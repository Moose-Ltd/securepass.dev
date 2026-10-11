#!/usr/bin/env node
// Release procedure as one command (KTD15): prove the account, build, upload the site and the www
// redirect Worker, then run the smoke check against production. Each step is printed before it runs
// and the first failure stops the rest. CI runs it with SECUREPASS_DEPLOY_TOKEN; a workstation runs it
// on the personal wrangler login. Mirrors donono.app's scripts/deploy.mjs.
//
//   npm run deploy

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEPLOY_TOKEN, TOKEN_VERIFY_URL, WRANGLER_HOME, deployToken, loginProblem, tokenProblem, wranglerEnv, wranglerFlags } from "./lib/account.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wranglerBin = path.join(path.dirname(createRequire(import.meta.url).resolve("wrangler/package.json")), "bin", "wrangler.js");
const viteBin = path.join(path.dirname(createRequire(import.meta.url).resolve("vite/package.json")), "bin", "vite.js");
const env = wranglerEnv(process.env, os.homedir(), existsSync(path.join(os.homedir(), WRANGLER_HOME)));
const wranglerCli = (...args) => [wranglerBin, ...args, ...wranglerFlags(os.devNull)];

/** The reason the deploy token can't be used, or null once Cloudflare verified it. Fails closed. */
async function checkDeployToken(token) {
  try {
    const res = await fetch(TOKEN_VERIFY_URL, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
    const body = await res.json().catch(() => null);
    return tokenProblem(res.status, body);
  } catch (err) {
    return `could not reach Cloudflare to verify ${DEPLOY_TOKEN}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/** True when wrangler will reach the personal account and nothing else. */
async function requireAccount() {
  const token = deployToken(process.env);
  let problem;
  if (token) problem = await checkDeployToken(token);
  else if (process.env.GITHUB_ACTIONS === "true") problem = `${DEPLOY_TOKEN} is empty: add it to the production environment's secrets`;
  else {
    const who = spawnSync(process.execPath, wranglerCli("whoami"), { cwd: rootDir, env, encoding: "utf8" });
    problem = who.error ? `wrangler whoami could not start: ${who.error.message}` : loginProblem(`${who.stdout}\n${who.stderr}`);
  }
  if (problem) {
    process.stderr.write(`account check: ${problem}\n`);
    return false;
  }
  process.stdout.write(token ? "account check: the deploy token is an active Account API Token of the personal account\n" : "account check: wrangler is logged in as the personal account\n");
  return true;
}

const steps = [
  ["build", [viteBin, "build"]],
  ["deploy site", wranglerCli("deploy")],
  ["deploy www redirect", wranglerCli("deploy", "--config", path.join("workers", "www-redirect", "wrangler.jsonc"))],
  ["smoke", [path.join(rootDir, "scripts", "smoke.mjs")]],
];

process.stdout.write("\n==> account check\n");
if (!(await requireAccount())) {
  process.stderr.write("deploy: the account check failed; nothing after it ran.\n");
  process.exitCode = 1;
} else {
  for (const [name, args] of steps) {
    process.stdout.write(`\n==> ${name}\n`);
    const result = spawnSync(process.execPath, args, { cwd: rootDir, env, stdio: "inherit" });
    if (result.error || result.status !== 0) {
      process.stderr.write(`deploy: ${name} failed${result.error ? `: ${result.error.message}` : ` (exit ${result.status ?? "signal"})`}; nothing after it ran.\n`);
      process.exitCode = result.status || 1;
      break;
    }
  }
  if (!process.exitCode) process.stdout.write("\ndeploy: built, both Workers uploaded, smoke passed.\n");
}
