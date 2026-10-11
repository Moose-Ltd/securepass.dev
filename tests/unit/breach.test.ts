import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BreachAttempt } from "../../src/check/breach.ts";

// The module keeps an in-flight flag, so each test gets a fresh copy: a test that
// fails mid-lookup must not leave the next one stuck on "busy".
type BreachModule = typeof import("../../src/check/breach.ts");
let breach: BreachModule;

const PASSWORD = "password";
const PASSWORD_SHA1 = "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8";
const PREFIX = "5BAA6";
const SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";
const RANGE_URL = "https://api.pwnedpasswords.com/range/5BAA6";

// Realistic neighbours: a near-miss differing only in the last character, and padding rows.
const NEAR_MISS = "1E4C9B93F3F0682250B6CF8331B7EE68FD7";
const FILLER = ["003D68EB55068C33ACE09247EE4C639306B:3", "1E2AAA439972480CEC7F16C795BBB429372:1", `${NEAR_MISS}:12`];
const PADDING = ["A".repeat(35) + ":0", "0".repeat(35) + ":0"];

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

function stubFetch(impl: FetchImpl) {
  const mock = vi.fn(impl);
  vi.stubGlobal("fetch", mock);
  return mock;
}

function respondWith(body: string, status = 200) {
  return stubFetch(async () => new Response(body, { status }));
}

function onlyCall(mock: ReturnType<typeof stubFetch>): [string, RequestInit] {
  expect(mock).toHaveBeenCalledTimes(1);
  const call = mock.mock.calls[0];
  if (!call) throw new Error("fetch was not called");
  return call;
}

// A fetch that never settles on its own but rejects like the platform does when its signal aborts.
function hangingFetch() {
  let markStarted!: (signal: AbortSignal) => void;
  const started = new Promise<AbortSignal>((resolve) => {
    markStarted = resolve;
  });
  const mock = stubFetch(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init.signal;
        if (!signal) throw new Error("lookup must pass an abort signal");
        signal.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "AbortError")));
        markStarted(signal);
      }),
  );
  return { mock, started };
}

beforeEach(async () => {
  vi.resetModules();
  breach = await import("../../src/check/breach.ts");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sha1Hex", () => {
  it("hashes the UTF-8 bytes to uppercase hex", async () => {
    expect(await breach.sha1Hex(PASSWORD)).toBe(PASSWORD_SHA1);
  });

  it("hashes exactly what was typed, without trimming or normalising", async () => {
    // Known SHA-1 vectors: surrounding whitespace and composed vs decomposed é must all differ.
    expect(await breach.sha1Hex(" password ")).not.toBe(PASSWORD_SHA1);
    expect(await breach.sha1Hex("é")).not.toBe(await breach.sha1Hex("é"));
    expect(await breach.sha1Hex("")).toBe("DA39A3EE5E6B4B0D3255BFEF95601890AFD80709");
  });
});

describe("request (AE3)", () => {
  it("sends exactly one GET whose path holds only the five-character prefix", async () => {
    const fetchMock = respondWith(`${SUFFIX}:52256`);
    await breach.checkBreach(PASSWORD);

    const [url, init] = onlyCall(fetchMock);
    expect(url).toBe(RANGE_URL);
    const parsed = new URL(url);
    expect(parsed.origin).toBe(breach.BREACH_API_ORIGIN);
    expect(parsed.pathname).toBe("/range/5BAA6");
    expect(parsed.search).toBe("");
    expect(parsed.hash).toBe("");
    expect(init.body).toBeUndefined();

    // Nothing past the prefix, and nothing of the password, may leave the device. The origin
    // is fixed (and itself spells "pwnedpasswords"), so inspect what follows it plus the headers.
    const headers = new Headers(init.headers);
    const outgoing = [url.slice(parsed.origin.length), ...[...headers].flat()].join("\n").toUpperCase();
    expect(outgoing).not.toContain(PASSWORD.toUpperCase());
    for (let i = 0; i + 4 <= SUFFIX.length; i++) {
      expect(outgoing).not.toContain(SUFFIX.slice(i, i + 4));
    }
  });

  it("requests padding and strips credentials, referrer and caching", async () => {
    const fetchMock = respondWith(`${SUFFIX}:52256`);
    await breach.checkBreach(PASSWORD);

    const [, init] = onlyCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(init.mode).toBe("cors");
    expect(init.credentials).toBe("omit");
    expect(init.referrerPolicy).toBe("no-referrer");
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect([...new Headers(init.headers)]).toEqual([["add-padding", "true"]]);
  });
});

describe("matching", () => {
  it("reports found with the count when the suffix is in the range", async () => {
    respondWith([...FILLER, `${SUFFIX}:52256`, ...PADDING].join("\n"));
    expect(await breach.checkBreach(PASSWORD)).toEqual({ status: "found", count: 52256, prefix: PREFIX });
  });

  it("treats a matching padding row (count 0) as not found (AE13)", async () => {
    respondWith([...FILLER, `${SUFFIX}:0`, ...PADDING].join("\n"));
    expect(await breach.checkBreach(PASSWORD)).toEqual({ status: "not-found", prefix: PREFIX });
  });

  it("reports not found when the suffix is absent, including near misses", async () => {
    respondWith([...FILLER, ...PADDING].join("\n"));
    expect(await breach.checkBreach(PASSWORD)).toEqual({ status: "not-found", prefix: PREFIX });
  });

  it("parses lowercase hex, CRLF line endings and blank lines the same way", async () => {
    const body = ["", ...FILLER, `${SUFFIX.toLowerCase()}:52256`, "", ...PADDING, ""].join("\r\n");
    respondWith(body);
    expect(await breach.checkBreach(PASSWORD)).toEqual({ status: "found", count: 52256, prefix: PREFIX });
  });

  it("matches the final row when the body has no trailing newline", async () => {
    respondWith([...PADDING, `${SUFFIX}:7`].join("\r\n"));
    expect(await breach.checkBreach(PASSWORD)).toEqual({ status: "found", count: 7, prefix: PREFIX });
  });

  it("fails rather than reporting safe when the body holds no range rows", async () => {
    // A proxy or portal page answering 200 must not read as "not found" (R15).
    respondWith("<!doctype html><title>Sign in to Wi-Fi</title>");
    expect(await breach.checkBreach(PASSWORD)).toEqual({ status: "failed", reason: "http" });
  });
});

describe("failures", () => {
  it("reports offline when fetch rejects with a network TypeError (AE4)", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await breach.checkBreach(PASSWORD)).toEqual({ status: "failed", reason: "offline" });
  });

  it("reports http on a non-2xx status", async () => {
    respondWith(`${SUFFIX}:52256`, 503);
    expect(await breach.checkBreach(PASSWORD)).toEqual({ status: "failed", reason: "http" });
  });

  it("aborts after 8 seconds and reports timeout", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { mock, started } = hangingFetch();

    const pending = breach.checkBreach(PASSWORD);
    const signal = await started;

    await vi.advanceTimersByTimeAsync(7_999);
    expect(signal.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    expect(await pending).toEqual({ status: "failed", reason: "timeout" });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("clears the timeout once a lookup settles", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    respondWith(`${SUFFIX}:52256`);
    await breach.checkBreach(PASSWORD);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("capability (R40)", () => {
  it("reports support when crypto.subtle and fetch exist", () => {
    respondWith("");
    expect(breach.canCheckBreaches()).toBe(true);
  });

  it("reports unsupported without crypto.subtle and never fetches", async () => {
    const fetchMock = respondWith(`${SUFFIX}:52256`);
    vi.stubGlobal("crypto", {});

    expect(breach.canCheckBreaches()).toBe(false);
    expect(await breach.checkBreach(PASSWORD)).toEqual({ status: "failed", reason: "unsupported" });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
    expect(globalThis.crypto.subtle).toBeDefined();
  });

  it("reports unsupported without fetch", async () => {
    vi.stubGlobal("fetch", undefined);
    expect(breach.canCheckBreaches()).toBe(false);
    expect(await breach.checkBreach(PASSWORD)).toEqual({ status: "failed", reason: "unsupported" });
  });
});

describe("one lookup at a time (R37)", () => {
  it("rejects a second call as busy without fetching, then accepts a new one", async () => {
    let release!: (response: Response) => void;
    const fetchMock = stubFetch(async () => new Response(`${SUFFIX}:52256`));
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );

    // Second call lands before the first has even finished hashing.
    const first = breach.checkBreach(PASSWORD);
    expect(await breach.checkBreach(PASSWORD)).toEqual({ status: "failed", reason: "busy" });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await breach.checkBreach("another")).toEqual({ status: "failed", reason: "busy" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    release(new Response([...PADDING].join("\n")));
    expect(await first).toEqual({ status: "not-found", prefix: PREFIX });

    expect(await breach.checkBreach(PASSWORD)).toEqual({ status: "found", count: 52256, prefix: PREFIX });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("frees the slot after a failed lookup", async () => {
    const fetchMock = stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await breach.checkBreach(PASSWORD)).toEqual({ status: "failed", reason: "offline" });
    fetchMock.mockImplementation(async () => new Response(`${SUFFIX}:3`));
    expect(await breach.checkBreach(PASSWORD)).toEqual({ status: "found", count: 3, prefix: PREFIX });
  });
});

describe("attempt hook (KTD10)", () => {
  it("announces each started lookup just before fetching, with the URL and prefix", async () => {
    const order: string[] = [];
    const attempts: BreachAttempt[] = [];
    stubFetch(async () => {
      order.push("fetch");
      return new Response(`${SUFFIX}:52256`);
    });
    breach.onBreachAttempt((attempt) => {
      order.push("attempt");
      attempts.push(attempt);
    });

    await breach.checkBreach(PASSWORD);

    expect(order).toEqual(["attempt", "fetch"]);
    expect(attempts).toEqual([{ url: RANGE_URL, prefix: PREFIX, at: expect.any(Number) }]);
  });

  it("still announces a lookup whose fetch fails, so the meter counts it", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    const listener = vi.fn<(attempt: BreachAttempt) => void>();
    breach.onBreachAttempt(listener);

    await breach.checkBreach(PASSWORD);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stays silent for busy and unsupported calls", async () => {
    let release!: (response: Response) => void;
    stubFetch(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const listener = vi.fn<(attempt: BreachAttempt) => void>();
    breach.onBreachAttempt(listener);

    const first = breach.checkBreach(PASSWORD);
    await breach.checkBreach(PASSWORD);
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    release(new Response(`${SUFFIX}:1`));
    await first;

    vi.stubGlobal("crypto", {});
    await breach.checkBreach(PASSWORD);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops notifying after unsubscribe, leaving other listeners attached", async () => {
    respondWith(`${SUFFIX}:1`);
    const removed = vi.fn<(attempt: BreachAttempt) => void>();
    const kept = vi.fn<(attempt: BreachAttempt) => void>();
    const unsubscribe = breach.onBreachAttempt(removed);
    breach.onBreachAttempt(kept);

    await breach.checkBreach(PASSWORD);
    unsubscribe();
    await breach.checkBreach(PASSWORD);

    expect(removed).toHaveBeenCalledTimes(1);
    expect(kept).toHaveBeenCalledTimes(2);
  });
});
