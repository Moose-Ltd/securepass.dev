import { describe, expect, it } from "vitest";
import { PIN_LIMITS, generatePin } from "../../src/core/pin.ts";

describe("generatePin", () => {
  it("makes a 6-digit PIN of only 0-9 worth 19.93 bits", () => {
    for (let i = 0; i < 500; i += 1) {
      const pin = generatePin(6);
      expect(pin.value).toMatch(/^[0-9]{6}$/);
      expect(pin.entropyBits).toBeCloseTo(19.93, 2);
      expect(pin.entropyBits).toBeCloseTo(6 * Math.log2(10), 12);
    }
  });

  it("uses every digit in every position", () => {
    const seen = Array.from({ length: 6 }, () => new Set<string>());
    for (let i = 0; i < 2000; i += 1) {
      [...generatePin(6).value].forEach((digit, position) => seen[position]!.add(digit));
    }
    for (const digits of seen) expect(digits.size).toBe(10);
  });

  it("clamps the length to 4-12 digits", () => {
    expect(PIN_LIMITS).toEqual({ min: 4, max: 12, default: 6 });
    expect(generatePin(2).value).toHaveLength(4);
    expect(generatePin(40).value).toHaveLength(12);
    expect(generatePin(Number.NaN).value).toHaveLength(6);
    expect(generatePin(12).entropyBits).toBeCloseTo(12 * Math.log2(10), 12);
  });
});
