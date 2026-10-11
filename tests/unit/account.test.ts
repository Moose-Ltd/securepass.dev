import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain ESM script without type declarations
import { ACCOUNT_ID, DEPLOY_TOKEN, deployToken, loginProblem, tokenProblem, wranglerEnv } from "../../scripts/lib/account.mjs";

const whoami = (email: string, accounts = ACCOUNT_ID) =>
  `\u001b[1mwrangler 4.149.0\u001b[0m\nGetting User settings...\nYou are logged in with an OAuth Token, associated with the email ${email}.\n| Account Name | Account ID |\n| Personal | ${accounts} |`;

describe("deploy account guard", () => {

  it("refuses a work-account login", () => {
    expect(loginProblem(whoami("someone@work.example", "f00f00f00f00f00f00f00f00f00f00f0"))).toMatch(/not the personal account/);
  });

  it("refuses an API-token login, which names no email", () => {
    expect(loginProblem(`You are logged in with an API Token.\n${ACCOUNT_ID}`)).toMatch(/not using an OAuth login/);
    expect(loginProblem("You are not authenticated. Please run `wrangler login`.")).toMatch(/not logged in/);
  });

  it("accepts only an active, verified Account API Token", () => {
    expect(tokenProblem(200, { success: true, result: { status: "active" } })).toBeNull();
    expect(tokenProblem(200, { success: true, result: { status: "disabled" } })).toMatch(/not active/);
    expect(tokenProblem(401, { success: false, errors: [{ code: 1000, message: "Invalid API Token" }] })).toMatch(/did not verify/);
    expect(tokenProblem(500, null)).toMatch(/refusing to deploy/);
  });

  it("never lets a stray credential override the chosen one", () => {
    const env = wranglerEnv({ CLOUDFLARE_API_TOKEN: "stray", CF_API_KEY: "stray", [DEPLOY_TOKEN]: " verified " }, "/home/u", false);
    expect(env.CLOUDFLARE_API_TOKEN).toBe("verified");
    expect(env.CF_API_KEY).toBeUndefined();
    expect(env[DEPLOY_TOKEN]).toBeUndefined();
    expect(env.CLOUDFLARE_ACCOUNT_ID).toBe(ACCOUNT_ID);
    expect(deployToken({ [DEPLOY_TOKEN]: "" })).toBeNull();
  });

  it("pins the dedicated config home only when it exists", () => {
    expect(wranglerEnv({}, "/home/u", false).XDG_CONFIG_HOME).toBeUndefined();
    expect(wranglerEnv({}, "/home/u", true).XDG_CONFIG_HOME).toBe("/home/u/.config/wrangler-personal");
  });

  it("keeps the email address out of the source", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of ["scripts/lib/account.mjs", "scripts/deploy.mjs"]) {
      expect(readFileSync(file, "utf8")).not.toMatch(/@gmail\.com/);
    }
  });
});
