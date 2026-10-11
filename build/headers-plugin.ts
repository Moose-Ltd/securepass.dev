// Writes dist/_headers from src/security/headers.ts, so the policy the browser receives is the one
// the page documents (KTD3).

import type { Plugin } from "vite";
import { renderHeadersFile } from "../src/security/headers.ts";

export function headersPlugin(): Plugin {
  return {
    name: "securepass:headers",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "_headers", source: renderHeadersFile() });
    },
  };
}
