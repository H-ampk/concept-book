import { expect, test, type Page } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pdfPath = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "psych-lecture-4.pdf");
const consoleErrors: string[] = [];

const openViewer = async (page: Page) => {
  await page.getByRole("button", { name: "文脈" }).click();
  await expect(page.getByRole("heading", { name: "文脈カードの分野を選択" })).toBeVisible();
  await page.getByRole("button", { name: /すべて/ }).filter({ hasText: "文脈カード" }).click();
  await page.getByRole("button", { name: "新規作成" }).click();
  const modal = page.locator(".fixed.inset-0").filter({ hasText: "文脈カードを作成" });
  await modal.locator("input").nth(0).fill("自動検出カード");
  await modal.locator("input").nth(1).fill("心理学概論");
  await modal.locator("textarea").last().fill("強化, シェイピング, オペラント条件づけ, 条件づけ");
  await modal.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByRole("heading", { name: "文脈カード詳細" })).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="file"][accept*="pdf"]').setInputFiles(pdfPath);
  await expect(page.getByText("psych-lecture-4.pdf")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "教材を開く" }).click();
  const viewer = page.getByRole("dialog", { name: "psych-lecture-4" });
  await expect(viewer).toBeVisible();
  await expect(viewer.locator("canvas")).toBeVisible({ timeout: 20_000 });
  await expect(viewer.getByRole("button", { name: /登録済みConcept/ }).first()).toBeVisible({ timeout: 20_000 });
  return viewer;
};

test.describe("PDF registered concept auto-detect", () => {
  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    page.on("pageerror", (err) => consoleErrors.push(`pageerror:${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(`console:${msg.text()}`);
      }
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
  });

  test("highlights registered concepts without persisting matches", async ({ page }) => {
    test.setTimeout(120_000);
    const viewer = await openViewer(page);

    const autoKyo = viewer.getByRole("button", { name: '登録済みConcept「強化」を表示' });
    const autoOp = viewer.getByRole("button", { name: '登録済みConcept「オペラント条件づけ」を表示' });
    const autoCond = viewer.getByRole("button", { name: '登録済みConcept「条件づけ」を表示' });
    expect(await autoKyo.count()).toBeGreaterThanOrEqual(2);
    expect(await autoOp.count()).toBeGreaterThanOrEqual(1);
    expect(await autoCond.count()).toBe(0);

    await autoKyo.first().click({ force: true });
    await expect(viewer.getByText("自分の定義")).toBeVisible();
    await page.screenshot({ path: "e2e/artifacts/auto-concept-preview.png", fullPage: true });

    await viewer.getByRole("button", { name: '登録済みConcept「シェイピング」を表示' }).first().click({ force: true });
    await expect(viewer.getByRole("heading", { name: "psych-lecture-4" })).toBeVisible();
    await expect(viewer.getByText("シェイピング").first()).toBeVisible();

    await viewer.getByRole("button", { name: "Conceptを開く" }).click();
    await expect(page.getByRole("dialog", { name: "psych-lecture-4" })).toHaveCount(0);
    await expect(page.getByTestId("concept-detail-pane").getByRole("heading", { name: "シェイピング" })).toBeVisible({
      timeout: 15_000
    });

    await page.getByRole("button", { name: "文脈" }).click();
    await page.getByRole("button", { name: /すべて/ }).filter({ hasText: "文脈カード" }).click();
    await page.getByRole("button", { name: "自動検出カード" }).click();
    await page.getByRole("button", { name: "教材を開く" }).click();
    const viewer2 = page.getByRole("dialog", { name: "psych-lecture-4" });
    await expect(viewer2.getByRole("button", { name: /登録済みConcept「強化」を表示/ }).first()).toBeVisible({ timeout: 20_000 });

    await viewer2.getByRole("checkbox", { name: "登録済みConceptを表示" }).uncheck();
    await expect(viewer2.getByRole("button", { name: /登録済みConcept/ })).toHaveCount(0);

    await viewer2.getByRole("checkbox", { name: "登録済みConceptを表示" }).check();
    await expect(viewer2.getByRole("button", { name: /登録済みConcept「強化」を表示/ }).first()).toBeVisible();

    await viewer2.getByRole("button", { name: "拡大" }).click();
    await expect(viewer2.getByRole("button", { name: /登録済みConcept「強化」を表示/ }).first()).toBeVisible();
    await viewer2.getByRole("button", { name: "次のページ" }).click();
    await expect(viewer2.getByText(/2 \//)).toBeVisible();
    await expect(viewer2.getByRole("button", { name: /登録済みConcept「強化」を表示/ }).first()).toBeVisible({ timeout: 15_000 });
    await viewer2.getByRole("button", { name: "前のページ" }).click();

    const before = await page.evaluate(async () => {
      const open = () =>
        new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open("concept-book-db");
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      const db = await open();
      const count = await new Promise<number>((resolve, reject) => {
        const tx = db.transaction("conceptSourceAnchors", "readonly");
        const req = tx.objectStore("conceptSourceAnchors").count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return count;
    });
    expect(before).toBe(0);

    await page.reload();
    await page.getByRole("button", { name: "文脈" }).click();
    await page.getByRole("button", { name: /すべて/ }).filter({ hasText: "文脈カード" }).click();
    await page.getByRole("button", { name: "自動検出カード" }).click();
    await page.getByRole("button", { name: "教材を開く" }).click();
    await expect(page.getByRole("button", { name: /登録済みConcept「強化」を表示/ }).first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: "e2e/artifacts/auto-concept-highlights.png", fullPage: true });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /登録済みConcept「強化」を表示/ }).first().click({ force: true });
    await expect(page.getByText("自分の定義")).toBeVisible();
    await page.screenshot({ path: "e2e/artifacts/auto-concept-mobile.png", fullPage: true });

    const serious = consoleErrors.filter(
      (e) =>
        !e.includes("Download the React DevTools") &&
        !e.includes("favicon") &&
        !/ResizeObserver loop/.test(e)
    );
    expect(serious).toEqual([]);
  });
});
