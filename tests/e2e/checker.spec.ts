import { expect, stubBreachApi, test } from "./fixtures.ts";

// "password123" hashes to CBFDAC6008F9CAB4083784CBD1874F76618D2A97.
const PREFIX = "CBFDA";
const SUFFIX = "C6008F9CAB4083784CBD1874F76618D2A97";

test.describe("strength checker", () => {
  test("AE3: the breach check sends one GET with only five hash characters", async ({ page, watch }) => {
    const calls = await stubBreachApi(page, () => `0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n${SUFFIX}:250000\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:0`);
    await page.goto("/password-strength-checker");
    await page.getByLabel("Password to check").fill("password123");
    await page.getByRole("button", { name: "Check breaches" }).click();

    await expect(page.locator("[data-breach-result]")).toContainText("Found 250,000 times");
    await expect(page.locator('[data-strength="check"]')).toHaveAttribute("data-rating", "compromised");

    const gets = calls.filter((c) => c.method === "GET");
    expect(gets).toHaveLength(1);
    expect(new URL(gets[0]!.url).pathname).toBe(`/range/${PREFIX}`);
    expect(gets[0]!.headers["add-padding"]).toBe("true");
    expect(gets[0]!.headers.cookie).toBeUndefined();
    expect(gets[0]!.headers.referer).toBeUndefined();
    for (const value of [gets[0]!.url, ...Object.values(gets[0]!.headers)]) {
      expect(value).not.toContain("password123");
      expect(value.toUpperCase()).not.toContain(SUFFIX.slice(0, 8));
    }
    await expect(page.locator("[data-net-summary]")).toHaveText("1 sent");
    await expect(page.locator("[data-net-log]")).toContainText(PREFIX);
    expect(watch.external.every((r) => r.url().startsWith("https://api.pwnedpasswords.com/range/"))).toBe(true);
  });

  test("AE13: a padding row with count 0 reads as not found", async ({ page }) => {
    await stubBreachApi(page, () => `${SUFFIX}:0\n0018A45C4D1DEF81644B54AB7F969B88D65:12`);
    await page.goto("/password-strength-checker");
    await page.getByLabel("Password to check").fill("password123");
    await page.getByRole("button", { name: "Check breaches" }).click();
    await expect(page.locator("[data-breach-result]")).toContainText("Not found in known breaches");
  });

  test("AE4: an offline breach check is a failure, never 'safe'", async ({ page, context }) => {
    await page.goto("/password-strength-checker");
    await page.getByLabel("Password to check").fill("password123");
    await context.setOffline(true);
    await page.getByRole("button", { name: "Check breaches" }).click();
    await expect(page.locator("[data-breach-result]")).toHaveAttribute("data-status", "failed");
    await expect(page.locator("[data-breach-result]")).not.toContainText("Not found");
    await context.setOffline(false);
  });

  test("AE11: editing the password clears a breach result", async ({ page }) => {
    await stubBreachApi(page, () => `${SUFFIX}:52256`);
    await page.goto("/password-strength-checker");
    const field = page.getByLabel("Password to check");
    await field.fill("password123");
    await page.getByRole("button", { name: "Check breaches" }).click();
    await expect(page.locator("[data-breach-result]")).toBeVisible();
    await field.press("4");
    await expect(page.locator("[data-breach-result]")).toBeHidden();
    await expect(page.locator('[data-strength="check"]')).not.toHaveAttribute("data-rating", "compromised");
  });

  test("rates a generated 20-character password as excellent, and warns about common ones", async ({ page }) => {
    await page.goto("/password-strength-checker");
    const field = page.getByLabel("Password to check");
    await field.fill("kR7#mQ2!vX9@pL4$wN8&");
    await expect(page.locator('[data-strength="check"]')).toHaveAttribute("data-rating", "excellent");
    await field.fill("password");
    await expect(page.locator('[data-strength="check"]')).toHaveAttribute("data-rating", "very-weak");
    await expect(page.locator("[data-check-feedback] li").first()).toBeVisible();
  });

  test("AE12: pagehide and a back/forward-cache restore both wipe and re-mask the field", async ({ page }) => {
    // Headless Chromium won't restore this page from the back/forward cache (the reason is masked),
    // so the lifecycle handlers are driven directly with the events a real restore fires.
    await page.goto("/password-strength-checker");
    const field = page.getByLabel("Password to check");
    for (const fire of [
      () => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })),
      () => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
    ]) {
      await field.fill("hunter2");
      await page.getByRole("button", { name: "Show password" }).click();
      await expect(field).toHaveAttribute("type", "text");
      await page.evaluate(fire);
      await expect(field).toHaveValue("");
      await expect(field).toHaveAttribute("type", "password");
      await expect(page.locator('[data-strength="check"]')).toHaveAttribute("data-empty", "true");
    }
  });

  test("AE12: after navigating away and back, the field is empty and masked", async ({ page }) => {
    await page.goto("/password-strength-checker");
    const field = page.getByLabel("Password to check");
    await field.fill("hunter2");
    await page.getByRole("button", { name: "Show password" }).click();
    await page.goto("/404-navigation-target");
    await page.goBack();
    await expect(field).toHaveValue("");
    await expect(field).toHaveAttribute("type", "password");
  });

  test("leaving check mode wipes what was typed", async ({ page }) => {
    await page.goto("/password-strength-checker");
    await page.getByLabel("Password to check").fill("hunter2");
    await page.getByRole("link", { name: "Password", exact: true }).click();
    await page.getByRole("link", { name: "Strength", exact: true }).click();
    await expect(page.getByLabel("Password to check")).toHaveValue("");
  });

  test("checks a breached password against the real API @live", async ({ page }) => {
    await page.goto("/password-strength-checker");
    await page.getByLabel("Password to check").fill("password123");
    await page.getByRole("button", { name: "Check breaches" }).click();
    await expect(page.locator("[data-breach-result]")).toHaveAttribute("data-status", "found", { timeout: 15_000 });
  });
});
