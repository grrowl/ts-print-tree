import { describe, expect, test } from "@jest/globals";
import { tree, VisibilityLevel } from ".";
import { formatAsList, formatAsTree, pathFilter } from "./cli";

const defaultIgnore = [
  "node_modules",
  /\.git/,
  /\.vscode/,
  /\.DS_Store/,
  /\.test\.ts$/,
  /\.spec\.ts$/,
];

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
      pathFilter(defaultIgnore),
      customVisibilityLevel,
    );
    expect(result).toMatchSnapshot();
  });
});
