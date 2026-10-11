import { describe, expect, it } from "vitest";
import {
  DEFAULT_PASSPHRASE_OPTIONS,
  PASSPHRASE_LIMITS,
  SEPARATORS,
  generatePassphrase,
  type PassphraseOptions,
} from "../../src/core/passphrase.ts";
import { loadWordlist } from "../../src/core/wordlist.ts";

// Letters only, so splitting on any separator recovers the words and a digit is unmistakable.
const WORDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"];

function phrase(overrides: Partial<PassphraseOptions>, wordlist: readonly string[] = WORDS): string {
  return generatePassphrase({ ...DEFAULT_PASSPHRASE_OPTIONS, ...overrides }, wordlist).value;
}

describe("generatePassphrase", () => {
  it("has the documented defaults and limits", () => {
    expect(PASSPHRASE_LIMITS).toEqual({ min: 3, max: 12, default: 6 });
    expect(DEFAULT_PASSPHRASE_OPTIONS.words).toBe(6);
    expect(SEPARATORS).toEqual(["-", " ", ".", "_", ",", ""]);
  });

  it("prices 6 EFF words at 77.55 bits and adds log2(60) for the digit", async () => {
    const wordlist = await loadWordlist();
    const plain = generatePassphrase({ ...DEFAULT_PASSPHRASE_OPTIONS, words: 6, includeDigit: false }, wordlist);
    expect(plain.entropyBits).toBeCloseTo(77.55, 2);
    expect(plain.entropyBits).toBeCloseTo(6 * Math.log2(7776), 12);
    const withDigit = generatePassphrase({ ...DEFAULT_PASSPHRASE_OPTIONS, words: 6, includeDigit: true }, wordlist);
    expect(withDigit.entropyBits).toBeCloseTo(6 * Math.log2(7776) + Math.log2(60), 12);
    // Capitalisation and the separator are fixed choices and add nothing.
    const styled = generatePassphrase({ words: 6, separator: " ", capitalize: true, includeDigit: false }, wordlist);
    expect(styled.entropyBits).toBe(plain.entropyBits);
  });

  it("draws real EFF words", async () => {
    const wordlist = await loadWordlist();
    const known = new Set(wordlist);
    const { value } = generatePassphrase({ words: 8, separator: " ", capitalize: false, includeDigit: false }, wordlist);
    const words = value.split(" ");
    expect(words).toHaveLength(8);
    for (const word of words) expect(known.has(word), word).toBe(true);
  });

  for (const separator of SEPARATORS.filter((s) => s !== "")) {
    it(`joins words with ${JSON.stringify(separator)}`, () => {
      const words = phrase({ words: 5, separator, capitalize: false }).split(separator);
      expect(words).toHaveLength(5);
      for (const word of words) expect(WORDS).toContain(word);
    });
  }

  it("capitalises every word when asked", () => {
    const words = phrase({ words: 7, separator: "-", capitalize: true }).split("-");
    for (const word of words) {
      expect(word).toMatch(/^[A-Z][a-z]+$/);
      expect(WORDS).toContain(word.toLowerCase());
    }
  });

  it("capitalises automatically with no separator so word boundaries stay readable", () => {
    const value = phrase({ words: 6, separator: "", capitalize: false });
    expect(value).toMatch(/^([A-Z][a-z]+){6}$/);
    const words = value.match(/[A-Z][a-z]+/g) ?? [];
    expect(words).toHaveLength(6);
    for (const word of words) expect(WORDS).toContain(word.toLowerCase());
  });

  it("appends the digit to the end of exactly one word, at any of them", () => {
    const positions = new Set<number>();
    const digits = new Set<string>();
    for (let i = 0; i < 2000; i += 1) {
      const words = phrase({ words: 4, separator: ".", includeDigit: true }).split(".");
      expect(words).toHaveLength(4);
      const withDigit = words.flatMap((word, index) => (/[0-9]/.test(word) ? [index] : []));
      expect(withDigit).toHaveLength(1);
      const index = withDigit[0]!;
      const word = words[index]!;
      expect(word).toMatch(/^[a-z]+[0-9]$/);
      expect(WORDS).toContain(word.slice(0, -1));
      positions.add(index);
      digits.add(word.slice(-1));
    }
    expect(positions.size).toBe(4);
    expect(digits.size).toBe(10);
  });

  it("keeps the digit at a word boundary when there is no separator", () => {
    const value = phrase({ words: 5, separator: "", includeDigit: true });
    expect(value).toMatch(/^([A-Z][a-z]+[0-9]?){5}$/);
    expect(value.match(/[0-9]/g)).toHaveLength(1);
  });

  it("clamps the word count and falls back to the default separator", () => {
    expect(phrase({ words: 1, separator: " " }).split(" ")).toHaveLength(3);
    expect(phrase({ words: 50, separator: " " }).split(" ")).toHaveLength(12);
    expect(phrase({ words: Number.NaN, separator: " " }).split(" ")).toHaveLength(6);
    const bogus = phrase({ words: 4, separator: "+" as PassphraseOptions["separator"] });
    expect(bogus.split(DEFAULT_PASSPHRASE_OPTIONS.separator)).toHaveLength(4);
  });

  it("refuses a wordlist too small to be meaningful", () => {
    expect(() => generatePassphrase(DEFAULT_PASSPHRASE_OPTIONS, ["only"])).toThrow(RangeError);
  });
});
