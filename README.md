# vscode-bmb

Visual Studio Code extension for BMB (Bare-Metal-Banter) programming language.

## Features

- **Syntax Highlighting**: Full syntax highlighting for BMB source files
- **Error Diagnostics**: Real-time error detection via LSP
- **Auto-completion**: Smart code completion
- **Go to Definition**: Navigate to symbol definitions
- **Find References**: Find all references to a symbol
- **Formatting**: Code formatting on save
- **Contract Verification**: Trigger SMT-based contract verification
- **Code Snippets**: 20+ snippets for common patterns

## Requirements

- [BMB Compiler](https://github.com/lang-bmb/lang-bmb) installed and in your PATH
- VS Code 1.85.0 or later

## Installation

### From VS Code Marketplace

Search for "BMB Language" in the VS Code Extensions panel.

### From VSIX

1. Download the `.vsix` file from the releases
2. In VS Code: `Extensions` → `...` → `Install from VSIX...`

### From Source

```bash
cd vscode-bmb
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `bmb.serverPath` | `"bmb"` | Path to the BMB compiler executable |
| `bmb.trace.server` | `"off"` | Trace communication with language server |
| `bmb.enableVerification` | `true` | Enable contract verification on save |
| `bmb.formatOnSave` | `true` | Format BMB files on save |

## Commands

| Command | Description |
|---------|-------------|
| `BMB: Restart Language Server` | Restart the BMB language server |
| `BMB: Verify Contracts` | Run SMT verification on the current file |
| `BMB: Show AST` | Display the AST of the current file |

## Snippets

| Prefix | Description |
|--------|-------------|
| `fn` | Simple function |
| `fnc` | Function with contracts |
| `fnb` | Function with block body |
| `pre` | Precondition |
| `post` | Postcondition |
| `let` | Let binding |
| `if` | If-then-else expression |
| `struct` | Struct definition |
| `enum` | Enum definition |
| `type` | Type alias |
| `typer` | Refinement type |
| `forall` | Universal quantifier |
| `exists` | Existential quantifier |
| `match` | Pattern matching |
| `@trust` | Trusted function |
| `@check` | Function with runtime check |
| `@test` | Test function |
| `@bench` | Benchmark function |
| `tailrec` | Tail-recursive pattern |
| `main` | Main entry point |

## Supported Syntax

### Keywords

- **Definition**: `fn`, `let`, `mut`, `struct`, `enum`, `type`, `mod`, `use`, `pub`
- **Control Flow**: `if`, `then`, `else`, `match`, `while`, `for`, `in`, `return`
- **Contracts**: `pre`, `post`, `invariant`, `where`, `modifies`, `decreases`
- **Memory**: `own`, `ref`, `move`, `copy`, `drop`, `linear`
- **Operators**: `and`, `or`, `not`, `forall`, `exists`

### Types

- **Primitives**: `i8`, `i16`, `i32`, `i64`, `i128`, `u8`, `u16`, `u32`, `u64`, `u128`, `f32`, `f64`, `bool`, `char`, `String`
- **References**: `&T`, `&mut T`
- **Arrays**: `[T; N]`
- **Unit**: `()`

### Special Identifiers

- `ret` - Return value in postconditions
- `it` - Self-reference in refinement types
- `old` - Previous value in postconditions

## Example

```bmb
// Function with contracts
fn factorial(n: i64) -> i64
  pre n >= 0
  post ret >= 1
= if n <= 1 then 1 else n * factorial(n - 1);

// Struct definition
struct Point {
  x: f64,
  y: f64,
}

// Enum with variants
enum Option<T> {
  Some(T),
  None,
}
```

## Development

### Build

```bash
npm install
npm run compile
```

### Test

```bash
npm test
```

### Package

```bash
npm run package
```

## Related

- [BMB Compiler](https://github.com/lang-bmb/lang-bmb) - Main compiler repository
- [BMB Playground](https://play.bmb-lang.org) - Try BMB online

## License

MIT
