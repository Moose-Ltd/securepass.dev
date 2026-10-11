import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY, THEME_BOOTSTRAP, THEME_BOOTSTRAP_HASH, cacheControlFor, renderHeadersFile } from "../../src/security/headers.ts";
import { ROUTES } from "../../src/pages/routes.ts";
import { renderPage } from "../../src/pages/render.ts";

interface Rule {
  pattern: string;
  headers: [string, string][];
}

function parse(file: string): Rule[] {
  const rules: Rule[] = [];
  for (const line of file.split("\n")) {
    if (!line.trim()) continue;
    if (!line.startsWith(" ")) rules.push({ pattern: line, headers: [] });
    else {
      const [name, ...rest] = line.trim().split(":");
      rules.at(-1)!.headers.push([name!, rest.join(":").trim()]);
    }
  }
  return rules;
}

describe("_headers", () => {
  const file = renderHeadersFile();
  const rules = parse(file);

  it("sends exactly one CSP, from the global rule", () => {
    const csp = rules.flatMap((r) => r.headers.filter(([n]) => n === "Content-Security-Policy").map(() => r.pattern));
    expect(csp).toEqual(["/*"]);
  });

  it("allows the theme bootstrap by the hash of its exact source", () => {
    const expected = `sha256-${createHash("sha256").update(THEME_BOOTSTRAP).digest("base64")}`;
    expect(THEME_BOOTSTRAP_HASH).toBe(expected);
    expect(CONTENT_SECURITY_POLICY).toContain(`'${expected}'`);
    expect(renderPage("password")).toContain(`<script>${THEME_BOOTSTRAP}</script>`);
  });

  it("never allows unsafe-inline or unsafe-eval and limits connections to the breach API", () => {
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
    expect(CONTENT_SECURITY_POLICY).toContain("connect-src 'self' https://api.pwnedpasswords.com;");
    expect(CONTENT_SECURITY_POLICY).toMatch(/trusted-types securepass$/);
    expect(CONTENT_SECURITY_POLICY).toContain("require-trusted-types-for 'script'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY.startsWith("default-src 'none'")).toBe(true);
  });

  it("stays inside Cloudflare's _headers limits", () => {
    expect(rules.length).toBeLessThanOrEqual(100);
    for (const line of file.split("\n")) expect(line.length).toBeLessThan(2000);
  });

  it("defines no header but Cache-Control in more than one rule, so no security header is comma-joined", () => {
    const seen = new Map<string, number>();
    for (const rule of rules) for (const [name] of rule.headers) seen.set(name, (seen.get(name) ?? 0) + 1);
    for (const [name, count] of seen) if (name !== "Cache-Control") expect(count, name).toBe(1);
  });

  it("forbids rewriting every response in transit, and keeps every page revalidating", () => {
    // Without no-transform, Cloudflare injects its analytics beacon into the HTML a browser receives.
    const global = rules.find((r) => r.pattern === "/*")!;
    expect(global.headers).toContainEqual(["Cache-Control", "no-transform"]);
    for (const route of ROUTES) {
      expect(rules.find((r) => r.pattern === route.path)?.headers, route.path).toEqual([["Cache-Control", "public, max-age=0, must-revalidate"]]);
      expect(cacheControlFor(route.path)).toBe("no-transform, public, max-age=0, must-revalidate");
    }
    expect(cacheControlFor("/assets/*")).toBe("no-transform, public, max-age=31536000, immutable");
    expect(cacheControlFor("/manifest.webmanifest")).toBe("no-transform");
  });

  it("keeps clipboard writing and switches the rest off", () => {
    const policy = rules[0]!.headers.find(([n]) => n === "Permissions-Policy")![1];
    expect(policy).toContain("clipboard-write=(self)");
    expect(policy).toContain("camera=()");
    expect(policy).not.toContain("interest-cohort");
  });

  it("documents on every page exactly the policy it serves", () => {
    for (const id of ["password", "passphrase", "pin", "check"] as const) {
      const html = renderPage(id);
      for (const directive of CONTENT_SECURITY_POLICY.split("; ")) {
        expect(html).toContain(`<code>${directive.replace(/'/g, "&#39;")}</code>`);
      }
    }
  });
});
