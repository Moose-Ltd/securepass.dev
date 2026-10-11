// Strength estimate for a typed password (R12, KTD7, KTD8). zxcvbn-ts and its dictionaries load
// through dynamic import() only when loadEstimator() is first called, so they land in a lazy
// chunk that pages never download until someone uses the checker.

import type { MatchExtended, TimeEstimationValues, ZxcvbnFactory } from "@zxcvbn-ts/core";
import { CHARSETS, charClass, type CharsetId } from "../core/charsets.ts";
import { crackTimesFromGuesses } from "../core/crack-time.ts";
import { RATING_ORDER, ratingFromBits, type Rating } from "../core/rating.ts";
import { SCENARIO_BY_ID, type ScenarioId } from "../core/scenarios.ts";

export interface Estimate {
  /** Average-case guesses after the random-run adjustment, capped at Number.MAX_VALUE. */
  guesses: number;
  log10Guesses: number;
  /** log2(guesses) + 1, on the same scale as a generated secret's bits. */
  effectiveBits: number;
  rating: Rating;
  crackSeconds: Record<ScenarioId, number>;
  warning: string | null;
  suggestions: string[];
  /** True when only the first MAX_ANALYSED_CHARS characters were analysed. */
  truncated: boolean;
}

export type Estimator = (password: string) => Estimate;

// Matching cost grows quickly with length, and 100 characters is far more than any rating
// band needs to tell passwords apart.
export const MAX_ANALYSED_CHARS = 100;

export const FALLBACK_SUGGESTION = "Use 15 or more characters, or a passphrase of 5 or more words.";

// KTD7 adjustment. zxcvbn prices each unmatched character at 10 guesses, which would rate a
// random 20-character password at about 67 bits instead of the 131 the generator reports.
// Unmatched characters that are numerous and varied enough to be random are priced as random
// instead. Fewer or narrower ones keep zxcvbn's conservative pricing, so human strings such as
// "Tr0ub4dor&3" aren't overrated.
//
// The test is on all unmatched characters together, not on each run: in about 1 in 70 random
// 20-character passwords a chance 3-5 character match ("caN", "531", "Livvy") splits the
// unmatched part into two runs shorter than 12, and a per-run rule would then rate the site's
// own generated password Fair while the generator says Excellent.
const RANDOM_MIN_CHARS = 12;
const RANDOM_MIN_CLASSES = 3;
/**
 * Share of the password that must be unmatched before any of it is repriced. Generator output is
 * almost all unmatched; a password made of known patterns plus one unknown word is not, and its
 * unknown word must not be priced as random characters ("Tr0ub4dor&3 summer2024").
 */
const RANDOM_MIN_SHARE = 0.7;
const CLASS_SIZES: Readonly<Record<CharsetId, number>> = {
  upper: CHARSETS.upper.length,
  lower: CHARSETS.lower.length,
  digits: CHARSETS.digits.length,
  // charClass also files the space (and anything outside printable ASCII) under symbols.
  symbols: CHARSETS.symbols.length + 1,
};

// Unmatched letters can still be words zxcvbn doesn't know: "Dankie!Totsiens" is two Afrikaans
// words, not 15 random characters. A run of 4+ letters with a word's share of vowels keeps
// zxcvbn's conservative price and never counts toward the random test. Random runs rarely look
// like that ("ghvnh", "Xq"), and when one does the password is only underrated, never overrated.
const WORD_LIKE = /[A-Za-z]{4,}/g;
const VOWELS = /[aeiouy]/gi;
const MIN_VOWEL_SHARE = 0.25;

/** The characters of `token` outside word-like letter runs, which may be priced as random. */
export function randomCandidates(token: string): string[] {
  const kept: string[] = [];
  let last = 0;
  for (const match of token.matchAll(WORD_LIKE)) {
    const word = match[0];
    const vowels = word.match(VOWELS)?.length ?? 0;
    if (vowels / word.length < MIN_VOWEL_SHARE) continue;
    kept.push(...Array.from(token.slice(last, match.index)));
    last = match.index + word.length;
  }
  kept.push(...Array.from(token.slice(last)));
  return kept;
}

/**
 * log10 of the guesses after the random-run adjustment. When the unmatched characters together
 * number at least 12, span at least 3 classes and make up at least 70% of the password, those
 * outside word-like runs are repriced at C each, where C is the combined size of the classes
 * present (symbols: 33, the 32 ASCII symbols plus space; anything non-ASCII counts as a symbol
 * too), and the total is scaled by the same ratio. Word-like runs and matched parts keep zxcvbn's price. Works in log space because
 * C^length overflows a double past ~150 characters.
 */
export function adjustedLog10Guesses(log10Guesses: number, sequence: readonly MatchExtended[]): number {
  const runs = sequence
    .filter((match) => match.pattern === "bruteforce")
    .map((match) => ({ match, candidates: randomCandidates(match.token) }));
  const unmatched = runs.flatMap((run) => Array.from(run.match.token));
  if (unmatched.length < RANDOM_MIN_CHARS) return log10Guesses;
  const total = sequence.reduce((sum, match) => sum + Array.from(match.token).length, 0);
  if (unmatched.length < RANDOM_MIN_SHARE * total) return log10Guesses;
  const classes = new Set(unmatched.map(charClass));
  if (classes.size < RANDOM_MIN_CLASSES) return log10Guesses;
  const log10Alphabet = Math.log10([...classes].reduce((sum, id) => sum + CLASS_SIZES[id], 0));

  let adjusted = log10Guesses;
  for (const { match, candidates: random } of runs) {
    const runGuesses: unknown = match["guesses"];
    const length = Array.from(match.token).length;
    // zxcvbn's own price for an unmatched run is 10^length; used if the field is ever missing.
    const zxcvbnLog10 = typeof runGuesses === "number" && runGuesses > 0 ? Math.log10(runGuesses) : length;
    // Word-like characters stay at zxcvbn's 10 guesses each; the rest are priced as random.
    const repricedLog10 = random.length * log10Alphabet + (length - random.length);
    if (repricedLog10 > zxcvbnLog10) adjusted += repricedLog10 - zxcvbnLog10;
  }
  return adjusted;
}

// Our attack rates, so zxcvbn's own crack times agree with the page. The score thresholds stay
// at zxcvbn's defaults because they decide when it offers feedback.
const TIME_ESTIMATION_VALUES: TimeEstimationValues = {
  scoring: { 0: 1e3, 1: 1e6, 2: 1e8, 3: 1e10 },
  attackTime: {
    onlineThrottlingXPerHour: Math.round(SCENARIO_BY_ID["online-throttled"].guessesPerSecond * 3600),
    onlineNoThrottlingXPerSecond: SCENARIO_BY_ID["online-unthrottled"].guessesPerSecond,
    offlineSlowHashingXPerSecond: SCENARIO_BY_ID["offline-slow"].guessesPerSecond,
    offlineFastHashingXPerSecond: SCENARIO_BY_ID["offline-fast"].guessesPerSecond,
  },
};

function estimate(zxcvbn: ZxcvbnFactory, password: string): Estimate {
  // Code points, so the cut never splits a surrogate pair.
  const chars = Array.from(password);
  const truncated = chars.length > MAX_ANALYSED_CHARS;
  const analysed = truncated ? chars.slice(0, MAX_ANALYSED_CHARS).join("") : password;
  const result = zxcvbn.check(analysed);

  const log10Guesses = adjustedLog10Guesses(Math.log10(result.guesses), result.sequence);
  const guesses = Math.min(10 ** log10Guesses, Number.MAX_VALUE);
  // zxcvbn counts the guesses to find this password on average, which matches 2^(bits - 1) for
  // a generated secret; adding the bit back puts both on one rating scale.
  const effectiveBits = log10Guesses * Math.log2(10) + 1;
  const rating = ratingFromBits(effectiveBits);

  const warning = result.feedback.warning || null;
  let suggestions = [...result.feedback.suggestions];
  // zxcvbn gives feedback only when its own score is 2 or below, which leaves middling
  // passwords with no advice at all.
  if (warning === null && suggestions.length === 0 && RATING_ORDER.indexOf(rating) < RATING_ORDER.indexOf("strong")) {
    suggestions = [FALLBACK_SUGGESTION];
  }

  return {
    guesses,
    log10Guesses,
    effectiveBits,
    rating,
    crackSeconds: crackTimesFromGuesses(guesses),
    warning,
    suggestions,
    truncated,
  };
}

async function createEstimator(): Promise<Estimator> {
  // Deep imports of just the data we use: importing the language packages' index modules
  // would bundle every dictionary they ship (about 850 KB gzip instead of about 450 KB).
  const [{ ZxcvbnFactory }, passwords, diceware, adjacencyGraphs, commonWords, firstnames, translations] = await Promise.all([
    import("@zxcvbn-ts/core"),
    import("@zxcvbn-ts/language-common/dist/passwords.json.mjs"),
    import("@zxcvbn-ts/language-common/dist/diceware.json.mjs"),
    import("@zxcvbn-ts/language-common/dist/adjacencyGraphs.json.mjs"),
    import("@zxcvbn-ts/language-en/dist/commonWords.json.mjs"),
    import("@zxcvbn-ts/language-en/dist/firstnames.json.mjs"),
    import("@zxcvbn-ts/language-en/dist/translations.mjs"),
  ]);
  const zxcvbn = new ZxcvbnFactory({
    // Keys follow the language packages' own index modules; zxcvbn picks warnings by name.
    dictionary: {
      "passwords-common": passwords.default,
      "diceware-common": diceware.default,
      "commonWords-en": commonWords.default,
      "firstnames-en": firstnames.default,
    },
    graphs: adjacencyGraphs.default,
    translations: translations.default,
    timeEstimationValues: TIME_ESTIMATION_VALUES,
  });
  return (password) => estimate(zxcvbn, password);
}

let loading: Promise<Estimator> | undefined;

/** Loads zxcvbn once; later calls share the same estimator. A failed load can be retried. */
export function loadEstimator(): Promise<Estimator> {
  loading ??= createEstimator().catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
