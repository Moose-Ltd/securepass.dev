// The four tool pages. This module is shared by the build (which prerenders each page) and the
// browser (which switches modes without a reload), so it must stay free of Node imports.

export type Mode = "password" | "passphrase" | "pin" | "check";

export interface Route {
  mode: Mode;
  path: string;
  /** Label on the mode switch. */
  tab: string;
  /** Document title. */
  title: string;
  /** Meta description and Open Graph description. */
  description: string;
  h1: string;
  lede: string;
  /** Spoken when the mode changes without a reload. */
  announce: string;
}

export const SITE_ORIGIN = "https://securepass.dev";

export const ROUTES: readonly Route[] = [
  {
    mode: "password",
    path: "/",
    tab: "Password",
    title: "Free Secure Password Generator, Fully Offline | SecurePass",
    description:
      "Generate strong, random passwords in your browser. Nothing is sent or stored: no tracking, no cookies, and it works offline. See how long each would take to crack.",
    h1: "Password generator",
    lede: "Strong, random passwords made on your device. Nothing you generate is ever sent anywhere.",
    announce: "Password generator",
  },
  {
    mode: "passphrase",
    path: "/passphrase-generator",
    tab: "Passphrase",
    title: "Passphrase Generator Using the EFF Wordlist | SecurePass",
    description:
      "Create memorable passphrases from the EFF's 7,776-word list using your device's secure random generator. Private, offline and free, with crack-time estimates.",
    h1: "Passphrase generator",
    lede: "Random words that are easy to type and hard to guess. Made on your device, never sent anywhere.",
    announce: "Passphrase generator",
  },
  {
    mode: "pin",
    path: "/pin-generator",
    tab: "PIN",
    title: "Random PIN Generator, Secure and Offline | SecurePass",
    description:
      "Generate random 4 to 12 digit PINs with your browser's cryptographic random generator. Nothing leaves your device, and it works without a connection.",
    h1: "PIN generator",
    lede: "Random PINs from your device's secure random generator, for places that lock after a few wrong tries.",
    announce: "PIN generator",
  },
  {
    mode: "check",
    path: "/password-strength-checker",
    tab: "Strength",
    title: "Password Strength Checker and Breach Check | SecurePass",
    description:
      "Test how strong a password is and how long it would take to crack, right on your device. Optionally check it against known breaches without ever sending it.",
    h1: "Password strength checker",
    lede: "See how long a password would hold up against a real attack. It is analysed on your device and never sent anywhere.",
    announce: "Password strength checker",
  },
];

export function routeForMode(mode: Mode): Route {
  const route = ROUTES.find((r) => r.mode === mode);
  if (!route) throw new Error(`No route for mode ${mode}`);
  return route;
}

/** The route for a pathname, ignoring a trailing slash; undefined for anything else. */
export function routeForPath(pathname: string): Route | undefined {
  const normalised = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return ROUTES.find((r) => r.path === normalised);
}

export function canonicalUrl(route: Route): string {
  return route.path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${route.path}`;
}
