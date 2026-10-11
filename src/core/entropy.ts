// Exact entropy for generated secrets (KTD6). Entropy here is log2 of the number of equally
// likely outcomes the generator can produce, so it is a count, not an estimate.

/**
 * The number of length-L strings over the union of disjoint sets of the given sizes that use
 * every set at least once. Inclusion-exclusion over the subsets S of sets that are left out:
 * sum of (-1)^|S| * (n - |S's characters|)^L. BigInt, because 94^128 has 253 digits.
 */
export function countValidStrings(setSizes: readonly number[], length: number): bigint {
  if (!Number.isSafeInteger(length) || length < 0) throw new RangeError(`length must be a non-negative integer, got ${length}`);
  if (setSizes.length > 16) throw new RangeError("too many sets for inclusion-exclusion");
  for (const size of setSizes) {
    if (!Number.isSafeInteger(size) || size < 0) throw new RangeError(`set sizes must be non-negative integers, got ${size}`);
  }
  const total = setSizes.reduce((sum, size) => sum + size, 0);
  const exponent = BigInt(length);
  let count = 0n;
  for (let mask = 0; mask < 1 << setSizes.length; mask += 1) {
    let remaining = total;
    let odd = false;
    setSizes.forEach((size, index) => {
      if (mask & (1 << index)) {
        remaining -= size;
        odd = !odd;
      }
    });
    const term = BigInt(remaining) ** exponent;
    count += odd ? -term : term;
  }
  return count;
}

/** log2 of a non-negative BigInt, accurate to double precision at any magnitude. */
export function log2BigInt(n: bigint): number {
  if (n < 0n) throw new RangeError("log2 of a negative number");
  if (n === 0n) return Number.NEGATIVE_INFINITY;
  const bitLength = n.toString(2).length;
  // A double carries 53 significant bits, so the top 53 bits hold all the precision a result
  // can show; the bits shifted away only move the exponent, which is added back exactly.
  const shift = Math.max(0, bitLength - 53);
  return Math.log2(Number(n >> BigInt(shift))) + shift;
}

/** Bits of a password drawn uniformly from the strings that use every set at least once. */
export function passwordEntropyBits(setSizes: readonly number[], length: number): number {
  return log2BigInt(countValidStrings(setSizes, length));
}

/**
 * Words are drawn independently from the list. The optional digit (0-9) is appended to one
 * word chosen at random, which multiplies the outcomes by 10 x words. Capitalisation and the
 * separator are fixed by the options, so they add nothing.
 */
export function passphraseEntropyBits(words: number, wordlistSize: number, includeDigit: boolean): number {
  const bits = words * Math.log2(wordlistSize);
  return includeDigit ? bits + Math.log2(10 * words) : bits;
}

export function pinEntropyBits(digits: number): number {
  return digits * Math.log2(10);
}
