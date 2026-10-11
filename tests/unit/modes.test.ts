import { describe, expect, it } from "vitest";
import { ROUTES, canonicalUrl, routeForMode, routeForPath } from "../../src/pages/routes.ts";

describe("mode routes", () => {
  it("maps every path to its mode and back", () => {
    for (const route of ROUTES) {
      expect(routeForPath(route.path)?.mode).toBe(route.mode);
      expect(routeForMode(route.mode).path).toBe(route.path);
    }
  });

  it("ignores a trailing slash", () => {
    expect(routeForPath("/passphrase-generator/")?.mode).toBe("passphrase");
    expect(routeForPath("/")?.mode).toBe("password");
  });

  it("returns nothing for an unknown path, so the 404 page shows no tool", () => {
    expect(routeForPath("/nope")).toBeUndefined();
    expect(routeForPath("/passphrase-generator/extra")).toBeUndefined();
  });

  it("builds canonical URLs without trailing slashes, except the root", () => {
    expect(canonicalUrl(routeForMode("password"))).toBe("https://securepass.dev/");
    expect(canonicalUrl(routeForMode("pin"))).toBe("https://securepass.dev/pin-generator");
  });
});
