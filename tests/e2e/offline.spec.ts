import { expect, secret, test } from "./fixtures.ts";

test("AE7: after one visit, every page and the checker work with no connection @smoke", async ({ page, context, browserName }) => {
  test.skip(browserName === "webkit", "WebKit in Playwright does not expose service workers");
  await page.goto("/");
  await expect(page.locator(".footer__status")).toHaveAttribute("data-ready", "", { timeout: 20_000 });
  await page.reload(); // now controlled by the service worker

  await context.setOffline(true);
  await page.reload();
  expect((await secret(page)).length).toBe(20);

  await page.goto("/password-strength-checker");
  await page.getByLabel("Password to check").fill("correct horse battery staple");
  await expect(page.locator('[data-strength="check"]')).toHaveAttribute("data-rating", /.+/);

  await page.goto("/passphrase-generator");
  expect((await secret(page)).split("-").length).toBeGreaterThanOrEqual(6);

  for (const [path, heading] of [["/how-it-works", "How SecurePass works"], ["/faq", "Questions"]]) {
    await page.goto(path!);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading!);
  }
  await context.setOffline(false);
});
