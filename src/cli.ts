#!/usr/bin/env node

import { readFileSync } from "fs";
import { join } from "path";
import { tree, VisibilityLevel, TreeNode } from ".";

const args = process.argv.slice(2);

const defaultIgnore = [
  "node_modules",
  /\.git/,
  /\.vscode/,
  /\.DS_Store/,
  /\.test\.ts$/,
  /\.spec\.ts$/,
];

function printHelp() {
  console.log("Usage: ts-print-tree [options]");
  console.log("--help       Show help");
  console.log("--version    Show version number");
  console.log("--ignore     Ignore files matching the specified patterns");
  console.log("--no-default Don't include default ignore patterns");
  console.log("--cwd        Set the current working directory");
  console.log("--protected  Include protected members");
  console.log("--private    Include private members");
  console.log("--tree       Output as tree (default)");
  console.log("--list       Output as markdown list");
}

function printVersion() {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, "../package.json"), "utf-8"),
  );
  console.log(`Version: ${packageJson.version}`);
}

export const pathFilter =
  (ignorePatterns: (string | RegExp)[]) => (path: string) =>
    !ignorePatterns.some((pattern) =>
      typeof pattern === "string" ? path.includes(pattern) : pattern.test(path),
    );

function formatNodeName(node: TreeNode): string {
  const visibilityPrefix =
    node.visibility && node.visibility !== "public"
      ? `${node.visibility} `
      : "";
  const typePrefix =
    node.type !== "directory" && node.type !== "file" ? `${node.type} ` : "";
  return `${visibilityPrefix}${typePrefix}${node.name}`;
}

export function formatAsTree(
  node: TreeNode,
  prefix = "",
  isLast = true,
  isRoot = true,
): string {
  const formattedName = formatNodeName(node);
  let output = isRoot
    ? `${formattedName}${node.signature ? node.signature : ""}\n`
    : `${prefix}${isLast ? "└── " : "├── "}${formattedName}${node.signature ? node.signature : ""}\n`;

  if (node.children) {
    node.children.forEach((child, index) => {
      const isLastChild = index === node.children!.length - 1;
      const newPrefix = isRoot ? "" : prefix + (isLast ? "    " : "│   ");
      output += formatAsTree(child, newPrefix, isLastChild, false);
    });
  }
  return output;
}

export function formatAsList(node: TreeNode, depth = 0): string {
  const formattedName = formatNodeName(node);
  let output = `${"  ".repeat(depth)}${depth === 0 ? "" : "- "}${formattedName}${node.signature ? node.signature : ""}\n`;
  if (node.children) {
    node.children.forEach((child) => {
      output += formatAsList(child, depth + 1);
    });
  }
  return output;
}

if (args.includes("--help")) {
  printHelp();
} else if (args.includes("--version")) {
  printVersion();
} else {
  const ignoreIndex = args.indexOf("--ignore");
  let ignorePatterns: (string | RegExp)[] = [];
  let cwd = process.cwd();
  let visibilityLevel = VisibilityLevel.Public;
  let outputFormat: "tree" | "list" = "tree";

  if (ignoreIndex !== -1) {
    ignorePatterns = args
      .slice(ignoreIndex + 1)
      .filter((pat) => !pat.startsWith("--"))
      .map((pat) =>
        pat.startsWith("/") && pat.endsWith("/") && pat.includes("i")
          ? new RegExp(pat.slice(1, -2), "i")
          : pat.startsWith("/") && pat.endsWith("/")
            ? new RegExp(pat.slice(1, -1))
            : pat,
      );
  }

  if (!args.includes("--no-default")) {
    ignorePatterns.push(...defaultIgnore);
  }

  const cwdIndex = args.indexOf("--cwd");
  if (cwdIndex !== -1 && args[cwdIndex + 1]) {
    cwd = args[cwdIndex + 1];
  }

  if (args.includes("--private")) {
    visibilityLevel = VisibilityLevel.Private;
  } else if (args.includes("--protected")) {
    visibilityLevel = VisibilityLevel.Protected;
  }

  if (args.includes("--list")) {
    outputFormat = "list";
  }

  const projectStructure = tree(
    cwd,
    pathFilter(ignorePatterns),
    visibilityLevel,
  );

  const output =
    outputFormat === "tree"
      ? formatAsTree(projectStructure)
      : formatAsList(projectStructure);

  console.log(output);
}
