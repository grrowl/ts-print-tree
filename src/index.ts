import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";

export enum VisibilityLevel {
  Public = 1,
  Protected = 2,
  Private = 3,
}

export interface TreeNode {
  name: string;
  type:
    | "directory"
    | "file"
    | "function"
    | "class"
    | "method"
    | "property"
    | "interface"
    | "const";
  visibility?: "public" | "protected" | "private";
  signature?: string;
  children?: TreeNode[];
  isDefault?: boolean;
}

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
): TreeNode[] {
  const nodes: TreeNode[] = [];

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

  function getVisibility(node: ts.Node): string {
    if (ts.isClassElement(node)) {
      if (node.modifiers) {
        if (node.modifiers.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword))
          return "private";
        if (
          node.modifiers.some((m) => m.kind === ts.SyntaxKind.ProtectedKeyword)
        )
          return "protected";
      }
      return "public"; // Class members are public by default if not explicitly marked
    }

    if (
      ts.isVariableStatement(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node)
    ) {
      if (node.modifiers) {
        if (node.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
          return "public";
      }
      return "private"; // Non-exported top-level declarations are considered private
    }

    return "private"; // Default to private if we can't determine visibility
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
      let exportType: TreeNode["type"] = "const";
      let name = "";
      let isDefault = false;
      let visibility: TreeNode["visibility"] = "private";

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
        visibility = getVisibility(node) as TreeNode["visibility"];
      } else if (ts.isVariableStatement(node)) {
        const declaration = node.declarationList.declarations[0];
        if (ts.isIdentifier(declaration.name)) {
          exportType = "const";
          name = declaration.name.text;
          visibility = getVisibility(node) as TreeNode["visibility"];
          // Check if this is a default export
          isDefault =
            node.modifiers?.some(
              (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
            ) &&
            node.modifiers?.some(
              (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
            );
        }
      }

      const shouldInclude = isVisibleEnough(visibility);

      if (name && shouldInclude) {
        const treeNode: TreeNode = {
          name,
          type: exportType,
          visibility,
          isDefault,
        };

        if (ts.isClassDeclaration(node)) {
          treeNode.children = node.members
            .filter(
              (member) =>
                (ts.isMethodDeclaration(member) ||
                  ts.isConstructorDeclaration(member) ||
                  ts.isPropertyDeclaration(member)) &&
                isVisibleEnough(getVisibility(member)),
            )
            .map(
              (member): TreeNode => ({
                name: ts.isConstructorDeclaration(member)
                  ? "constructor"
                  : ts.isPropertyDeclaration(member)
                    ? member.name.getText()
                    : (member.name as ts.Identifier).text,
                type:
                  ts.isMethodDeclaration(member) ||
                  ts.isConstructorDeclaration(member)
                    ? "method"
                    : "property",
                visibility: getVisibility(member) as TreeNode["visibility"],
                signature:
                  ts.isMethodDeclaration(member) ||
                  ts.isConstructorDeclaration(member)
                    ? getMethodSignature(
                        member as
                          | ts.MethodDeclaration
                          | ts.ConstructorDeclaration,
                      )
                    : undefined,
              }),
            );
        } else if (ts.isFunctionDeclaration(node)) {
          const signature = typeChecker.getSignatureFromDeclaration(node);
          if (signature) {
            treeNode.signature = `(${signature
              .getParameters()
              .map(
                (param) =>
                  `${param.getName()}: ${typeChecker.typeToString(typeChecker.getTypeOfSymbolAtLocation(param, param.valueDeclaration!))}`,
              )
              .join(
                ", ",
              )}): ${typeChecker.typeToString(signature.getReturnType())}`;
          }
        }

        nodes.push(treeNode);
      }
    }
  });

  return nodes;
}

function traverseDirectory(
  dir: string,
  program: ts.Program,
  pathFilter: (path: string) => boolean,
  visibilityLevel: VisibilityLevel,
): TreeNode {
  const rootNode: TreeNode = {
    name: path.basename(dir) + "/",
    type: "directory",
    children: [],
  };
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  const relevantEntries = entries.filter((entry) => {
    const fullPath = path.join(dir, entry.name);
    return (
      pathFilter(fullPath) &&
      (entry.isDirectory() || (entry.isFile() && entry.name.endsWith(".ts")))
    );
  });

  relevantEntries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const subDirNode = traverseDirectory(
        fullPath,
        program,
        pathFilter,
        visibilityLevel,
      );
      if (subDirNode.children && subDirNode.children.length > 0) {
        rootNode.children!.push(subDirNode);
      }
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      const fileNode: TreeNode = {
        name: entry.name,
        type: "file",
        children: [],
      };
      const sourceFile = program.getSourceFile(fullPath);
      if (sourceFile) {
        fileNode.children = analyzeFile(
          sourceFile,
          program.getTypeChecker(),
          visibilityLevel,
        );
      }
      if (fileNode.children && fileNode.children.length > 0) {
        rootNode.children!.push(fileNode);
      }
    }
  });

  return rootNode;
}

export function tree(
  rootDir: string = process.cwd(),
  pathFilter: (path: string) => boolean = () => true,
  visibilityLevel: VisibilityLevel = VisibilityLevel.Public,
): TreeNode {
  const program = createProgram(rootDir);
  return traverseDirectory(rootDir, program, pathFilter, visibilityLevel);
}
