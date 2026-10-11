import { describe, expect, it } from "vitest";
import { countValidStrings, log2BigInt, passwordEntropyBits } from "../../src/core/entropy.ts";

// Brute force: enumerate every string and count those that use each set at least once.
function bruteForceCount(sets: readonly string[], length: number): number {
  const alphabet = sets.join("");
  const setOf = new Map<string, number>();
  sets.forEach((set, index) => {
    for (const ch of set) setOf.set(ch, index);
  });
  let valid = 0;
  const indices = new Array<number>(length).fill(0);
  for (;;) {
    const seen = new Set(indices.map((i) => setOf.get(alphabet[i]!)));
    if (seen.size === sets.length) valid += 1;
    let position = 0;
    while (position < length && indices[position] === alphabet.length - 1) {
      indices[position] = 0;
      position += 1;
    }
    if (position === length) return valid;
    indices[position] = (indices[position] ?? 0) + 1;
  }
}

describe("log2BigInt", () => {
  it("is exact on powers of two and precise on everything else", () => {
    expect(log2BigInt(1n)).toBe(0);
    expect(log2BigInt(2n ** 600n)).toBe(600);
    expect(log2BigInt(3n)).toBeCloseTo(Math.log2(3), 14);
    expect(log2BigInt(10n ** 30n)).toBeCloseTo(30 * Math.log2(10), 10);
    // 94^128 is far beyond Number's range; the result must still be exact to ~1e-12 relative.
    expect(log2BigInt(94n ** 128n)).toBeCloseTo(128 * Math.log2(94), 9);
    expect(log2BigInt(2n ** 1100n * 3n)).toBeCloseTo(1100 + Math.log2(3), 9);
  });

  it("returns -Infinity for zero and rejects negatives", () => {
    expect(log2BigInt(0n)).toBe(Number.NEGATIVE_INFINITY);
    expect(() => log2BigInt(-1n)).toThrow(RangeError);
  });
});

describe("password entropy by inclusion-exclusion", () => {
  it("matches a brute-force count for length 4 with two small sets", () => {
    const sets = ["ab", "XYZ"];
    const brute = bruteForceCount(sets, 4);
    expect(brute).toBe(5 ** 4 - 3 ** 4 - 2 ** 4);
    expect(countValidStrings([2, 3], 4)).toBe(BigInt(brute));
    expect(passwordEntropyBits([2, 3], 4)).toBeCloseTo(Math.log2(brute), 12);
  });

  it("matches a brute-force count for length 5 with three sets", () => {
    const sets = ["ab", "XYZ", "7"];
    const brute = bruteForceCount(sets, 5);
    expect(countValidStrings([2, 3, 1], 5)).toBe(BigInt(brute));
    expect(passwordEntropyBits([2, 3, 1], 5)).toBeCloseTo(Math.log2(brute), 12);
  });

  it("is L x log2(n) for a single set", () => {
    expect(passwordEntropyBits([26], 8)).toBeCloseTo(8 * Math.log2(26), 12);
    expect(passwordEntropyBits([26], 8)).toBeCloseTo(37.6, 1);
  });

  it("gives about 839 bits for 128 characters from all four sets", () => {
    // The plan rounds this to "about 838"; it is 128 x log2(94) = 838.99 less a vanishing
    // correction for strings that miss a set.
    const bits = passwordEntropyBits([26, 26, 10, 32], 128);
    expect(bits).toBeGreaterThan(838.5);
    expect(bits).toBeLessThan(128 * Math.log2(94));
    expect(bits).toBeCloseTo(128 * Math.log2(94), 4);
  });

  it("is slightly below L x log2(n) when sets must all appear", () => {
    const bits = passwordEntropyBits([26, 10, 32], 8);
    expect(bits).toBeLessThan(8 * Math.log2(68));
    expect(bits).toBeCloseTo(Math.log2(317_904_834_723_840), 9);
  });
});
