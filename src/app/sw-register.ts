// Registers the offline service worker (R20) through the page's single Trusted Types policy, and
// offers a reload when a new version is waiting (R42).

import { SW_URL, TRUSTED_TYPES_POLICY } from "../security/constants.ts";

interface TrustedScriptURLPolicy {
  createScriptURL(input: string): string;
}

declare global {
  interface Window {
    trustedTypes?: { createPolicy(name: string, rules: { createScriptURL(input: string): string }): TrustedScriptURLPolicy };
  }
}

/**
 * The only Trusted Types policy on the page. It admits exactly one script URL; anything else
 * throws. The CSP names it (`trusted-types securepass`), so no other policy can be created.
 */
function scriptUrl(): string {
  const policy = window.trustedTypes?.createPolicy(TRUSTED_TYPES_POLICY, {
    createScriptURL(input: string) {
      if (input === SW_URL) return input;
      throw new TypeError(`Blocked script URL: ${input}`);
    },
  });
  return policy ? policy.createScriptURL(SW_URL) : SW_URL;
}

export function registerServiceWorker(views: { status: HTMLElement[]; shortStatus: HTMLElement | null; toast: HTMLElement }): void {
  const setStatus = (text: string, ready: boolean, short?: string) => {
    for (const node of views.status) {
      node.textContent = text;
      node.toggleAttribute("data-ready", ready);
    }
    if (views.shortStatus && short) {
      views.shortStatus.textContent = short;
      views.shortStatus.parentElement?.toggleAttribute("data-ready", ready);
    }
  };

  if (!("serviceWorker" in navigator)) {
    setStatus("This browser can't save SecurePass for offline use, so it needs a connection to load.", false);
    return;
  }

  let reloading = false;
  views.toast.querySelector('[data-action="dismiss-update"]')?.addEventListener("click", () => {
    views.toast.hidden = true;
  });
  const offerUpdate = (worker: ServiceWorker) => {
    views.toast.hidden = false;
    const button = views.toast.querySelector<HTMLButtonElement>('[data-action="reload"]');
    button?.addEventListener(
      "click",
      () => {
        reloading = true;
        worker.postMessage("SKIP_WAITING");
      },
      { once: true },
    );
  };
  // Only reload when the user asked for the update; the first install also changes the controller.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(scriptUrl(), { scope: "/" })
      .then((registration) => {
        const watch = (incoming: ServiceWorker | null) => {
          incoming?.addEventListener("statechange", () => {
            if (incoming.state === "installed" && navigator.serviceWorker.controller) offerUpdate(incoming);
          });
        };
        if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);
        // The navigation's own update check can find a new version before this listener exists.
        watch(registration.installing);
        registration.addEventListener("updatefound", () => watch(registration.installing));
        return navigator.serviceWorker.ready;
      })
      .then(() => setStatus("Ready to work offline. Turn off your connection and it keeps working.", true, "Ready offline"))
      .catch(() => setStatus("Offline mode couldn't be set up in this browser.", false));
  });
}
