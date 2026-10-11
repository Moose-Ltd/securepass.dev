import { SECURITY_HEADERS, cacheControlFor } from "../../src/security/headers.ts";
import { expect, test } from "./fixtures.ts";

test.describe("response headers", () => {
  for (const path of ["/", "/passphrase-generator", "/pin-generator", "/password-strength-checker", "/sw.js", "/manifest.webmanifest"]) {
    test(`${path} carries the full security header set`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      const headers = response.headers();
      for (const header of SECURITY_HEADERS) expect(headers[header.name.toLowerCase()], header.name).toBe(header.value);
    });
  }

  test("an unknown path is a 404 page that search engines skip", async ({ request }) => {
    const response = await request.get("/does-not-exist");
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain('content="noindex, follow"');
    expect(response.headers()["content-security-policy"]).toBeTruthy();
  });

  test("hashed assets are immutable and the service worker is never cached", async ({ request, page }) => {
    await page.goto("/");
    const css = await page.locator('link[rel="stylesheet"]').getAttribute("href");
    expect((await request.get(css!)).headers()["cache-control"]).toBe(cacheControlFor("/assets/*"));
    expect((await request.get("/sw.js")).headers()["cache-control"]).toBe(cacheControlFor("/sw.js"));
  });

  test("pages may not be rewritten in transit and revalidate on every load", async ({ request }) => {
    for (const path of ["/", "/passphrase-generator", "/pin-generator", "/password-strength-checker"]) {
      expect((await request.get(path)).headers()["cache-control"], path).toBe("no-transform, public, max-age=0, must-revalidate");
    }
    // Everything else stays compressible: no-transform would also stop Cloudflare's compression.
    expect((await request.get("/manifest.webmanifest")).headers()["cache-control"] ?? "").not.toContain("no-transform");
  });

  test("a trailing slash redirects to the canonical URL", async ({ request }) => {
    const response = await request.get("/pin-generator/", { maxRedirects: 0 });
    expect([301, 307, 308]).toContain(response.status());
    expect(response.headers().location).toBe("/pin-generator");
  });
});
