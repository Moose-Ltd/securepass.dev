// The password, passphrase and PIN generator (U6). Secrets live only in memory: never in the URL,
// storage or history.

import { CHARSET_IDS, type CharsetId } from "../core/charsets.ts";
import { crackTimesFromBits, formatDuration } from "../core/crack-time.ts";
import { generatePassphrase, type Separator } from "../core/passphrase.ts";
import { canDisableSet, generatePassword } from "../core/password.ts";
import { generatePin } from "../core/pin.ts";
import { clampInteger, hasSecureRandom } from "../core/random.ts";
import { ratingFromBits } from "../core/rating.ts";
import { loadWordlist } from "../core/wordlist.ts";
import { announce } from "./announcer.ts";
import { copySecret, copyShortcutHint } from "./copy.ts";
import { $, $$, debounce, el } from "./dom.ts";
import { savePrefs, type Prefs } from "./prefs.ts";
import { SecretDisplay } from "./secret-display.ts";
import { StrengthBlock, headlineSentence } from "./strength-ui.ts";
import type { GeneratorMode } from "../pages/routes.ts";

const SET_NAMES: Record<CharsetId, string> = { upper: "Capital letters", lower: "Lower-case letters", digits: "Digits", symbols: "Symbols" };
const NOUNS: Record<GeneratorMode, string> = { password: "password", passphrase: "passphrase", pin: "PIN" };

type RangeKey = "length" | "words" | "digits";

export class Generator {
  private mode: GeneratorMode = "password";
  private readonly display: SecretDisplay;
  private readonly strength: StrengthBlock;
  private readonly buttons: Record<"hide" | "spell" | "regenerate" | "copy", HTMLButtonElement>;
  private readonly copyLabel: HTMLElement;
  private readonly copyHint: HTMLElement;
  private readonly spell: HTMLOListElement;
  private readonly secret: HTMLElement;
  /** Each range control's preference, read and written by key. */
  private readonly ranges: Record<RangeKey, { get(): number; set(value: number): void }>;
  private wordlist: readonly string[] | null = null;
  private frame = 0;
  private copyReset: ReturnType<typeof setTimeout> | undefined;
  private readonly persist: () => void;
  private readonly announceNew = debounce(() => {
    const length = this.mode === "passphrase" ? `${this.prefs.passphrase.words}-word` : `${Array.from(this.display.current).length}-character`;
    if (this.display.current) announce(`New ${length} ${NOUNS[this.mode]}`);
  }, 500);

  constructor(
    private readonly panel: HTMLElement,
    private readonly prefs: Prefs,
  ) {
    this.spell = $<HTMLOListElement>("[data-spell]", panel);
    this.secret = $("[data-secret-value]", panel);
    this.display = new SecretDisplay(this.secret, this.spell);
    const { password, passphrase, pin } = prefs;
    this.ranges = {
      length: { get: () => password.length, set: (v) => (password.length = v) },
      words: { get: () => passphrase.words, set: (v) => (passphrase.words = v) },
      digits: { get: () => pin.digits, set: (v) => (pin.digits = v) },
    };
    this.strength = new StrengthBlock($('[data-strength="gen"]', panel));
    this.buttons = {
      hide: $<HTMLButtonElement>('[data-action="hide"]', panel),
      spell: $<HTMLButtonElement>('[data-action="spell"]', panel),
      regenerate: $<HTMLButtonElement>('[data-action="regenerate"]', panel),
      copy: $<HTMLButtonElement>('[data-action="copy"]', panel),
    };
    this.copyLabel = $("[data-copy-label]", panel);
    this.copyHint = $("[data-copy-hint]", panel);
    this.persist = debounce(() => savePrefs(this.prefs), 300);
    this.bindActions();
    this.bindOptions();
    this.syncControls();
  }

  /** Switches the visible options and makes a fresh secret for `mode`. */
  async activate(mode: GeneratorMode): Promise<void> {
    this.mode = mode;
    for (const fieldset of $$("[data-options]", this.panel)) fieldset.hidden = fieldset.dataset.options !== mode;
    $("[data-pin-badge]", this.panel).hidden = mode !== "pin";
    this.secret.setAttribute("aria-label", `Generated ${NOUNS[mode]}`);
    this.closeSpell();
    await this.generate();
  }

  async generate(): Promise<void> {
    if (!hasSecureRandom()) {
      this.display.message("Your browser can't provide secure random numbers, so SecurePass won't generate anything here. Try an up-to-date browser.");
      this.setEnabled(false);
      return;
    }
    const mode = this.mode;
    let value: string;
    let bits: number;
    if (mode === "password") {
      const result = generatePassword(this.prefs.password);
      this.showSetAvailability(result.unavailable);
      if (!result.ok) {
        this.display.message("Every character is excluded. Turn a character type back on or remove some exclusions.");
        this.strength.clear();
        this.setEnabled(false);
        return;
      }
      ({ value, entropyBits: bits } = result);
    } else if (mode === "passphrase") {
      this.wordlist ??= await loadWordlist();
      if (this.mode !== mode) return;
      ({ value, entropyBits: bits } = generatePassphrase(this.prefs.passphrase, this.wordlist));
    } else {
      ({ value, entropyBits: bits } = generatePin(this.prefs.pin.digits));
    }

    this.display.show(value, mode);
    this.setEnabled(true);
    this.renderStrength(bits);
    this.resetCopy();
    this.announceNew();
  }

  private renderStrength(bits: number): void {
    const crackSeconds = crackTimesFromBits(bits);
    if (this.mode === "pin") {
      // PINs get a neutral treatment: they are only meant for places that limit wrong guesses (R6, R9).
      const throttled = el("strong", { text: formatDuration(crackSeconds["online-throttled"]) });
      this.strength.render({
        rating: null,
        level: Math.min(5, Math.max(1, Math.ceil(bits / 10))),
        label: "Only where guesses are limited",
        bits,
        crackSeconds,
        timeLine: [...headlineSentence(crackSeconds["offline-fast"]), " offline, or about ", throttled, " at 100 guesses an hour"],
      });
      return;
    }
    this.strength.render({ rating: ratingFromBits(bits), bits, crackSeconds });
  }

  private setEnabled(enabled: boolean): void {
    for (const button of Object.values(this.buttons)) button.disabled = !enabled;
    if (this.display.isHidden) this.buttons.spell.disabled = true;
  }

  private bindActions(): void {
    const { hide, spell, regenerate, copy } = this.buttons;
    regenerate.addEventListener("click", () => void this.generate());
    copy.addEventListener("click", () => void this.copy());

    hide.addEventListener("click", () => {
      const hidden = !this.display.isHidden;
      this.display.setHidden(hidden);
      hide.setAttribute("aria-pressed", String(hidden));
      hide.setAttribute("aria-label", hidden ? "Show" : "Hide");
      // Spelling out a hidden secret would defeat hiding it.
      if (hidden) this.closeSpell();
      spell.disabled = hidden || !this.display.current;
    });

    spell.addEventListener("click", () => {
      const open = spell.getAttribute("aria-expanded") !== "true";
      spell.setAttribute("aria-expanded", String(open));
      this.spell.hidden = !open;
      this.display.setSpellOpen(open);
    });

    // Shortcuts work only while focus is inside the tool and never while typing (R41, WCAG 2.1.4).
    regenerate.setAttribute("aria-keyshortcuts", "R");
    copy.setAttribute("aria-keyshortcuts", "C");
    this.panel.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      const target = event.target as HTMLElement;
      if (target.matches("input[type=text], input[type=number], input[type=password], textarea")) return;
      const key = event.key.toLowerCase();
      if (key === "r" && !regenerate.disabled) {
        event.preventDefault();
        void this.generate();
      } else if (key === "c" && !copy.disabled) {
        event.preventDefault();
        void this.copy();
      }
    });
  }

  private closeSpell(): void {
    this.buttons.spell.setAttribute("aria-expanded", "false");
    this.spell.hidden = true;
    this.display.setSpellOpen(false);
  }

  private async copy(): Promise<void> {
    const value = this.display.current;
    if (!value) return;
    const outcome = await copySecret(value, this.secret);
    if (outcome === "copied") {
      this.buttons.copy.dataset.copied = "";
      this.copyLabel.textContent = "Copied";
      this.copyHint.textContent = "Copied. Some devices keep clipboard history, so clear it on a shared computer.";
      announce("Copied to the clipboard");
    } else {
      this.copyHint.textContent = `Your browser blocked copying. The ${NOUNS[this.mode]} is selected: press ${copyShortcutHint()} to copy it.`;
      announce(`Copy was blocked. The ${NOUNS[this.mode]} is selected; press ${copyShortcutHint()}.`);
    }
    this.copyHint.hidden = false;
    clearTimeout(this.copyReset);
    this.copyReset = setTimeout(() => this.resetCopy(), 4000);
  }

  private resetCopy(): void {
    clearTimeout(this.copyReset);
    delete this.buttons.copy.dataset.copied;
    this.copyLabel.textContent = "Copy";
    this.copyHint.hidden = true;
  }

  /** Regenerates at most once per frame while a slider is dragged. */
  private scheduleGenerate(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => void this.generate());
  }

  private changed(): void {
    this.persist();
    this.scheduleGenerate();
  }

  private bindOptions(): void {
    const { password, passphrase } = this.prefs;

    for (const wrapper of $$("[data-range]", this.panel)) {
      const binding = this.ranges[wrapper.dataset.range as RangeKey];
      const slider = $<HTMLInputElement>("[data-opt]", wrapper);
      const number = $<HTMLInputElement>("[data-opt-num]", wrapper);
      const limits = { min: Number(slider.min), max: Number(slider.max) };
      const commit = (raw: number) => {
        const value = clampInteger(raw, { ...limits, default: binding.get() });
        const unchanged = value === binding.get();
        binding.set(value);
        // Always resync: the number field may hold a typed value that was clamped.
        this.syncRange(wrapper);
        if (!unchanged) this.changed();
      };
      slider.addEventListener("input", () => commit(slider.valueAsNumber));
      number.addEventListener("change", () => commit(number.valueAsNumber));
      for (const step of $$<HTMLButtonElement>("[data-step]", wrapper)) {
        step.addEventListener("click", () => commit(binding.get() + Number(step.dataset.step)));
      }
    }

    const note = $("[data-sets-note]", this.panel);
    for (const box of $$<HTMLInputElement>("[data-set]", this.panel)) {
      box.addEventListener("change", () => {
        const id = box.dataset.set as CharsetId;
        if (!box.checked && !canDisableSet(password, id)) {
          // AE9: the last character type can't be switched off.
          box.checked = true;
          note.textContent = "At least one character type has to stay on.";
          return;
        }
        password.sets[id] = box.checked;
        note.textContent = "";
        this.changed();
      });
    }

    const ambiguous = $<HTMLInputElement>('[data-opt="avoidAmbiguous"]', this.panel);
    ambiguous.addEventListener("change", () => {
      password.avoidAmbiguous = ambiguous.checked;
      this.changed();
    });

    const exclude = $<HTMLInputElement>('[data-opt="exclude"]', this.panel);
    const onExclude = debounce(() => {
      password.exclude = exclude.value;
      this.changed();
    }, 200);
    exclude.addEventListener("input", onExclude);

    for (const radio of $$<HTMLInputElement>('input[name="separator"]', this.panel)) {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        passphrase.separator = radio.value as Separator;
        this.changed();
      });
    }
    for (const key of ["capitalize", "includeDigit"] as const) {
      const box = $<HTMLInputElement>(`[data-opt="${key}"]`, this.panel);
      box.addEventListener("change", () => {
        passphrase[key] = box.checked;
        this.changed();
      });
    }
  }

  /** Writes the remembered preferences into the controls. */
  private syncControls(): void {
    const { password, passphrase } = this.prefs;
    for (const wrapper of $$("[data-range]", this.panel)) this.syncRange(wrapper);
    for (const box of $$<HTMLInputElement>("[data-set]", this.panel)) box.checked = password.sets[box.dataset.set as CharsetId];
    $<HTMLInputElement>('[data-opt="avoidAmbiguous"]', this.panel).checked = password.avoidAmbiguous;
    $<HTMLInputElement>('[data-opt="exclude"]', this.panel).value = password.exclude;
    for (const radio of $$<HTMLInputElement>('input[name="separator"]', this.panel)) radio.checked = radio.value === passphrase.separator;
    $<HTMLInputElement>('[data-opt="capitalize"]', this.panel).checked = passphrase.capitalize;
    $<HTMLInputElement>('[data-opt="includeDigit"]', this.panel).checked = passphrase.includeDigit;
  }

  private syncRange(wrapper: HTMLElement): void {
    const value = this.ranges[wrapper.dataset.range as RangeKey].get();
    const slider = $<HTMLInputElement>("[data-opt]", wrapper);
    const number = $<HTMLInputElement>("[data-opt-num]", wrapper);
    slider.value = String(value);
    number.value = String(value);
    const min = Number(slider.min);
    const max = Number(slider.max);
    // CSSOM writes are allowed under the CSP; only style attributes in markup are not.
    slider.style.setProperty("--fill", `${((value - min) / (max - min)) * 100}%`);
    for (const step of $$<HTMLButtonElement>("[data-step]", wrapper)) {
      step.disabled = Number(step.dataset.step) < 0 ? value <= min : value >= max;
    }
  }

  /** Marks character types that the exclusions have emptied (R38, AE10). */
  private showSetAvailability(unavailable: readonly CharsetId[]): void {
    const note = $("[data-sets-note]", this.panel);
    for (const box of $$<HTMLInputElement>("[data-set]", this.panel)) {
      box.closest("label")?.toggleAttribute("data-unavailable", unavailable.includes(box.dataset.set as CharsetId));
    }
    const empty = CHARSET_IDS.filter((id) => this.prefs.password.sets[id] && unavailable.includes(id));
    if (empty.length) {
      note.textContent = `${empty.map((id) => SET_NAMES[id]).join(" and ")} ${empty.length > 1 ? "are" : "is"} fully excluded, so ${empty.length > 1 ? "they are" : "it is"} left out.`;
    } else if (note.textContent?.includes("excluded")) {
      note.textContent = "";
    }
  }
}
