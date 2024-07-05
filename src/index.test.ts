import { describe, expect, test } from "@jest/globals";
import { tree, VisibilityLevel } from ".";

const defaultIgnore = [
  "node_modules",
  /\.git/,
  /\.vscode/,
  /\.DS_Store/,
  /\.test\.ts$/,
  /\.spec\.ts$/,
];

const makePathFilter =
  (ignorePatterns: (string | RegExp)[] = defaultIgnore) =>
  (path: string) =>
    !ignorePatterns.some((pattern) =>
      typeof pattern === "string" ? path.includes(pattern) : pattern.test(path),
    );

describe("tree module", () => {
  test("calls tree() and matches result snapshot", () => {
    const result = tree();
    expect(result).toMatchSnapshot();
  });

  test("calls tree() with custom ignored patterns and matches result snapshot", () => {
    const customIgnored = ["node_modules", /\.git/, /^src\/(?!tests)/];

    const result = tree(process.cwd(), makePathFilter(customIgnored));
    expect(result).toMatchSnapshot();
  });

  test("calls tree() with custom visibility level and matches result snapshot", () => {
    const customVisibilityLevel = VisibilityLevel.Private;

    const result = tree(
      process.cwd(),
      makePathFilter(defaultIgnore),
      customVisibilityLevel,
    );
    expect(result).toMatchSnapshot();
  });
});
