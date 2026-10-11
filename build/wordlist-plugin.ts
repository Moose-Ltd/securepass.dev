// Vite plugin: `import words from "./list.txt?words"` yields the list's words joined with "\n".
// The EFF source file stays byte-for-byte verbatim (its SHA-256 is tested), while the shipped
// chunk drops the dice indices: about 25 KB gzip instead of 43 KB.

import { readFile } from "node:fs/promises";
import type { Plugin } from "vite";

const LINE = /^[1-6]{5}\t(\S+)$/;

// The file part of an id carrying a `words` query parameter. Matched as a parameter, not a
// suffix, because the dev server adds its own (`?import&words`).
function wordsFile(id: string): string | null {
  const query = id.indexOf("?");
  if (query < 0 || !new URLSearchParams(id.slice(query + 1)).has("words")) return null;
  return id.slice(0, query);
}

export function wordlistPlugin(): Plugin {
  return {
    name: "securepass:wordlist",
    // Vite's asset plugin claims .txt files as URLs, so this must resolve and load first.
    enforce: "pre",

    async resolveId(source, importer) {
      const path = wordsFile(source);
      if (path === null) return null;
      const resolved = await this.resolve(path, importer, { skipSelf: true });
      return resolved ? `${resolved.id}?words` : null;
    },

    async load(id) {
      const file = wordsFile(id);
      if (file === null) return null;
      this.addWatchFile(file);
      const text = await readFile(file, "utf8");
      const lines = text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n");
      const words = lines.map((line, index) => {
        const word = LINE.exec(line)?.[1];
        // Fail the build rather than ship a list whose size or contents differ from the source.
        if (word === undefined) this.error(`${file}:${index + 1}: expected "NNNNN<TAB>word", got ${JSON.stringify(line)}`);
        return word;
      });
      return { code: `export default ${JSON.stringify(words.join("\n"))};\n`, moduleType: "js" };
    },
  };
}
