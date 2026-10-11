// The strength checker (U7). The typed password stays in the input element only: it is never put in
// the URL, history state, storage or an announcement, and the field is wiped whenever the user
// leaves the mode or the page (R36).

import { canCheckBreaches, checkBreach, type BreachFailure } from "../check/breach.ts";
import type { Estimator } from "../check/estimator.ts";
import { RATING_LABELS } from "../core/rating.ts";
import { announce } from "./announcer.ts";
import { checkerReducer, displayedRating, initialCheckerState, type CheckerEvent, type CheckerState } from "./checker-state.ts";
import { $, debounce, el } from "./dom.ts";
import { StrengthBlock } from "./strength-ui.ts";

const FAILURES: Record<BreachFailure, string> = {
  offline: "The check couldn't reach Have I Been Pwned. You may be offline. Try again when you're connected.",
  timeout: "Have I Been Pwned took too long to answer. Try again in a moment.",
  http: "Have I Been Pwned didn't send a usable answer. Try again later.",
  unsupported: "This browser can't run the breach check privately.",
  busy: "A check is already running.",
};

const numberFormat = new Intl.NumberFormat("en");

export class Checker {
  private state: CheckerState = initialCheckerState;
  private estimator: Estimator | null = null;
  private loading: Promise<void> | null = null;
  private loadFailed = false;
  private readonly input: HTMLInputElement;
  private readonly reveal: HTMLButtonElement;
  private readonly strength: StrengthBlock;
  private readonly feedback: HTMLUListElement;
  private readonly hint: HTMLElement;
  private readonly breachButton: HTMLButtonElement;
  private readonly breachResult: HTMLElement;
  private readonly hintText: string;
  private readonly estimateSoon = debounce(() => this.estimate(), 120);
  private readonly announceStrength = debounce(() => {
    const rating = displayedRating(this.state);
    if (rating && this.state.estimate) {
      const warning = this.state.estimate.warning ? ` ${this.state.estimate.warning}` : "";
      announce(`Strength: ${this.strengthLabel()}.${warning}`);
    }
  }, 800);

  constructor(panel: HTMLElement) {
    this.input = $<HTMLInputElement>("[data-check-input]", panel);
    this.reveal = $<HTMLButtonElement>('[data-action="reveal"]', panel);
    this.strength = new StrengthBlock($('[data-strength="check"]', panel));
    this.feedback = $<HTMLUListElement>("[data-check-feedback]", panel);
    this.hint = $("[data-check-hint]", panel);
    this.hintText = this.hint.textContent ?? "";
    this.breachButton = $<HTMLButtonElement>('[data-action="breach"]', panel);
    this.breachResult = $("[data-breach-result]", panel);

    if (!canCheckBreaches()) $("[data-breach]", panel).hidden = true;

    // The estimator (about 450 KB) loads on the first real interaction, never during page load (KTD8).
    for (const type of ["focus", "pointerdown", "keydown"] as const) {
      this.input.addEventListener(type, () => void this.loadEstimator(), { once: true });
    }
    this.input.addEventListener("input", () => {
      this.dispatch({ type: "input", empty: this.input.value === "" });
      this.estimateSoon();
    });
    this.reveal.addEventListener("click", () => this.setRevealed(this.input.type === "password"));
    this.breachButton.addEventListener("click", () => void this.runBreachCheck());

    // R36: nothing typed survives leaving the page, including through the back/forward cache.
    window.addEventListener("pagehide", () => this.clear());
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) this.clear();
    });
  }

  /** Wipes the field and every result. Called on mode switches and page lifecycle events. */
  clear(): void {
    this.input.value = "";
    this.setRevealed(false);
    this.estimateSoon.cancel();
    this.announceStrength.cancel();
    this.dispatch({ type: "clear" });
  }

  private setRevealed(revealed: boolean): void {
    this.input.type = revealed ? "text" : "password";
    this.reveal.setAttribute("aria-pressed", String(revealed));
    this.reveal.setAttribute("aria-label", revealed ? "Hide password" : "Show password");
  }

  private loadEstimator(): Promise<void> {
    this.loading ??= (async () => {
      this.loadFailed = false;
      this.renderHint();
      try {
        const { loadEstimator } = await import("../check/estimator.ts");
        this.estimator = await loadEstimator();
      } catch {
        this.loadFailed = true;
        this.loading = null;
      }
      this.renderHint();
      this.estimate();
    })();
    return this.loading;
  }

  private estimate(): void {
    if (this.state.empty) return;
    if (!this.estimator) {
      void this.loadEstimator();
      return;
    }
    const revision = this.state.revision;
    this.dispatch({ type: "estimated", revision, estimate: this.estimator(this.input.value) });
    this.announceStrength();
  }

  private async runBreachCheck(): Promise<void> {
    if (this.state.empty) return;
    const revision = this.state.revision;
    this.dispatch({ type: "breach-start" });
    announce("Checking breaches");
    const result = await checkBreach(this.input.value);
    this.dispatch({ type: "breach-result", revision, result });
    if (this.state.revision !== revision) return;
    if (result.status === "found") announce(`Found in breaches ${numberFormat.format(result.count)} times. Don't use this password.`);
    else if (result.status === "not-found") announce("Not found in known breaches");
    else announce(`Breach check failed. ${FAILURES[result.reason]}`);
  }

  private dispatch(event: CheckerEvent): void {
    const next = checkerReducer(this.state, event);
    if (next === this.state) return;
    this.state = next;
    this.render();
  }

  private strengthLabel(): string {
    const rating = displayedRating(this.state);
    return rating ? RATING_LABELS[rating].toLowerCase() : "";
  }

  private renderHint(): void {
    if (this.loadFailed) {
      const retry = el("button", { className: "linkbtn", text: "Try again", attrs: { type: "button" } });
      retry.addEventListener("click", () => void this.loadEstimator());
      this.hint.replaceChildren("The strength estimator couldn't load. ", retry);
    } else if (this.loading && !this.estimator) {
      this.hint.textContent = "Loading the strength estimator on your device…";
    } else {
      this.hint.textContent = this.hintText;
    }
  }

  private render(): void {
    const { state } = this;
    const rating = displayedRating(state);

    if (state.empty || !state.estimate || !rating) {
      this.strength.clear();
      this.feedback.replaceChildren();
    } else {
      const estimate = state.estimate;
      this.strength.render({
        rating,
        crackSeconds: estimate.crackSeconds,
        ...(rating === "compromised" ? { timeLine: ["Found in a data breach, so attackers will try it first."] } : {}),
      });
      const items: HTMLLIElement[] = [];
      if (estimate.warning) items.push(el("li", { text: estimate.warning, attrs: { "data-kind": "warning" } }));
      for (const suggestion of estimate.suggestions) items.push(el("li", { text: suggestion }));
      const value = this.input.value;
      if (value !== value.trim()) items.push(el("li", { text: "It starts or ends with a space. That's allowed, but easy to get wrong when typing it." }));
      if (estimate.truncated) items.push(el("li", { text: "Only the first 100 characters were analysed." }));
      this.feedback.replaceChildren(...items);
    }

    const breach = state.breach;
    this.breachButton.disabled = state.empty || breach.status === "checking";
    this.breachButton.textContent = breach.status === "checking" ? "Checking…" : "Check breaches";
    this.breachResult.hidden = breach.status === "idle" || breach.status === "checking";
    if (breach.status === "found") {
      this.breachResult.dataset.status = "found";
      this.breachResult.textContent = `Found ${numberFormat.format(breach.count)} ${breach.count === 1 ? "time" : "times"} in known data breaches. Don't use this password anywhere, and change it wherever you have.`;
    } else if (breach.status === "not-found") {
      this.breachResult.dataset.status = "not-found";
      this.breachResult.textContent = "Not found in known breaches. That doesn't make it strong: check the rating above.";
    } else if (breach.status === "failed") {
      this.breachResult.dataset.status = "failed";
      this.breachResult.textContent = FAILURES[breach.reason];
    }
  }
}
