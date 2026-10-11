import { resolve } from "node:path";
import { defineConfig } from "vite";
import { headersPlugin } from "./build/headers-plugin.ts";
import { fontPreloadPlugin, pagesPlugin } from "./build/pages-plugin.ts";
import { serviceWorkerPlugin } from "./build/sw-plugin.ts";
import { wordlistPlugin } from "./build/wordlist-plugin.ts";
import { CONTENT_PAGES, ROUTES, fileForPath, pageFile } from "./src/pages/routes.ts";

const root = resolve(import.meta.dirname, "src");

// Every page is a real HTML entry so Vite emits dir/index.html files that the assets-only Worker
// serves at /dir (html_handling: drop-trailing-slash). Each stub is replaced by its prerendered page.
export const PAGE_ENTRIES: Record<string, string> = {
  ...Object.fromEntries(ROUTES.map((route) => [route.mode, resolve(root, pageFile(route))])),
  ...Object.fromEntries(CONTENT_PAGES.map((page) => [page.id, resolve(root, fileForPath(page.path))])),
  notFound: resolve(root, "404.html"),
};

export default defineConfig({
  root,
  publicDir: resolve(import.meta.dirname, "public"),
  plugins: [wordlistPlugin(), pagesPlugin(root), fontPreloadPlugin(), headersPlugin(), serviceWorkerPlugin(root)],
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    target: "es2022",
    // No data: URIs: the CSP allows images and fonts from 'self' only.
    assetsInlineLimit: 0,
    // Every supported browser has native modulepreload, and the polyfill is code we don't need.
    modulePreload: { polyfill: false },
    sourcemap: false,
    rolldownOptions: {
      input: PAGE_ENTRIES,
    },
  },
});
