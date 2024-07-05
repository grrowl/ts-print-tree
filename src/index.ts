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
      .map(
        (member): TreeNode => ({
          name: ts.isConstructorDeclaration(member)
            ? "constructor"
            : ts.isGetAccessor(member)
              ? `get ${member.name.getText()}`
              : ts.isSetAccessor(member)
                ? `set ${member.name.getText()}`
                : member.name?.getText() || "<anonymous>",
          type:
            ts.isMethodDeclaration(member) ||
            ts.isConstructorDeclaration(member) ||
            ts.isGetAccessor(member) ||
            ts.isSetAccessor(member)
              ? "method"
              : "property",
          visibility: getVisibility(member),
          signature: getMethodSignature(member),
        }),
      );
  }

  ts.forEachChild(sourceFile, (node) => {
    let exportNode: TreeNode | null = null;

    if (ts.isExportAssignment(node)) {
      // Handle `export default ...` cases
      const expression = node.expression;
      const name = "default";
      const isDefault = true;
      let type: TreeNode["type"] = "const";
      let signature: string | undefined;

      if (ts.isIdentifier(expression)) {
        signature = typeChecker.typeToString(
          typeChecker.getTypeAtLocation(expression),
        );
      } else if (ts.isObjectLiteralExpression(expression)) {
        signature = "{...}";
      } else if (
        ts.isFunctionExpression(expression) ||
        ts.isArrowFunction(expression)
      ) {
        type = "function";
        signature = getMethodSignature(expression);
      } else if (
        ts.isStringLiteral(expression) ||
        ts.isNumericLiteral(expression) ||
        expression.kind === ts.SyntaxKind.TrueKeyword ||
        expression.kind === ts.SyntaxKind.FalseKeyword ||
        expression.kind === ts.SyntaxKind.NullKeyword
      ) {
        signature = expression.getText();
      }

      exportNode = {
        name,
        type,
        visibility: VisibilityLevel.Public,
        isDefault,
        signature,
      };
    } else if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node)
    ) {
      const name = node.name ? node.name.text : "<anonymous>";
      const isDefault = !!(
        ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Default
      );
      const visibility = getVisibility(node);
      let type: TreeNode["type"] = "const";
      let signature: string | undefined;

      if (ts.isFunctionDeclaration(node)) {
        type = "function";
        signature = getMethodSignature(node);
      } else if (ts.isClassDeclaration(node)) {
        type = "class";
        signature = "class";
        exportNode = {
          name,
          type,
          visibility,
          isDefault,
          signature,
          children: handleClassMembers(node),
        };
      } else {
        type = "interface";
        signature = "interface";
      }

      if (!exportNode) {
        exportNode = { name, type, visibility, isDefault, signature };
      }
    } else if (ts.isVariableStatement(node)) {
      const isExport =
        node.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        ) ?? false;

      if (isExport) {
        const declarations = node.declarationList.declarations;
        for (const declaration of declarations) {
          if (ts.isIdentifier(declaration.name)) {
            const name = declaration.name.text;
            const isDefault =
              node.modifiers?.some(
                (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
              ) ?? false;
            const visibility = VisibilityLevel.Public; // Exported variables are always public
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
      }
    } else if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      // Handle `exports.default = ...` cases
      const left = node.left;
      if (
        ts.isPropertyAccessExpression(left) &&
        ts.isIdentifier(left.expression) &&
        left.expression.text === "exports" &&
        ts.isIdentifier(left.name) &&
        left.name.text === "default"
      ) {
        const right = node.right;
        const name = "default";
        const isDefault = true;
        let type: TreeNode["type"] = "const";
        let signature: string | undefined;

        if (
          ts.isStringLiteral(right) ||
          ts.isNumericLiteral(right) ||
          right.kind === ts.SyntaxKind.TrueKeyword ||
          right.kind === ts.SyntaxKind.FalseKeyword ||
          right.kind === ts.SyntaxKind.NullKeyword
        ) {
          signature = right.getText();
        } else if (ts.isIdentifier(right)) {
          signature = typeChecker.typeToString(
            typeChecker.getTypeAtLocation(right),
          );
        } else if (ts.isObjectLiteralExpression(right)) {
          signature = "{...}";
        } else if (
          ts.isFunctionExpression(right) ||
          ts.isArrowFunction(right)
        ) {
          type = "function";
          signature = getMethodSignature(right);
        }

        exportNode = {
          name,
          type,
          visibility: VisibilityLevel.Public,
          isDefault,
          signature,
        };
      }
    }

    if (exportNode && isVisibleEnough(exportNode.visibility)) {
      nodes.push(exportNode);
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
