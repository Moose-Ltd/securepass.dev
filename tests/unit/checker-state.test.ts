import { describe, expect, it } from "vitest";
import type { Estimate } from "../../src/check/estimator.ts";
import { checkerReducer, displayedRating, initialCheckerState, type CheckerState } from "../../src/app/checker-state.ts";

const estimate = (rating: Estimate["rating"]): Estimate =>
  ({
    guesses: 1e6,
    log10Guesses: 6,
    effectiveBits: 21,
    rating,
    crackSeconds: { "online-throttled": 1, "online-unthrottled": 1, "offline-slow": 1, "offline-fast": 1 },
    warning: null,
    suggestions: [],
    truncated: false,
  }) as Estimate;

function typed(): CheckerState {
  let state = checkerReducer(initialCheckerState, { type: "input", empty: false });
  state = checkerReducer(state, { type: "estimated", revision: state.revision, estimate: estimate("strong") });
  return state;
}

describe("checker state", () => {
  it("moves from rated to checking to found, and a found result overrides the rating", () => {
    let state = typed();
    expect(displayedRating(state)).toBe("strong");
    state = checkerReducer(state, { type: "breach-start" });
    expect(state.breach.status).toBe("checking");
    state = checkerReducer(state, { type: "breach-result", revision: state.revision, result: { status: "found", count: 52256, prefix: "5BAA6" } });
    expect(state.breach).toEqual({ status: "found", count: 52256, prefix: "5BAA6" });
    expect(displayedRating(state)).toBe("compromised");
  });

  it("keeps the estimator's rating when the password is not found", () => {
    let state = checkerReducer(typed(), { type: "breach-start" });
    state = checkerReducer(state, { type: "breach-result", revision: state.revision, result: { status: "not-found", prefix: "5BAA6" } });
    expect(displayedRating(state)).toBe("strong");
  });

  it("clears a breach result on any edit (AE11)", () => {
    let state = checkerReducer(typed(), { type: "breach-start" });
    state = checkerReducer(state, { type: "breach-result", revision: state.revision, result: { status: "found", count: 3, prefix: "AAAAA" } });
    state = checkerReducer(state, { type: "input", empty: false });
    expect(state.breach.status).toBe("idle");
    expect(displayedRating(state)).toBe("strong");
  });

  it("discards a breach answer that arrives after the password changed", () => {
    let state = checkerReducer(typed(), { type: "breach-start" });
    const revision = state.revision;
    state = checkerReducer(state, { type: "input", empty: false });
    state = checkerReducer(state, { type: "breach-result", revision, result: { status: "found", count: 9, prefix: "AAAAA" } });
    expect(state.breach.status).toBe("idle");
  });

  it("discards a stale estimate", () => {
    let state = checkerReducer(initialCheckerState, { type: "input", empty: false });
    const stale = state.revision;
    state = checkerReducer(state, { type: "input", empty: false });
    state = checkerReducer(state, { type: "estimated", revision: stale, estimate: estimate("weak") });
    expect(state.estimate).toBeNull();
  });

  it("returns to empty from any state on clear (mode switch, pagehide, bfcache)", () => {
    for (const before of [typed(), checkerReducer(typed(), { type: "breach-start" })]) {
      const after = checkerReducer(before, { type: "clear" });
      expect(after.empty).toBe(true);
      expect(after.estimate).toBeNull();
      expect(after.breach.status).toBe("idle");
      expect(displayedRating(after)).toBeNull();
    }
  });

  it("refuses to start a second lookup or one with an empty field", () => {
    const checking = checkerReducer(typed(), { type: "breach-start" });
    expect(checkerReducer(checking, { type: "breach-start" })).toBe(checking);
    expect(checkerReducer(initialCheckerState, { type: "breach-start" })).toBe(initialCheckerState);
  });
});
