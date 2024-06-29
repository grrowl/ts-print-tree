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
} else if (args.includes("--version")) {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, "../package.json"), "utf-8"),
  );
  console.log(`Version: ${packageJson.version}`);
} else {
  const ignoreIndex = args.indexOf("--ignore");
  let ignorePatterns: (string | RegExp)[] = [];

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

  console.log(ignorePatterns);
  tree(process.cwd(), ignorePatterns);
}
