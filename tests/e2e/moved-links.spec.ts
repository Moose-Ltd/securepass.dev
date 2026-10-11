import { expect, test } from "./fixtures.ts";

// The explanations used to sit below the tool; links to their old anchors reach the new pages.
for (const [from, to] of [
  ["/#breach", "/how-it-works#breach"],
  ["/pin-generator#network", "/how-it-works#network"],
  ["/#faq", "/faq#faq"],
]) {
  test(`${from} leads to ${to}`, async ({ page }) => {
    await page.goto(from!);
    await expect(page).toHaveURL(new RegExp(`${to!.replace("#", "#?")}$`));
  });
}

test("the tool's own skip-link target is not redirected", async ({ page }) => {
  await page.goto("/#tool");
  await expect(page).toHaveURL(/\/#tool$/);
  await expect(page.locator("[data-vault]")).toBeVisible();
});
