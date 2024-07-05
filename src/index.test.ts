import { describe, expect, test } from "@jest/globals";
import { tree, VisibilityLevel, TreeNode } from ".";
import path from "path";

describe("tree module", () => {
  test("calls tree() with default parameters", () => {
    const result = tree();
    expect(result).toBeDefined();
    expect(result.name).toBe("ts-print-tree/");
    expect(result.type).toBe("directory");
    expect(result.children).toBeDefined();
    expect(result.children!.length).toBeGreaterThan(0);
  });

  test("calls tree() with custom ignored patterns", () => {
    const customFilter = (filePath: string) => {
      const relativePath = path.relative(process.cwd(), filePath);
      return relativePath.startsWith("src") || relativePath === "src";
    };
    const result = tree(process.cwd(), customFilter);

    expect(result.children).toBeDefined();
    expect(result.children!.length).toBe(1); // Should only include 'src' directory

    const srcDir = result.children![0];
    expect(srcDir.name).toBe("src/");
    expect(srcDir.type).toBe("directory");

    const testsDir = srcDir.children!.find((child) => child.name === "tests/");
    expect(testsDir).toBeDefined();
    expect(testsDir!.type).toBe("directory");

    // Check that all nodes have public visibility
    const checkVisibility = (node: TreeNode) => {
      if (node.visibility) {
        expect(node.visibility).toBe("public");
      }
      if (node.children) {
        node.children.forEach(checkVisibility);
      }
    };
    checkVisibility(result);
  });

  test("calls tree() with custom visibility level", () => {
    const customFilter = (filePath: string) => {
      const relativePath = path.relative(process.cwd(), filePath);
      return relativePath.startsWith("src") || relativePath === "src";
    };
    const result = tree(process.cwd(), customFilter, VisibilityLevel.Protected);

    expect(result.children).toBeDefined();
    const srcDir = result.children!.find((child) => child.name === "src/");
    expect(srcDir).toBeDefined();
    const testsDir = srcDir!.children!.find((child) => child.name === "tests/");
    expect(testsDir).toBeDefined();

    // Recursive function to get all descendants
    const getAllDescendants = (node: TreeNode): TreeNode[] => {
      if (!node.children) return [];
      return node.children.concat(
        node.children.flatMap((child) => getAllDescendants(child)),
      );
    };

    // Get all descendants of the tests directory
    const allDescendants = getAllDescendants(testsDir!);

    // Check for presence of various TreeNode types
    const types = new Set(allDescendants.map((node) => node.type));
    expect(types.has("file")).toBe(true);
    expect(types.has("class")).toBe(true);
    expect(types.has("method")).toBe(true);
    expect(types.has("property")).toBe(true);

    // Check for presence of various TreeNode visibility levels
    const visibilityLevels = new Set(
      allDescendants.map((node) => node.visibility),
    );
    expect(visibilityLevels.has(VisibilityLevel.Public)).toBe(true);
    expect(visibilityLevels.has(VisibilityLevel.Protected)).toBe(true);
    expect(visibilityLevels.has(VisibilityLevel.Private)).toBe(false);
  });

  test("calls tree() with private visibility and matches snapshot", () => {
    const customFilter = (filePath: string) => {
      const relativePath = path.relative(process.cwd(), filePath);
      return relativePath.startsWith("src") || relativePath === "src";
    };
    const result = tree(process.cwd(), customFilter, VisibilityLevel.Private);
    expect(result).toMatchSnapshot();
  });
});
