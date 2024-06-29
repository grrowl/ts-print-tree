import { readFileSync } from "fs";
import { join } from "path";
import { tree } from "./index";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: ts-print-tree [options]");
  console.log("--help       Show help");
  console.log("--version    Show version number");
} else if (args.includes("--version")) {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, "../package.json"), "utf-8"),
  );
  console.log(`Version: ${packageJson.version}`);
} else {
  tree();
}
