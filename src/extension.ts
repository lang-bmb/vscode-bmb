import * as path from 'path';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    Trace
} from 'vscode-languageclient/node';

const execAsync = promisify(exec);
let client: LanguageClient | undefined;
let diagnosticCollection: vscode.DiagnosticCollection;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const config = vscode.workspace.getConfiguration('bmb');
    const serverPath = config.get<string>('serverPath', 'bmb');
    const lspServerPath = config.get<string>('lspServerPath', '');
    const traceServer = config.get<string>('trace.server', 'off');

    // Server options — choose between self-hosted BMB LSP or Rust-based server
    let serverOptions: ServerOptions;
    if (lspServerPath) {
        // Self-hosted BMB LSP server (bmb-lsp binary)
        // BMB_PATH tells the server where to find the bmb compiler for diagnostics/formatting
        serverOptions = {
            command: lspServerPath,
            args: [],
            transport: TransportKind.stdio,
            options: {
                env: { ...process.env, BMB_PATH: serverPath }
            }
        };
    } else {
        // Rust-based LSP server (bmb lsp subcommand)
        serverOptions = {
            command: serverPath,
            args: ['lsp'],
            transport: TransportKind.stdio,
            options: {
                env: { ...process.env, RUST_BACKTRACE: '1' }
            }
        };
    }

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
                ? Trace.Verbose
                : Trace.Messages
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
        }),

        // BMB Format command
        vscode.commands.registerCommand('bmb.format', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'bmb') {
                vscode.window.showWarningMessage('No BMB file is active');
                return;
            }

            try {
                const filePath = editor.document.uri.fsPath;
                const bmbPath = config.get<string>('serverPath', 'bmb');
                const { stdout } = await execAsync(`"${bmbPath}" run tools/bmb-fmt/main.bmb "${filePath}"`);

                // Replace document content with formatted output
                const fullRange = new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(editor.document.getText().length)
                );
                await editor.edit(editBuilder => {
                    editBuilder.replace(fullRange, stdout);
                });
                vscode.window.showInformationMessage('BMB file formatted');
            } catch (error) {
                vscode.window.showErrorMessage(`Format failed: ${error}`);
            }
        }),

        // BMB Lint command
        vscode.commands.registerCommand('bmb.lint', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'bmb') {
                vscode.window.showWarningMessage('No BMB file is active');
                return;
            }

            try {
                const filePath = editor.document.uri.fsPath;
                const bmbPath = config.get<string>('serverPath', 'bmb');
                const { stdout } = await execAsync(`"${bmbPath}" run tools/bmb-lint/main.bmb "${filePath}"`);

                // Parse lint output and show diagnostics
                const diagnostics: vscode.Diagnostic[] = [];
                const lines = stdout.split('\n');
                for (const line of lines) {
                    const match = line.match(/^([WI]\d+)\|(\d+)\|(.+)$/);
                    if (match) {
                        const [, code, lineNum, message] = match;
                        const lineIndex = parseInt(lineNum, 10) - 1;
                        const severity = code.startsWith('W')
                            ? vscode.DiagnosticSeverity.Warning
                            : vscode.DiagnosticSeverity.Information;
                        const range = new vscode.Range(lineIndex, 0, lineIndex, 1000);
                        diagnostics.push(new vscode.Diagnostic(range, `[${code}] ${message}`, severity));
                    }
                }
                diagnosticCollection.set(editor.document.uri, diagnostics);
                vscode.window.showInformationMessage(`Lint complete: ${diagnostics.length} issue(s) found`);
            } catch (error) {
                vscode.window.showErrorMessage(`Lint failed: ${error}`);
            }
        }),

        // BMB Check command
        vscode.commands.registerCommand('bmb.check', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'bmb') {
                vscode.window.showWarningMessage('No BMB file is active');
                return;
            }

            try {
                const filePath = editor.document.uri.fsPath;
                const bmbPath = config.get<string>('serverPath', 'bmb');
                const { stdout, stderr } = await execAsync(`"${bmbPath}" check "${filePath}"`);

                const output = stdout + stderr;
                if (output.includes('"type":"error"')) {
                    vscode.window.showErrorMessage('Type check failed - see Problems panel');
                } else if (output.includes('"type":"warning"')) {
                    vscode.window.showWarningMessage('Type check passed with warnings');
                } else {
                    vscode.window.showInformationMessage('Type check passed');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Type check failed: ${error}`);
            }
        }),

        // BMB Generate Docs command
        vscode.commands.registerCommand('bmb.generateDocs', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'bmb') {
                vscode.window.showWarningMessage('No BMB file is active');
                return;
            }

            try {
                const filePath = editor.document.uri.fsPath;
                const bmbPath = config.get<string>('serverPath', 'bmb');
                const { stdout } = await execAsync(`"${bmbPath}" run tools/bmb-doc/main.bmb "${filePath}"`);

                // Show documentation in a new markdown document
                const doc = await vscode.workspace.openTextDocument({
                    content: stdout,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc, { preview: true });
            } catch (error) {
                vscode.window.showErrorMessage(`Documentation generation failed: ${error}`);
            }
        })
    );

    // Create diagnostic collection for lint results
    diagnosticCollection = vscode.languages.createDiagnosticCollection('bmb-lint');
    context.subscriptions.push(diagnosticCollection);

    // Handle configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('bmb')) {
                const newConfig = vscode.workspace.getConfiguration('bmb');
                const newServerPath = newConfig.get<string>('serverPath', 'bmb');
                const newLspPath = newConfig.get<string>('lspServerPath', '');

                // Restart server if any path changed
                if ((newServerPath !== serverPath || newLspPath !== lspServerPath) && client) {
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
        const serverInfo = lspServerPath
            ? `Self-hosted LSP: ${lspServerPath}`
            : `Rust LSP: ${serverPath} lsp`;
        vscode.window.showErrorMessage(
            `Failed to start BMB Language Server (${serverInfo}): ${error}\n` +
            `Configure 'bmb.serverPath' (compiler) and optionally 'bmb.lspServerPath' (self-hosted LSP binary).`
        );
    }
}

export async function deactivate(): Promise<void> {
    if (client) {
        await client.stop();
    }
}
