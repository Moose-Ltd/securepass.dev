// Values shared by the build-time header definitions (headers.ts, which uses node:crypto), the
// browser code and the www redirect Worker. Dependency-free so every side can import it; a mismatch
// here would silently break service worker registration or the theme bootstrap.

/** The one Trusted Types policy the page may create (KTD5). */
export const TRUSTED_TYPES_POLICY = "securepass";

/** The only script URL that policy admits. */
export const SW_URL = "/sw.js";

/** localStorage key for the theme override; read by the inline bootstrap before first paint. */
export const THEME_STORAGE_KEY = "securepass:theme";

export const HSTS = "max-age=63072000; includeSubDomains; preload";

/** Browser chrome colours, matching --bg in each theme. */
export const CHROME_COLORS = { light: "#f4f6fb", dark: "#0b1130" } as const;
