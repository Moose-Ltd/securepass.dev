import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The deploy and smoke scripts are plain JavaScript that tsc never checks, and smoke only runs
// after a production upload. A syntax error there must fail here, not after going live.
const scripts = readdirSync("scripts", { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".mjs"))
  .map((file) => join("scripts", file));

describe("scripts", () => {
  it("finds the deploy and smoke scripts", () => {
    expect(scripts.map((file) => file.replaceAll("\\", "/"))).toEqual(expect.arrayContaining(["scripts/deploy.mjs", "scripts/smoke.mjs"]));
  });

  it.each(scripts)("%s parses", (file) => {
    expect(() => execFileSync(process.execPath, ["--check", file], { stdio: "pipe" })).not.toThrow();
  });
});
