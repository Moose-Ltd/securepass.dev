import { describe, expect, it } from "vitest";
import { ratingFromBits } from "../../src/core/rating.ts";
import { FAQ } from "../../src/pages/content.ts";
import { RATING_BANDS, renderPage, type PageId } from "../../src/pages/render.ts";

const TOOL_PAGES = ["password", "passphrase", "pin", "check"] as const;

const attr = (html: string, pattern: RegExp) => pattern.exec(html)?.[1];

function jsonLd(html: string): { "@graph": Record<string, unknown>[] } {
  const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!block) throw new Error("no JSON-LD");
  return JSON.parse(block);
}

describe("prerendered pages", () => {
  it("give every tool page a unique title, description, canonical, H1 and preview image", () => {
    const fields = TOOL_PAGES.map((id) => {
      const html = renderPage(id);
      return {
        title: attr(html, /<title>([^<]+)<\/title>/),
        description: attr(html, /<meta name="description" content="([^"]+)"/),
        canonical: attr(html, /<link rel="canonical" href="([^"]+)"/),
        h1: attr(html, /<h1[^>]*>([^<]+)<\/h1>/),
        og: attr(html, /<meta property="og:image" content="([^"]+)"/),
      };
    });
    for (const key of ["title", "description", "canonical", "h1", "og"] as const) {
      const values = fields.map((f) => f[key]);
      expect(values.every(Boolean), key).toBe(true);
      expect(new Set(values).size, key).toBe(TOOL_PAGES.length);
    }
    for (const { canonical } of fields) expect(canonical === "https://securepass.dev/" || !canonical!.endsWith("/")).toBe(true);
    for (const { title, description } of fields) {
      expect(title!.length).toBeLessThanOrEqual(65);
      expect(description!.length).toBeLessThanOrEqual(170);
    }
  });

  it("carries valid structured data, with the FAQ mirroring the visible questions on the home page", () => {
    const home = jsonLd(renderPage("password"));
    const faq = home["@graph"].find((n) => n["@type"] === "FAQPage") as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(faq.mainEntity.map((q) => q.name)).toEqual(FAQ.map((q) => q.question));
    for (const q of faq.mainEntity) expect(q.acceptedAnswer.text).not.toMatch(/<[a-z]/i);
    const sub = jsonLd(renderPage("pin"));
    expect(sub["@graph"].some((n) => n["@type"] === "BreadcrumbList")).toBe(true);
    expect(sub["@graph"].some((n) => n["@type"] === "FAQPage")).toBe(false);
  });

  it("escapes markup inside JSON-LD so it can never close the script element", () => {
    const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(renderPage("password"))![1]!;
    expect(block).not.toContain("<");
  });

  it("uses no style attributes and no inline scripts except the theme bootstrap and JSON-LD", () => {
    for (const id of [...TOOL_PAGES, "not-found"] as PageId[]) {
      const html = renderPage(id);
      expect(html).not.toMatch(/\sstyle="/);
      const inline = [...html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>/g)].map((m) => m[1]!.trim());
      expect(inline.filter((a) => a !== 'type="application/ld+json"')).toEqual([""]);
    }
  });

  it("marks the secret, spell-out list and check field as untranslatable", () => {
    const html = renderPage("password");
    expect(html).toMatch(/<output[^>]*id="secret"[^>]*translate="no"/);
    expect(html).toMatch(/<ol[^>]*id="spell"[^>]*translate="no"/);
    expect(html).toMatch(/<input[^>]*id="check-input"[^>]*translate="no"/);
  });

  it("keeps the 404 page out of search results", () => {
    const html = renderPage("not-found");
    expect(html).toContain('<meta name="robots" content="noindex, follow">');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain("data-vault");
  });

  it("shows rating bands that match the rating function", () => {
    const lower: Record<string, number> = { "very-weak": 0, weak: 45, fair: 60, strong: 75, excellent: 100 };
    for (const band of RATING_BANDS) expect(ratingFromBits(lower[band.rating]!)).toBe(band.rating);
  });

  it("credits the icon exactly as the Flaticon license asks", () => {
    expect(renderPage("password")).toContain('<a href="https://www.flaticon.com/free-icons/security" title="security icons">Security icons created by Vectors Tank - Flaticon</a>');
  });
});
