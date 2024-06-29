#!/usr/bin/env node

import { readFileSync } from "fs";
import { join } from "path";
import { tree } from ".";
import { ignoredPatterns } from "./defaults";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: ts-print-tree [options]");
  console.log("--help       Show help");
  console.log("--version    Show version number");
  console.log("--ignore     Ignore files matching the specified patterns");
  console.log("--no-default Don't include default ignore patterns");
  console.log("--cwd        Set the current working directory");
} else if (args.includes("--version")) {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, "../package.json"), "utf-8"),
  );
  console.log(`Version: ${packageJson.version}`);
} else {
  const ignoreIndex = args.indexOf("--ignore");
  let ignorePatterns: (string | RegExp)[] = [];
  let cwd = process.cwd();

  if (ignoreIndex !== -1) {
    ignorePatterns = args
      .slice(ignoreIndex + 1)
      .filter((pat) => !pat.startsWith("--"))
      .map((pat) =>
        pat.startsWith("/") && pat.endsWith("/") && pat.includes("i")
          ? new RegExp(pat.slice(1, -2), "i")
          : pat.startsWith("/") && pat.endsWith("/")
            ? new RegExp(pat.slice(1, -1))
            : pat,
      );
  }

  if (!args.includes("--no-default")) {
    ignorePatterns.push(...ignoredPatterns);
  }

  const cwdIndex = args.indexOf("--cwd");
  if (cwdIndex !== -1 && args[cwdIndex + 1]) {
    cwd = args[cwdIndex + 1];
  }

  tree(cwd, ignorePatterns);
}
