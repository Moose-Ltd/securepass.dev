import AxeBuilder from "@axe-core/playwright";
import { expect, secret, test } from "./fixtures.ts";

for (const path of ["/", "/passphrase-generator", "/pin-generator", "/password-strength-checker", "/how-it-works", "/faq", "/nope"]) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${path} has no serious accessibility violations in ${scheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto(path);
      if (["/", "/passphrase-generator", "/pin-generator"].includes(path)) await secret(page);
      // Open the disclosures so their contents are checked too.
      for (const details of await page.locator("details").all()) await details.evaluate((d) => ((d as HTMLDetailsElement).open = true));
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });
  }
}

test("keyboard shortcuts work inside the tool but never while typing", async ({ page }) => {
  await page.goto("/");
  const first = await secret(page);
  await page.getByRole("button", { name: "New" }).focus();
  await page.keyboard.press("r");
  await expect.poll(() => secret(page)).not.toBe(first);

  const before = await secret(page);
  await page.getByText("More options").click();
  await page.getByLabel("Leave out these characters").focus();
  await page.keyboard.press("r");
  // Typing "r" excludes the letter r; it must not also trigger a regenerate shortcut.
  await expect(page.getByLabel("Leave out these characters")).toHaveValue("r");
  await expect.poll(() => secret(page)).not.toContain("r");
  expect(before).toBeTruthy();
});

test("copy confirms without reading the password aloud", async ({ page }) => {
  // The site's own Permissions-Policy forbids reading the clipboard, so record what gets written.
  await page.addInitScript(() => {
    const written: string[] = [];
    (window as unknown as { __clip: string[] }).__clip = written;
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text: string) => void written.push(text) } });
  });
  await page.goto("/");
  const value = await secret(page);
  await page.getByRole("button", { name: "Copy" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __clip: string[] }).__clip)).toEqual([value]);
  await expect(page.locator("[data-announcer]")).toHaveText("Copied to the clipboard");
  await expect(page.locator("[data-announcer]")).not.toContainText(value);
});
