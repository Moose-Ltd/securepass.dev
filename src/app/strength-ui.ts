// Renders a strength block (meter, rating, crack time, per-scenario details) for the generator and
// the checker alike, so both describe strength on one scale (KTD7).

import { formatDuration } from "../core/crack-time.ts";
import { RATING_LABELS, type Rating } from "../core/rating.ts";
import { HEADLINE_SCENARIO, SCENARIOS, type ScenarioId } from "../core/scenarios.ts";
import { $, $$ } from "./dom.ts";

const LEVELS: Record<Rating, number> = { "very-weak": 1, weak: 2, fair: 3, strong: 4, excellent: 5, compromised: 5 };

export interface StrengthView {
  /** null renders the neutral PIN treatment instead of a rating band. */
  rating: Rating | null;
  /** Meter fill when rating is null. */
  level?: number;
  label?: string;
  bits?: number;
  crackSeconds: Record<ScenarioId, number>;
  /** Overrides the headline sentence. */
  timeLine?: (string | Node)[];
}

export function headlineSentence(seconds: number): (string | Node)[] {
  const formatted = formatDuration(seconds);
  const strong = document.createElement("strong");
  strong.textContent = formatted;
  return formatted === "instantly" ? ["Could be cracked ", strong] : ["Would take ", strong, " to crack"];
}

export class StrengthBlock {
  readonly root: HTMLElement;
  private readonly label: HTMLElement;
  private readonly bits: HTMLElement;
  private readonly time: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private readonly details: HTMLElement;
  private readonly emptyLabel: string;
  private readonly emptyTime: string;

  constructor(root: HTMLElement) {
    this.root = root;
    this.label = $("[data-rating-label]", root);
    this.bits = $("[data-bits]", root);
    this.time = $("[data-time-line]", root);
    this.toggle = $<HTMLButtonElement>('[data-action="details"]', root);
    this.details = $(`#${this.toggle.getAttribute("aria-controls")}`);
    this.emptyLabel = this.label.textContent ?? "";
    this.emptyTime = this.time.textContent ?? "";
    this.toggle.addEventListener("click", () => {
      const open = this.toggle.getAttribute("aria-expanded") !== "true";
      this.toggle.setAttribute("aria-expanded", String(open));
      this.details.hidden = !open;
    });
  }

  render(view: StrengthView): void {
    delete this.root.dataset.empty;
    if (view.rating) {
      this.root.dataset.rating = view.rating;
      this.root.dataset.level = String(LEVELS[view.rating]);
    } else {
      delete this.root.dataset.rating;
      this.root.dataset.level = String(view.level ?? 1);
    }
    this.label.textContent = view.label ?? (view.rating ? RATING_LABELS[view.rating] : "");
    this.bits.textContent = view.bits === undefined ? "" : `${view.bits.toFixed(view.bits < 100 ? 1 : 0)} bits`;
    this.time.replaceChildren(...(view.timeLine ?? headlineSentence(view.crackSeconds[HEADLINE_SCENARIO.id])));
    for (const scenario of SCENARIOS) {
      const cell = $$("[data-scenario-time]", this.details).find((dd) => dd.closest<HTMLElement>("[data-scenario]")?.dataset.scenario === scenario.id);
      if (cell) cell.textContent = formatDuration(view.crackSeconds[scenario.id]);
    }
  }

  /** Back to the waiting state (checker with an empty field). */
  clear(): void {
    this.root.dataset.empty = "true";
    delete this.root.dataset.rating;
    delete this.root.dataset.level;
    this.label.textContent = this.emptyLabel;
    this.bits.textContent = "";
    this.time.textContent = this.emptyTime;
    for (const dd of $$("[data-scenario-time]", this.details)) dd.textContent = " ";
  }
}
