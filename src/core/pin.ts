// Numeric PINs (R6). Short by nature, so the UI labels them for places that limit attempts.

import { pinEntropyBits } from "./entropy.ts";
import { assertSecureRandom, clampInteger, randomInt } from "./random.ts";

export const PIN_LIMITS = Object.freeze({ min: 4, max: 12, default: 6 } as const);

export function generatePin(digits: number): { value: string; entropyBits: number } {
  assertSecureRandom();
  const length = clampInteger(digits, PIN_LIMITS);
  let value = "";
  for (let i = 0; i < length; i += 1) value += String(randomInt(10));
  return { value, entropyBits: pinEntropyBits(length) };
}
