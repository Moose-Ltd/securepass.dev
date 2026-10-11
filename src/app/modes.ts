// Mode switching without a reload (R28, R39). Each mode is a real page, so a switch updates the URL
// and adds a history entry, and Back restores the previous mode. The URL always decides the mode.

import { announce } from "./announcer.ts";
import { $, $$ } from "./dom.ts";
import { canonicalUrl, routeForMode, routeForPath, type Mode } from "../pages/routes.ts";

export function modeFromLocation(pathname: string): Mode | undefined {
  return routeForPath(pathname)?.mode;
}

export function initModes(apply: (mode: Mode) => Promise<void> | void): void {
  const show = (mode: Mode, focus: boolean) => {
    const route = routeForMode(mode);
    document.body.dataset.mode = mode;
    document.title = route.title;
    $("[data-page-title]").textContent = route.h1;
    $("[data-page-lede]").textContent = route.lede;
    $<HTMLLinkElement>('link[rel="canonical"]').href = canonicalUrl(route);
    $<HTMLMetaElement>('meta[name="description"]').content = route.description;
    for (const link of $$<HTMLAnchorElement>("[data-mode-link]")) {
      if (link.dataset.modeLink === mode) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    void apply(mode);
    if (focus) {
      $("[data-page-title]").focus({ preventScroll: true });
      announce(route.announce);
    }
  };

  for (const link of $$<HTMLAnchorElement>("[data-mode-link]")) {
    link.addEventListener("click", (event) => {
      // Let the browser handle new-tab and download gestures.
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const mode = link.dataset.modeLink as Mode;
      event.preventDefault();
      if (mode === document.body.dataset.mode) return;
      history.pushState(null, "", routeForMode(mode).path);
      show(mode, true);
    });
  }

  window.addEventListener("popstate", () => {
    const mode = modeFromLocation(location.pathname);
    if (mode && mode !== document.body.dataset.mode) show(mode, true);
  });
}
