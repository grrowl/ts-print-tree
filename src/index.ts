import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";

// Function to read tsconfig.json
function readTsConfig(rootDir: string): ts.ParsedCommandLine {
  const configPath = ts.findConfigFile(
    rootDir,
    ts.sys.fileExists,
    "tsconfig.json",
  );
  if (!configPath) {
    throw new Error("Could not find a valid 'tsconfig.json'.");
  }
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  return ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
  );
}

// Function to create a Program instance
function createProgram(rootDir: string): ts.Program {
  const config = readTsConfig(rootDir);
  return ts.createProgram(config.fileNames, config.options);
}

// Function to analyze a TypeScript file
function analyzeFile(
  sourceFile: ts.SourceFile,
  typeChecker: ts.TypeChecker,
): string {
  let output = "";

  ts.forEachChild(sourceFile, (node) => {
    if (
      ts.isExportDeclaration(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isClassDeclaration(node)
    ) {
      if (node.name) {
        output += `     └─ ${node.name.text}`;
        if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
          const signature = typeChecker.getSignatureFromDeclaration(node);
          if (signature) {
            const parameters = signature
              .getParameters()
              .map(
                (param) =>
                  `${param.getName()}: ${typeChecker.typeToString(typeChecker.getTypeOfSymbolAtLocation(param, param.valueDeclaration!))}`,
              )
              .join(", ");
            const returnType = typeChecker.typeToString(
              signature.getReturnType(),
            );
            output += `(${parameters}): ${returnType}`;
          }
        }
        output += "\n";
      }
    }
  });

  return output;
}

// Function to traverse directory and generate tree-like output
function traverseDirectory(
  dir: string,
  program: ts.Program,
  shouldIgnore: (path: string) => boolean,
  prefix = "",
): string {
  let output = "";
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  entries.forEach((entry, index) => {
    const fullPath = path.join(dir, entry.name);

    if (shouldIgnore(fullPath)) {
      return;
    }

    const isLast = index === entries.length - 1;
    const newPrefix = prefix + (isLast ? "└─ " : "├─ ");

    if (entry.isDirectory()) {
      output += `${newPrefix}${entry.name}/\n`;
      output += traverseDirectory(
        fullPath,
        program,
        shouldIgnore,
        prefix + (isLast ? "   " : "│  "),
      );
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !shouldIgnore(fullPath)
    ) {
      output += `${newPrefix}${entry.name}\n`;
      const sourceFile = program.getSourceFile(fullPath);
      if (sourceFile) {
        output += analyzeFile(sourceFile, program.getTypeChecker());
      }
    }
  });

  return output;
}

// Function to check if a path should be ignored
function shouldIgnore(
  ignoredPatterns: (string | RegExp)[],
  pathToCheck: string,
): boolean {
  const relativePath = path.relative(process.cwd(), pathToCheck);
  return ignoredPatterns.some((pattern) => {
    // console.log(pattern, relativePath);
    if (typeof pattern === "string") {
      return relativePath.includes(pattern);
    }
    return pattern.test(relativePath);
  });
}

const ignoredPatterns: (string | RegExp)[] = [
  "node_modules",
  /\.git/,
  /\.vscode/,
  /\.DS_Store/,
  /\.test\.ts$/,
  /\.spec\.ts$/,
];

export function tree(
  rootDir: string = process.cwd(),
  ignored: (string | RegExp)[] = ignoredPatterns,
) {
  const program = createProgram(rootDir);
  const output = traverseDirectory(
    rootDir,
    program,
    shouldIgnore.bind(null, ignored),
  );
  console.log(output);
}
