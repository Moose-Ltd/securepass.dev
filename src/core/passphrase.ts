// Diceware-style passphrases from the EFF large wordlist (R5).

import { passphraseEntropyBits } from "./entropy.ts";
import { assertSecureRandom, clampInteger, randomInt } from "./random.ts";

export type Separator = "-" | " " | "." | "_" | "," | "";

export const SEPARATORS: readonly Separator[] = Object.freeze(["-", " ", ".", "_", ",", ""]);

export interface PassphraseOptions {
  words: number;
  separator: Separator;
  capitalize: boolean;
  includeDigit: boolean;
}

export const PASSPHRASE_LIMITS = Object.freeze({ min: 3, max: 12, default: 6 } as const);

// Frozen so shared defaults can't be mutated by accident: copy before changing.
export const DEFAULT_PASSPHRASE_OPTIONS: PassphraseOptions = Object.freeze({
  words: PASSPHRASE_LIMITS.default,
  separator: "-",
  capitalize: false,
  includeDigit: false,
});

function capitalizeWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function generatePassphrase(
  opts: PassphraseOptions,
  wordlist: readonly string[],
): { value: string; entropyBits: number } {
  assertSecureRandom();
  if (wordlist.length < 2) throw new RangeError("a passphrase needs a wordlist of at least two words");
  const count = clampInteger(opts.words, PASSPHRASE_LIMITS);
  const separator = SEPARATORS.includes(opts.separator) ? opts.separator : DEFAULT_PASSPHRASE_OPTIONS.separator;
  // With no separator, capitals are the only thing showing where one word ends and the next
  // begins, so they are forced on.
  const capitalize = opts.capitalize || separator === "";

  const words = Array.from({ length: count }, () => {
    const word = wordlist[randomInt(wordlist.length)] ?? "";
    return capitalize ? capitalizeWord(word) : word;
  });
  if (opts.includeDigit) {
    // The digit goes on the end of a random word: a word boundary, never mid-word, and since
    // EFF words have no digits each (word, digit) choice gives a distinct passphrase.
    const at = randomInt(count);
    words[at] = `${words[at] ?? ""}${randomInt(10)}`;
  }

  return {
    value: words.join(separator),
    entropyBits: passphraseEntropyBits(count, wordlist.length, opts.includeDigit),
  };
}
