import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// KTD5: all randomness comes from crypto.getRandomValues and every DOM write goes through
// textContent, createElement and attribute setters. Trusted Types enforce the DOM half at
// runtime; this guard catches both before review.
const FORBIDDEN: readonly [label: string, pattern: RegExp][] = [
  ["Math.random", /\bMath\s*\.\s*random\b/],
  ["innerHTML", /\binnerHTML\b/],
  ["outerHTML", /\bouterHTML\b/],
  ["insertAdjacentHTML", /\binsertAdjacentHTML\b/],
  ["document.write", /\bdocument\s*\.\s*write(?:ln)?\b/],
];

const SCANNED = new Set([".ts", ".mts", ".js", ".mjs", ".html", ".css"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return SCANNED.has(extname(entry.name)) ? [path] : [];
  });
}

describe("source hygiene", () => {
  const files = sourceFiles("src");

  it("finds the source tree", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files.map((file) => relative("src", file).replaceAll("\\", "/"))).toContain("core/random.ts");
  });

  it("never uses Math.random or HTML-string DOM APIs anywhere in src/", () => {
    const violations: string[] = [];
    for (const file of files) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          for (const [label, pattern] of FORBIDDEN) {
            if (pattern.test(line)) violations.push(`${file}:${index + 1} uses ${label}`);
          }
        });
    }
    expect(violations).toEqual([]);
  });
});
