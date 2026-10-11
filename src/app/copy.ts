// Copies the secret inside the click that asked for it. When the Clipboard API is missing or refused,
// the secret is selected so the user can copy it with the keyboard instead (R40).

export type CopyOutcome = "copied" | "selected";

export async function copySecret(value: string, output: HTMLElement): Promise<CopyOutcome> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(value);
    return "copied";
  } catch {
    const range = document.createRange();
    range.selectNodeContents(output);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return "selected";
  }
}

export const copyShortcutHint = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "Cmd+C" : "Ctrl+C");
