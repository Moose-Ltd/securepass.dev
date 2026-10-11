import { describe, expect, it } from "vitest";
import { RequestLedger, isExternalRequest } from "../../src/app/network-meter.ts";

const ORIGIN = "https://securepass.dev";

describe("network meter", () => {
  it("counts only requests to other sites", () => {
    const ledger = new RequestLedger(ORIGIN);
    ledger.addResource(`${ORIGIN}/assets/estimator-abc.js`);
    ledger.addResource("https://api.pwnedpasswords.com/range/ABCDE");
    expect(ledger.requests).toEqual([{ url: "https://api.pwnedpasswords.com/range/ABCDE" }]);
  });

  it("describes a breach check by the prefix it sent, and counts it once", () => {
    const ledger = new RequestLedger(ORIGIN);
    const url = "https://api.pwnedpasswords.com/range/5BAA6";
    ledger.addAttempt({ url, prefix: "5BAA6", at: 1 });
    ledger.addResource(url);
    expect(ledger.requests).toEqual([{ url, prefix: "5BAA6" }]);
  });

  it("still counts a breach attempt that left no resource entry", () => {
    const ledger = new RequestLedger(ORIGIN);
    ledger.addAttempt({ url: "https://api.pwnedpasswords.com/range/12345", prefix: "12345", at: 1 });
    expect(ledger.requests).toHaveLength(1);
  });

  it("ignores browser-extension resources, which are not network requests", () => {
    expect(isExternalRequest("chrome-extension://abc/icon.png", ORIGIN)).toBe(false);
    expect(isExternalRequest("moz-extension://abc/font.woff2", ORIGIN)).toBe(false);
    expect(isExternalRequest("data:image/png;base64,AAAA", ORIGIN)).toBe(false);
    expect(isExternalRequest("not a url", ORIGIN)).toBe(false);
    expect(isExternalRequest("https://evil.example/x", ORIGIN)).toBe(true);
    expect(isExternalRequest(`${ORIGIN}/sw.js`, ORIGIN)).toBe(false);
  });
});
