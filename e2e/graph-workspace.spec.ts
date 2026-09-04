import { expect, test } from "@playwright/test";

const boxesOverlap = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

const clickToolbar = async (page: import("@playwright/test").Page, name: string) => {
  await page.getByRole("button", { name, exact: true }).click();
};

test.describe("concept graph workspace browser regressions (#104)", () => {
  test("詳細パネル表示中でも操作UIとCanvasが pointer event を受け取れる", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/?e2eGraphLayout=1");

    await expect(page.getByTestId("graph-detail-panel")).toBeVisible();
    await expect(page.getByTestId("decorative-background")).toHaveCSS("pointer-events", "none");
    await expect(page.getByTestId("graph-detail-backdrop")).toHaveCSS("pointer-events", "none");
    await expect(page.getByTestId("graph-detail-panel")).toHaveCSS("pointer-events", "auto");

    await clickToolbar(page, "1-hop");
    await expect(page.getByRole("button", { name: "1-hop", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await clickToolbar(page, "2-hop");
    await clickToolbar(page, "全体");
    await clickToolbar(page, "全体を収める");
    await clickToolbar(page, "表示をリセット");
    await expect(page.getByRole("button", { name: /さらに表示/ })).toBeEnabled();

    const canvas = page.getByTestId("force-graph-canvas").or(page.locator("canvas").first());
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    if (!box) {
      return;
    }
    const hitX = box.x + Math.min(24, box.width / 4);
    const hitY = box.y + Math.min(24, box.height / 4);
    const hitTag = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.tagName ?? "",
      { x: hitX, y: hitY }
    );
    expect(hitTag).toBe("CANVAS");

    await canvas.hover({ position: { x: 12, y: 12 } });
    await page.mouse.wheel(0, -120);
    await page.mouse.down();
    await page.mouse.move(hitX + 30, hitY + 20);
    await page.mouse.up();

    await page.getByRole("button", { name: "お気に入り" }).click();
    await page.getByRole("button", { name: "閉じる" }).click();
    await expect(page.getByTestId("graph-detail-panel")).toHaveCount(0);
  });

  test("390px幅でも操作UIと詳細パネルが致命的に重ならない", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?e2eGraphLayout=1");

    const panel = page.getByTestId("graph-detail-panel");
    await expect(panel).toBeVisible();
    const panelBox = await panel.boundingBox();
    expect(panelBox).toBeTruthy();

    const controlNames = [
      { name: "全体", exact: true as const },
      { name: "1-hop", exact: true as const },
      { name: "2-hop", exact: true as const },
      { name: "全体を収める", exact: true as const },
      { name: "表示をリセット", exact: true as const },
      { name: /さらに表示/ }
    ];

    for (const controlName of controlNames) {
      const control = page.getByRole("button", controlName);
      await expect(control).toBeVisible();
      const controlBox = await control.boundingBox();
      expect(controlBox).toBeTruthy();
      if (controlBox && panelBox) {
        expect(boxesOverlap(controlBox, panelBox)).toBe(false);
      }
      await expect(control).toBeEnabled();
    }

    await clickToolbar(page, "1-hop");
    await clickToolbar(page, "2-hop");
    await clickToolbar(page, "全体");
    await clickToolbar(page, "全体を収める");
    await clickToolbar(page, "表示をリセット");
    await page.getByRole("button", { name: /さらに表示/ }).click();
  });
});
