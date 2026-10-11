// Crack times and their plain-language display (R10, R11, KTD7).

import { SCENARIOS, type ScenarioId } from "./scenarios.ts";

/** The mean Gregorian year, so 12 months make exactly one year. */
export const SECONDS_PER_YEAR = 365.2425 * 86_400;
export const UNIVERSE_AGE_YEARS = 13.8e9;
const UNIVERSE_AGE_SECONDS = UNIVERSE_AGE_YEARS * SECONDS_PER_YEAR;

/**
 * The average time to find a generated secret: the attacker searches half of the 2^bits
 * equally likely outcomes on average. Finite up to ~1,000 bits, past the longest password.
 */
export function averageSecondsFromBits(bits: number, guessesPerSecond: number): number {
  return 2 ** (bits - 1) / guessesPerSecond;
}

/** The time for a typed password, whose estimator guesses are already an average-case count. */
export function secondsFromGuesses(guesses: number, guessesPerSecond: number): number {
  return guesses / guessesPerSecond;
}

function perScenario(seconds: (guessesPerSecond: number) => number): Record<ScenarioId, number> {
  const times = {} as Record<ScenarioId, number>;
  for (const scenario of SCENARIOS) times[scenario.id] = seconds(scenario.guessesPerSecond);
  return times;
}

export function crackTimesFromBits(bits: number): Record<ScenarioId, number> {
  return perScenario((rate) => averageSecondsFromBits(bits, rate));
}

export function crackTimesFromGuesses(guesses: number): Record<ScenarioId, number> {
  return perScenario((rate) => secondsFromGuesses(guesses, rate));
}

const WHOLE = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const ONE_DECIMAL = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

const UNITS: readonly (readonly [seconds: number, name: string])[] = [
  [1, "second"],
  [60, "minute"],
  [3_600, "hour"],
  [86_400, "day"],
  [SECONDS_PER_YEAR / 12, "month"],
  [SECONDS_PER_YEAR, "year"],
];

const SCALES: readonly (readonly [size: number, word: string])[] = [
  [1e3, "thousand"],
  [1e6, "million"],
  [1e9, "billion"],
  [1e12, "trillion"],
];

function plural(value: number, unit: string): string {
  return `${WHOLE.format(value)} ${unit}${value === 1 ? "" : "s"}`;
}

// Under a year: the largest unit that fits, rounded, promoted when rounding reaches the next
// unit so "60 seconds" reads "1 minute" and "12 months" reads "1 year".
function formatUnderAYear(seconds: number): string {
  let index = 0;
  while (index + 1 < UNITS.length && seconds >= (UNITS[index + 1]?.[0] ?? Infinity)) index += 1;
  const [size, name] = UNITS[index] ?? [1, "second"];
  const value = Math.round(seconds / size);
  const next = UNITS[index + 1];
  if (next && value * size >= next[0]) return plural(1, next[1]);
  return plural(value, name);
}

// Whole numbers below `firstScale`, then the smallest scale word whose rounded value stays
// under 1,000, with one decimal under 10: "650", "4,000", "2.4 million", "45 billion".
function formatCount(x: number, firstScale: number): string {
  if (Math.round(x) < firstScale) return WHOLE.format(Math.round(x));
  const scales = SCALES.filter(([size]) => size >= firstScale);
  for (const [index, [size, word]] of scales.entries()) {
    const value = x / size;
    const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
    if (rounded < 1000 || index === scales.length - 1) return `${ONE_DECIMAL.format(rounded)} ${word}`;
  }
  return WHOLE.format(x);
}

/**
 * Plain-language duration: "instantly" under a second, then seconds up to billions of years,
 * then multiples of the age of the universe, capped at 10^20 of them. Beyond 10^15 ages only
 * the order of magnitude is shown, rounded down, so the display never overstates.
 */
export function formatDuration(seconds: number): string {
  // NaN and negative values fall here too: showing the weakest outcome is the safe failure.
  if (!(seconds >= 1)) return "instantly";
  if (seconds < SECONDS_PER_YEAR) return formatUnderAYear(seconds);
  if (seconds < UNIVERSE_AGE_SECONDS) {
    const years = formatCount(seconds / SECONDS_PER_YEAR, 1e3);
    return `${years} ${years === "1" ? "year" : "years"}`;
  }
  const ages = seconds / UNIVERSE_AGE_SECONDS;
  if (ages >= 1e15) return `more than 10^${Math.min(Math.floor(Math.log10(ages)), 20)} × the age of the universe`;
  return `${formatCount(ages, 1e6)} × the age of the universe`;
}
