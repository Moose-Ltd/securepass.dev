import { defineConfig, devices } from "@playwright/test";

// Browser tests run against the built site served by `wrangler dev`, which applies dist/_headers,
// so the real CSP, Trusted Types and cross-origin isolation are in force (KTD16). Build first:
// `npm run build && npm run test:e2e`.
const PORT = 8788;
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  ...(CI ? { workers: 2 } : {}),
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  reporter: CI ? [["github"], ["list"]] : "list",
  // The live breach test talks to the real Have I Been Pwned API; it runs only when asked.
  ...(process.env.LIVE ? {} : { grepInvert: /@live/ }),
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx wrangler dev --port ${PORT} --ip 127.0.0.1 --local --show-interactive-dev-session=false`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !CI,
    timeout: 120_000,
    env: { WRANGLER_SEND_METRICS: "false" },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ...(CI
      ? []
      : [
          { name: "firefox", use: { ...devices["Desktop Firefox"] }, grep: /@smoke/ },
          { name: "webkit", use: { ...devices["Desktop Safari"] }, grep: /@smoke/ },
        ]),
  ],
});
