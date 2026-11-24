import { defineConfig, devices } from "@playwright/test";

/**
 * 通常の `npm run test:e2e` とは別設定。
 * 本番ビルドの preview に対して、専用ブラウザコンテキストで合成データを測る。
 */
export default defineConfig({
  testDir: "./perf",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30 * 60 * 1000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://127.0.0.1:4179",
    actionTimeout: 20_000,
    navigationTimeout: 180_000,
    trace: "off",
    screenshot: "off",
    video: "off"
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4179 --strictPort",
    url: "http://127.0.0.1:4179",
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
