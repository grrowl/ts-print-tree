import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";
import { ignoredPatterns } from "./defaults";

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
  if (configFile.error) {
    throw new Error(
      `Error reading tsconfig.json: ${configFile.error.messageText}`,
    );
  }
  return ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
  );
}

function createProgram(rootDir: string): ts.Program {
  const config = readTsConfig(rootDir);
  return ts.createProgram(config.fileNames, config.options);
}

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
        let exportType = "export";
        if (ts.isFunctionDeclaration(node)) exportType = "function";
        if (ts.isClassDeclaration(node)) exportType = "class";
        if (ts.isInterfaceDeclaration(node)) exportType = "interface";

        output += `└─ ${exportType} ${node.name.text}`;
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

function traverseDirectory(
  dir: string,
  program: ts.Program,
  shouldIgnore: (path: string) => boolean,
  prefix = "",
): string {
  let output = "";
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  const relevantEntries = entries.filter((entry) => {
    const fullPath = path.join(dir, entry.name);
    return (
      !shouldIgnore(fullPath) &&
      (entry.isDirectory() || (entry.isFile() && entry.name.endsWith(".ts")))
    );
  });

  relevantEntries.forEach((entry, index) => {
    const fullPath = path.join(dir, entry.name);
    const isLast = index === relevantEntries.length - 1;
    const newPrefix = prefix + (isLast ? "└─ " : "├─ ");
    const continuationPrefix = prefix + (isLast ? "   " : "│  ");

    if (entry.isDirectory()) {
      const subDirContent = traverseDirectory(
        fullPath,
        program,
        shouldIgnore,
        continuationPrefix,
      );
      if (subDirContent.trim()) {
        output += `${newPrefix}${entry.name}/\n${subDirContent}`;
      }
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      output += `${newPrefix}${entry.name}\n`;
      const sourceFile = program.getSourceFile(fullPath);
      if (sourceFile) {
        const fileContent = analyzeFile(sourceFile, program.getTypeChecker());
        if (fileContent.trim()) {
          output +=
            fileContent
              .split("\n")
              .filter((line) => line.trim())
              .map((line) => continuationPrefix + line)
              .join("\n") + "\n";
        }
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
