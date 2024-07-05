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
ts-print-tree/
├── src/
│   ├── index.ts
│   │   └── function main(): void
│   └── utils/
│       └── helper.ts
│           └── function formatDate(date: Date): string
```

More comprehensive example output can be found in the [test snapshots for this very project](https://github.com/grrowl/ts-print-tree/blob/main/src/__snapshots__/index.test.ts.snap).

## 🔧 Customization

You can customize ignored patterns and output format by passing arguments to the CLI command. For example:

```
npx ts-print-tree -- --ignore "docs" --ignore "/\\.(test|spec)\\.ts$/" --list --private
```

This will ignore files and directories of docs or ending with `.test.ts` or `.spec.ts`, include private members, and output in list format (which is more efficient for LLM usage).

Run `npx ts-print-tree -- --help` to see all available options.

## 🧰 Programmatic Usage

You can also use ts-print-tree programmatically in your TypeScript projects:

```typescript
import { tree, VisibilityLevel } from 'ts-print-tree';

const projectStructure = tree(
  process.cwd(),
  (path) => !path.includes('node_modules'),
  VisibilityLevel.Public
);

console.log(JSON.stringify(projectStructure, null, 2));
```

This will give you a structured representation of your project that you can further process or format as needed.

## 📚 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the ISC License - I hope you find it useful!

## 🙏 Acknowledgments

- TypeScript team for the excellent Compiler API
- All the open-source contributors who inspire projects like this

Happy exploring! 🕵️‍♀️🌟
