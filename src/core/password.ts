// Random passwords (R3, R4, R38).

import { PASSWORD_LIMITS, effectiveAlphabet, type CharsetId, type PasswordOptions } from "./charsets.ts";
import { passwordEntropyBits } from "./entropy.ts";
import { assertSecureRandom, clampInteger, randomInt } from "./random.ts";

export type PasswordResult =
  | { ok: true; value: string; entropyBits: number; alphabetSize: number; unavailable: readonly CharsetId[] }
  | { ok: false; reason: "empty-alphabet"; unavailable: readonly CharsetId[] };

export function generatePassword(opts: PasswordOptions): PasswordResult {
  // Checked before anything else so an insecure environment always fails the same way, even
  // when the options would also have produced an empty alphabet.
  assertSecureRandom();
  const length = clampInteger(opts.length, PASSWORD_LIMITS);
  const alphabet = effectiveAlphabet(opts);
  if (alphabet.size === 0) return { ok: false, reason: "empty-alphabet", unavailable: alphabet.unavailable };

  const pool: string[] = [];
  const setIndex: number[] = [];
  alphabet.sets.forEach((set, index) => {
    for (const ch of set.chars) {
      pool.push(ch);
      setIndex.push(index);
    }
  });

  // Every candidate is uniform over the whole alphabet, and candidates missing a set are thrown
  // away whole. What survives is uniform over exactly the valid passwords (R4). Planting one
  // character per set and shuffling would instead over-weight small sets, such as digits. The
  // minimum length of 8 covers at most 4 sets, so a valid candidate always has a real chance.
  const chars = new Array<string>(length);
  for (;;) {
    const seen = new Set<number>();
    for (let i = 0; i < length; i += 1) {
      const pick = randomInt(pool.length);
      chars[i] = pool[pick] ?? "";
      seen.add(setIndex[pick] ?? -1);
    }
    if (seen.size === alphabet.sets.length) break;
  }

  return {
    ok: true,
    value: chars.join(""),
    entropyBits: passwordEntropyBits(
      alphabet.sets.map((set) => set.chars.length),
      length,
    ),
    alphabetSize: alphabet.size,
    unavailable: alphabet.unavailable,
  };
}

/**
 * Whether the UI may switch a set off (AE9). It may not when that would leave no set with
 * characters to draw from; an enabled set emptied by exclusions does not count as remaining.
 */
export function canDisableSet(opts: PasswordOptions, id: CharsetId): boolean {
  if (!opts.sets[id]) return true;
  return effectiveAlphabet({ ...opts, sets: { ...opts.sets, [id]: false } }).sets.length > 0;
}
