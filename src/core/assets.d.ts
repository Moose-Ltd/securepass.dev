// Types for modules that are not TypeScript.

// build/wordlist-plugin.ts: the words of a "NNNNN<TAB>word" list, joined with "\n".
declare module "*.txt?words" {
  const words: string;
  export default words;
}

// zxcvbn-ts data modules, deep-imported so only the dictionaries we use are bundled
// (src/check/estimator.ts). The packages ship no declarations for these files.
declare module "@zxcvbn-ts/language-common/dist/passwords.json.mjs" {
  const words: string[];
  export default words;
}

declare module "@zxcvbn-ts/language-common/dist/diceware.json.mjs" {
  const words: string[];
  export default words;
}

declare module "@zxcvbn-ts/language-common/dist/adjacencyGraphs.json.mjs" {
  import type { OptionsGraph } from "@zxcvbn-ts/core";
  const graphs: OptionsGraph;
  export default graphs;
}

declare module "@zxcvbn-ts/language-en/dist/commonWords.json.mjs" {
  const words: string[];
  export default words;
}

declare module "@zxcvbn-ts/language-en/dist/firstnames.json.mjs" {
  const words: string[];
  export default words;
}

declare module "@zxcvbn-ts/language-en/dist/translations.mjs" {
  import type { TranslationKeys } from "@zxcvbn-ts/core";
  const translations: TranslationKeys;
  export default translations;
}
