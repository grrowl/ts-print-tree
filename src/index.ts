import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";

const TS_FILE_MATCH = /\.tsx?$/;

export enum VisibilityLevel {
  Public = "public",
  Protected = "protected",
  Private = "private",
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
  visibility?: VisibilityLevel;
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

  function getMethodSignature(node: ts.Node): string {
    if (ts.isFunctionLike(node)) {
      const signature = typeChecker.getSignatureFromDeclaration(node);
      if (signature) {
        return typeChecker.signatureToString(signature);
      }
    }
    return typeChecker.typeToString(typeChecker.getTypeAtLocation(node));
  }

  // Helper function to check if a node is an exported declaration
  function isExportedDeclaration(node: ts.Node): boolean {
    return (
      (ts.isVariableStatement(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node)) &&
      node.modifiers !== undefined &&
      node.modifiers.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    );
  }

  function isVisibleEnough(visibility: VisibilityLevel): boolean {
    switch (visibilityLevel) {
      case VisibilityLevel.Public:
        return visibility === VisibilityLevel.Public;
      case VisibilityLevel.Protected:
        return (
          visibility === VisibilityLevel.Public ||
          visibility === VisibilityLevel.Protected
        );
      case VisibilityLevel.Private:
        return true;
    }
  }

  function getVisibility(node: ts.Node): VisibilityLevel {
    // Check for explicit modifiers
    if (ts.canHaveModifiers(node)) {
      const modifiers = ts.getModifiers(node);
      if (modifiers) {
        if (modifiers.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword))
          return VisibilityLevel.Private;
        if (modifiers.some((m) => m.kind === ts.SyntaxKind.ProtectedKeyword))
          return VisibilityLevel.Protected;
        if (modifiers.some((m) => m.kind === ts.SyntaxKind.PublicKeyword))
          return VisibilityLevel.Public;
      }
    }

    // Check for exports
    if (
      ts.isExportAssignment(node) || // export default ...
      ts.isExportDeclaration(node) || // export { ... } or export * from ...
      (ts.isVariableStatement(node) &&
        node.modifiers?.some(
          (mod) => mod.kind === ts.SyntaxKind.ExportKeyword,
        )) || // export const ...
      (ts.isFunctionDeclaration(node) &&
        node.modifiers?.some(
          (mod) => mod.kind === ts.SyntaxKind.ExportKeyword,
        )) || // export function ...
      (ts.isClassDeclaration(node) &&
        node.modifiers?.some(
          (mod) => mod.kind === ts.SyntaxKind.ExportKeyword,
        )) || // export class ...
      (ts.isInterfaceDeclaration(node) &&
        node.modifiers?.some(
          (mod) => mod.kind === ts.SyntaxKind.ExportKeyword,
        )) || // export interface ...
      (ts.isTypeAliasDeclaration(node) &&
        node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) // export type ...
    ) {
      return VisibilityLevel.Public;
    }

    // For class members, default to "public" if not explicitly marked
    if (ts.isClassElement(node)) {
      return VisibilityLevel.Public;
    }

    // Default to "private" for other non-exported declarations
    return VisibilityLevel.Private;
  }

  function handleClassMembers(node: ts.ClassDeclaration): TreeNode[] {
    return node.members
      .filter(
        (member): member is ts.ClassElement & { name?: ts.PropertyName } =>
          (ts.isMethodDeclaration(member) ||
            ts.isConstructorDeclaration(member) ||
            ts.isPropertyDeclaration(member) ||
            ts.isGetAccessor(member) ||
            ts.isSetAccessor(member)) &&
          isVisibleEnough(getVisibility(member)),
      )
      .map((member): TreeNode => {
        const isStatic = member.modifiers?.some(
          (mod) => mod.kind === ts.SyntaxKind.StaticKeyword,
        );
        const visibility = getVisibility(member);
        let name = ts.isConstructorDeclaration(member)
          ? "constructor"
          : ts.isGetAccessor(member)
            ? `get ${member.name.getText()}`
            : ts.isSetAccessor(member)
              ? `set ${member.name.getText()}`
              : member.name?.getText() || "<anonymous>";

        if (isStatic) {
          name = `static ${name}`;
        }

        return {
          name,
          type:
            ts.isMethodDeclaration(member) ||
            ts.isConstructorDeclaration(member) ||
            ts.isGetAccessor(member) ||
            ts.isSetAccessor(member)
              ? "method"
              : "property",
          visibility,
          signature: getMethodSignature(member),
        };
      });
  }

  ts.forEachChild(sourceFile, (node) => {
    let exportNode: TreeNode | null = null;

    if (ts.isVariableStatement(node)) {
      const isExport =
        node.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        ) ?? false;
      const declarations = node.declarationList.declarations;
      for (const declaration of declarations) {
        if (ts.isIdentifier(declaration.name)) {
          const name = declaration.name.text;
          const visibility = isExport
            ? VisibilityLevel.Public
            : getVisibility(node);
          if (isVisibleEnough(visibility)) {
            const isDefault =
              node.modifiers?.some(
                (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
              ) ?? false;
            const signature = getMethodSignature(declaration);
            exportNode = {
              name,
              type: "const",
              visibility,
              isDefault,
              signature,
            };
            nodes.push(exportNode);
          }
        }
      }
    } else if (
      ts.isInterfaceDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isFunctionDeclaration(node)
    ) {
      const name = node.name ? node.name.text : "<anonymous>";
      const visibility = getVisibility(node);
      if (isVisibleEnough(visibility)) {
        const type = ts.isInterfaceDeclaration(node)
          ? "interface"
          : ts.isClassDeclaration(node)
            ? "class"
            : "function";
        exportNode = {
          name,
          type,
          visibility,
          signature: type === "function" ? getMethodSignature(node) : undefined,
          children:
            type === "class"
              ? handleClassMembers(node as ts.ClassDeclaration)
              : undefined,
        };
        nodes.push(exportNode);
      }
    } else if (ts.isExportAssignment(node)) {
      // Handle default exports
      const name = "default";
      const visibility = VisibilityLevel.Public;
      let type: TreeNode["type"] = "const";
      let signature: string | undefined;

      if (ts.isIdentifier(node.expression)) {
        const symbol = typeChecker.getSymbolAtLocation(node.expression);
        if (symbol && symbol.declarations && symbol.declarations.length > 0) {
          const declaration = symbol.declarations[0];
          if (
            ts.isFunctionDeclaration(declaration) ||
            ts.isArrowFunction(declaration)
          ) {
            type = "function";
            signature = getMethodSignature(declaration);
          } else {
            signature = typeChecker.typeToString(
              typeChecker.getTypeAtLocation(node.expression),
            );
          }
        }
      } else if (ts.isObjectLiteralExpression(node.expression)) {
        signature = "{...}";
      } else if (
        ts.isFunctionExpression(node.expression) ||
        ts.isArrowFunction(node.expression)
      ) {
        type = "function";
        signature = getMethodSignature(node.expression);
      } else {
        signature = node.expression.getText();
      }

      exportNode = {
        name,
        type,
        visibility,
        isDefault: true,
        signature,
      };
      nodes.push(exportNode);
    } else if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          const name = element.name.text;
          const propertyName = element.propertyName?.text;
          const signature = typeChecker.typeToString(
            typeChecker.getTypeAtLocation(element),
          );
          exportNode = {
            name: propertyName ? `${propertyName} as ${name}` : name,
            type: "const",
            visibility: VisibilityLevel.Public,
            isDefault: false,
            signature,
          };
          nodes.push(exportNode);
        }
      } else if (node.moduleSpecifier) {
        // Handle re-exports
        const moduleName = node.moduleSpecifier.getText().slice(1, -1); // Remove quotes
        exportNode = {
          name: `* from "${moduleName}"`,
          type: "const",
          visibility: VisibilityLevel.Public,
          isDefault: false,
          signature: `module "${moduleName}"`,
        };
        nodes.push(exportNode);
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
      (entry.isDirectory() ||
        (entry.isFile() && TS_FILE_MATCH.test(entry.name)))
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
