// Entry point for every page. Nothing here makes a network request: generation, analysis and
// preferences all run on the device.

import { initAnnouncer } from "./announcer.ts";
import { Checker } from "./checker-ui.ts";
import { $, $$ } from "./dom.ts";
import { Generator } from "./generator-ui.ts";
import { initModes, modeFromLocation } from "./modes.ts";
import { startNetworkMeter } from "./network-meter.ts";
import { loadPrefs } from "./prefs.ts";
import { registerServiceWorker } from "./sw-register.ts";
import { initTheme } from "./theme.ts";
import type { Mode } from "../pages/routes.ts";

const optional = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);

const MOVED_TO_HOW = new Set(["#how", "#randomness", "#network", "#headers", "#storage", "#breach", "#crack-time", "#guides", "#best-practice"]);
if (document.body.dataset.page === "tool" && location.hash) {
  const hash = location.hash;
  if (MOVED_TO_HOW.has(hash)) location.replace(`/how-it-works${hash}`);
  else if (hash === "#faq" || hash.startsWith("#faq-")) location.replace(`/faq${hash}`);
}

initAnnouncer($("[data-announcer]"));
initTheme($('[data-action="theme"]'));
startNetworkMeter({
  pill: $("[data-netpill]"),
  pillText: $("[data-net-summary]"),
  card: optional("[data-netcard]"),
  count: optional("[data-net-count]"),
  label: optional("[data-net-label]"),
  log: optional<HTMLOListElement>("[data-net-log]"),
});
registerServiceWorker({
  status: $$("[data-offline-status]"),
  shortStatus: optional("[data-offline-status-short]"),
  toast: $("[data-update-toast]"),
});

const vault = optional("[data-vault]");
if (vault) {
  const generatePanel = $('[data-panel="generate"]', vault);
  const checkPanel = $('[data-panel="check"]', vault);
  const generator = new Generator(generatePanel, loadPrefs());
  const checker = new Checker(checkPanel);

  const apply = async (mode: Mode) => {
    const isCheck = mode === "check";
    generatePanel.hidden = isCheck;
    checkPanel.hidden = !isCheck;
    // Leaving the checker wipes whatever was typed (R36).
    if (!isCheck) {
      checker.clear();
      await generator.activate(mode);
    }
  };

  initModes(apply);
  void apply(modeFromLocation(location.pathname) ?? (document.body.dataset.mode as Mode) ?? "password");
}
