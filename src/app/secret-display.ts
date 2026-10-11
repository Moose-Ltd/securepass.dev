// Shows the generated secret: characters tagged by class (colour plus weight, R8/R41), an optional
// mask (R43) and a spell-out list. The display carries translate="no" in the markup so browser
// translation never sends it anywhere or rewrites passphrase words (R16).

import { charClass, type CharsetId } from "../core/charsets.ts";
import type { GeneratorMode } from "../pages/routes.ts";
import { el, prefersReducedMotion } from "./dom.ts";

const MASK = "•".repeat(16);

const SYMBOL_NAMES: Record<string, string> = {
  "!": "exclamation mark",
  '"': "double quote",
  "#": "hash",
  $: "dollar",
  "%": "percent",
  "&": "ampersand",
  "'": "apostrophe",
  "(": "left parenthesis",
  ")": "right parenthesis",
  "*": "asterisk",
  "+": "plus",
  ",": "comma",
  "-": "hyphen",
  ".": "full stop",
  "/": "slash",
  ":": "colon",
  ";": "semicolon",
  "<": "less than",
  "=": "equals",
  ">": "greater than",
  "?": "question mark",
  "@": "at sign",
  "[": "left bracket",
  "\\": "backslash",
  "]": "right bracket",
  "^": "caret",
  _: "underscore",
  "`": "backtick",
  "{": "left brace",
  "|": "vertical bar",
  "}": "right brace",
  "~": "tilde",
  " ": "space",
};

export function characterName(ch: string): string {
  switch (charClass(ch)) {
    case "upper":
      return `capital ${ch}`;
    case "lower":
      return `lower case ${ch}`;
    case "digits":
      return `digit ${ch}`;
    default:
      return SYMBOL_NAMES[ch] ?? "symbol";
  }
}

/** Classes that get their own colour and weight; letters stay in the ink colour. */
const CLASS_FOR: Partial<Record<CharsetId, string>> = { digits: "c-digit", symbols: "c-symbol" };

export class SecretDisplay {
  private value = "";
  private kind: GeneratorMode = "password";
  private hidden = false;
  private spellOpen = false;

  constructor(
    private readonly output: HTMLElement,
    private readonly spell: HTMLOListElement,
  ) {}

  get current(): string {
    return this.value;
  }

  get isHidden(): boolean {
    return this.hidden;
  }

  show(value: string, kind: GeneratorMode): void {
    this.value = value;
    this.kind = kind;
    this.output.dataset.kind = kind;
    this.render();
    if (this.spellOpen) this.renderSpell();
    if (!prefersReducedMotion()) {
      this.output.classList.remove("is-new");
      // Restart the reveal animation on the next frame.
      requestAnimationFrame(() => this.output.classList.add("is-new"));
    }
  }

  /** Replaces the secret with a message (empty alphabet, insecure browser). */
  message(text: string): void {
    this.value = "";
    this.output.removeAttribute("data-masked");
    this.output.removeAttribute("data-long");
    this.output.replaceChildren(el("span", { className: "secret__placeholder", text }));
    this.spell.replaceChildren();
  }

  /** The spell-out list exists only while open, so the secret never lingers in a hidden list. */
  setSpellOpen(open: boolean): void {
    this.spellOpen = open;
    if (open) this.renderSpell();
    else this.spell.replaceChildren();
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.render();
  }

  private render(): void {
    if (!this.value) return;
    this.output.toggleAttribute("data-long", this.value.length > 40);
    if (this.hidden) {
      this.output.setAttribute("data-masked", "");
      this.output.replaceChildren(MASK);
      return;
    }
    this.output.removeAttribute("data-masked");
    const fragment = document.createDocumentFragment();
    let run = "";
    let runClass = "";
    // Group consecutive characters of one class into a single span to keep the DOM small.
    const flush = () => {
      if (!run) return;
      fragment.append(runClass ? el("span", { className: runClass, text: run }) : document.createTextNode(run));
      run = "";
    };
    for (const ch of this.value) {
      const kind = charClass(ch);
      const cls = this.kind === "pin" ? "" : (CLASS_FOR[kind] ?? "");
      if (cls !== runClass) {
        flush();
        runClass = cls;
      }
      run += ch;
    }
    flush();
    this.output.replaceChildren(fragment);
  }

  private renderSpell(): void {
    const items: HTMLLIElement[] = [];
    if (this.kind === "passphrase") {
      const words = this.value.split(/[-. _,]+|(?<=[a-z0-9])(?=[A-Z])/).filter(Boolean);
      words.forEach((word, i) =>
        items.push(el("li", {}, [el("span", { className: "spell__char", text: word }), el("span", { className: "spell__pos", text: `word ${i + 1}` })])),
      );
    } else {
      Array.from(this.value).forEach((ch, i) =>
        items.push(
          el("li", {}, [
            el("span", { className: "spell__char", text: ch === " " ? "␣" : ch }),
            el("span", { className: "spell__name", text: characterName(ch) }),
            el("span", { className: "spell__pos", text: String(i + 1) }),
          ]),
        ),
      );
    }
    this.spell.replaceChildren(...items);
  }
}
