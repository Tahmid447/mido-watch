import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: process.env.PLAYWRIGHT_BASE_URL?.startsWith("https://")
    ? 180000
    : 60000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    storageState: process.env.PLAYWRIGHT_STORAGE_STATE || undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL?.startsWith("https://")
    ? undefined
    : {
        command: process.env.MIDO_ISOLATED_E2E
          ? "node tests/helpers/isolated-server.mjs"
          : "npm run dev",
        url: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
        reuseExistingServer: !process.env.CI && !process.env.MIDO_ISOLATED_E2E,
      },
});
