import { afterEach, describe, expect, it, vi } from "vitest";
import { PREFS_KEY, defaultPrefs, loadPrefs, sanitizePrefs, savePrefs } from "../../src/app/prefs.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("preferences", () => {
  it("round-trips valid options through storage", () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    const prefs = defaultPrefs();
    prefs.password.length = 32;
    prefs.password.sets.symbols = false;
    prefs.password.exclude = "<>";
    prefs.passphrase.words = 8;
    prefs.passphrase.separator = ".";
    prefs.pin.digits = 8;
    savePrefs(prefs);
    expect(loadPrefs()).toEqual(prefs);
  });

  it("clamps out-of-range numbers to the limits", () => {
    const prefs = sanitizePrefs({ password: { length: 500 }, passphrase: { words: 1 }, pin: { digits: 99 } });
    expect(prefs.password.length).toBe(128);
    expect(prefs.passphrase.words).toBe(3);
    expect(prefs.pin.digits).toBe(12);
  });

  it("falls back to defaults for corrupt JSON", () => {
    vi.stubGlobal("localStorage", memoryStorage({ [PREFS_KEY]: "{not json" }));
    expect(loadPrefs()).toEqual(defaultPrefs());
  });

  it("falls back to defaults when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(loadPrefs()).toEqual(defaultPrefs());
    expect(() => savePrefs(defaultPrefs())).not.toThrow();
  });

  it("never turns every character type off", () => {
    const prefs = sanitizePrefs({ password: { sets: { upper: false, lower: false, digits: false, symbols: false } } });
    expect(Object.values(prefs.password.sets).some(Boolean)).toBe(true);
  });

  it("ignores unknown separators and wrong types", () => {
    const prefs = sanitizePrefs({ passphrase: { separator: "<script>", capitalize: "yes" }, password: { exclude: 42 } });
    expect(prefs.passphrase.separator).toBe(defaultPrefs().passphrase.separator);
    expect(prefs.passphrase.capitalize).toBe(defaultPrefs().passphrase.capitalize);
    expect(prefs.password.exclude).toBe("");
  });

  it("stores only settings, never a secret", () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    savePrefs(defaultPrefs());
    expect([...storage.data.keys()]).toEqual([PREFS_KEY]);
    expect(Object.keys(JSON.parse(storage.data.get(PREFS_KEY)!))).toEqual(["password", "passphrase", "pin"]);
  });
});
