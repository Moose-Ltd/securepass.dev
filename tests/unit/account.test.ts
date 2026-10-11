import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_ID,
  DEPLOY_TOKEN,
  accountProblem,
  deployToken,
  loginProblem,
  sha256,
  tokenProblem,
  withoutCredentials,
  wranglerEnv,
  // @ts-expect-error -- plain ESM script without type declarations
} from "../../scripts/lib/account.mjs";

// A stand-in login: the real owner's address never appears in this public repository, so the
// tests check the guard against the hash of this synthetic one.
const OWNER = "owner@example.com";
const OWNER_HASH = sha256(OWNER);

const whoami = (email: string, accounts = ACCOUNT_ID) =>
  `\u001b[1mwrangler 4.149.0\u001b[0m\nGetting User settings...\nYou are logged in with an OAuth Token, associated with the email ${email}.\n| Account Name | Account ID |\n| Personal | ${accounts} |`;

describe("deploy account guard", () => {
  it("accepts only the owner's login on the personal account, ignoring email case", () => {
    expect(loginProblem(whoami("Owner@Example.com"), OWNER_HASH)).toBeNull();
  });

  it("refuses another account's login", () => {
    expect(loginProblem(whoami("someone@work.example", "f00f00f00f00f00f00f00f00f00f00f0"), OWNER_HASH)).toMatch(/not the personal account/);
  });

  it("refuses the owner's login when it can't see the personal account", () => {
    expect(loginProblem(whoami(OWNER, "f00f00f00f00f00f00f00f00f00f00f0"), OWNER_HASH)).toMatch(/cannot see account/);
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

  it("keeps every Cloudflare credential away from the build and smoke steps", () => {
    const clean = withoutCredentials({ CLOUDFLARE_API_TOKEN: "t", [DEPLOY_TOKEN]: "t", CF_API_KEY: "k", PATH: "/bin" });
    expect(clean).toEqual({ PATH: "/bin" });
  });

  it("pins the dedicated config home only when it exists", () => {
    expect(wranglerEnv({}, "/home/u", false).XDG_CONFIG_HOME).toBeUndefined();
    expect(wranglerEnv({}, "/home/u", true).XDG_CONFIG_HOME).toBe("/home/u/.config/wrangler-personal");
  });
});

describe("accountProblem (the deploy's decision)", () => {
  const active = async () => ({ status: 200, body: { success: true, result: { status: "active" } } });

  it("refuses in CI when the deploy token is empty, without asking wrangler", async () => {
    const whoamiFn = vi.fn();
    const problem = await accountProblem({ env: { GITHUB_ACTIONS: "true", [DEPLOY_TOKEN]: "" }, verify: active, whoami: whoamiFn });
    expect(problem).toMatch(/is empty/);
    expect(whoamiFn).not.toHaveBeenCalled();
  });

  it("uses a present token alone: verified means go, and wrangler's login is never consulted", async () => {
    const whoamiFn = vi.fn();
    const verify = vi.fn(active);
    expect(await accountProblem({ env: { [DEPLOY_TOKEN]: "tok" }, verify, whoami: whoamiFn })).toBeNull();
    expect(verify).toHaveBeenCalledWith("tok");
    expect(whoamiFn).not.toHaveBeenCalled();
  });

  it("fails closed when Cloudflare can't be reached to verify the token", async () => {
    const verify = vi.fn(async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    });
    expect(await accountProblem({ env: { [DEPLOY_TOKEN]: "tok" }, verify, whoami: vi.fn() })).toMatch(/could not reach Cloudflare/);
  });

  it("refuses an inactive token", async () => {
    const verify = async () => ({ status: 200, body: { success: true, result: { status: "expired" } } });
    expect(await accountProblem({ env: { [DEPLOY_TOKEN]: "tok" }, verify, whoami: vi.fn() })).toMatch(/expired, not active/);
  });

  it("falls back to the workstation login outside CI, and reports a wrangler that won't start", async () => {
    expect(await accountProblem({ env: {}, verify: active, whoami: () => ({ error: "ENOENT", output: "" }) })).toMatch(/could not start/);
    expect(await accountProblem({ env: {}, verify: active, whoami: () => ({ output: "You are not authenticated." }) })).toMatch(/not logged in/);
  });
});

describe("repository hygiene", () => {
  it("keeps personal email addresses out of every source, test, script and doc", () => {
    const roots = ["src", "scripts", "tests", "workers", "docs", "build", ".github"];
    const files = ["README.md", "SECURITY.md", "THIRD_PARTY_NOTICES.md", "package.json", "wrangler.jsonc"];
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
      });
    const text = /\.(ts|mjs|js|md|json|jsonc|yml|html|css|txt)$/;
    const personal = /@(gmail|outlook|hotmail|yahoo|icloud)\.com/i;
    for (const file of [...roots.flatMap(walk), ...files].filter((f) => text.test(f))) {
      expect(personal.test(readFileSync(file, "utf8")), file).toBe(false);
    }
  });
});
