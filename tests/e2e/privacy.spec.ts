import { expect, secret, test } from "./fixtures.ts";

test.describe("privacy", () => {
  test("AE5: generating, switching modes and typing never contacts another site @smoke", async ({ page, watch }) => {
    await page.goto("/");
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      await page.getByRole("button", { name: "New" }).click();
      seen.add(await secret(page));
    }
    // 50 random 20-character passwords are all different.
    expect(seen.size).toBe(50);

    for (const tab of ["Passphrase", "PIN", "Password", "Strength"]) {
      await page.getByRole("navigation", { name: "Tools" }).getByRole("link", { name: tab, exact: true }).click();
    }
    await page.getByLabel("Password to check").fill("correct horse battery staple");
    await expect(page.locator('[data-strength="check"]')).toHaveAttribute("data-rating", /.+/);

    expect(watch.external.map((r) => r.url())).toEqual([]);
    await expect(page.locator("[data-net-summary]")).toHaveText("Nothing sent");
  });

  test("the generated secret never lands in the URL, history state or storage", async ({ page, watch }) => {
    await page.goto("/");
    const value = await secret(page);
    await page.getByRole("link", { name: "PIN", exact: true }).click();
    const leaks = await page.evaluate((needle) => {
      const store = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
      return [location.href, JSON.stringify(history.state), store].filter((s) => s.includes(needle));
    }, value);
    expect(leaks).toEqual([]);
    expect(watch.external).toEqual([]);
  });

  test("sets no cookies", async ({ page, context, watch }) => {
    await page.goto("/password-strength-checker");
    await page.getByLabel("Password to check").fill("hunter2");
    expect(await context.cookies()).toEqual([]);
    expect(watch.external).toEqual([]);
  });
});
