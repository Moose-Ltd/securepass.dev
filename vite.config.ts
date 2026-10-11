import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = resolve(import.meta.dirname, "src");

// Every page is a real HTML entry so Vite emits dir/index.html files that the assets-only Worker
// serves at /dir (html_handling: drop-trailing-slash).
export const PAGE_ENTRIES = {
  index: resolve(root, "index.html"),
  passphrase: resolve(root, "passphrase-generator/index.html"),
  pin: resolve(root, "pin-generator/index.html"),
  checker: resolve(root, "password-strength-checker/index.html"),
  notFound: resolve(root, "404.html"),
};

export default defineConfig({
  root,
  publicDir: resolve(import.meta.dirname, "public"),
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
