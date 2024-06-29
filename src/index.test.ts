import { jest, describe, expect, test } from "@jest/globals";
import { tree, VisibilityLevel } from ".";
import { formatAsList, formatAsTree, pathFilter } from "./cli";

const ignoredPatterns = [
  "node_modules",
  /\.git/,
  /\.vscode/,
  /\.DS_Store/,
  /\.test\.ts$/,
  /\.spec\.ts$/,
];

describe("cli module", () => {
  test("calls tree() and formats as tree", () => {
    const result = tree();
    const formattedResult = formatAsTree(result);
    expect(formattedResult).toMatchSnapshot();
  });

  test("calls tree() and formats as list, with custom visibility level", () => {
    const customVisibilityLevel = VisibilityLevel.Private;

    const result = tree(
      process.cwd(),
      pathFilter(ignoredPatterns),
      customVisibilityLevel,
    );
    const formattedResult = formatAsList(result);
    expect(formattedResult).toMatchSnapshot();
  });
});

describe("tree module", () => {
  test("calls tree() and matches result snapshot", () => {
    const result = tree();
    expect(result).toMatchSnapshot();
  });

  test("calls tree() with custom ignored patterns and matches result snapshot", () => {
    const customIgnored = ["node_modules", /\.git/, /^src\/(?!tests)/];

    const result = tree(process.cwd(), pathFilter(customIgnored));
    expect(result).toMatchSnapshot();
  });

  test("calls tree() with custom visibility level and matches result snapshot", () => {
    const customVisibilityLevel = VisibilityLevel.Private;

    const result = tree(
      process.cwd(),
      pathFilter(ignoredPatterns),
      customVisibilityLevel,
    );
    expect(result).toMatchSnapshot();
  });
});
