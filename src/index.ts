import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";

export enum VisibilityLevel {
  Public = 1,
  Protected = 2,
  Private = 3,
}

export const ignoredPatterns: (string | RegExp)[] = [
  "node_modules",
  /\.git/,
  /\.vscode/,
  /\.DS_Store/,
  /\.test\.ts$/,
  /\.spec\.ts$/,
];

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
  visibilityLevel: VisibilityLevel,
): string {
  let output = "";

  function getMethodSignature(
    method: ts.MethodDeclaration | ts.ConstructorDeclaration,
  ): string {
    const parameters = method.parameters
      .map(
        (param) =>
          `${param.name.getText()}: ${typeChecker.typeToString(typeChecker.getTypeAtLocation(param))}`,
      )
      .join(", ");
    const returnType = method.type
      ? typeChecker.typeToString(typeChecker.getTypeAtLocation(method))
      : "void";
    return `(${parameters}): ${returnType}`;
  }

  function getVisibility(node: ts.Declaration | ts.VariableStatement): string {
    if (ts.isVariableStatement(node)) {
      return node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        ? "public"
        : "private";
    }
    const modifiers = ts.getCombinedModifierFlags(node);
    if (modifiers & ts.ModifierFlags.Private) return "private";
    if (modifiers & ts.ModifierFlags.Protected) return "protected";
    if (modifiers & ts.ModifierFlags.Export) return "public";
    return "private"; // Non-exported top-level declarations are considered private
  }

  function isVisibleEnough(visibility: string): boolean {
    switch (visibilityLevel) {
      case VisibilityLevel.Public:
        return visibility === "public";
      case VisibilityLevel.Protected:
        return visibility === "public" || visibility === "protected";
      case VisibilityLevel.Private:
        return true;
    }
  }

  ts.forEachChild(sourceFile, (node) => {
    if (
      ts.isExportDeclaration(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isVariableStatement(node)
    ) {
      let exportType = "";
      let name = "";
      let isDefault = false;
      let visibility = "private";

      if (
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node)
      ) {
        exportType = ts.isFunctionDeclaration(node)
          ? "function"
          : ts.isClassDeclaration(node)
            ? "class"
            : "interface";
        name = node.name ? node.name.text : "<anonymous>";
        isDefault = !!(
          ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Default
        );
        visibility = getVisibility(node);
      } else if (ts.isVariableStatement(node)) {
        const declaration = node.declarationList.declarations[0];
        if (ts.isIdentifier(declaration.name)) {
          exportType = "const";
          name = declaration.name.text;
          visibility = getVisibility(node);
        }
      }

      const shouldInclude = isVisibleEnough(visibility);

      if (name && shouldInclude) {
        const visibilityPrefix =
          visibility !== "public" ? `${visibility} ` : "";
        output += `└─ ${isDefault ? "export default " : ""}${visibilityPrefix}${exportType} ${name}`;

        if (ts.isClassDeclaration(node)) {
          output += "\n";
          node.members.forEach((member) => {
            if (
              ts.isMethodDeclaration(member) ||
              ts.isConstructorDeclaration(member)
            ) {
              const methodName = ts.isConstructorDeclaration(member)
                ? "constructor"
                : member.name.getText();
              const memberVisibility = getVisibility(member);
              if (isVisibleEnough(memberVisibility)) {
                const memberVisibilityPrefix =
                  memberVisibility !== "public" ? `${memberVisibility} ` : "";
                output += `   ├─ ${memberVisibilityPrefix}${methodName}${getMethodSignature(member)}\n`;
              }
            }
          });
        } else if (ts.isFunctionDeclaration(node)) {
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
  visibilityLevel: VisibilityLevel,
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
        visibilityLevel,
        continuationPrefix,
      );
      if (subDirContent.trim()) {
        output += `${newPrefix}${entry.name}/\n${subDirContent}`;
      }
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      output += `${newPrefix}${entry.name}\n`;
      const sourceFile = program.getSourceFile(fullPath);
      if (sourceFile) {
        const fileContent = analyzeFile(
          sourceFile,
          program.getTypeChecker(),
          visibilityLevel,
        );
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
  visibilityLevel: VisibilityLevel = VisibilityLevel.Public,
) {
  const program = createProgram(rootDir);
  const output = traverseDirectory(
    rootDir,
    program,
    shouldIgnore.bind(null, ignored),
    visibilityLevel,
  );
  console.log(output);
}
