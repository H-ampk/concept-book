import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // 未指定時の worker 数は論理 CPU の半数。この開発機は 12 論理 CPU なので 6 になる。
  // 6 worker では PDF auto-detect の fullPage スクリーンショットが、フォント読み込み完了後も
  // 120s のテスト制限を超えた。2 worker と 4 worker では同じ PDF 検証は通過した。
  // GitHub Actions の ubuntu-latest は 4 vCPU で、未指定時も 2 worker になる。
  // ローカル既定の 6 を避け、CI と同じ 2 に固定する。
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5174",
    url: "http://127.0.0.1:5174/?e2eGraphLayout=1",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
