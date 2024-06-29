# 🌳 ts-print-tree

## Overview

ts-print-tree is a command-line tool that generates a tree-like representation of your TypeScript project structure, including exported members and their signatures. It's perfect for quickly understanding the layout and API of a TypeScript project, or a concise way of summarising your project's structure to AI models like ChatGPT or Claude.

## 🚀 Features

- Generates a tree-like view of your TypeScript project structure
- Lists exported members (functions, classes, interfaces) from each file
- Displays function signatures with parameter types and return types
- Ignores common directories and files (e.g., node_modules, .git)
- Customizable ignore patterns

## 🤖 Why Use ts-print-tree?

- Quickly grasp the structure of a new or unfamiliar TypeScript project
- Generate project descriptions for documentation purposes
- Create input for AI models like ChatGPT or Claude to assist with project understanding and development
- Easily share project structure with team members or stakeholders

## 📦 Installation

No installation required! You can run ts-print-tree directly using `npx` or `bunx`.

## 🛠️ Usage

Navigate to the root of your TypeScript project (where your `tsconfig.json` is located) and run:

```
npx ts-print-tree
```

or if you prefer to use Bun:

```
bunx ts-print-tree
```

The tool will output a tree-like structure of your project, including files, directories, and exported members.

## 📋 Example Output

```
├─ src/
│  ├─ index.ts
│  │  └─ main(): void
│  ├─ utils/
│  │  └─ helper.ts
│  │     └─ formatDate(date: Date): string
```

## 🔧 Customization

You can customize ignored patterns by passing them as arguments to the CLI command. For example:

```
npx ts-print-tree -- --ignore "__snapshots__"  --ignore "/\\.(test|spec)\\.ts$/"
```

This will ignore files and directories of __snapshots__ or ending with `.test.ts` or `.spec.ts`.

You can also set your project directory with the `--cwd` option:

```
npx ts-print-tree -- --cwd ./my-project
```

By default, only public members are shown. You can include protected and private members using the `--protected` and `--private` flags, respectively:

 ```
npx ts-print-tree -- --private
```

## 📚 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🙏 Acknowledgments

- TypeScript team for the excellent Compiler API
- All the open-source contributors who inspire projects like this

Happy exploring! 🕵️‍♀️🌟
<!--
```

This revised README focuses on the CLI usage of `ts-print-tree`, removes mention of the programmatic API, updates the license to ISC, and adjusts the example output as requested. It also includes information about running with both `npx` and `bunx`.
-->
