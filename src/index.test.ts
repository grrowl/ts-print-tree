import { jest, describe, expect, test } from "@jest/globals";
import { tree } from ".";

describe("tree module", () => {
  test("calls tree() and matches console.log snapshot", () => {
    console.log = jest.fn();

    tree();
    expect((console.log as jest.Mock).mock.calls).toMatchSnapshot();
  });
});
