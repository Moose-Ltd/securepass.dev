#!/usr/bin/env node
// Checks the live site after a deploy (R33): every page, the security headers from
// src/security/headers.ts, the 404 page, the www and HTTP redirects, the discovery files, and that
// Cloudflare injected nothing into the HTML that the CSP would block.
//
//   npm run smoke                      # https://securepass.dev
//   SMOKE_ORIGIN=http://127.0.0.1:8787 npm run smoke   # a local wrangler dev, skips redirects

const ORIGIN = (process.env.SMOKE_ORIGIN ?? "https://securepass.dev").replace(/\/$/, "");
const LIVE = ORIGIN === "https://securepass.dev";
// The pages never reference /cdn-cgi/, so any mention is something Cloudflare added.
const INJECTED = ["cloudflareinsights", "rocket-loader", "email-decode", "challenge-platform", "/cdn-cgi/"];
// Cloudflare rewrites only what it takes for a browser's page load, so pages are fetched as one.
const AS_BROWSER = {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  },
};

// The TypeScript sources are the single source of truth; Node strips their types natively.
const { SECURITY_HEADERS, cacheControlFor } = await import("../src/security/headers.ts");
const { PAGE_PATHS, SITE_ORIGIN } = await import("../src/pages/routes.ts");
const PAGES = PAGE_PATHS;

const failures = [];
const check = (ok, message) => {
  process.stdout.write(`${ok ? "ok  " : "FAIL"} ${message}\n`);
  if (!ok) failures.push(message);
};

// One retry, so a transient network blip right after a deploy doesn't fail a release that worked.
async function get(url, init = {}) {
  const once = () => fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000), ...init });
  try {
    return await once();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return once();
  }
}

for (const path of PAGES) {
  const res = await get(`${ORIGIN}${path}`, AS_BROWSER);
  const html = await res.text();
  check(res.status === 200, `${path} returns 200 (got ${res.status})`);
  for (const header of SECURITY_HEADERS) {
    check(res.headers.get(header.name) === header.value, `${path} sends ${header.name}`);
  }
  check(res.headers.get("cache-control") === cacheControlFor(path), `${path} forbids rewriting in transit (got ${res.headers.get("cache-control")})`);
  for (const marker of INJECTED) check(!html.includes(marker), `${path} has no injected ${marker}`);
}

const missing = await get(`${ORIGIN}/smoke-check-missing-page`, AS_BROWSER);
const missingHtml = await missing.text();
check(missing.status === 404, `unknown path returns 404 (got ${missing.status})`);
check(missingHtml.includes("noindex"), "404 page is noindex");
for (const marker of INJECTED) check(!missingHtml.includes(marker), `404 page has no injected ${marker}; if not, turn off Web Analytics automatic setup for the zone`);

const robots = await (await get(`${ORIGIN}/robots.txt`)).text();
check(robots.includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`), "robots.txt names the sitemap");
const sitemap = await get(`${ORIGIN}/sitemap.xml`);
check((sitemap.headers.get("content-type") ?? "").includes("xml"), "sitemap.xml is served as XML");
check((await (await get(`${ORIGIN}/.well-known/security.txt`)).text()).includes("Contact:"), "security.txt is served");
check((await get(`${ORIGIN}/sw.js`)).headers.get("cache-control") === cacheControlFor("/sw.js"), "sw.js is never cached");
if (LIVE) {
  // Pages opt out of Cloudflare's rewriting, which also opts them out of compression; scripts must not.
  const script = (await (await get(`${ORIGIN}/`, AS_BROWSER)).text()).match(/\/assets\/main-[\w-]+\.js/)?.[0];
  const encoding = script ? (await get(`${ORIGIN}${script}`, { headers: { "Accept-Encoding": "br, gzip" } })).headers.get("content-encoding") : null;
  check(Boolean(encoding), `the main script is served compressed (got ${encoding})`);
}
check((await get(`${ORIGIN}/og/password.png`)).status === 200, "the preview image is served");

if (LIVE) {
  const www = await get("https://www.securepass.dev/pin-generator?x=1");
  check(www.status === 301 && www.headers.get("location") === "https://securepass.dev/pin-generator?x=1", `www redirects to the apex (got ${www.status} ${www.headers.get("location")})`);
  const http = await get("http://securepass.dev/");
  check([301, 302, 307, 308].includes(http.status) && (http.headers.get("location") ?? "").startsWith("https://"), `plain HTTP redirects to HTTPS (got ${http.status}); if not, turn on Always Use HTTPS for the zone`);
}

if (failures.length) {
  process.stderr.write(`\nsmoke: ${failures.length} check(s) failed.\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`\nsmoke: ${ORIGIN} passed every check.\n`);
}
