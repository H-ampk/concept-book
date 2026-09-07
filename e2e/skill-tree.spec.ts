import { expect, test, type Page } from "@playwright/test";
import { SKILL_TREE_E2E_IDS } from "../src/dev/skillTreeE2eData";

const OVERFLOW_SLACK_PX = 8;
const OVERLAP_TOLERANCE_PX = 4;

const gotoTree = async (page: Page, tree: string) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/?e2eSkillTree=1&tree=${tree}`);
  await expect(page.getByTestId("skill-tree-container")).toBeVisible();
  await expect(page.getByTestId("skill-tree-content")).toBeVisible();
  return errors;
};

const assertNoHorizontalPageScroll = async (page: Page) => {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + OVERFLOW_SLACK_PX);
};

const nodeLocator = (page: Page, id: string) => page.getByTestId(`skill-tree-node-${id}`);

const readNodeBoxes = async (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<SVGGElement>('[data-testid^="skill-tree-node-"]')].map((el) => {
      const box = el.getBoundingClientRect();
      return {
        id: el.getAttribute("data-testid") ?? "",
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height
      };
    })
  );

const assertCardsDoNotOverlap = async (page: Page) => {
  const boxes = await readNodeBoxes(page);
  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(Number.isFinite(box.x)).toBe(true);
    expect(Number.isFinite(box.y)).toBe(true);
    expect(Number.isFinite(box.width)).toBe(true);
    expect(Number.isFinite(box.height)).toBe(true);
    expect(Math.abs(box.x)).toBeLessThan(20_000);
    expect(Math.abs(box.y)).toBeLessThan(20_000);
    expect(box.width).toBeGreaterThan(8);
    expect(box.height).toBeGreaterThan(8);
    expect(box.width).toBeLessThan(2_000);
    expect(box.height).toBeLessThan(2_000);
  }
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      const overlaps = overlapX > OVERLAP_TOLERANCE_PX && overlapY > OVERLAP_TOLERANCE_PX;
      expect(overlaps, `${a.id} overlaps ${b.id}`).toBe(false);
    }
  }
};

const contentSize = async (page: Page) =>
  page.getByTestId("skill-tree-content").evaluate((el) => ({
    width: Number((el as SVGSVGElement).getAttribute("width")),
    height: Number((el as SVGSVGElement).getAttribute("height")),
    transform: getComputedStyle(el).transform
  }));

const assertFiniteTransform = async (page: Page) => {
  const size = await contentSize(page);
  expect(Number.isFinite(size.width)).toBe(true);
  expect(Number.isFinite(size.height)).toBe(true);
  expect(size.transform).not.toMatch(/NaN|Infinity/i);
};

const zoomLabel = (page: Page) => page.locator("span.tabular-nums");

const panTree = async (page: Page) => {
  const container = page.getByTestId("skill-tree-container");
  const before = await container.evaluate((el) => ({
    scrollLeft: el.scrollLeft,
    scrollTop: el.scrollTop
  }));
  const box = await container.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return before;
  const startX = box.x + Math.min(40, box.width / 8);
  const startY = box.y + box.height - 24;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 140, startY - 90, { steps: 8 });
  await page.mouse.up();
  const after = await container.evaluate((el) => ({
    scrollLeft: el.scrollLeft,
    scrollTop: el.scrollTop
  }));
  expect(after.scrollLeft !== before.scrollLeft || after.scrollTop !== before.scrollTop).toBe(true);
  return after;
};

test.describe("skill tree browser regressions (#141)", () => {
  test("非対称ツリー: カードが重ならず A/B subtree が食い込まない", async ({ page }) => {
    const errors = await gotoTree(page, "asymmetric");
    await assertCardsDoNotOverlap(page);
    await assertFiniteTransform(page);
    await assertNoHorizontalPageScroll(page);

    const ids = SKILL_TREE_E2E_IDS.asymmetric;
    const aBox = await nodeLocator(page, ids.a).boundingBox();
    const bBox = await nodeLocator(page, ids.b).boundingBox();
    const a1 = await nodeLocator(page, ids.a1).boundingBox();
    const a4 = await nodeLocator(page, ids.a4).boundingBox();
    const b1 = await nodeLocator(page, ids.b1).boundingBox();
    expect(aBox && bBox && a1 && a4 && b1).toBeTruthy();
    if (a1 && a4 && b1) {
      const aBottom = Math.max(a1.y + a1.height, a4.y + a4.height);
      expect(aBottom).toBeLessThanOrEqual(b1.y + OVERLAP_TOLERANCE_PX);
    }
    expect(errors).toEqual([]);
  });

  test("少数ノード: 表示でき、重ならず、異常座標にならない", async ({ page }) => {
    for (const tree of ["single", "pair", "small-branch"] as const) {
      const errors = await gotoTree(page, tree);
      await expect(page.locator('[data-testid^="skill-tree-node-"]')).toHaveCount(
        tree === "single" ? 1 : tree === "pair" ? 2 : 3
      );
      await assertCardsDoNotOverlap(page);
      await assertFiniteTransform(page);
      const size = await contentSize(page);
      expect(size.width).toBeLessThan(4_000);
      expect(size.height).toBeLessThan(4_000);
      expect(errors).toEqual([]);
    }
  });

  test("大きいツリーの content は小さいツリーより広い/高い", async ({ page }) => {
    await gotoTree(page, "single");
    const small = await contentSize(page);
    await gotoTree(page, "wide");
    const wide = await contentSize(page);
    await gotoTree(page, "chain");
    const chain = await contentSize(page);
    expect(wide.height).toBeGreaterThan(small.height);
    expect(chain.width).toBeGreaterThan(small.width);
  });

  test("collapse / expand と collapse 後レイアウト", async ({ page }) => {
    const errors = await gotoTree(page, "asymmetric");
    const ids = SKILL_TREE_E2E_IDS.asymmetric;
    await expect(nodeLocator(page, ids.a1)).toBeVisible();
    await page.getByTestId(`skill-tree-collapse-${ids.a}`).click();
    await expect(nodeLocator(page, ids.a1)).toHaveCount(0);
    await expect(nodeLocator(page, ids.a4)).toHaveCount(0);
    await expect(nodeLocator(page, ids.a)).toBeVisible();
    await expect(nodeLocator(page, ids.b1)).toBeVisible();
    await assertCardsDoNotOverlap(page);
    await assertFiniteTransform(page);
    await expect(page.getByTestId(`skill-tree-collapse-${ids.a}`)).toBeVisible();
    await page.getByTestId(`skill-tree-collapse-${ids.a}`).click();
    await expect(nodeLocator(page, ids.a1)).toBeVisible();
    await expect(nodeLocator(page, ids.a4)).toBeVisible();
    await assertCardsDoNotOverlap(page);
    expect(errors).toEqual([]);
  });

  test("zoom in / out / 100% 復帰", async ({ page }) => {
    const errors = await gotoTree(page, "asymmetric");
    const ids = SKILL_TREE_E2E_IDS.asymmetric;
    await expect(zoomLabel(page)).toHaveText("100%");
    await page.getByRole("button", { name: "拡大" }).click();
    await expect(zoomLabel(page)).toHaveText("110%");
    await assertFiniteTransform(page);
    await expect(nodeLocator(page, ids.root)).toBeVisible();
    await nodeLocator(page, ids.b).click();
    await expect(page.getByTestId("skill-tree-selected")).toHaveText(`選択: ${ids.b}`);
    await page.getByRole("button", { name: "縮小" }).click();
    await expect(zoomLabel(page)).toHaveText("100%");
    await page.getByRole("button", { name: "縮小" }).click();
    await expect(zoomLabel(page)).toHaveText("90%");
    await page.getByRole("button", { name: "100%" }).click();
    await expect(zoomLabel(page)).toHaveText("100%");
    await assertFiniteTransform(page);
    expect(errors).toEqual([]);
  });

  test("pan 後もカードを選択できる", async ({ page }) => {
    const errors = await gotoTree(page, "wide");
    await panTree(page);
    await assertFiniteTransform(page);
    const ids = SKILL_TREE_E2E_IDS.wide;
    await nodeLocator(page, ids.a).click();
    await expect(page.getByTestId("skill-tree-selected")).toHaveText(`選択: ${ids.a}`);
    expect(errors).toEqual([]);
  });

  test("Concept 選択、zoom 後選択、collapse で selection clear", async ({ page }) => {
    const errors = await gotoTree(page, "asymmetric");
    const ids = SKILL_TREE_E2E_IDS.asymmetric;
    await expect(page.getByTestId("skill-tree-selected")).toHaveText("選択: なし");
    await nodeLocator(page, ids.a1).click();
    await expect(page.getByTestId("skill-tree-selected")).toHaveText(`選択: ${ids.a1}`);
    await page.getByRole("button", { name: "拡大" }).click();
    await nodeLocator(page, ids.a2).click();
    await expect(page.getByTestId("skill-tree-selected")).toHaveText(`選択: ${ids.a2}`);
    await page.getByTestId(`skill-tree-collapse-${ids.a}`).click();
    await expect(page.getByTestId("skill-tree-selected")).toHaveText("選択: なし");
    expect(errors).toEqual([]);
  });

  test("extra edge: 表示でき、選択時に extra edge が出ても崩れない", async ({ page }) => {
    const errors = await gotoTree(page, "extra-edge");
    await assertCardsDoNotOverlap(page);
    const ids = SKILL_TREE_E2E_IDS.extraEdge;
    await expect(page.locator('[data-testid^="skill-tree-extra-edge-"]')).toHaveCount(0);
    await nodeLocator(page, ids.a).click();
    await expect(page.locator('[data-testid^="skill-tree-extra-edge-"]')).toHaveCount(1);
    await assertCardsDoNotOverlap(page);
    await assertFiniteTransform(page);
    const paths = await page.locator('[data-testid^="skill-tree-extra-edge-"]').evaluateAll((els) =>
      els.map((el) => el.getAttribute("d") ?? "")
    );
    expect(new Set(paths).size).toBe(paths.length);
    expect(errors).toEqual([]);
  });

  test("複雑ツリー: 描画・非重複・有限座標", async ({ page }) => {
    const errors = await gotoTree(page, "complex");
    const count = await page.locator('[data-testid^="skill-tree-node-"]').count();
    expect(count).toBeGreaterThan(20);
    await assertCardsDoNotOverlap(page);
    await assertFiniteTransform(page);
    const size = await contentSize(page);
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("390px viewport でも操作できる", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = await gotoTree(page, "asymmetric");
    await assertNoHorizontalPageScroll(page);
    await expect(page.getByRole("button", { name: "拡大" })).toBeVisible();
    await expect(page.getByRole("button", { name: "縮小" })).toBeVisible();
    const ids = SKILL_TREE_E2E_IDS.asymmetric;
    await nodeLocator(page, ids.root).click();
    await expect(page.getByTestId("skill-tree-selected")).toHaveText(`選択: ${ids.root}`);
    await page.getByRole("button", { name: "拡大" }).click();
    await panTree(page);
    await assertCardsDoNotOverlap(page);
    expect(errors).toEqual([]);
  });
});
