import { expect, test, type Page } from "@playwright/test";

const OVERFLOW_SLACK_PX = 8;

const boxesOverlap = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

const gotoListWorkspace = async (page: Page) => {
  await page.goto("/?e2eListWorkspace=1");
  await expect(page.getByTestId("concept-list-page-layout")).toBeVisible();
  await expect(page.getByTestId("concept-list-workspace")).toBeVisible();
};

const assertNoHorizontalPageScroll = async (page: Page) => {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + OVERFLOW_SLACK_PX);
};

const assertCenterHitIsSelf = async (page: Page, testId: string) => {
  const locator = page.getByTestId(testId);
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  if (!box) {
    return;
  }
  const hitInside = await page.evaluate(
    ({ x, y, id }) => {
      const el = document.elementFromPoint(x, y);
      return Boolean(el?.closest(`[data-testid="${id}"]`));
    },
    { x: box.x + box.width / 2, y: box.y + Math.min(24, box.height / 2), id: testId }
  );
  expect(hitInside).toBe(true);
};

test.describe("concept list workspace browser regressions (#52 / #138)", () => {
  test("1280pxで一覧と詳細が同時表示され横並びになる", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoListWorkspace(page);

    const list = page.getByTestId("concept-list-pane");
    const detail = page.getByTestId("concept-detail-pane");
    await expect(list).toBeVisible();
    await expect(detail).toBeVisible();
    await expect(page.getByTestId("concept-detail-content")).toContainText("Concept A");

    const listBox = await list.boundingBox();
    const detailBox = await detail.boundingBox();
    expect(listBox).toBeTruthy();
    expect(detailBox).toBeTruthy();
    if (!listBox || !detailBox) {
      return;
    }
    expect(listBox.x + listBox.width).toBeLessThanOrEqual(detailBox.x + 1);
    expect(Math.abs(listBox.y - detailBox.y)).toBeLessThan(80);
  });

  test("1280pxでワークスペース幅が中央固定幅へ戻っていない", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoListWorkspace(page);

    const pageLayout = page.getByTestId("concept-list-page-layout");
    const workspace = page.getByTestId("concept-list-workspace");
    const pageBox = await pageLayout.boundingBox();
    const workspaceBox = await workspace.boundingBox();
    expect(pageBox).toBeTruthy();
    expect(workspaceBox).toBeTruthy();
    if (!pageBox || !workspaceBox) {
      return;
    }
    expect(pageBox.width).toBeGreaterThanOrEqual(1280 * 0.8);
    expect(workspaceBox.width).toBeGreaterThanOrEqual(1280 * 0.8);
    await expect(pageLayout).toHaveClass(/w-full/);
    await expect(pageLayout).not.toHaveClass(/max-w-/);
    await expect(pageLayout).not.toHaveClass(/mx-auto/);
    await expect(workspace).not.toHaveClass(/max-w-/);
  });

  test("大画面で検索・一覧/グラフ/ツリー・Concept追加が操作できる", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoListWorkspace(page);

    const toolbar = page.getByTestId("concept-list-toolbar");
    await expect(toolbar.getByPlaceholder("タイトル・定義・解釈・分野タグ・研究テーマタグ・メモを検索")).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "一覧表示" })).toBeEnabled();
    await expect(toolbar.getByRole("button", { name: "グラフ表示" })).toBeEnabled();
    await expect(toolbar.getByRole("button", { name: "ツリー表示" })).toBeEnabled();
    await expect(toolbar.getByRole("button", { name: "概念を追加" })).toBeEnabled();
    await expect(toolbar.getByText("分野タグ:")).toBeVisible();
    await expect(toolbar.getByText("研究テーマタグ:")).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "稼働中" })).toBeEnabled();

    const search = toolbar.getByPlaceholder("タイトル・定義・解釈・分野タグ・研究テーマタグ・メモを検索");
    await search.fill("Concept B");
    await expect(page.getByTestId("concept-list-item-concept-b")).toBeVisible();
    await expect(page.getByTestId("concept-list-item-concept-a")).toHaveCount(0);
  });

  test("Concept選択で詳細が更新され一覧は操作し続けられる", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoListWorkspace(page);

    await expect(page.getByTestId("concept-detail-content")).toContainText("Concept A");
    await page.getByTestId("concept-list-item-concept-b").click();
    await expect(page.getByTestId("concept-detail-content")).toContainText("Concept B");
    await expect(page.getByTestId("concept-detail-content")).toContainText("定義 B");
    await page.getByTestId("concept-list-item-concept-a").click();
    await expect(page.getByTestId("concept-detail-content")).toContainText("Concept A");
    await expect(page.getByTestId("concept-list-pane")).toBeVisible();
  });

  test("390pxで横スクロールせず主要UIへアクセスできる", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoListWorkspace(page);

    await assertNoHorizontalPageScroll(page);

    const toolbar = page.getByTestId("concept-list-toolbar");
    const search = toolbar.getByPlaceholder("タイトル・定義・解釈・分野タグ・研究テーマタグ・メモを検索");
    await expect(search).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "一覧表示" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "グラフ表示" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "ツリー表示" })).toBeVisible();
    await expect(page.getByTestId("concept-list-pane")).toBeVisible();

    await search.click();
    await search.fill("Concept");
    await page.getByTestId("concept-list-item-concept-a").click();
    await expect(page.getByTestId("concept-detail-content")).toBeVisible();
    await expect(page.getByRole("button", { name: "一覧に戻る" })).toBeVisible();
    await page.getByRole("button", { name: "一覧に戻る" }).click();
    await expect(page.getByTestId("concept-list-pane")).toBeVisible();
    await assertNoHorizontalPageScroll(page);
  });

  test("390pxで主要領域が互いに完全に覆われない", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoListWorkspace(page);

    const toolbarBox = await page.getByTestId("concept-list-toolbar").boundingBox();
    const listBox = await page.getByTestId("concept-list-pane").boundingBox();
    expect(toolbarBox).toBeTruthy();
    expect(listBox).toBeTruthy();
    if (toolbarBox && listBox) {
      expect(boxesOverlap(toolbarBox, listBox)).toBe(false);
    }

    await assertCenterHitIsSelf(page, "concept-list-toolbar");
    await assertCenterHitIsSelf(page, "concept-list-pane");

    await page.getByTestId("concept-list-item-concept-b").click();
    await expect(page.getByTestId("concept-detail-pane")).toBeVisible();
    await assertCenterHitIsSelf(page, "concept-detail-pane");
  });
});
