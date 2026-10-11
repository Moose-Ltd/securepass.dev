// Character sets and the effective alphabet a password is drawn from (R3, R38).

export type CharsetId = "upper" | "lower" | "digits" | "symbols";

export const CHARSET_IDS: readonly CharsetId[] = Object.freeze(["upper", "lower", "digits", "symbols"]);

export const CHARSETS: Readonly<Record<CharsetId, string>> = Object.freeze({
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  digits: "0123456789",
  // All 32 printable ASCII punctuation characters. Nothing outside ASCII, so every symbol can be
  // typed on any keyboard and survives sites with narrow character handling.
  symbols: "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",
});

// Characters easily confused when read or retyped: I/l/1/|, O/0/o, and the quotes, which also
// tend to break when a password is pasted into a shell or a config file.
export const AMBIGUOUS = "Il1O0o|'\"`";

export interface PasswordOptions {
  length: number;
  sets: Record<CharsetId, boolean>;
  avoidAmbiguous: boolean;
  /** Free text; every non-whitespace character in it is removed from the alphabet. */
  exclude: string;
}

export const PASSWORD_LIMITS = Object.freeze({ min: 8, max: 128, default: 20 } as const);

// Frozen so shared defaults can't be mutated by accident: copy before changing.
export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = Object.freeze({
  length: PASSWORD_LIMITS.default,
  sets: Object.freeze({ upper: true, lower: true, digits: true, symbols: true }),
  avoidAmbiguous: false,
  exclude: "",
});

export interface EffectiveSet {
  id: CharsetId;
  chars: readonly string[];
}

export interface EffectiveAlphabet {
  /** Enabled sets that still have characters, in CHARSET_IDS order. */
  sets: readonly EffectiveSet[];
  /** Enabled sets left with no characters; they no longer have to appear in a password. */
  unavailable: readonly CharsetId[];
  size: number;
}

const WHITESPACE = /\s/u;

/** The characters to exclude: code points (so an emoji is one entry), case-sensitive, no whitespace. */
export function parseExclusions(exclude: string): ReadonlySet<string> {
  return new Set(Array.from(exclude).filter((ch) => !WHITESPACE.test(ch)));
}

export function effectiveAlphabet(opts: PasswordOptions): EffectiveAlphabet {
  const excluded = parseExclusions(opts.exclude);
  const ambiguous = new Set(opts.avoidAmbiguous ? AMBIGUOUS : "");
  const sets: EffectiveSet[] = [];
  const unavailable: CharsetId[] = [];
  for (const id of CHARSET_IDS) {
    if (!opts.sets[id]) continue;
    const chars = Array.from(CHARSETS[id]).filter((ch) => !excluded.has(ch) && !ambiguous.has(ch));
    if (chars.length === 0) unavailable.push(id);
    else sets.push({ id, chars });
  }
  const size = sets.reduce((sum, set) => sum + set.chars.length, 0);
  return { sets, unavailable, size };
}

/** The set a character belongs to. Anything outside A-Z, a-z and 0-9, including spaces and non-ASCII, counts as a symbol. */
export function charClass(ch: string): CharsetId {
  if (/^[A-Z]/.test(ch)) return "upper";
  if (/^[a-z]/.test(ch)) return "lower";
  if (/^[0-9]/.test(ch)) return "digits";
  return "symbols";
}
