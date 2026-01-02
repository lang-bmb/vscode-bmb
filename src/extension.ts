import * as path from 'path';
import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const config = vscode.workspace.getConfiguration('bmb');
    const serverPath = config.get<string>('serverPath', 'bmb');
    const traceServer = config.get<string>('trace.server', 'off');

    // Server options - run BMB compiler in LSP mode
    const serverOptions: ServerOptions = {
        command: serverPath,
        args: ['lsp'],
        transport: TransportKind.stdio,
        options: {
            env: { ...process.env, RUST_BACKTRACE: '1' }
        }
    };

    // Client options
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'bmb' }],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.bmb')
        },
        outputChannelName: 'BMB Language Server',
        traceOutputChannel: vscode.window.createOutputChannel('BMB Language Server Trace'),
        initializationOptions: {
            enableVerification: config.get<boolean>('enableVerification', true),
            formatOnSave: config.get<boolean>('formatOnSave', true)
        }
    };

    // Create and start the language client
    client = new LanguageClient(
        'bmb',
        'BMB Language Server',
        serverOptions,
        clientOptions
    );

    // Set trace level
    if (traceServer !== 'off') {
        client.setTrace(
            traceServer === 'verbose'
                ? vscode.Trace.Verbose
                : vscode.Trace.Messages
        );
    }

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('bmb.restartServer', async () => {
            if (client) {
                await client.stop();
                await client.start();
                vscode.window.showInformationMessage('BMB Language Server restarted');
            }
        }),

        vscode.commands.registerCommand('bmb.verify', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'bmb') {
                vscode.window.showWarningMessage('No BMB file is active');
                return;
            }

            // Save the document first
            await editor.document.save();

            // Trigger verification through LSP
            if (client) {
                try {
                    await client.sendRequest('bmb/verify', {
                        textDocument: {
                            uri: editor.document.uri.toString()
                        }
                    });
                    vscode.window.showInformationMessage('BMB verification complete');
                } catch (error) {
                    vscode.window.showErrorMessage(`Verification failed: ${error}`);
                }
            }
        }),

        vscode.commands.registerCommand('bmb.showAst', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'bmb') {
                vscode.window.showWarningMessage('No BMB file is active');
                return;
            }

            // Request AST from LSP
            if (client) {
                try {
                    const ast = await client.sendRequest('bmb/ast', {
                        textDocument: {
                            uri: editor.document.uri.toString()
                        }
                    });

                    // Show AST in a new document
                    const doc = await vscode.workspace.openTextDocument({
                        content: JSON.stringify(ast, null, 2),
                        language: 'json'
                    });
                    await vscode.window.showTextDocument(doc, { preview: true });
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to show AST: ${error}`);
                }
            }
        })
    );

    // Handle configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('bmb')) {
                const newConfig = vscode.workspace.getConfiguration('bmb');
                const newServerPath = newConfig.get<string>('serverPath', 'bmb');

                // Restart server if path changed
                if (newServerPath !== serverPath && client) {
                    await client.stop();
                    await client.start();
                }
            }
        })
    );

    // Start the client
    try {
        await client.start();
        console.log('BMB Language Server started');
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to start BMB Language Server: ${error}\n` +
            `Make sure 'bmb' is installed and in your PATH, or configure 'bmb.serverPath'.`
        );
    }
}

export async function deactivate(): Promise<void> {
    if (client) {
        await client.stop();
    }
}
