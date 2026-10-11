import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PAGE_PATHS, urlForPath } from "../../src/pages/routes.ts";

describe("sitemap.xml", () => {
  it("lists exactly the pages the site serves", () => {
    const sitemap = readFileSync("public/sitemap.xml", "utf8");
    const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(listed).toEqual(PAGE_PATHS.map(urlForPath));
  });
});
