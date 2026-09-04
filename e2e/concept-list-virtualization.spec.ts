import { expect, test, type Page } from "@playwright/test";
import {
  VIRTUAL_LIST_E2E_COUNT,
  VIRTUAL_LIST_E2E_IDS,
  VIRTUAL_LIST_QUERY_A,
  VIRTUAL_LIST_QUERY_B
} from "../src/dev/listWorkspaceVirtualE2eData";

const OVERFLOW_SLACK_PX = 8;
const ROW_TOLERANCE_PX = 2;

const searchInput = (page: Page) =>
  page.getByPlaceholder("タイトル・定義・解釈・分野タグ・研究テーマタグ・メモを検索");

const gotoVirtual = async (page: Page, extra = "") => {
  await page.goto(`/?e2eListWorkspace=1&virtual=1${extra}`);
};

const itemTestId = (id: string) => `concept-list-item-${id}`;

const listItems = (page: Page) => page.locator('[data-testid^="concept-list-item-"]');

const assertNoHorizontalPageScroll = async (page: Page) => {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + OVERFLOW_SLACK_PX);
};

type RowBox = {
  id: string;
  top: number;
  bottom: number;
  height: number;
  hasSnippet: boolean;
};

const readVisibleRows = async (page: Page): Promise<RowBox[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-testid^="concept-list-item-"]')].map((el) => {
      const box = el.getBoundingClientRect();
      return {
        id: el.getAttribute("data-testid") ?? "",
        top: box.top,
        bottom: box.bottom,
        height: box.height,
        hasSnippet: Boolean(el.querySelector(".concept-index-search-hit"))
      };
    })
  );

const waitForHealthyVisibleRows = async (page: Page) => {
  await expect
    .poll(async () => {
      const rows = await readVisibleRows(page);
      if (rows.length < 2) {
        return "too-few";
      }
      const ids = rows.map((row) => row.id);
      if (new Set(ids).size !== ids.length) {
        return "duplicate";
      }
      const byTop = [...rows].sort((a, b) => a.top - b.top);
      if (ids.join() !== byTop.map((row) => row.id).join()) {
        return "order";
      }
      for (let i = 0; i < rows.length - 1; i += 1) {
        if (rows[i].bottom > rows[i + 1].top + ROW_TOLERANCE_PX) {
          return "overlap";
        }
      }
      return "ok";
    })
    .toBe("ok");
};

const fillSearch = async (page: Page, value: string) => {
  await searchInput(page).fill(value);
  if (value) {
    await expect(page.locator(".concept-index-search-hit").first()).toBeVisible();
  } else {
    await expect(page.locator(".concept-index-search-hit")).toHaveCount(0);
  }
};

test.describe("concept list virtualization browser regressions (#145)", () => {
  test("A. desktopでは通常listでvirtual scroll containerがない", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoVirtual(page);
    await expect(page.locator("ul.concept-index-list")).toBeVisible();
    await expect(page.getByTestId("concept-list-virtual-scroll")).toHaveCount(0);
    expect(await listItems(page).count()).toBe(VIRTUAL_LIST_E2E_COUNT);
  });

  test("B. mobileではvirtual listで初期DOMは全件未満", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoVirtual(page);
    await expect(page.getByTestId("concept-list-virtual-scroll")).toBeVisible();
    const domCount = await listItems(page).count();
    expect(domCount).toBeGreaterThan(0);
    expect(domCount).toBeLessThan(VIRTUAL_LIST_E2E_COUNT);
  });

  test("C. 検索なしではsnippetなし", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoVirtual(page);
    await expect(page.locator(".concept-index-search-hit")).toHaveCount(0);
  });

  test("D. contextDefinition検索でsnippetとhighlightが出る", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoVirtual(page);
    await fillSearch(page, VIRTUAL_LIST_QUERY_A);
    const row = page.getByTestId(itemTestId(VIRTUAL_LIST_E2E_IDS.contextSnippet));
    await expect(row).toBeVisible();
    await expect(row.locator(".concept-index-search-hit-label")).toContainText("文脈別定義：教育");
    await expect(row.locator(".concept-index-search-hit-text")).toContainText("フィードバック");
    await expect(row.locator("mark.concept-search-mark")).toContainText("フィードバック");
  });

  test("E. 同じrowのheightがsnippet表示後に増える", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoVirtual(page);
    const row = page.getByTestId(itemTestId(VIRTUAL_LIST_E2E_IDS.contextSnippet));
    await expect(row).toBeVisible();
    const before = await row.boundingBox();
    expect(before).toBeTruthy();
    await fillSearch(page, VIRTUAL_LIST_QUERY_A);
    await expect(row.locator(".concept-index-search-hit")).toBeVisible();
    const after = await row.boundingBox();
    expect(after).toBeTruthy();
    expect(after!.height).toBeGreaterThan(before!.height);
  });

  test("F. 隣接rowが重ならない (snippet→なし / snippet→snippet)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoVirtual(page);
    await fillSearch(page, VIRTUAL_LIST_QUERY_A);
    await waitForHealthyVisibleRows(page);
    const rows = await readVisibleRows(page);
    const snippetToPlain = rows.some(
      (row, i) => row.hasSnippet && rows[i + 1] && !rows[i + 1].hasSnippet
    );
    const snippetToSnippet = rows.some(
      (row, i) => row.hasSnippet && rows[i + 1]?.hasSnippet
    );
    expect(snippetToPlain).toBe(true);
    expect(snippetToSnippet).toBe(true);
  });

  test("G. 可変row混在でもDOM順とtop順が一致し重複しない", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoVirtual(page);
    await fillSearch(page, VIRTUAL_LIST_QUERY_A);
    await waitForHealthyVisibleRows(page);
  });

  test("H. 検索変更後に再measureされ検索解除後も空白が残らない", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoVirtual(page);
    const scroll = page.getByTestId("concept-list-virtual-scroll");

    const innerHeight = async () =>
      scroll.evaluate((el) => (el.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0);

    const emptyHeight = await innerHeight();
    await waitForHealthyVisibleRows(page);

    await fillSearch(page, VIRTUAL_LIST_QUERY_A);
    const queryAHeight = await innerHeight();
    await waitForHealthyVisibleRows(page);
    expect(queryAHeight).toBeGreaterThan(emptyHeight);

    await fillSearch(page, VIRTUAL_LIST_QUERY_B);
    await waitForHealthyVisibleRows(page);

    await fillSearch(page, "");
    await expect(page.locator(".concept-index-search-hit")).toHaveCount(0);
    await waitForHealthyVisibleRows(page);
    const clearedHeight = await innerHeight();
    expect(clearedHeight).toBeLessThan(queryAHeight);
    expect(Math.abs(clearedHeight - emptyHeight)).toBeLessThan(emptyHeight * 0.2 + 80);
  });

  test("I. viewport外へscrollすると対象がDOMへ入る", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoVirtual(page);
    const target = page.getByTestId(itemTestId(VIRTUAL_LIST_E2E_IDS.offscreen));
    await expect(target).toHaveCount(0);
    const scroll = page.getByTestId("concept-list-virtual-scroll");
    for (let i = 0; i < 40; i += 1) {
      if ((await target.count()) > 0) {
        break;
      }
      await scroll.evaluate((el) => {
        el.scrollTop += Math.max(el.clientHeight, 200);
      });
    }
    await expect(target).toBeVisible();
  });

  test("J. 最後付近まで到達できる", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoVirtual(page);
    const scroll = page.getByTestId("concept-list-virtual-scroll");
    await scroll.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(page.getByTestId(itemTestId(VIRTUAL_LIST_E2E_IDS.last))).toBeVisible();
    const metrics = await scroll.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  });

  test("K. スクロール途中も二重表示・順序破綻なし", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoVirtual(page);
    await fillSearch(page, VIRTUAL_LIST_QUERY_A);
    const scroll = page.getByTestId("concept-list-virtual-scroll");
    await scroll.evaluate((el) => {
      el.scrollTop = Math.floor(el.scrollHeight * 0.4);
    });
    await waitForHealthyVisibleRows(page);
  });

  test("L. selectedId変更で対象付近へ追従する", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoVirtual(page);
    await expect(page.getByTestId(itemTestId(VIRTUAL_LIST_E2E_IDS.last))).toHaveCount(0);
    await page.getByTestId("e2e-select-last").click();
    await expect(page.getByTestId(itemTestId(VIRTUAL_LIST_E2E_IDS.last))).toBeVisible();
    await page.getByTestId("e2e-select-first").click();
    await expect(page.getByTestId(itemTestId(VIRTUAL_LIST_E2E_IDS.first))).toBeVisible();
  });

  test("M. 検索変更だけでは選択位置へ戻らない", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoVirtual(page);
    await page.getByTestId("e2e-select-last").click();
    await expect(page.getByTestId(itemTestId(VIRTUAL_LIST_E2E_IDS.last))).toBeVisible();
    const scroll = page.getByTestId("concept-list-virtual-scroll");
    await scroll.evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect(page.getByTestId(itemTestId(VIRTUAL_LIST_E2E_IDS.first))).toBeVisible();
    await expect(page.getByTestId(itemTestId(VIRTUAL_LIST_E2E_IDS.last))).toHaveCount(0);
    const topBefore = await scroll.evaluate((el) => el.scrollTop);
    await fillSearch(page, VIRTUAL_LIST_QUERY_A);
    const topAfter = await scroll.evaluate((el) => el.scrollTop);
    expect(topAfter).toBeLessThan(200);
    expect(Math.abs(topAfter - topBefore)).toBeLessThan(120);
    await expect(page.getByTestId(itemTestId(VIRTUAL_LIST_E2E_IDS.last))).toHaveCount(0);
  });

  test("N. selectedIdが検索結果外でも破綻しない", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoVirtual(page);
    await page.getByTestId("e2e-select-missing").click();
    await expect(page.getByTestId("concept-list-virtual-scroll")).toBeVisible();
    await waitForHealthyVisibleRows(page);
    await fillSearch(page, VIRTUAL_LIST_QUERY_A);
    await waitForHealthyVisibleRows(page);
    expect(errors).toEqual([]);
  });

  test("O. full layoutでvirtual scrollが使える", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoVirtual(page);
    await expect(page.getByTestId("concept-list-virtual-scroll")).toHaveClass(/concept-list-scroll--full/);
    const scroll = page.getByTestId("concept-list-virtual-scroll");
    await fillSearch(page, VIRTUAL_LIST_QUERY_A);
    await waitForHealthyVisibleRows(page);
    await scroll.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(page.getByTestId(itemTestId(VIRTUAL_LIST_E2E_IDS.last))).toBeVisible();
  });

  test("P. grouped layoutでも致命的に破綻しない", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoVirtual(page, "&listLayout=grouped");
    await expect(page.getByTestId("concept-list-virtual-scroll")).toHaveClass(/concept-list-scroll--grouped/);
    expect(await listItems(page).count()).toBeLessThan(VIRTUAL_LIST_E2E_COUNT);
    await fillSearch(page, VIRTUAL_LIST_QUERY_A);
    await waitForHealthyVisibleRows(page);
    const row = page.getByTestId(itemTestId(VIRTUAL_LIST_E2E_IDS.contextSnippet));
    await expect(row.locator(".concept-index-search-hit")).toBeVisible();
  });

  test("Q. 390pxでページ全体の横overflowがない", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoVirtual(page);
    await assertNoHorizontalPageScroll(page);
    await fillSearch(page, VIRTUAL_LIST_QUERY_A);
    await assertNoHorizontalPageScroll(page);
  });
});
