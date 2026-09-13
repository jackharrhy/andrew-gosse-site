import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test",
  testMatch: "**/*.spec.ts",
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:4332",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "NODE_ENV=test node --import remix/node-tsx test/server.ts",
    url: "http://127.0.0.1:4332/healthz",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
