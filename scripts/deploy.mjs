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
import { TOKEN_VERIFY_URL, WRANGLER_HOME, accountProblem, deployToken, withoutCredentials, wranglerEnv, wranglerFlags } from "./lib/account.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const wranglerBin = path.join(path.dirname(require.resolve("wrangler/package.json")), "bin", "wrangler.js");
const viteBin = path.join(path.dirname(require.resolve("vite/package.json")), "bin", "vite.js");
const env = wranglerEnv(process.env, os.homedir(), existsSync(path.join(os.homedir(), WRANGLER_HOME)));
const wranglerCli = (...args) => [wranglerBin, ...args, ...wranglerFlags(os.devNull)];

/** True when wrangler will reach the personal account and nothing else (scripts/lib/account.mjs). */
async function requireAccount() {
  const problem = await accountProblem({
    env: process.env,
    verify: async (token) => {
      const res = await fetch(TOKEN_VERIFY_URL, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    whoami: () => {
      const who = spawnSync(process.execPath, wranglerCli("whoami"), { cwd: rootDir, env, encoding: "utf8" });
      return { error: who.error?.message, output: `${who.stdout}\n${who.stderr}` };
    },
  });
  if (problem) {
    process.stderr.write(`account check: ${problem}\n`);
    return false;
  }
  process.stdout.write(
    deployToken(process.env)
      ? "account check: the deploy token is an active Account API Token of the personal account\n"
      : "account check: wrangler is logged in as the personal account\n",
  );
  return true;
}

/**
 * A workstation deploy ships exactly main as committed: CI already refuses anything but main's
 * tip, and deploying a feature branch or uncommitted edits would put unreviewed code live.
 */
function gitProblem() {
  if (process.env.GITHUB_ACTIONS === "true") return null;
  const git = (...args) => spawnSync("git", args, { cwd: rootDir, encoding: "utf8" });
  const branch = git("branch", "--show-current").stdout.trim();
  if (branch !== "main") return `deploys run from main; this checkout is on ${branch || "a detached HEAD"}`;
  if (git("status", "--porcelain").stdout.trim()) return "the working tree has uncommitted changes; commit or stash them first";
  return null;
}

// Only the two wrangler steps see the Cloudflare credential; the build and its dependencies never do.
const buildEnv = withoutCredentials(env);
const steps = [
  ["build", [viteBin, "build"], buildEnv],
  ["deploy site", wranglerCli("deploy"), env],
  ["deploy www redirect", wranglerCli("deploy", "--config", path.join("workers", "www-redirect", "wrangler.jsonc")), env],
  // Pinned, so a SMOKE_ORIGIN left in the shell can never point the post-deploy check elsewhere.
  ["smoke", [path.join(rootDir, "scripts", "smoke.mjs")], { ...buildEnv, SMOKE_ORIGIN: "https://securepass.dev" }],
];

const checkoutProblem = gitProblem();
process.stdout.write("\n==> account check\n");
if (checkoutProblem) {
  process.stderr.write(`deploy: ${checkoutProblem}; nothing ran.\n`);
  process.exitCode = 1;
} else if (!(await requireAccount())) {
  process.stderr.write("deploy: the account check failed; nothing after it ran.\n");
  process.exitCode = 1;
} else {
  for (const [name, args, stepEnv] of steps) {
    process.stdout.write(`\n==> ${name}\n`);
    const result = spawnSync(process.execPath, args, { cwd: rootDir, env: stepEnv, stdio: "inherit" });
    if (result.error || result.status !== 0) {
      process.stderr.write(`deploy: ${name} failed${result.error ? `: ${result.error.message}` : ` (exit ${result.status ?? "signal"})`}; nothing after it ran.\n`);
      process.exitCode = result.status || 1;
      break;
    }
  }
  if (!process.exitCode) process.stdout.write("\ndeploy: built, both Workers uploaded, smoke passed.\n");
}
