import { describe, expect, it } from "vitest";
import { cacheVersion, precacheUrls } from "../../build/sw-plugin.ts";

const BUILD = [
  "index.html",
  "404.html",
  "passphrase-generator/index.html",
  "pin-generator/index.html",
  "password-strength-checker/index.html",
  "assets/main-abc.js",
  "assets/main-abc.css",
  "assets/commonWords.json-xyz.js",
  "assets/eff_large_wordlist-q.js",
  "manifest.webmanifest",
  "favicon.ico",
  "logo-64.png",
  "_headers",
  "sw.js",
  "robots.txt",
  "sitemap.xml",
  ".well-known/security.txt",
  "og/password.png",
];

describe("service worker precache", () => {
  it("caches every page at its clean URL and every built asset", () => {
    const urls = precacheUrls(BUILD);
    expect(urls).toEqual(
      expect.arrayContaining([
        "/",
        "/passphrase-generator",
        "/pin-generator",
        "/password-strength-checker",
        "/assets/main-abc.js",
        "/assets/main-abc.css",
        "/assets/commonWords.json-xyz.js",
        "/assets/eff_large_wordlist-q.js",
        "/manifest.webmanifest",
        "/favicon.ico",
        "/logo-64.png",
      ]),
    );
  });

  it("leaves out headers, the worker itself, discovery files and preview images", () => {
    const urls = precacheUrls(BUILD);
    for (const excluded of ["/_headers", "/sw.js", "/robots.txt", "/sitemap.xml", "/.well-known/security.txt", "/og/password.png", "/404.html", "/index.html"]) {
      expect(urls).not.toContain(excluded);
    }
  });

  it("changes the cache version when any precached file changes", () => {
    const a = cacheVersion([{ url: "/", contents: "one" }, { url: "/assets/x.js", contents: "two" }]);
    const b = cacheVersion([{ url: "/", contents: "one" }, { url: "/assets/x.js", contents: "two!" }]);
    const c = cacheVersion([{ url: "/assets/x.js", contents: "two" }, { url: "/", contents: "one" }]);
    expect(a).not.toBe(b);
    expect(a).toBe(c);
  });
});
