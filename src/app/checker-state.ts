// Check-mode state (R36, R37) as a pure reducer, so the lifecycle rules are testable without a DOM.
// A revision number ties every async result to the input it was computed for: an estimate or a
// breach answer that arrives after the user has edited the password is discarded.

import type { BreachResult } from "../check/breach.ts";
import type { Estimate } from "../check/estimator.ts";
import type { Rating } from "../core/rating.ts";

export type BreachView = { status: "idle" } | { status: "checking" } | BreachResult;

export interface CheckerState {
  revision: number;
  empty: boolean;
  estimate: Estimate | null;
  breach: BreachView;
}

export type CheckerEvent =
  | { type: "input"; empty: boolean }
  | { type: "estimated"; revision: number; estimate: Estimate }
  | { type: "breach-start" }
  | { type: "breach-result"; revision: number; result: BreachResult }
  /** Mode switch, pagehide or a back/forward-cache restore. */
  | { type: "clear" };

export const initialCheckerState: CheckerState = { revision: 0, empty: true, estimate: null, breach: { status: "idle" } };

export function checkerReducer(state: CheckerState, event: CheckerEvent): CheckerState {
  switch (event.type) {
    case "input":
      // Any edit invalidates the previous estimate's freshness and clears a breach result (AE11).
      return { revision: state.revision + 1, empty: event.empty, estimate: event.empty ? null : state.estimate, breach: { status: "idle" } };
    case "estimated":
      return event.revision === state.revision && !state.empty ? { ...state, estimate: event.estimate } : state;
    case "breach-start":
      return state.empty || state.breach.status === "checking" ? state : { ...state, breach: { status: "checking" } };
    case "breach-result":
      return event.revision === state.revision && state.breach.status === "checking" ? { ...state, breach: event.result } : state;
    case "clear":
      // Already clear: return the same state so nothing re-renders.
      if (state.empty && !state.estimate && state.breach.status === "idle") return state;
      return { ...initialCheckerState, revision: state.revision + 1 };
  }
}

/** The rating to show: a breach hit overrides whatever the estimator said (R37). */
export function displayedRating(state: CheckerState): Rating | null {
  if (state.empty || !state.estimate) return null;
  return state.breach.status === "found" ? "compromised" : state.estimate.rating;
}
