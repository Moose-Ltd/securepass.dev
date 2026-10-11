// Replaces each stub HTML entry with its prerendered page (KTD12) and, at build time, preloads the
// two font files so the secret never renders in a fallback face first.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { esc, renderPage, type PageId } from "../src/pages/render.ts";

const STUB_IDS: Record<string, PageId> = {
  index: "password",
  "passphrase-generator": "passphrase",
  "pin-generator": "pin",
  "password-strength-checker": "check",
  "404": "not-found",
};

/** The real randomInt from src/core/random.ts, shown on the page as the code every character passes through. */
export function randomIntSource(root: string): string {
  const source = readFileSync(resolve(root, "core/random.ts"), "utf8").replace(/\r\n/g, "\n");
  const match = /export function randomInt\([\s\S]*?\n}\n/.exec(source);
  if (!match) throw new Error("pages-plugin: could not find randomInt in src/core/random.ts");
  return match[0].trimEnd();
}

export function pagesPlugin(root: string): Plugin {
  return {
    name: "securepass:pages",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const stub = /<!--page:([a-z0-9-]+)-->/.exec(html);
        if (!stub) return html;
        const id = STUB_IDS[stub[1] ?? ""];
        if (!id) throw new Error(`pages-plugin: unknown page stub ${stub[1]}`);
        return renderPage(id).replace("{{RANDOM_INT_SOURCE}}", esc(randomIntSource(root)));
      },
    },
  };
}

export function fontPreloadPlugin(): Plugin {
  return {
    name: "securepass:font-preload",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const fonts = Object.keys(ctx.bundle ?? {}).filter((file) => file.endsWith(".woff2"));
        const links = fonts.map((file) => `<link rel="preload" href="/${file}" as="font" type="font/woff2" crossorigin>`).join("\n");
        // Straight after the viewport meta: charset stays first, and the fonts start before the CSS.
        return html.replace(/(<meta name="viewport"[^>]*>)/, `$1\n${links}`);
      },
    },
  };
}
