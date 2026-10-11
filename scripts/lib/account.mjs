// SecurePass lives on the owner's personal Cloudflare account and nowhere else (R31). Every wrangler
// call that reaches Cloudflare goes through scripts/deploy.mjs, which proves the account first:
// either SECUREPASS_DEPLOY_TOKEN verifies as an Account API Token of this account (CI), or
// `wrangler whoami` shows the personal OAuth login and this account (a workstation). The login's
// email is checked by its SHA-256, so the address itself never enters this public repository.
// Pure: callers supply the environment, run wrangler and fetch, so tests can drive it.
//
// Ported from donono.app's scripts/lib/account.mjs.

import { createHash } from "node:crypto";

export const ACCOUNT_ID = "1e3dfc08a40b3d1df09d3760e320df40";
/** SHA-256 of the personal login's email address, lower-cased. */
export const ACCOUNT_EMAIL_SHA256 = "e9b88983257d0069a3fadd9a651d08f628a9777f4f499d6df4052304dff00dba";
/** Relative to the home directory: a dedicated config home for the personal login, used when present. */
export const WRANGLER_HOME = ".config/wrangler-personal";
/** The CI deploy credential, under a name wrangler never reads on its own. */
export const DEPLOY_TOKEN = "SECUREPASS_DEPLOY_TOKEN";
/** Answers only for an Account API Token owned by this account. */
export const TOKEN_VERIFY_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/tokens/verify`;

// Credentials wrangler would prefer over the OAuth login; any of them could name another account.
const OVERRIDES = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_KEY", "CLOUDFLARE_EMAIL", "CF_API_TOKEN", "CF_API_KEY", "CF_EMAIL", "CF_ACCOUNT_ID"];

export const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/** The deploy token from an environment, or null when absent or blank (an unset GitHub secret is ""). */
export function deployToken(base) {
  const token = String(base?.[DEPLOY_TOKEN] ?? "").trim();
  return token || null;
}

/**
 * The environment for a wrangler child process: this account pinned and every token or key variable
 * removed. The dedicated config home is used only when it exists; otherwise the workstation's default
 * login is used, and loginProblem still refuses anything but the personal account. With a deploy
 * token, that token alone is handed to wrangler, after the caller has verified it.
 */
export function wranglerEnv(base, home, personalHomeExists) {
  const env = { ...base, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID };
  if (personalHomeExists) env.XDG_CONFIG_HOME = `${home}/${WRANGLER_HOME}`;
  for (const key of [...OVERRIDES, DEPLOY_TOKEN]) delete env[key];
  const token = deployToken(base);
  if (token) env.CLOUDFLARE_API_TOKEN = token;
  return env;
}

/** Flags after every wrangler command: an empty env file, so a stray .env token can't override the login. */
export function wranglerFlags(devNull) {
  return [`--env-file=${devNull}`];
}

/**
 * Reads `wrangler whoami` output and returns null when it is the personal OAuth login on this
 * account, or the reason it is not. An API-token login is refused: it names no email.
 */
export function loginProblem(whoami, expectedEmailSha256 = ACCOUNT_EMAIL_SHA256) {
  const text = String(whoami ?? "").replace(/\x1b\[[0-9;]*m/g, "");
  if (/not authenticated|not logged in/i.test(text)) return "wrangler is not logged in; run `npx wrangler login` with the personal Cloudflare account";
  const email = /associated with the email (\S+?)\.?\s*$/im.exec(text)?.[1];
  if (!email) return "wrangler is not using an OAuth login; workstation deploys need the personal OAuth login";
  if (sha256(email.toLowerCase()) !== expectedEmailSha256) return `wrangler is logged in as ${email}, which is not the personal account; refusing to touch Cloudflare`;
  if (!text.includes(ACCOUNT_ID)) return `the personal login cannot see account ${ACCOUNT_ID}`;
  return null;
}

/** The environment for build and smoke steps: no Cloudflare credential at all. */
export function withoutCredentials(env) {
  const clean = { ...env };
  for (const key of [...OVERRIDES, DEPLOY_TOKEN, "CLOUDFLARE_API_TOKEN"]) delete clean[key];
  return clean;
}

/**
 * The reason the deploy may not touch Cloudflare, or null when it may: a deploy token that
 * Cloudflare verifies as an active Account API Token of this account, or else (never in CI) the
 * personal OAuth login. Fails closed. `verify` fetches TOKEN_VERIFY_URL with the token and
 * resolves to { status, body }; `whoami` runs `wrangler whoami` and returns its output.
 */
export async function accountProblem({ env, verify, whoami }) {
  const token = deployToken(env);
  if (token) {
    try {
      const { status, body } = await verify(token);
      return tokenProblem(status, body);
    } catch (err) {
      return `could not reach Cloudflare to verify ${DEPLOY_TOKEN}: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  if (env.GITHUB_ACTIONS === "true") return `${DEPLOY_TOKEN} is empty: add it to the production environment's secrets`;
  const who = whoami();
  return who.error ? `wrangler whoami could not start: ${who.error}` : loginProblem(who.output);
}

/**
 * Reads the answer to GET TOKEN_VERIFY_URL and returns null when the deploy token is an active
 * Account API Token of this account, or the reason it is not. Never repeats the token.
 */
export function tokenProblem(status, body) {
  const result = body?.result;
  if (status === 200 && body?.success === true && result?.status === "active") return null;
  if (body?.success === true && result?.status) return `the ${DEPLOY_TOKEN} token is ${result.status}, not active`;
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  const said = errors.map((e) => `${e?.code ?? "?"} ${String(e?.message ?? "").slice(0, 120)}`.trim()).join("; ");
  if (status === 401 || status === 403 || errors.some((e) => e?.code === 1000)) {
    return `Cloudflare did not verify ${DEPLOY_TOKEN} as an Account API Token of account ${ACCOUNT_ID} (HTTP ${status}${said ? `: ${said}` : ""})`;
  }
  return `Cloudflare's token check answered HTTP ${status}${said ? `: ${said}` : ""}; refusing to deploy without a verified token`;
}
