// Non-secret settings remembered on this device (KTD17). Secrets and checked passwords are never
// stored. Everything read back is validated and clamped, and blocked or corrupt storage falls back
// to defaults silently (R39, R40).

import { CHARSET_IDS, DEFAULT_PASSWORD_OPTIONS, MAX_EXCLUDE_LENGTH, PASSWORD_LIMITS, type CharsetId, type PasswordOptions } from "../core/charsets.ts";
import { DEFAULT_PASSPHRASE_OPTIONS, PASSPHRASE_LIMITS, SEPARATORS, type PassphraseOptions, type Separator } from "../core/passphrase.ts";
import { PIN_LIMITS } from "../core/pin.ts";
import { clampInteger } from "../core/random.ts";

export const PREFS_KEY = "securepass:prefs:v1";

export interface Prefs {
  password: PasswordOptions;
  passphrase: PassphraseOptions;
  pin: { digits: number };
}

export function defaultPrefs(): Prefs {
  return {
    password: { ...DEFAULT_PASSWORD_OPTIONS, sets: { ...DEFAULT_PASSWORD_OPTIONS.sets } },
    passphrase: { ...DEFAULT_PASSPHRASE_OPTIONS },
    pin: { digits: PIN_LIMITS.default },
  };
}

/** A stored number clamped into range; anything that isn't a number keeps the current value. */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" ? clampInteger(value, { min, max, default: fallback }) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Turns anything read from storage into valid preferences. */
export function sanitizePrefs(raw: unknown): Prefs {
  const prefs = defaultPrefs();
  if (!raw || typeof raw !== "object") return prefs;
  const { password, passphrase, pin } = raw as Record<string, Record<string, unknown> | undefined>;

  if (password && typeof password === "object") {
    const p = prefs.password;
    p.length = clampInt(password.length, PASSWORD_LIMITS.min, PASSWORD_LIMITS.max, p.length);
    p.avoidAmbiguous = bool(password.avoidAmbiguous, p.avoidAmbiguous);
    if (typeof password.exclude === "string") p.exclude = password.exclude.slice(0, MAX_EXCLUDE_LENGTH);
    const sets = password.sets as Record<string, unknown> | undefined;
    if (sets && typeof sets === "object") {
      for (const id of CHARSET_IDS) p.sets[id] = bool(sets[id], p.sets[id]);
      // At least one character type always stays on.
      if (!CHARSET_IDS.some((id: CharsetId) => p.sets[id])) p.sets = { ...DEFAULT_PASSWORD_OPTIONS.sets };
    }
  }

  if (passphrase && typeof passphrase === "object") {
    const p = prefs.passphrase;
    p.words = clampInt(passphrase.words, PASSPHRASE_LIMITS.min, PASSPHRASE_LIMITS.max, p.words);
    if (SEPARATORS.includes(passphrase.separator as Separator)) p.separator = passphrase.separator as Separator;
    p.capitalize = bool(passphrase.capitalize, p.capitalize);
    p.includeDigit = bool(passphrase.includeDigit, p.includeDigit);
  }

  if (pin && typeof pin === "object") {
    prefs.pin.digits = clampInt(pin.digits, PIN_LIMITS.min, PIN_LIMITS.max, prefs.pin.digits);
  }
  return prefs;
}

export function loadPrefs(): Prefs {
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    return sanitizePrefs(stored ? JSON.parse(stored) : null);
  } catch {
    return defaultPrefs();
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Private mode or blocked storage: settings simply aren't remembered.
  }
}
