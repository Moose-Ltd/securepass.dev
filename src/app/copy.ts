// Copies the secret inside the click that asked for it. When the Clipboard API is missing or refused,
// the caller selects the secret so the user can copy it with the keyboard instead (R40).

export type CopyOutcome = "copied" | "blocked";

export async function copySecret(value: string): Promise<CopyOutcome> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(value);
    return "copied";
  } catch {
    return "blocked";
  }
}

/** Selects everything inside `node`, ready for the user's own copy shortcut. */
export function selectContents(node: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export const copyShortcutHint = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "Cmd+C" : "Ctrl+C");
