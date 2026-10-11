import type { Page } from "@playwright/test";
import { expect, secret, stubBreachApi, test } from "./fixtures.ts";

async function inViewport(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  const viewport = page.viewportSize()!;
  expect(box, selector).not.toBeNull();
  expect(box!.y, `${selector} top`).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `${selector} bottom`).toBeLessThanOrEqual(viewport.height);
  expect(box!.x + box!.width, `${selector} right edge`).toBeLessThanOrEqual(viewport.width);
}

for (const viewport of [
  { width: 375, height: 667 },
  { width: 1366, height: 768 },
]) {
  for (const scheme of ["light", "dark"] as const) {
    test(`AE8: the whole tool is above the fold at ${viewport.width}x${viewport.height} in ${scheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize(viewport);
      await page.goto("/");
      await secret(page);
      for (const selector of [
        ".modes",
        "[data-secret-value]",
        '[data-strength="gen"] .meter',
        '[data-strength="gen"] [data-rating-label]',
        "#pw-length",
        '[data-action="regenerate"]',
        '[data-action="copy"]',
      ]) {
        await inViewport(page, selector);
      }
      // No horizontal scrolling anywhere on the page.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
}

test("the theme override persists across a reload and applies before first paint", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const toggle = page.locator('[data-action="theme"]');
  await toggle.click(); // system -> light
  await toggle.click(); // light -> dark
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  // Read during parsing, before the app script runs: the inline bootstrap already applied it.
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  await toggle.click(); // dark -> system
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
});

test("mode switches update the URL without a reload, and Back restores the previous mode", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => ((window as unknown as { __marker: boolean }).__marker = true));
  await page.getByRole("link", { name: "Passphrase", exact: true }).click();
  await expect(page).toHaveURL(/\/passphrase-generator$/);
  await expect(page.locator("h1")).toHaveText("Passphrase generator");
  await expect(page).toHaveTitle(/Passphrase Generator/);
  await page.getByRole("link", { name: "PIN", exact: true }).click();
  await expect(page).toHaveURL(/\/pin-generator$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/passphrase-generator$/);
  await expect(page.locator("h1")).toHaveText("Passphrase generator");
  await expect(page.locator('[data-options="passphrase"]')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __marker?: boolean }).__marker)).toBe(true);
});

test("AE10: excluding every digit marks digits unavailable and leaves them out", async ({ page }) => {
  await page.goto("/");
  await page.getByText("More options").click();
  await page.getByLabel("Leave out these characters").fill("0123456789");
  await expect(page.locator("[data-sets-note]")).toContainText("Digits");
  await expect(page.locator('label:has([data-set="digits"])')).toHaveAttribute("data-unavailable", "");
  expect(await secret(page)).not.toMatch(/\d/);
});

test("AE9: the last character type cannot be switched off", async ({ page }) => {
  await page.goto("/");
  for (const id of ["upper", "lower", "digits"]) await page.locator(`label:has([data-set="${id}"])`).click();
  await page.locator('label:has([data-set="symbols"])').click();
  await expect(page.locator('[data-set="symbols"]')).toBeChecked();
  await expect(page.locator("[data-sets-note]")).toContainText("At least one");
  expect((await secret(page)).length).toBe(20);
});

test("hiding the secret masks it and disables spelling it out", async ({ page }) => {
  await page.goto("/");
  const value = await secret(page);
  await page.getByRole("button", { name: "Hide" }).click();
  await expect(page.locator("[data-secret-value]")).not.toContainText(value);
  await expect(page.getByRole("button", { name: "Spell it out" })).toBeDisabled();
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.locator("[data-secret-value]")).toHaveText(value);
});

for (const viewport of [
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
]) {
  test(`at ${viewport.width}x${viewport.height} every tool page, loaded directly, is exactly one screen with its footer in view`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const path of ["/", "/passphrase-generator", "/pin-generator", "/password-strength-checker"]) {
      await page.goto(path);
      await expect(page.locator("[data-vault]")).toBeVisible();
      const fit = await page.evaluate(() => ({ page: document.documentElement.scrollHeight, footer: Math.round(document.querySelector(".site-footer")!.getBoundingClientRect().bottom) }));
      expect(fit, path).toEqual({ page: viewport.height, footer: viewport.height });
      // The offline status (R42) and the icon credit the licence requires are visible at every size.
      await expect(page.locator(".footer__status"), path).toBeVisible();
      await expect(page.getByRole("link", { name: "Security icons created by Vectors Tank - Flaticon" }), path).toBeVisible();
    }
  });

  test(`at ${viewport.width}x${viewport.height} the checker stays one screen with suggestions and a breach result`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stubBreachApi(page, () => "0018A45C4D1DEF81644B54AB7F969B88D65:3");
    await page.goto("/password-strength-checker");
    const vault = () => page.locator("[data-vault]").evaluate((el) => Math.round(el.getBoundingClientRect().height));
    const idle = await vault();
    await page.getByLabel("Password to check").fill("password123");
    await expect(page.locator("[data-check-feedback] li").first()).toBeVisible();
    await page.getByRole("button", { name: "Check breaches" }).click();
    await expect(page.locator("[data-breach-result]")).toBeVisible();
    expect(await vault()).toBe(idle);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(viewport.height);
  });
}

for (const viewport of [
  { width: 375, height: 667 },
  { width: 1366, height: 768 },
]) {
  test(`at ${viewport.width}x${viewport.height} each tool page is exactly one screen, and nothing in it moves the page`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await secret(page);
    // The tool's height, the page's height, and where the footer sits.
    const layout = () =>
      page.evaluate(() => {
        const vault = document.querySelector("[data-vault]")!.getBoundingClientRect();
        const footer = document.querySelector(".site-footer")!.getBoundingClientRect();
        return { vault: Math.round(vault.height), page: document.documentElement.scrollHeight, footer: Math.round(footer.bottom + window.scrollY) };
      });
    const start = await layout();
    expect(start.page, "the page never scrolls").toBe(viewport.height);
    expect(start.footer, "the footer sits at the bottom of the screen").toBe(viewport.height);

    const steps: [string, () => Promise<void>][] = [
      ["hide", () => page.getByRole("button", { name: "Hide" }).click()],
      ["show", () => page.getByRole("button", { name: "Show" }).click()],
      ["spell out", () => page.getByRole("button", { name: "Spell it out" }).click()],
      ["close with Escape", () => page.keyboard.press("Escape")],
      ["attack speeds", () => page.getByRole("button", { name: "Attack speeds" }).first().click()],
      ["close by pressing outside", () => page.mouse.click(2, viewport.height - 2)],
      ["passphrase", () => page.getByRole("link", { name: "Passphrase", exact: true }).click()],
      ["PIN", () => page.getByRole("link", { name: "PIN", exact: true }).click()],
      ["strength", () => page.getByRole("link", { name: "Strength", exact: true }).click()],
      ["password", () => page.getByRole("link", { name: "Password", exact: true }).click()],
    ];
    for (const [name, act] of steps) {
      await act();
      expect(await layout(), name).toEqual(start);
    }
    await expect(page.locator("[data-spell]")).toBeHidden();
    await expect(page.locator("#crack-gen")).toBeHidden();
  });
}

test("the secret stays on one line at any length", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await secret(page);
  const lines = () =>
    page.locator("[data-secret-value]").evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
  for (const length of ["8", "64", "128"]) {
    await page.locator("#pw-length-num").fill(length);
    await page.locator("#pw-length-num").press("Enter");
    await expect.poll(async () => (await secret(page)).length).toBe(Number(length));
    expect(await lines(), `${length} characters`).toBe(1);
  }
  // Too long to show whole: it scrolls sideways, and a fade marks the hidden end.
  await expect(page.locator("[data-secret-value]")).toHaveAttribute("data-overflow", "end");
});

test("overlays close on Escape (focus returns to their button) or a press outside, and stay open for presses inside", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => {} }, configurable: true });
  });
  await page.goto("/");
  await secret(page);
  const spellButton = page.getByRole("button", { name: "Spell it out" });
  const spell = page.locator("[data-spell]");
  await spellButton.click();
  await spell.locator("li").first().click();
  await expect(spell, "a press inside keeps it open").toBeVisible();
  await page.keyboard.press("Escape");
  await expect(spell).toBeHidden();
  await expect(spellButton).toBeFocused();
  await expect(spellButton).toHaveAttribute("aria-expanded", "false");

  const speeds = page.getByRole("button", { name: "Attack speeds" }).first();
  await speeds.click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#crack-gen")).toBeHidden();
  await expect(speeds).toBeFocused();

  await page.getByRole("button", { name: "Copy" }).click();
  const notice = page.locator("[data-copy-hint]");
  await expect(notice).toBeVisible();
  await page.mouse.click(2, 300);
  await expect(notice, "a press outside closes the copy notice").toBeHidden();
});
