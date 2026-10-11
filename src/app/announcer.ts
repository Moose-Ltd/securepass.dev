// One polite live region for the whole page. Announcements say what happened and never contain a
// password (R41).

let region: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

export function initAnnouncer(node: HTMLElement): void {
  region = node;
}

/** Announces `message` after `delay` ms; a newer call replaces a pending one. */
export function announce(message: string, delay = 0): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (!region) return;
    // Clearing first makes screen readers repeat an identical message.
    region.textContent = "";
    requestAnimationFrame(() => {
      if (region) region.textContent = message;
    });
  }, delay);
}
