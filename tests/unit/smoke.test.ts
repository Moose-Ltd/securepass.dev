import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

describe("scaffold", () => {
  it("pins every dependency to an exact version", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as Record<string, Record<string, string>>;
    for (const group of ["dependencies", "devDependencies"]) {
      for (const [name, version] of Object.entries(pkg[group] ?? {})) {
        expect(version, `${name} must be pinned exactly`).toMatch(/^\d+\.\d+\.\d+$/);
      }
    }
  });

  it("keeps the wrangler config on the personal account with workers.dev off", () => {
    const config = readFileSync("wrangler.jsonc", "utf8");
    expect(config).toContain('"account_id": "1e3dfc08a40b3d1df09d3760e320df40"');
    expect(config).toContain('"workers_dev": false');
    expect(config).not.toMatch(/"main"\s*:/);
    expect(existsSync("src/index.html")).toBe(true);
  });
});
