import { expect, secret, test } from "./fixtures.ts";

test("AE2: without secure randomness nothing is generated and the reason is shown", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, "getRandomValues", { value: undefined, configurable: true });
  });
  await page.goto("/");
  await expect(page.locator("[data-secret-value]")).toContainText("can't provide secure random numbers");
  await expect(page.getByRole("button", { name: "Copy" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "New" })).toBeDisabled();
});

test("a strength estimator that fails to load waits for Try again instead of retrying forever", async ({ page, watch }) => {
  let attempts = 0;
  let failing = true;
  await page.route(/\/assets\/estimator-[^/]+\.js$/, (route) => {
    attempts += 1;
    return failing ? route.abort() : route.continue();
  });
  await page.goto("/password-strength-checker");
  await page.getByLabel("Password to check").fill("hunter2-and-more");
  const retry = page.getByRole("button", { name: "Try again" });
  await expect(retry).toBeVisible();
  // Give a runaway retry loop time to show itself.
  await page.waitForTimeout(1000);
  expect(attempts).toBe(1);

  failing = false;
  await retry.click();
  await expect(page.locator('[data-strength="check"]')).toHaveAttribute("data-rating", /.+/);
  // The deliberately failed chunk logs a load error; nothing else may.
  expect(watch.consoleErrors.filter((e) => !/estimator|Failed to fetch dynamically imported module|ERR_FAILED/i.test(e))).toEqual([]);
  watch.consoleErrors.length = 0;
});

test("a word list that fails to load says so, and New tries again", async ({ page, watch }) => {
  let failing = true;
  await page.route(/\/assets\/eff_large_wordlist-[^/]+\.js$/, (route) => (failing ? route.abort() : route.continue()));
  await page.goto("/passphrase-generator");
  await expect(page.locator("[data-secret-value]")).toContainText("word list couldn't load");
  await expect(page.getByRole("button", { name: "Copy" })).toBeDisabled();
  failing = false;
  await page.getByRole("button", { name: "New" }).click();
  expect((await secret(page)).split("-").length).toBeGreaterThanOrEqual(6);
  expect(watch.consoleErrors.filter((e) => !/wordlist|Failed to fetch dynamically imported module|ERR_FAILED/i.test(e))).toEqual([]);
  watch.consoleErrors.length = 0;
});

test("when copying is blocked, a hidden secret is revealed and selected, never the mask", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  });
  await page.goto("/");
  const value = await secret(page);
  await page.getByRole("button", { name: "Hide" }).click();
  await page.getByRole("button", { name: "Copy" }).click();
  await expect(page.locator("[data-copy-hint]")).toContainText("blocked copying");
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(value);
  await expect(page.getByRole("button", { name: "Hide" })).toHaveAttribute("aria-pressed", "false");
});
