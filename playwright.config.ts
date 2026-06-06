import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Playwright starts (or reuses) a server for the duration of the
 * run and drives a headless Chromium against it.
 *
 * In CI we run against the PRODUCTION build (`pnpm start`) rather than `pnpm
 * dev`: Next's dev server compiles each route on first request, which on a
 * constrained CI runner regularly exceeds per-test timeouts. The CI workflow
 * runs `pnpm build` before the E2E step, so the production server is ready.
 * Locally we keep `pnpm dev` for fast iteration.
 */
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  // First-hit compilation (dev) and cold starts (CI) need headroom.
  timeout: isCI ? 90_000 : 30_000,
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: isCI ? "pnpm start" : "pnpm dev",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
