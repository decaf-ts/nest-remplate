/**
 * @module nest-template/version
 * @description Application version, read from `package.json`.
 */
import { readFileSync } from "node:fs";

function readVersion(): string {
  try {
    // `src/` (tests) and `lib/` (build) both sit next to package.json
    return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  } catch {
    return "0.0.0";
  }
}

/**
 * @description Current version of the application (the `version` field of `package.json`).
 * @const VERSION
 */
export const VERSION: string = readVersion();
