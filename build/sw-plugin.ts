// Emits dist/sw.js: the hand-written service worker in src/sw/sw.js with this build's precache list
// and a version derived from the precached files' contents (KTD11). Any change to any precached file
// produces a new cache name, so a deploy can never be served half-old.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import { ROUTES, pageFile } from "../src/pages/routes.ts";

/** Page files and the clean URL each is served at (html_handling: drop-trailing-slash). */
const PAGE_URLS: Record<string, string> = Object.fromEntries(ROUTES.map((route) => [pageFile(route), route.path]));

/** Root files worth keeping offline: the install manifest and the icons it and the pages use. */
const ROOT_FILES = new Set([
  "manifest.webmanifest",
  "favicon.ico",
  "favicon-32.png",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "maskable-512.png",
  "logo-64.png",
]);

/**
 * Maps the files of a build (paths relative to dist, forward slashes) to the URLs to precache.
 * Pages are cached under the clean URL they are served at, never the .html path, which redirects.
 */
export function precacheUrls(files: readonly string[]): string[] {
  const urls: string[] = [];
  for (const file of files) {
    const page = PAGE_URLS[file];
    if (page) urls.push(page);
    else if (file.startsWith("assets/")) urls.push(`/${file}`);
    else if (ROOT_FILES.has(file)) urls.push(`/${file}`);
  }
  return urls.sort();
}

/** A short version that changes whenever any precached file's bytes change. */
export function cacheVersion(entries: readonly { url: string; contents: Buffer | string }[]): string {
  const hash = createHash("sha256");
  for (const entry of [...entries].sort((a, b) => a.url.localeCompare(b.url))) {
    hash.update(entry.url).update("\0").update(entry.contents).update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

export function serviceWorkerPlugin(root: string): Plugin {
  let config: ResolvedConfig;
  return {
    name: "securepass:service-worker",
    apply: "build",
    configResolved(resolved) {
      config = resolved;
    },
    closeBundle() {
      const outDir = config.build.outDir;
      const files = listFiles(outDir).map((f) => relative(outDir, f).split(sep).join("/"));
      const urls = precacheUrls(files);
      const fileForUrl = new Map(files.map((f) => [PAGE_URLS[f] ?? `/${f}`, f]));
      const version = cacheVersion(urls.map((url) => ({ url, contents: readFileSync(join(outDir, fileForUrl.get(url)!)) })));
      const template = readFileSync(resolve(root, "sw/sw.js"), "utf8");
      const source = template.replace('"__SP_VERSION__"', JSON.stringify(version)).replace("__SP_PRECACHE__", JSON.stringify(urls));
      if (source.includes("__SP_")) throw new Error("sw-plugin: a placeholder in src/sw/sw.js was not replaced");
      writeFileSync(join(outDir, "sw.js"), source);
    },
  };
}
