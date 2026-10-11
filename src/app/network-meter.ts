// The live network counter (R19, KTD10). It counts every request this page makes to another site,
// observed through Resource Timing, plus each breach check the app starts (a failed fetch may leave
// no resource entry). Requests to SecurePass itself, such as loading the strength estimator, are
// not "other sites" and are not counted. Extension resources are not network requests at all.

import { onBreachAttempt, type BreachAttempt } from "../check/breach.ts";
import { el } from "./dom.ts";

export interface ExternalRequest {
  url: string;
  /** Set for breach checks: the 5 hash characters that were sent. */
  prefix?: string;
}

/** True for a real network request to an origin other than `pageOrigin`. */
export function isExternalRequest(url: string, pageOrigin: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.origin !== pageOrigin;
}

/** Merges observed resource URLs with breach attempts so one breach check counts once. */
export class RequestLedger {
  private readonly attempts: { attempt: BreachAttempt; matched: boolean }[] = [];
  private readonly others: string[] = [];

  constructor(private readonly pageOrigin: string) {}

  addAttempt(attempt: BreachAttempt): void {
    this.attempts.push({ attempt, matched: false });
  }

  addResource(url: string): void {
    if (!isExternalRequest(url, this.pageOrigin)) return;
    const pending = this.attempts.find((a) => !a.matched && a.attempt.url === url);
    if (pending) pending.matched = true;
    else this.others.push(url);
  }

  get requests(): ExternalRequest[] {
    return [...this.attempts.map(({ attempt }) => ({ url: attempt.url, prefix: attempt.prefix })), ...this.others.map((url) => ({ url }))];
  }
}

export function startNetworkMeter(views: { pill: HTMLElement; pillText: HTMLElement; card: HTMLElement | null; count: HTMLElement | null; label: HTMLElement | null; log: HTMLOListElement | null }): void {
  const ledger = new RequestLedger(location.origin);

  const render = () => {
    const requests = ledger.requests;
    const n = requests.length;
    views.pill.dataset.state = n ? "sent" : "quiet";
    views.pillText.textContent = n ? `${n} sent` : "Nothing sent";
    views.pill.setAttribute("aria-label", n ? `${n} ${n === 1 ? "request" : "requests"} sent to other sites. See details` : "Nothing sent to other sites. See how this is checked");
    if (views.card) views.card.dataset.state = n ? "sent" : "quiet";
    if (views.count) views.count.textContent = String(n);
    if (views.label) views.label.textContent = `${n === 1 ? "request" : "requests"} to other sites since you opened this page`;
    if (views.log) {
      views.log.hidden = n === 0;
      views.log.replaceChildren(
        ...requests.map((r) =>
          r.prefix
            ? el("li", {}, ["Breach check: sent ", el("code", { text: r.prefix }), ", the first 5 characters of a SHA-1 hash, to ", el("code", { text: new URL(r.url).host }), "."])
            : el("li", {}, ["Request to ", el("code", { text: new URL(r.url).origin }), "."]),
        ),
      );
    }
  };

  onBreachAttempt((attempt) => {
    ledger.addAttempt(attempt);
    render();
  });

  if ("PerformanceObserver" in window && PerformanceObserver.supportedEntryTypes?.includes("resource")) {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) ledger.addResource(entry.name);
      render();
    }).observe({ type: "resource", buffered: true });
  }
  render();
}
