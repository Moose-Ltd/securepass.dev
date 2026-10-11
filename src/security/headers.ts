// The single source of truth for every response header (KTD3). The build writes dist/_headers from
// it, the "headers" section of each page renders the same values, and the smoke check compares the
// live site against it. Build-time only: it uses node:crypto and is never bundled for the browser.

import { createHash } from "node:crypto";
import { BREACH_API_ORIGIN } from "../check/breach.ts";
import { ROUTES } from "../pages/routes.ts";
import { HSTS, SW_URL, THEME_STORAGE_KEY, TRUSTED_TYPES_POLICY } from "./constants.ts";

export { TRUSTED_TYPES_POLICY };

/**
 * The only inline script on any page. It applies a stored theme override before first paint so the
 * page never flashes the wrong theme, and the CSP allows it by hash alone (KTD4).
 */
export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})();`;

export const THEME_BOOTSTRAP_HASH = `sha256-${createHash("sha256").update(THEME_BOOTSTRAP, "utf8").digest("base64")}`;

interface Directive {
  name: string;
  value: string;
  /** Plain-English meaning shown on the page next to the directive. */
  note: string;
}

export const CSP_DIRECTIVES: readonly Directive[] = [
  { name: "default-src", value: "'none'", note: "Block everything that is not explicitly allowed below." },
  {
    name: "script-src",
    value: `'self' '${THEME_BOOTSTRAP_HASH}'`,
    note: "Only SecurePass's own scripts, plus one inline theme script pinned by its hash.",
  },
  { name: "style-src", value: "'self'", note: "Load styles only from SecurePass. No inline styles." },
  { name: "img-src", value: "'self'", note: "Load images only from SecurePass." },
  { name: "font-src", value: "'self'", note: "Load fonts only from SecurePass. No font CDNs that could log your visit." },
  {
    name: "connect-src",
    value: `'self' ${BREACH_API_ORIGIN}`,
    note: "Requests go only to SecurePass, and to the breach check when you ask.",
  },
  { name: "manifest-src", value: "'self'", note: "Read the install manifest only from SecurePass." },
  { name: "worker-src", value: "'self'", note: "Run only SecurePass's own offline service worker." },
  { name: "base-uri", value: "'none'", note: "Stop injected markup from redirecting where relative links point." },
  { name: "form-action", value: "'none'", note: "Nothing on the page can submit a form anywhere." },
  { name: "frame-ancestors", value: "'none'", note: "No other site can embed SecurePass in a frame to trick you." },
  { name: "object-src", value: "'none'", note: "No plugins or embedded objects." },
  { name: "upgrade-insecure-requests", value: "", note: "Any plain HTTP request is upgraded to HTTPS." },
  {
    name: "require-trusted-types-for",
    value: "'script'",
    note: "The page cannot turn text into code. Every script URL has to pass a reviewed policy.",
  },
  {
    name: "trusted-types",
    value: TRUSTED_TYPES_POLICY,
    note: `That policy exists for one job: registering the offline service worker at ${SW_URL}.`,
  },
];

export const CONTENT_SECURITY_POLICY = CSP_DIRECTIVES.map((d) => (d.value ? `${d.name} ${d.value}` : d.name)).join("; ");

/**
 * Every capability the tool never uses is switched off. Only names current Chrome recognises are
 * listed: an unrecognised name is logged as a console error. Clipboard writing stays allowed for
 * the copy button.
 */
export const PERMISSIONS_POLICY_DENIED = [
  "accelerometer",
  "autoplay",
  "bluetooth",
  "browsing-topics",
  "camera",
  "compute-pressure",
  "display-capture",
  "encrypted-media",
  "fullscreen",
  "gamepad",
  "geolocation",
  "gyroscope",
  "hid",
  "identity-credentials-get",
  "idle-detection",
  "local-fonts",
  "magnetometer",
  "microphone",
  "midi",
  "otp-credentials",
  "payment",
  "picture-in-picture",
  "publickey-credentials-create",
  "publickey-credentials-get",
  "screen-wake-lock",
  "serial",
  "storage-access",
  "usb",
  "web-share",
  "window-management",
  "xr-spatial-tracking",
  "clipboard-read",
] as const;

export const PERMISSIONS_POLICY = [...PERMISSIONS_POLICY_DENIED.map((f) => `${f}=()`), "clipboard-write=(self)"].join(", ");

interface Header {
  name: string;
  value: string;
  note: string;
}

/** Headers sent with every response (the `/*` rule). */
export const SECURITY_HEADERS: readonly Header[] = [
  { name: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY, note: "The policy above." },
  {
    name: "Strict-Transport-Security",
    value: HSTS,
    note: "Browsers must use HTTPS for securepass.dev for the next two years.",
  },
  { name: "Referrer-Policy", value: "no-referrer", note: "Never tell another site which page you came from." },
  { name: "X-Content-Type-Options", value: "nosniff", note: "Browsers must not guess file types, so a file can't be passed off as a script." },
  { name: "X-Frame-Options", value: "DENY", note: "The older form of the frame ban, for browsers that predate frame-ancestors." },
  {
    name: "Cross-Origin-Opener-Policy",
    value: "same-origin",
    note: "Other windows cannot keep a handle on this page.",
  },
  {
    name: "Cross-Origin-Embedder-Policy",
    value: "require-corp",
    note: "The page refuses resources from other sites unless they explicitly opt in.",
  },
  {
    name: "Cross-Origin-Resource-Policy",
    value: "same-origin",
    note: "Other sites cannot load SecurePass's files into their pages.",
  },
  {
    name: "Permissions-Policy",
    value: PERMISSIONS_POLICY,
    note: `Camera, microphone, location and ${PERMISSIONS_POLICY_DENIED.length - 3} more are off. Only clipboard writing is allowed.`,
  },
];

interface CacheRule {
  pattern: string;
  value: string;
}

/**
 * Pages carry no-transform, so Cloudflare never rewrites them on the way out: no Web Analytics
 * beacon, Rocket Loader or email obfuscation, whatever the zone's settings say. It also turns off
 * Cloudflare's compression, so only the HTML pages carry it; scripts, styles and the word lists
 * stay compressed. Pages revalidate on every load, so a deploy shows up at once.
 */
const PAGE_CACHE = "no-transform, public, max-age=0, must-revalidate";

/**
 * Narrower rules carry only Cache-Control. Workers merges every rule that matches a path and
 * comma-joins a header defined twice, so no security header may appear here.
 */
export const CACHE_RULES: readonly CacheRule[] = [
  ...ROUTES.map((route) => ({ pattern: route.path, value: PAGE_CACHE })),
  { pattern: "/assets/*", value: "public, max-age=31536000, immutable" },
  { pattern: SW_URL, value: "no-cache" },
  { pattern: "/og/*", value: "public, max-age=86400" },
];

/** The Cache-Control _headers sets for `pattern`, or undefined where the platform default applies. */
export function cacheControlFor(pattern: string): string | undefined {
  return CACHE_RULES.find((r) => r.pattern === pattern)?.value;
}

/** The text of dist/_headers. */
export function renderHeadersFile(): string {
  const lines = ["/*", ...SECURITY_HEADERS.map((h) => `  ${h.name}: ${h.value}`)];
  for (const rule of CACHE_RULES) lines.push("", rule.pattern, `  Cache-Control: ${rule.value}`);
  return `${lines.join("\n")}\n`;
}
