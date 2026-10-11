// The four tool pages and the two pages that explain them. This module is shared by the build
// (which prerenders each page) and the browser (which switches modes without a reload), so it must
// stay free of Node imports.

export type Mode = "password" | "passphrase" | "pin" | "check";

/** The modes that generate a secret. */
export type GeneratorMode = Exclude<Mode, "check">;

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

/** The pages that explain the tool. They live apart from it, so each tool page is one screen. */
export type ContentId = "how-it-works" | "faq";

export interface ContentPage {
  id: ContentId;
  path: string;
  /** Label in the site navigation. */
  nav: string;
  title: string;
  description: string;
  h1: string;
}

export const CONTENT_PAGES: readonly ContentPage[] = [
  {
    id: "how-it-works",
    path: "/how-it-works",
    nav: "How it works",
    title: "How SecurePass Keeps Your Passwords Private | SecurePass",
    description:
      "How SecurePass makes passwords on your device, checks breaches without sending them and estimates crack time, and how to verify each part yourself.",
    h1: "How SecurePass works",
  },
  {
    id: "faq",
    path: "/faq",
    nav: "FAQ",
    title: "SecurePass FAQ: Privacy, Offline Use and Strength | SecurePass",
    description:
      "Answers about SecurePass: whether passwords are ever sent, offline use, the private breach check, randomness, and what it can't protect against.",
    h1: "Questions",
  },
];

/** Every page with its own URL: the tool modes first, then the content pages. */
export const PAGE_PATHS: readonly string[] = [...ROUTES.map((r) => r.path), ...CONTENT_PAGES.map((p) => p.path)];

/** The file a page path is built to, relative to the site root ("index.html", "faq/index.html"). */
export function fileForPath(path: string): string {
  return path === "/" ? "index.html" : `${path.slice(1)}/index.html`;
}

/** The page file a route is built to, relative to the site root ("index.html", "pin-generator/index.html"). */
export function pageFile(route: Route): string {
  return fileForPath(route.path);
}

export function urlForPath(path: string): string {
  return path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;
}

export function canonicalUrl(route: Route): string {
  return urlForPath(route.path);
}
