import { describe, expect, it } from "vitest";
import { RATING_LABELS, RATING_ORDER, ratingFromBits } from "../../src/core/rating.ts";

describe("ratingFromBits (KTD7)", () => {
  it.each([
    [0, "very-weak"],
    [19.93, "very-weak"],
    [44.9, "very-weak"],
    [45, "weak"],
    [59.999, "weak"],
    [60, "fair"],
    [74.999, "fair"],
    [75, "strong"],
    [99.9, "strong"],
    [100, "excellent"],
    [839, "excellent"],
    [Number.POSITIVE_INFINITY, "excellent"],
    [Number.NaN, "very-weak"],
  ])("rates %d bits as %s", (bits, rating) => {
    expect(ratingFromBits(bits)).toBe(rating);
  });

  it("labels every rating, including the breach override", () => {
    expect(RATING_LABELS).toEqual({
      "very-weak": "Very weak",
      weak: "Weak",
      fair: "Fair",
      strong: "Strong",
      excellent: "Excellent",
      compromised: "Compromised",
    });
  });

  it("orders the scale from weakest to strongest", () => {
    expect(RATING_ORDER).toEqual(["very-weak", "weak", "fair", "strong", "excellent"]);
  });
});
