import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PASSWORD_OPTIONS } from "../../src/core/charsets.ts";
import { DEFAULT_PASSPHRASE_OPTIONS, generatePassphrase } from "../../src/core/passphrase.ts";
import { generatePassword } from "../../src/core/password.ts";
import { generatePin } from "../../src/core/pin.ts";
import { InsecureEnvironmentError, hasSecureRandom, randomInt } from "../../src/core/random.ts";

// Upper critical value of chi-square via the Wilson–Hilferty approximation, which is accurate
// to well under 1% for the degrees of freedom used here. z is the standard normal quantile.
function chiSquareCritical(df: number, z: number): number {
  const k = 2 / (9 * df);
  return df * (1 - k + z * Math.sqrt(k)) ** 3;
}

// z for an upper tail of 1e-6 per test: four distributions are checked, so a correct
// generator fails this file by chance about once in 250,000 runs.
const Z_ONE_IN_A_MILLION = 4.7534;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("randomInt", () => {
  for (const n of [3, 7, 62, 7776]) {
    // Real randomness: a fair source fails this rarely, so two retries make a chance failure negligible
    // while a real bias still fails every attempt.
    it(`draws uniformly from [0, ${n}) over 100,000 draws`, { retry: 2 }, () => {
      const draws = 100_000;
      const counts = new Array<number>(n).fill(0);
      for (let i = 0; i < draws; i += 1) {
        const value = randomInt(n);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(n);
        counts[value] = (counts[value] ?? 0) + 1;
      }

      const expected = draws / n;
      const chiSquare = counts.reduce((sum, observed) => sum + (observed - expected) ** 2 / expected, 0);
      expect(chiSquare).toBeLessThan(chiSquareCritical(n - 1, Z_ONE_IN_A_MILLION));

      // Per-bucket bound only where buckets are large enough for a normal approximation;
      // with 7,776 buckets of ~13 draws the chi-square above is the meaningful test.
      if (n <= 62) {
        const sigma = Math.sqrt(expected * (1 - 1 / n));
        for (const observed of counts) {
          expect(Math.abs(observed - expected)).toBeLessThan(6 * sigma);
        }
      }
    });
  }

  it("returns 0 for n = 1 and rejects ranges it cannot serve", () => {
    expect(randomInt(1)).toBe(0);
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 32 + 1]) {
      expect(() => randomInt(bad)).toThrow(RangeError);
    }
  });

  it("retries values in the rejection zone instead of wrapping them", () => {
    // 2^32 = 552,336 * 7,776 + 2,560, so the top 2,560 values would favour 0..2,559 if reduced
    // modulo 7,776. Both zone values below would wrap to small results (0 and 2,559).
    const zoneStart = Math.floor(2 ** 32 / 7776) * 7776;
    expect(zoneStart).toBe(4_294_964_736);
    const queue = [zoneStart, 2 ** 32 - 1, 7777];
    const getRandomValues = vi.fn(<T extends ArrayBufferView | null>(array: T): T => {
      if (array instanceof Uint32Array) {
        for (let i = 0; i < array.length; i += 1) {
          const next = queue.shift();
          if (next === undefined) throw new Error("stub exhausted");
          array[i] = next;
        }
      }
      return array;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    expect(randomInt(7776)).toBe(1);
    expect(getRandomValues).toHaveBeenCalledTimes(3);
  });

  it("accepts the last value below the rejection zone", () => {
    const below = Math.floor(2 ** 32 / 7776) * 7776 - 1;
    vi.stubGlobal("crypto", {
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
        if (array instanceof Uint32Array) array.fill(below);
        return array;
      },
    });
    expect(randomInt(7776)).toBe(7775);
  });
});

describe("insecure environments (AE2)", () => {
  const generators: Record<string, () => unknown> = {
    randomInt: () => randomInt(10),
    generatePassword: () => generatePassword(DEFAULT_PASSWORD_OPTIONS),
    generatePassphrase: () => generatePassphrase(DEFAULT_PASSPHRASE_OPTIONS, ["alpha", "bravo", "charlie"]),
    generatePin: () => generatePin(6),
  };

  it("reports a secure source when one exists", () => {
    expect(hasSecureRandom()).toBe(true);
  });

  for (const [label, absent] of [
    ["crypto is missing", undefined],
    ["crypto has no getRandomValues", {}],
  ] as const) {
    it(`refuses every generator when ${label}`, () => {
      vi.stubGlobal("crypto", absent);
      expect(hasSecureRandom()).toBe(false);
      for (const [name, generate] of Object.entries(generators)) {
        expect(generate, name).toThrow(InsecureEnvironmentError);
      }
    });
  }

  it("is a typed error that callers can recognise", () => {
    vi.stubGlobal("crypto", undefined);
    try {
      generatePin(6);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InsecureEnvironmentError);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).name).toBe("InsecureEnvironmentError");
    }
  });
});
