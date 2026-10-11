// Every browser test records CSP violations, console errors and requests to other sites, and fails
// if anything unexpected shows up (Success Criteria: zero CSP violations and console errors).

import { test as base, expect, type Page, type Request } from "@playwright/test";

interface Watch {
  external: Request[];
  consoleErrors: string[];
  cspViolations: () => Promise<string[]>;
}

export const test = base.extend<{ watch: Watch }>({
  watch: async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL!).origin;
    const external: Request[] = [];
    const consoleErrors: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== origin) external.push(request);
    });
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));
    await page.addInitScript(() => {
      const list: string[] = [];
      (window as unknown as { __csp: string[] }).__csp = list;
      document.addEventListener("securitypolicyviolation", (e) => list.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    await use({
      external,
      consoleErrors,
      cspViolations: () => page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []),
    });
    expect(await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []), "CSP violations").toEqual([]);
    expect(consoleErrors, "console errors").toEqual([]);
  },
});

export { expect };

export async function secret(page: Page): Promise<string> {
  await expect(page.locator("[data-secret-value] .secret__placeholder")).toHaveCount(0);
  return (await page.locator("[data-secret-value]").textContent())!.trim();
}

/** Stubs the breach API so CI never depends on, or leaks to, the real service. */
export async function stubBreachApi(page: Page, body: (prefix: string) => string) {
  const calls: { url: string; method: string; headers: Record<string, string> }[] = [];
  await page.route("https://api.pwnedpasswords.com/**", async (route) => {
    const request = route.request();
    calls.push({ url: request.url(), method: request.method(), headers: await request.allHeaders() });
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Add-Padding", "Access-Control-Allow-Methods": "GET" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const prefix = new URL(request.url()).pathname.split("/").pop()!;
    return route.fulfill({ status: 200, headers: { ...cors, "Content-Type": "text/plain" }, body: body(prefix) });
  });
  return calls;
}
