import type { MatchExtended } from "@zxcvbn-ts/core";
import { beforeAll, describe, expect, it } from "vitest";
import {
  FALLBACK_SUGGESTION,
  MAX_ANALYSED_CHARS,
  adjustedLog10Guesses,
  loadEstimator,
  randomCandidates,
  type Estimator,
} from "../../src/check/estimator.ts";
import { DEFAULT_PASSWORD_OPTIONS } from "../../src/core/charsets.ts";
import { generatePassword } from "../../src/core/password.ts";
import { SCENARIOS } from "../../src/core/scenarios.ts";

let estimate: Estimator;

beforeAll(async () => {
  estimate = await loadEstimator();
});

function generated(length: number, sets = DEFAULT_PASSWORD_OPTIONS.sets): string {
  const result = generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length, sets });
  if (!result.ok) throw new Error("expected a password");
  return result.value;
}

function bruteforce(token: string): MatchExtended {
  return { pattern: "bruteforce", i: 0, j: token.length - 1, token, guesses: 10 ** token.length };
}

describe("deep-import paths (KTD8)", () => {
  // The packages have no exports map, so an upgrade can move these files without warning.
  it.each([
    "@zxcvbn-ts/language-common/dist/passwords.json.mjs",
    "@zxcvbn-ts/language-common/dist/diceware.json.mjs",
    "@zxcvbn-ts/language-en/dist/commonWords.json.mjs",
    "@zxcvbn-ts/language-en/dist/firstnames.json.mjs",
  ])("%s resolves to a word list", async (path) => {
    const { default: words } = (await import(/* @vite-ignore */ path)) as { default: unknown };
    expect(Array.isArray(words)).toBe(true);
    expect((words as unknown[]).length).toBeGreaterThan(1000);
    expect((words as unknown[]).every((word) => typeof word === "string" && word.length > 0)).toBe(true);
  });

  it("resolves the keyboard adjacency graphs", async () => {
    const { default: graphs } = await import("@zxcvbn-ts/language-common/dist/adjacencyGraphs.json.mjs");
    expect(Object.keys(graphs)).toContain("qwerty");
    expect(graphs["qwerty"]?.["a"]).toBeInstanceOf(Array);
  });

  it("resolves the English translations", async () => {
    const { default: translations } = await import("@zxcvbn-ts/language-en/dist/translations.mjs");
    expect(translations.warnings.topTen).toMatch(/password/i);
    expect(translations.suggestions.l33t).toMatch(/substitutions/i);
  });

  it("resolves the core factory", async () => {
    const { ZxcvbnFactory } = await import("@zxcvbn-ts/core");
    expect(typeof ZxcvbnFactory).toBe("function");
  });
});

describe("estimator", () => {
  it("loads once", async () => {
    expect(await loadEstimator()).toBe(estimate);
  });

  it("rates 'password' very weak with a common-password warning", () => {
    const result = estimate("password");
    expect(result.rating).toBe("very-weak");
    expect(result.warning).toMatch(/(heavily|frequently|commonly) used password/i);
  });

  it("flags the predictable substitutions in 'P@ssw0rd'", () => {
    const result = estimate("P@ssw0rd");
    expect(result.rating).toBe("very-weak");
    expect(result.suggestions.some((s) => /predictable letter substitutions/i.test(s))).toBe(true);
  });

  it("keeps 'Tr0ub4dor&3' very weak and supplies the fallback suggestion zxcvbn doesn't", () => {
    const result = estimate("Tr0ub4dor&3");
    expect(result.rating).toBe("very-weak");
    expect(result.warning).toBeNull();
    expect(result.suggestions).toEqual([FALLBACK_SUGGESTION]);
  });

  it("rates 20-character generated passwords with all four sets excellent, never below strong", () => {
    // About 2% contain a chance letter run that reads like a word ("Rope"), which keeps zxcvbn's
    // conservative price and can land the whole on strong; nothing lands lower.
    const ratings = Array.from({ length: 200 }, () => estimate(generated(20)).rating);
    expect(ratings.every((r) => r === "excellent" || r === "strong")).toBe(true);
    expect(ratings.filter((r) => r === "excellent").length).toBeGreaterThanOrEqual(180);
  });

  it("rates a random password split by a chance match by its unmatched characters together", () => {
    // From the generator: "3@ch" matches a common word, leaving unmatched runs of 5 and 11.
    const result = estimate("wl$Ue3@chwAZ<H+AdXvt");
    expect(result.rating).toBe("excellent");
  });

  it("prices patternless all-set strings as random: 14 characters strong, 16 excellent", () => {
    // Generator output in which zxcvbn finds no pattern at all. 95^14 is ~93 effective bits and
    // 95^16 is ~106, matching what the generator reports for those lengths.
    const fourteen = estimate("pxm:R9k7[ghvnh");
    expect(fourteen.rating).toBe("strong");
    expect(fourteen.effectiveBits).toBeCloseTo(14 * Math.log2(95) + 1, 6);
    expect(fourteen.suggestions).toEqual([]);
    const sixteen = estimate("UJ.,%J$Y<^)/JT2a");
    expect(sixteen.rating).toBe("excellent");
    expect(sixteen.effectiveBits).toBeCloseTo(16 * Math.log2(95) + 1, 6);
  });

  it("does not price words zxcvbn doesn't know as random characters", () => {
    // Afrikaans and isiZulu words joined by a symbol: unknown to the English dictionaries, but
    // still words a cracking tool's wordlists will hold. Before the word-like carve-out these rated
    // strong or excellent.
    for (const phrase of ["Dankie!Totsiens", "Sawubona!Ngiyabonga", "Siyabonga#Ubuntu", "Zdravo!Hvala"]) {
      const result = estimate(phrase);
      expect(["very-weak", "weak", "fair"], phrase).toContain(result.rating);
    }
  });

  it("keeps generated passwords excellent when a chance letter run looks like a word", () => {
    // "Rope" and "Kite" read as words, so they keep zxcvbn's price; the other 12 characters are
    // still random over all four classes, and the whole stays above the excellent line.
    const result = estimate("Rope7#q2Kite!9xZ$4w%");
    expect(result.rating).toBe("excellent");
  });

  it("keeps zxcvbn's pricing for a 12-character lowercase-only random string", () => {
    const value = generated(12, { upper: false, lower: true, digits: false, symbols: false });
    const result = estimate(value);
    // Unadjusted, the whole string costs at most 10^12 guesses; priced as random it would be 26^12.
    expect(result.log10Guesses).toBeLessThanOrEqual(12 + 1e-9);
    expect(result.rating).toBe("very-weak");
  });

  it("rates 'correct horse battery staple' above 'Password1!'", () => {
    expect(estimate("correct horse battery staple").effectiveBits).toBeGreaterThan(estimate("Password1!").effectiveBits);
  });

  it("analyses only the first 100 characters", () => {
    const head = generated(100);
    const long = estimate(`${head}${generated(30)}`);
    expect(long.truncated).toBe(true);
    expect(long.guesses).toBe(estimate(head).guesses);
    expect(estimate(head).truncated).toBe(false);
    // Counted in code points, so astral characters are never split.
    expect(estimate("😀".repeat(MAX_ANALYSED_CHARS)).truncated).toBe(false);
    expect(estimate("😀".repeat(MAX_ANALYSED_CHARS + 1)).truncated).toBe(true);
  });

  it("reports crack times per scenario from the adjusted guesses", () => {
    const result = estimate("Tr0ub4dor&3");
    for (const scenario of SCENARIOS) {
      expect(result.crackSeconds[scenario.id]).toBeCloseTo(result.guesses / scenario.guessesPerSecond, 6);
    }
    expect(result.effectiveBits).toBeCloseTo(Math.log2(result.guesses) + 1, 9);
    expect(result.log10Guesses).toBeCloseTo(Math.log10(result.guesses), 9);
  });

  it("stays finite on the longest input", () => {
    const result = estimate(generated(128));
    expect(Number.isFinite(result.log10Guesses)).toBe(true);
    expect(Number.isFinite(result.guesses)).toBe(true);
    expect(result.rating).toBe("excellent");
  });
});

describe("randomCandidates", () => {
  it("drops letter runs that read like words and keeps everything else", () => {
    expect(randomCandidates("Dankie!Totsiens").join("")).toBe("!");
    expect(randomCandidates("x9Ubuntu#").join("")).toBe("x9#");
  });

  it("keeps vowel-poor letter runs, which are what random strings produce", () => {
    expect(randomCandidates("pxm:R9k7[ghvnh").join("")).toBe("pxm:R9k7[ghvnh");
    expect(randomCandidates("chwAZ<H+AdXvt").join("")).toBe("chwAZ<H+AdXvt");
  });
});

describe("adjustedLog10Guesses (KTD7)", () => {
  it("prices a long, varied unmatched run as random over its classes", () => {
    const token = "aB3$aB3$aB3$aB3$aB3$";
    expect(adjustedLog10Guesses(20, [bruteforce(token)])).toBeCloseTo(20 * Math.log10(95), 9);
  });

  it("uses only the classes present: lower + upper + digits is 62", () => {
    expect(adjustedLog10Guesses(13, [bruteforce("bcdFGH123bcdF")])).toBeCloseTo(13 * Math.log10(62), 9);
  });

  it("leaves fewer than 12 unmatched characters alone", () => {
    expect(adjustedLog10Guesses(11, [bruteforce("aB3$aB3$aB3")])).toBe(11);
  });

  it("leaves runs with fewer than 3 classes alone", () => {
    expect(adjustedLog10Guesses(16, [bruteforce("abcdef1234567890")])).toBe(16);
  });

  it("counts unmatched runs together, keeping matched parts at zxcvbn's price", () => {
    const sequence: MatchExtended[] = [
      bruteforce("aB3$aB"),
      { pattern: "dictionary", i: 6, j: 9, token: "word", guesses: 500 },
      bruteforce("3$aB3$"),
    ];
    // The total is scaled by each run's ratio: (95^6 / 10^6) twice.
    expect(adjustedLog10Guesses(15, sequence)).toBeCloseTo(15 + 2 * (6 * Math.log10(95) - 6), 9);
  });

  it("ignores everything when nothing is unmatched", () => {
    expect(adjustedLog10Guesses(3, [{ pattern: "dictionary", i: 0, j: 7, token: "password", guesses: 2 }])).toBe(3);
  });
});
