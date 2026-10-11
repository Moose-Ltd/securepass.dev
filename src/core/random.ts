// The single source of randomness for every secret the site makes. It uses the platform CSPRNG
// and refuses to run without one: any fallback would quietly produce guessable secrets.

export class InsecureEnvironmentError extends Error {
  override readonly name = "InsecureEnvironmentError";

  constructor(
    message = "This browser has no secure random number generator (crypto.getRandomValues), so no secret can be generated safely.",
  ) {
    super(message);
  }
}

const UINT32_RANGE = 2 ** 32;

export function hasSecureRandom(): boolean {
  return typeof globalThis.crypto?.getRandomValues === "function";
}

// Looked up on every call rather than captured at import, so a missing or replaced source is
// noticed at the moment a secret is requested.
function secureSource(): Crypto {
  const source = globalThis.crypto as Crypto | undefined;
  if (typeof source?.getRandomValues !== "function") throw new InsecureEnvironmentError();
  return source;
}

/** Throws InsecureEnvironmentError unless crypto.getRandomValues is available. */
export function assertSecureRandom(): void {
  secureSource();
}

/** A uniformly distributed integer in [0, n), for 1 <= n <= 2^32. */
export function randomInt(n: number): number {
  if (!Number.isSafeInteger(n) || n < 1 || n > UINT32_RANGE) {
    throw new RangeError(`randomInt needs an integer range between 1 and 2^32, got ${n}`);
  }
  const source = secureSource();
  // 2^32 is rarely a multiple of n, so reducing every draw modulo n would make the low results
  // slightly more likely. Draws at or above the largest multiple of n are discarded and redrawn;
  // even in the worst case under half of all draws are rejected, so the loop ends quickly.
  const limit = Math.floor(UINT32_RANGE / n) * n;
  const draw = new Uint32Array(1);
  for (;;) {
    source.getRandomValues(draw);
    const value = draw[0] ?? limit;
    if (value < limit) return value % n;
  }
}

/** Rounds a raw UI value to an integer within limits; anything non-numeric becomes the default. */
export function clampInteger(value: number, limits: { readonly min: number; readonly max: number; readonly default: number }): number {
  if (!Number.isFinite(value)) return limits.default;
  return Math.min(limits.max, Math.max(limits.min, Math.round(value)));
}
