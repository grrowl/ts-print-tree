import {
  describe,
  expect,
  test,
  jest,
  beforeAll,
  afterAll,
  beforeEach,
} from "@jest/globals";

describe("cli module", () => {
  let mockLog: jest.SpiedFunction<typeof console.log>;
  let originalArgv: string[];

  beforeAll(() => {
    mockLog = jest.spyOn(console, "log").mockImplementation(() => {});
    originalArgv = process.argv;
  });

  afterAll(() => {
    mockLog.mockRestore();
    process.argv = originalArgv;
  });

  beforeEach(() => {
    jest.resetModules();
  });

  test("call with no arguments", () => {
    process.argv = ["node", "script.js"];

    require("./cli");

    expect(console.log).toHaveBeenCalled();
    expect(mockLog.mock.calls).toMatchSnapshot();
  });

  test("call with arguments: ['--list', '--private']", () => {
    process.argv = ["node", "script.js", "--list", "--private"];

    require("./cli");

    expect(console.log).toHaveBeenCalled();
    expect(mockLog.mock.calls).toMatchSnapshot();
  });
});
