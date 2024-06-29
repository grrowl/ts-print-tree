import { jest, describe, expect, test } from "@jest/globals";
import { ignoredPatterns, tree, VisibilityLevel } from ".";

describe("tree module", () => {
  test("calls tree() and matches console.log snapshot", () => {
    console.log = jest.fn();

    tree();
    expect((console.log as jest.Mock).mock.calls).toMatchSnapshot();
  });

  test("calls tree() with custom ignored patterns and matches console.log snapshot", () => {
    console.log = jest.fn();
    const customIgnored = ["node_modules", /\.git/, /^src\/(?!tests)/];

    tree(process.cwd(), customIgnored);
    expect((console.log as jest.Mock).mock.calls).toMatchSnapshot();
  });

  test("calls tree() with custom visibility level and matches console.log snapshot", () => {
    console.log = jest.fn();
    const customVisibilityLevel = VisibilityLevel.Private;

    tree(process.cwd(), ignoredPatterns, customVisibilityLevel);
    expect((console.log as jest.Mock).mock.calls).toMatchSnapshot();
  });
});
