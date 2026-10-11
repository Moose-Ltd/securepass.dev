// Attack scenarios behind every crack time (KTD7). The page cites each source, so a figure
// changes here only together with its source.

export type ScenarioId = "online-throttled" | "online-unthrottled" | "offline-slow" | "offline-fast";

export interface Scenario {
  id: ScenarioId;
  label: string;
  guessesPerSecond: number;
  rateLabel: string;
  description: string;
  source: string;
}

const ONLINE_THROTTLED: Scenario = Object.freeze({
  id: "online-throttled",
  label: "Online, rate-limited",
  guessesPerSecond: 100 / 3600,
  rateLabel: "100 guesses per hour",
  description:
    "Guessing through a login page that slows down or locks out repeated attempts. This is zxcvbn's throttled-online assumption.",
  source: "https://github.com/dropbox/zxcvbn#usage",
});

const ONLINE_UNTHROTTLED: Scenario = Object.freeze({
  id: "online-unthrottled",
  label: "Online, no rate limit",
  guessesPerSecond: 1_000,
  rateLabel: "1,000 guesses per second",
  description:
    "Guessing against a login or API that never slows the attacker down, which OWASP warns against. The service itself becomes the bottleneck.",
  source: "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html",
});

const OFFLINE_SLOW: Scenario = Object.freeze({
  id: "offline-slow",
  label: "Offline, slow hash",
  guessesPerSecond: 100_000,
  rateLabel: "100,000 guesses per second",
  description:
    "A stolen database protected by a slow password hash (bcrypt, cost 10), attacked with twelve RTX 5090 graphics cards, as in Hive Systems' 2025 password table.",
  source: "https://www.hivesystems.com/blog/are-your-passwords-in-the-green-2025",
});

const OFFLINE_FAST: Scenario = Object.freeze({
  id: "offline-fast",
  label: "Offline, fast hash",
  guessesPerSecond: 3e12,
  rateLabel: "3 trillion guesses per second",
  description:
    "A stolen database protected only by a fast hash such as MD5 or SHA-1, attacked with twelve RTX 5090 cards at about 220 billion MD5 guesses per second each (2.64 trillion in total), rounded up.",
  source: "https://www.bleepingcomputer.com/news/security/is-a-30-000-gpu-good-at-password-cracking/",
});

/** Slowest to fastest attacker. */
export const SCENARIOS: readonly Scenario[] = Object.freeze([ONLINE_THROTTLED, ONLINE_UNTHROTTLED, OFFLINE_SLOW, OFFLINE_FAST]);

export const SCENARIO_BY_ID: Readonly<Record<ScenarioId, Scenario>> = Object.freeze({
  "online-throttled": ONLINE_THROTTLED,
  "online-unthrottled": ONLINE_UNTHROTTLED,
  "offline-slow": OFFLINE_SLOW,
  "offline-fast": OFFLINE_FAST,
});

// The headline assumes the attacker's best case (R10): a leaked database with a fast hash.
export const HEADLINE_SCENARIO: Scenario = OFFLINE_FAST;
