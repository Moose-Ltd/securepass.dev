// One rating scale for generated and checked secrets, applied to effective bits (KTD7).

export type Rating = "very-weak" | "weak" | "fair" | "strong" | "excellent" | "compromised";

export const RATING_LABELS: Readonly<Record<Rating, string>> = Object.freeze({
  "very-weak": "Very weak",
  weak: "Weak",
  fair: "Fair",
  strong: "Strong",
  excellent: "Excellent",
  // Never computed from bits: the UI sets it when a breach check finds the password.
  compromised: "Compromised",
});

export type BitsRating = Exclude<Rating, "compromised">;

/** Weakest to strongest. */
export const RATING_ORDER: readonly BitsRating[] = Object.freeze(["very-weak", "weak", "fair", "strong", "excellent"]);

// Lower bound (inclusive) of each band, strongest first.
const BANDS: readonly (readonly [minBits: number, rating: BitsRating])[] = [
  [100, "excellent"],
  [75, "strong"],
  [60, "fair"],
  [45, "weak"],
];

export function ratingFromBits(bits: number): BitsRating {
  for (const [minBits, rating] of BANDS) if (bits >= minBits) return rating;
  // Also catches NaN, so a broken input never looks strong.
  return "very-weak";
}
