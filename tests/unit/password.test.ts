import { describe, expect, it } from "vitest";
import {
  AMBIGUOUS,
  CHARSETS,
  CHARSET_IDS,
  DEFAULT_PASSWORD_OPTIONS,
  PASSWORD_LIMITS,
  charClass,
  effectiveAlphabet,
  type CharsetId,
  type PasswordOptions,
} from "../../src/core/charsets.ts";
import { canDisableSet, generatePassword } from "../../src/core/password.ts";

function options(overrides: Partial<Omit<PasswordOptions, "sets">> & { sets?: Partial<Record<CharsetId, boolean>> } = {}): PasswordOptions {
  return {
    ...DEFAULT_PASSWORD_OPTIONS,
    ...overrides,
    sets: { upper: false, lower: false, digits: false, symbols: false, ...overrides.sets },
  };
}

function generated(opts: PasswordOptions): string {
  const result = generatePassword(opts);
  if (!result.ok) throw new Error(`expected a password, got ${result.reason}`);
  return result.value;
}

// Independent of src/core/entropy.ts on purpose: the expectation must not share code with the
// thing it checks. Counts length-L strings over an alphabet of `alphabetSize` characters that
// use at least one character from each of the disjoint `required` subsets (inclusion-exclusion).
function countCovering(alphabetSize: number, required: readonly number[], length: number): bigint {
  let count = 0n;
  for (let mask = 0; mask < 1 << required.length; mask += 1) {
    let left = alphabetSize;
    let parity = 0;
    required.forEach((size, index) => {
      if (mask & (1 << index)) {
        left -= size;
        parity ^= 1;
      }
    });
    const term = BigInt(left) ** BigInt(length);
    count += parity ? -term : term;
  }
  return count;
}

function chiSquareCritical(df: number, z: number): number {
  const k = 2 / (9 * df);
  return df * (1 - k + z * Math.sqrt(k)) ** 3;
}

describe("character sets", () => {
  it("defines the four sets over printable ASCII", () => {
    expect(CHARSET_IDS).toEqual(["upper", "lower", "digits", "symbols"]);
    expect(CHARSETS.upper).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(CHARSETS.lower).toBe("abcdefghijklmnopqrstuvwxyz");
    expect(CHARSETS.digits).toBe("0123456789");
    expect(CHARSETS.symbols).toBe("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~");
    expect(CHARSETS.symbols).toHaveLength(32);
    // Every printable, non-space ASCII character appears in exactly one set.
    const all = CHARSET_IDS.map((id) => CHARSETS[id]).join("");
    expect(new Set(all).size).toBe(94);
    for (let code = 0x21; code <= 0x7e; code += 1) expect(all).toContain(String.fromCharCode(code));
  });

  it("treats look-alikes and quotes as ambiguous", () => {
    expect([...AMBIGUOUS].sort()).toEqual([..."Il1O0o|'\"`"].sort());
  });

  it("classifies any character", () => {
    expect(charClass("Q")).toBe("upper");
    expect(charClass("q")).toBe("lower");
    expect(charClass("7")).toBe("digits");
    expect(charClass("#")).toBe("symbols");
    expect(charClass(" ")).toBe("symbols");
    expect(charClass("é")).toBe("symbols");
    expect(charClass("😀")).toBe("symbols");
  });

  it("has the documented defaults and limits", () => {
    expect(PASSWORD_LIMITS).toEqual({ min: 8, max: 128, default: 20 });
    expect(DEFAULT_PASSWORD_OPTIONS).toEqual({
      length: 20,
      sets: { upper: true, lower: true, digits: true, symbols: true },
      avoidAmbiguous: false,
      exclude: "",
    });
  });
});

describe("effectiveAlphabet (R38)", () => {
  it("removes ambiguous characters from every set", () => {
    const alphabet = effectiveAlphabet({ ...DEFAULT_PASSWORD_OPTIONS, avoidAmbiguous: true });
    const chars = alphabet.sets.flatMap((set) => set.chars);
    for (const ch of AMBIGUOUS) expect(chars).not.toContain(ch);
    expect(alphabet.size).toBe(94 - AMBIGUOUS.length);
  });

  it("splits exclusions by code point, de-duplicates, keeps case and ignores whitespace", () => {
    const alphabet = effectiveAlphabet({ ...DEFAULT_PASSWORD_OPTIONS, exclude: "aa B \t\n%😀" });
    const chars = alphabet.sets.flatMap((set) => set.chars);
    expect(chars).not.toContain("a");
    expect(chars).toContain("A");
    expect(chars).not.toContain("B");
    expect(chars).toContain("b");
    expect(chars).not.toContain("%");
    expect(alphabet.size).toBe(94 - 3);
    expect(alphabet.unavailable).toEqual([]);
  });

  it("ignores disabled sets and reports emptied enabled sets as unavailable", () => {
    const alphabet = effectiveAlphabet(options({ sets: { upper: true, digits: true }, exclude: "0123456789" }));
    expect(alphabet.sets.map((set) => set.id)).toEqual(["upper"]);
    expect(alphabet.unavailable).toEqual(["digits"]);
    expect(alphabet.size).toBe(26);
  });
});

describe("generatePassword", () => {
  // Real randomness: about 1 run in 1,000 fails by chance; two retries make that negligible, and a
  // real bias still fails every attempt.
  it("covers AE1: every enabled set appears and each position matches the exact valid-set distribution", { retry: 2 }, () => {
    const opts = options({ length: 8, sets: { upper: true, digits: true, symbols: true } });
    const sets = { upper: CHARSETS.upper, digits: CHARSETS.digits, symbols: CHARSETS.symbols };
    const sizes = [sets.upper.length, sets.digits.length, sets.symbols.length];
    const alphabet = [...sets.upper, ...sets.digits, ...sets.symbols];
    const n = alphabet.length;
    const length = 8;
    const samples = 10_000;

    // P(a given position holds character c of set A) = (valid strings with c there) / (valid
    // strings). With c fixed, A is already covered, so the other L-1 positions, still drawn from
    // the whole alphabet, need only cover the remaining sets.
    const valid = countCovering(n, sizes, length);
    const perChar = (setIndex: number): number => {
      const others = sizes.filter((_, index) => index !== setIndex);
      return Number(countCovering(n, others, length - 1)) / Number(valid);
    };
    const probability: Record<string, number> = {};
    const pUpper = perChar(0);
    const pDigit = perChar(1);
    const pSymbol = perChar(2);
    for (const ch of sets.upper) probability[ch] = pUpper;
    for (const ch of sets.digits) probability[ch] = pDigit;
    for (const ch of sets.symbols) probability[ch] = pSymbol;

    // The figures the plan quotes, and a distribution that sums to one.
    expect(pDigit).toBeCloseTo(0.0202, 4);
    expect(pUpper).toBeCloseTo(0.014, 4);
    expect(pSymbol).toBeCloseTo(0.0136, 4);
    expect(alphabet.reduce((sum, ch) => sum + (probability[ch] ?? 0), 0)).toBeCloseTo(1, 12);

    const counts = Array.from({ length }, () => new Map<string, number>());
    const pooled = { upper: 0, digits: 0, symbols: 0 };
    for (let i = 0; i < samples; i += 1) {
      const value = generated(opts);
      expect(value).toHaveLength(length);
      expect(value).toMatch(/[A-Z]/);
      expect(value).toMatch(/[0-9]/);
      expect(value).toMatch(/[^A-Za-z0-9]/);
      expect(value).not.toMatch(/[a-z]/);
      [...value].forEach((ch, position) => {
        const map = counts[position]!;
        map.set(ch, (map.get(ch) ?? 0) + 1);
        pooled[charClass(ch) as keyof typeof pooled] += 1;
      });
    }

    // Nine tests share a family-wise false-alarm rate of 0.001 (Bonferroni), so a correct
    // generator fails this case by chance about once in a thousand runs at most.
    const perTestAlpha = 0.001 / 9;
    const zBonferroni = 3.6923; // upper-tail normal quantile for 0.001 / 9
    const critical = chiSquareCritical(n - 1, zBonferroni);
    for (const map of counts) {
      let chiSquare = 0;
      for (const ch of alphabet) {
        const expected = samples * (probability[ch] ?? 0);
        chiSquare += ((map.get(ch) ?? 0) - expected) ** 2 / expected;
      }
      expect(chiSquare).toBeLessThan(critical);
    }

    // Pooled set frequencies are where a biased "force one of each, then shuffle" generator
    // shows up most clearly. With df = 2 the chi-square tail is exactly exp(-x / 2).
    const draws = samples * length;
    const expectedSets = { upper: 26 * pUpper, digits: 10 * pDigit, symbols: 32 * pSymbol };
    const pooledChiSquare = (model: Record<keyof typeof pooled, number>): number =>
      (Object.keys(pooled) as (keyof typeof pooled)[]).reduce(
        (sum, id) => sum + (pooled[id] - draws * model[id]) ** 2 / (draws * model[id]),
        0,
      );
    expect(pooledChiSquare(expectedSets)).toBeLessThan(-2 * Math.log(perTestAlpha));
    // Sanity check on the test's power: the naive 1/68-per-character model is clearly rejected.
    expect(pooledChiSquare({ upper: 26 / n, digits: 10 / n, symbols: 32 / n })).toBeGreaterThan(
      -2 * Math.log(perTestAlpha),
    );
  });

  it("covers AE10: excluding every digit makes digits unavailable and prices the 3-set alphabet exactly", () => {
    const opts = { ...DEFAULT_PASSWORD_OPTIONS, length: 16, exclude: "0123456789" };
    for (let i = 0; i < 200; i += 1) {
      const result = generatePassword(opts);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).not.toMatch(/[0-9]/);
      expect(result.value).toMatch(/[A-Z]/);
      expect(result.value).toMatch(/[a-z]/);
      expect(result.value).toMatch(/[^A-Za-z0-9]/);
      expect(result.unavailable).toEqual(["digits"]);
      expect(result.alphabetSize).toBe(84);
      const exact = Math.log2(Number(countCovering(84, [26, 26, 32], 16)));
      expect(result.entropyBits).toBeCloseTo(exact, 9);
    }
  });

  it("returns an empty-alphabet result, not an exception or an empty string", () => {
    const opts = options({
      sets: { digits: true, symbols: true },
      avoidAmbiguous: true,
      exclude: "23456789!#$%&()*+,-./:;<=>?@[\\]^_{}~",
    });
    const result = generatePassword(opts);
    expect(result).toEqual({ ok: false, reason: "empty-alphabet", unavailable: ["digits", "symbols"] });
  });

  it("returns an empty-alphabet result when nothing is enabled", () => {
    expect(generatePassword(options())).toEqual({ ok: false, reason: "empty-alphabet", unavailable: [] });
  });

  it("draws only from the effective alphabet", () => {
    // 0 and 1 are ambiguous and 2-9 are excluded, so digits are unavailable.
    const opts = { ...DEFAULT_PASSWORD_OPTIONS, length: 8, avoidAmbiguous: true, exclude: "23456789" };
    const alphabet = effectiveAlphabet(opts);
    expect(alphabet.unavailable).toEqual(["digits"]);
    const allowed = new Set(alphabet.sets.flatMap((set) => set.chars));
    for (let i = 0; i < 300; i += 1) {
      for (const ch of generated(opts)) expect(allowed.has(ch), ch).toBe(true);
    }
  });

  it("still covers a set reduced to a single character", () => {
    const opts = { ...DEFAULT_PASSWORD_OPTIONS, length: 8, exclude: "012345678" };
    for (let i = 0; i < 300; i += 1) expect(generated(opts)).toContain("9");
  });

  it("clamps the length to its limits", () => {
    expect(generated({ ...DEFAULT_PASSWORD_OPTIONS, length: 3 })).toHaveLength(8);
    expect(generated({ ...DEFAULT_PASSWORD_OPTIONS, length: 500 })).toHaveLength(128);
    expect(generated({ ...DEFAULT_PASSWORD_OPTIONS, length: 12.4 })).toHaveLength(12);
    expect(generated({ ...DEFAULT_PASSWORD_OPTIONS, length: Number.NaN })).toHaveLength(20);
  });

  it("reports exact entropy and the alphabet size", () => {
    const result = generatePassword(DEFAULT_PASSWORD_OPTIONS);
    expect(result.ok && result.value).toHaveLength(20);
    if (!result.ok) return;
    expect(result.alphabetSize).toBe(94);
    expect(result.unavailable).toEqual([]);
    expect(result.entropyBits).toBeCloseTo(Math.log2(Number(countCovering(94, [26, 26, 10, 32], 20))), 9);
  });
});

describe("canDisableSet (AE9)", () => {
  it("refuses to disable the only enabled set", () => {
    const opts = options({ sets: { lower: true } });
    expect(canDisableSet(opts, "lower")).toBe(false);
  });

  it("allows disabling a set while another remains available", () => {
    const opts = options({ sets: { lower: true, digits: true } });
    expect(canDisableSet(opts, "lower")).toBe(true);
    expect(canDisableSet(opts, "digits")).toBe(true);
  });

  it("treats an unavailable set as not counting toward what remains", () => {
    const opts = options({ sets: { upper: true, digits: true }, exclude: "0123456789" });
    expect(canDisableSet(opts, "upper")).toBe(false);
    expect(canDisableSet(opts, "digits")).toBe(true);
  });

  it("allows 'disabling' a set that is already off", () => {
    expect(canDisableSet(options({ sets: { lower: true } }), "symbols")).toBe(true);
  });
});
