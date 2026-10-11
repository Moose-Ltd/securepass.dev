// Theme: follows the system by default, with a manual override that persists (R23). The inline
// bootstrap in <head> applies a stored override before first paint; this module keeps the control,
// the attribute and the browser chrome colour in step afterwards.

export type ThemeChoice = "system" | "light" | "dark";

const KEY = "securepass:theme";
const ORDER: readonly ThemeChoice[] = ["system", "light", "dark"];
const CHROME = { light: "#f4f6fb", dark: "#0b1130" } as const;
const LABELS: Record<ThemeChoice, string> = { system: "match system", light: "light", dark: "dark" };

function stored(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function apply(choice: ThemeChoice, button: HTMLElement): void {
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;

  // Pin the browser chrome colour to an override; with "system" the media queries decide.
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  metas.forEach((meta, i) => {
    const media = i === 0 ? "light" : "dark";
    meta.content = choice === "system" ? CHROME[media] : CHROME[choice];
  });

  const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length]!;
  button.dataset.themeChoice = choice;
  button.setAttribute("aria-label", `Theme: ${LABELS[choice]}. Switch to ${LABELS[next]}`);
}

export function initTheme(button: HTMLElement): void {
  let choice = stored();
  apply(choice, button);
  button.addEventListener("click", () => {
    choice = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length]!;
    try {
      if (choice === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      // The override still applies for this page view.
    }
    apply(choice, button);
  });
}
