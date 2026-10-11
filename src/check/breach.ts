// Opt-in Have I Been Pwned lookup using the k-anonymity range API: only the first five
// hex characters of the password's SHA-1 leave the device, and matching happens here.

export const BREACH_API_ORIGIN = "https://api.pwnedpasswords.com";

export type BreachFailure = "offline" | "timeout" | "http" | "unsupported" | "busy" | "cancelled";

export type BreachResult =
  | { status: "found"; count: number; prefix: string }
  | { status: "not-found"; prefix: string }
  | { status: "failed"; reason: BreachFailure };

/** One request about to be sent. `at` is a `performance.now()` time, the same clock as resource-timing entries. */
export interface BreachAttempt {
  url: string;
  prefix: string;
  at: number;
}

const TIMEOUT_MS = 8_000;
const PREFIX_LENGTH = 5;
const ROW = /^([0-9A-F]{35}):(\d+)$/i;

const listeners = new Set<(attempt: BreachAttempt) => void>();
/** The signal of the lookup in progress, if any; an aborted one no longer blocks a new lookup. */
let inFlight: AbortSignal | null = null;

export function canCheckBreaches(): boolean {
  // crypto.subtle is undefined outside secure contexts even though the types say otherwise.
  return typeof globalThis.crypto?.subtle?.digest === "function" && typeof globalThis.fetch === "function";
}

export function onBreachAttempt(listener: (attempt: BreachAttempt) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function sha1Hex(text: string): Promise<string> {
  // Hash exactly what was typed: HIBP stores hashes of the raw UTF-8 bytes.
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  let hex = "";
  for (const byte of new Uint8Array(digest)) hex += byte.toString(16).padStart(2, "0");
  return hex.toUpperCase();
}

/**
 * Looks the password up. Aborting `signal` (the password was edited, or the page is going away)
 * cancels the lookup: before the request it is never sent, and either way the result is
 * "cancelled" and the next lookup may start at once.
 */
export async function checkBreach(password: string, signal: AbortSignal = new AbortController().signal): Promise<BreachResult> {
  if (!canCheckBreaches()) return failed("unsupported");
  // Claimed synchronously so a second click before hashing finishes is still refused.
  if (inFlight && !inFlight.aborted) return failed("busy");
  inFlight = signal;
  try {
    return await lookup(password, signal);
  } finally {
    if (inFlight === signal) inFlight = null;
  }
}

async function lookup(password: string, signal: AbortSignal): Promise<BreachResult> {
  let hash: string;
  try {
    hash = await sha1Hex(password);
  } catch {
    return failed("unsupported");
  }
  const prefix = hash.slice(0, PREFIX_LENGTH);
  const suffix = hash.slice(PREFIX_LENGTH);
  const url = `${BREACH_API_ORIGIN}/range/${prefix}`;
  if (signal.aborted) return failed("cancelled");

  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  try {
    notifyAttempt({ url, prefix, at: performance.now() });
    const response = await fetch(url, {
      method: "GET",
      // Padding hides the true size of the range from anyone watching the wire.
      headers: { "Add-Padding": "true" },
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return failed("http");
    const count = matchCount(await response.text(), suffix);
    // A 200 with no range rows is not an answer (portal, proxy, truncation); never call it safe.
    if (count === undefined) return failed("http");
    return count > 0 ? { status: "found", count, prefix } : { status: "not-found", prefix };
  } catch {
    // Abort surfaces as an AbortError, so the flag tells a timeout apart from a dead network.
    return failed(timedOut ? "timeout" : signal.aborted ? "cancelled" : "offline");
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}

/** Count for `suffix` (0 when absent or padding), or undefined when the body holds no valid rows. */
function matchCount(body: string, suffix: string): number | undefined {
  let sawRow = false;
  for (const line of body.split("\n")) {
    const row = ROW.exec(line.trim());
    if (!row) continue;
    sawRow = true;
    const count = Number(row[2]);
    // Count-0 rows are padding; a real entry always has count >= 1.
    if (count > 0 && row[1]?.toUpperCase() === suffix) return count;
  }
  return sawRow ? 0 : undefined;
}

function notifyAttempt(attempt: BreachAttempt): void {
  for (const listener of [...listeners]) {
    try {
      listener(attempt);
    } catch (error) {
      // A meter bug must not fail or wedge the lookup; rethrow out of band so it still surfaces.
      queueMicrotask(() => {
        throw error;
      });
    }
  }
}

function failed(reason: BreachFailure): BreachResult {
  return { status: "failed", reason };
}
