import { describe, expect, it } from "vitest";
import {
  SECONDS_PER_YEAR,
  UNIVERSE_AGE_YEARS,
  averageSecondsFromBits,
  crackTimesFromBits,
  crackTimesFromGuesses,
  formatDuration,
  secondsFromGuesses,
} from "../../src/core/crack-time.ts";
import { HEADLINE_SCENARIO, SCENARIOS, SCENARIO_BY_ID } from "../../src/core/scenarios.ts";

const HEADLINE_RATE = HEADLINE_SCENARIO.guessesPerSecond;
const MINUTE = 60;
const HOUR = 3600;
const DAY = 86_400;
const MONTH = SECONDS_PER_YEAR / 12;
const UNIVERSE = UNIVERSE_AGE_YEARS * SECONDS_PER_YEAR;

describe("scenarios (KTD7)", () => {
  it("defines the four attack rates, headline last", () => {
    expect(SCENARIOS.map((s) => [s.id, s.guessesPerSecond])).toEqual([
      ["online-throttled", 100 / 3600],
      ["online-unthrottled", 1_000],
      ["offline-slow", 100_000],
      ["offline-fast", 3e12],
    ]);
    expect(HEADLINE_SCENARIO.id).toBe("offline-fast");
    expect(HEADLINE_SCENARIO).toBe(SCENARIOS.at(-1));
    for (const scenario of SCENARIOS) {
      expect(SCENARIO_BY_ID[scenario.id]).toBe(scenario);
      expect(scenario.label.length).toBeGreaterThan(0);
      expect(scenario.rateLabel.length).toBeGreaterThan(0);
      expect(scenario.description.length).toBeGreaterThan(0);
      expect(scenario.source).toMatch(/^https:\/\/\S+$/);
    }
  });
});

describe("crack-time formulas", () => {
  it("averages half the space for generated secrets", () => {
    expect(averageSecondsFromBits(60, HEADLINE_RATE)).toBeCloseTo(2 ** 59 / 3e12, 6);
    expect(averageSecondsFromBits(60, HEADLINE_RATE) / DAY).toBeCloseTo(2.22, 2);
  });

  it("divides guesses by the rate for checked passwords", () => {
    expect(secondsFromGuesses(3e12, HEADLINE_RATE)).toBe(1);
    expect(secondsFromGuesses(100, 100 / 3600)).toBeCloseTo(3600, 9);
  });

  it("gives every scenario a time", () => {
    const fromBits = crackTimesFromBits(40);
    const fromGuesses = crackTimesFromGuesses(2 ** 39);
    for (const scenario of SCENARIOS) {
      expect(fromBits[scenario.id]).toBeCloseTo(2 ** 39 / scenario.guessesPerSecond, 3);
      expect(fromGuesses[scenario.id]).toBeCloseTo(fromBits[scenario.id], 3);
    }
    expect(fromBits["online-throttled"]).toBeGreaterThan(fromBits["offline-fast"]);
  });

  it("stays finite for the longest passwords (~840 bits)", () => {
    for (const scenario of SCENARIOS) expect(Number.isFinite(averageSecondsFromBits(840, scenario.guessesPerSecond))).toBe(true);
  });
});

describe("formatDuration", () => {
  it("covers AE6: 131 bits at the headline rate is a multiple of the age of the universe", () => {
    const text = formatDuration(averageSecondsFromBits(131, HEADLINE_RATE));
    const match = /^([\d,.]+)(?: (thousand|million|billion|trillion))? × the age of the universe$/.exec(text);
    expect(match, text).not.toBeNull();
    const scale = { thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 }[match?.[2] ?? ""] ?? 1;
    expect(Number(match?.[1]?.replaceAll(",", "")) * scale).toBeGreaterThanOrEqual(1);
    expect(text).toBe("1 billion × the age of the universe");
  });

  it("covers AE6: a 6-digit PIN falls instantly", () => {
    expect(formatDuration(averageSecondsFromBits(6 * Math.log2(10), HEADLINE_RATE))).toBe("instantly");
  });

  it("formats 60 bits at the headline rate as 2 days", () => {
    expect(formatDuration(averageSecondsFromBits(60, HEADLINE_RATE))).toBe("2 days");
  });

  it.each([
    [0, "instantly"],
    [0.999, "instantly"],
    [-5, "instantly"],
    [Number.NaN, "instantly"],
    [1, "1 second"],
    [1.4, "1 second"],
    [2, "2 seconds"],
    [59.4, "59 seconds"],
    [59.6, "1 minute"],
    [MINUTE, "1 minute"],
    [45 * MINUTE, "45 minutes"],
    [HOUR, "1 hour"],
    [23.4 * HOUR, "23 hours"],
    [23.6 * HOUR, "1 day"],
    [DAY, "1 day"],
    [3 * DAY, "3 days"],
    [30 * DAY, "30 days"],
    [MONTH, "1 month"],
    [3 * MONTH, "3 months"],
    [11.6 * MONTH, "1 year"],
    [SECONDS_PER_YEAR, "1 year"],
    [45 * SECONDS_PER_YEAR, "45 years"],
    [650 * SECONDS_PER_YEAR, "650 years"],
    [999.4 * SECONDS_PER_YEAR, "999 years"],
    [999.6 * SECONDS_PER_YEAR, "1 thousand years"],
    [1_240 * SECONDS_PER_YEAR, "1.2 thousand years"],
    [4_000 * SECONDS_PER_YEAR, "4 thousand years"],
    [45_300 * SECONDS_PER_YEAR, "45 thousand years"],
    [999_700 * SECONDS_PER_YEAR, "1 million years"],
    [2.4e6 * SECONDS_PER_YEAR, "2.4 million years"],
    [310e6 * SECONDS_PER_YEAR, "310 million years"],
    [1.04e9 * SECONDS_PER_YEAR, "1 billion years"],
    [13e9 * SECONDS_PER_YEAR, "13 billion years"],
    [UNIVERSE, "1 × the age of the universe"],
    [3 * UNIVERSE, "3 × the age of the universe"],
    [4_000 * UNIVERSE, "4,000 × the age of the universe"],
    [250_000 * UNIVERSE, "250,000 × the age of the universe"],
    [2e6 * UNIVERSE, "2 million × the age of the universe"],
    [7.26e9 * UNIVERSE, "7.3 billion × the age of the universe"],
    [42e12 * UNIVERSE, "42 trillion × the age of the universe"],
    [3e17 * UNIVERSE, "more than 10^17 × the age of the universe"],
    [1e20 * UNIVERSE, "more than 10^20 × the age of the universe"],
    [1e200 * UNIVERSE, "more than 10^20 × the age of the universe"],
    [Number.POSITIVE_INFINITY, "more than 10^20 × the age of the universe"],
  ])("formats %d seconds as %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it("caps the longest generated passwords", () => {
    expect(formatDuration(averageSecondsFromBits(839, HEADLINE_RATE))).toBe("more than 10^20 × the age of the universe");
  });
});
