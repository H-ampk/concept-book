import { expect, test, type Page } from "@playwright/test";

const openCreateModal = async (page: Page) => {
  await page.getByRole("button", { name: "文脈" }).click();
  await expect(page.getByRole("heading", { name: "文脈カードの分野を選択" })).toBeVisible();
  await page.getByRole("button", { name: /すべて/ }).filter({ hasText: "文脈カード" }).click();
  await page.getByRole("button", { name: "新規作成" }).click();
  await expect(page.getByRole("heading", { name: "文脈カードを作成" })).toBeVisible();
};

test.describe("context card index extract", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
  });

  test("抽出した用語だけを保存し、再編集時に索引テキストは残らない", async ({ page }) => {
    await openCreateModal(page);
    const modal = page.locator(".fixed.inset-0").filter({ hasText: "文脈カードを作成" });
    await modal.locator("input").nth(0).fill("索引抽出カード");
    await modal.getByRole("textbox", { name: "索引テキスト" }).fill(
      ["インターネット 12, 38, 52", "ISP 40-42", "データ通信 66-70"].join("\n")
    );
    await modal.getByRole("textbox", { name: "開始ページ" }).fill("36");
    await modal.getByRole("textbox", { name: "終了ページ" }).fill("65");
    await modal.getByRole("button", { name: "指定範囲から用語を抽出" }).click();
    await expect(modal.getByRole("textbox", { name: "重要概念" })).toHaveValue("");
    await modal.getByRole("checkbox", { name: /ISP/ }).click();
    await modal.getByRole("button", { name: "選択した用語を重要概念に追加" }).click();
    await expect(modal.getByRole("textbox", { name: "重要概念" })).toHaveValue("インターネット");
    await modal.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByRole("heading", { name: "文脈カード詳細" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("重要概念")).toBeVisible();
    await expect(page.getByText("インターネット")).toBeVisible();
    await expect(page.getByText("ISP")).toHaveCount(0);

    await page.locator("section").filter({ hasText: "文脈カード詳細" }).getByRole("button", { name: "編集" }).click();
    await expect(page.getByRole("heading", { name: "文脈カードを編集" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "重要概念" })).toHaveValue("インターネット");
    await expect(page.getByRole("textbox", { name: "索引テキスト" })).toHaveValue("");
  });
});
