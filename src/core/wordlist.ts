// The EFF large wordlist, loaded on demand so only passphrase mode pays for it. The build plugin
// (build/wordlist-plugin.ts) turns the verbatim source file into a newline-joined string with
// the dice indices stripped, in its own lazy chunk.

export const WORDLIST_SIZE = 7776;

let loading: Promise<readonly string[]> | undefined;

export function loadWordlist(): Promise<readonly string[]> {
  loading ??= import("../data/eff_large_wordlist.txt?words")
    .then(({ default: joined }) => {
      const words = joined.split("\n");
      // Passphrase entropy is claimed as log2(7,776) bits per word. A list that a build step
      // truncated or duplicated would make that claim false, so it is refused outright.
      if (words.length !== WORDLIST_SIZE || new Set(words).size !== WORDLIST_SIZE || words.includes("")) {
        throw new Error(`The wordlist must hold ${WORDLIST_SIZE} unique words; got ${words.length}.`);
      }
      return Object.freeze(words);
    })
    .catch((error: unknown) => {
      // Let a later call retry, for example after a failed chunk download.
      loading = undefined;
      throw error;
    });
  return loading;
}
