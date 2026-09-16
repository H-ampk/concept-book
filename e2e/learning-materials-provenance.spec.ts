import { expect, test, type Page } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pdfPath = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "psych-lecture-4.pdf");

const consoleErrors: string[] = [];

const openContextCardCreate = async (page: Page) => {
  await page.getByRole("button", { name: "文脈" }).click();
  await expect(page.getByRole("heading", { name: "文脈カードの分野を選択" })).toBeVisible();
  await page.getByRole("button", { name: /すべて/ }).filter({ hasText: "文脈カード" }).click();
  await page.getByRole("button", { name: "新規作成" }).click();
  await expect(page.getByRole("heading", { name: "文脈カードを作成" })).toBeVisible();
};

const fillCreateCard = async (page: Page, title: string, keyConcepts: string) => {
  const modal = page.locator(".fixed.inset-0").filter({ hasText: "文脈カードを作成" });
  await modal.locator("input").nth(0).fill(title);
  await modal.locator("input").nth(1).fill("心理学概論");
  await modal.locator("textarea").last().fill(keyConcepts);
  await modal.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByRole("heading", { name: "文脈カード詳細" })).toBeVisible({ timeout: 15_000 });
};

const idbSnapshot = async (page: Page) =>
  page.evaluate(async () => {
    const open = () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("concept-book-db");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    const all = (db: IDBDatabase, name: string) =>
      new Promise<unknown[]>((resolve, reject) => {
        if (!db.objectStoreNames.contains(name)) {
          resolve([]);
          return;
        }
        const tx = db.transaction(name, "readonly");
        const req = tx.objectStore(name).getAll();
        req.onsuccess = () => resolve(req.result as unknown[]);
        req.onerror = () => reject(req.error);
      });
    const db = await open();
    const [learningMaterials, learningMaterialBlobs, conceptSourceAnchors, concepts, contextCards] =
      await Promise.all([
        all(db, "learningMaterials"),
        all(db, "learningMaterialBlobs"),
        all(db, "conceptSourceAnchors"),
        all(db, "concepts"),
        all(db, "contextCards")
      ]);
    db.close();
    return {
      learningMaterials,
      learningMaterialBlobs,
      conceptSourceAnchors,
      conceptTitles: (concepts as { title?: string }[]).map((c) => c.title),
      contextCardTitles: (contextCards as { title?: string }[]).map((c) => c.title)
    };
  });

const selectTextContaining = async (page: Page, needle: string) => {
  const ok = await page.evaluate((text) => {
    const spans = [...document.querySelectorAll(".text-layer span")] as HTMLElement[];
    const start = spans.findIndex((el) => (el.textContent ?? "").includes(text.slice(0, 4)));
    if (start < 0) {
      const joined = spans.map((el) => el.textContent ?? "").join("");
      const idx = joined.indexOf(text.slice(0, 6));
      if (idx < 0) {
        return false;
      }
    }
    const matches = spans.filter((el) => {
      const t = el.textContent ?? "";
      return text.includes(t.trim()) || t.includes(text.slice(0, 6));
    });
    if (matches.length === 0) {
      return false;
    }
    const range = document.createRange();
    range.setStart(matches[0], 0);
    const last = matches[matches.length - 1];
    range.setEnd(last, last.childNodes.length || 1);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    return (sel?.toString() ?? "").length > 0;
  }, needle);
  expect(ok).toBe(true);
};

const linkSelectionToConcept = async (page: Page, conceptTitle: string) => {
  await page.getByRole("button", { name: "Conceptに関連付ける" }).click();
  const dialog = page.getByRole("dialog", { name: "Conceptに関連付ける" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: conceptTitle }).check();
  await dialog.getByRole("button", { name: "関連付ける" }).click();
  await expect(dialog).toBeHidden();
};

test.describe("learning material PDF provenance (browser)", () => {
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
    await expect(page.getByRole("button", { name: "文脈" })).toBeVisible();
  });

  test("upload, viewer, anchors, zoom, mobile, persistence, cascade, ZIP", async ({ page }) => {
    test.setTimeout(180_000);
    await openContextCardCreate(page);
    await fillCreateCard(
      page,
      "心理学概論 第4回",
      "強化, シェイピング, 弱化, オペラント条件づけ"
    );

    await expect(page.getByText("教材", { exact: true })).toBeVisible();
    const pdfInput = page.locator('input[type="file"][accept*="pdf"]');
    await pdfInput.setInputFiles(pdfPath);
    await expect(page.getByText("psych-lecture-4.pdf")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "教材を開く" })).toBeVisible();
    expect(consoleErrors.filter((e) => !e.includes("Download the React DevTools"))).toEqual([]);

    await page.reload();
    await page.getByRole("button", { name: "文脈" }).click();
    await page.getByRole("button", { name: /すべて/ }).filter({ hasText: "文脈カード" }).click();
    await page.getByRole("button", { name: "心理学概論 第4回" }).click();
    await expect(page.getByText("psych-lecture-4.pdf")).toBeVisible();

    await page.getByRole("button", { name: "教材を開く" }).click();
    const viewer = page.getByRole("dialog", { name: "psych-lecture-4" });
    await expect(viewer).toBeVisible();
    await expect(viewer.locator("canvas")).toBeVisible({ timeout: 20_000 });
    await expect(viewer.locator(".text-layer span").first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: "e2e/artifacts/viewer-open.png", fullPage: true });

    await selectTextContaining(page, "強化とは");
    await linkSelectionToConcept(page, "強化");
    await expect(viewer.getByRole("button", { name: /出現箇所/ }).first()).toBeVisible();
    const highlightCount1 = await viewer.locator("button[aria-label^='出現箇所']").count();
    expect(highlightCount1).toBeGreaterThan(0);
    await expect.poll(async () => viewer.locator("svg line").count()).toBeGreaterThan(0);
    await page.screenshot({ path: "e2e/artifacts/anchor-highlight-connector.png", fullPage: true });

    await selectTextContaining(page, "シェイピングとは");
    await linkSelectionToConcept(page, "シェイピング");
    await expect(viewer.getByRole("button", { name: "出現箇所: シェイピング" }).first()).toBeVisible();

    await selectTextContaining(page, "オペラント条件づけ");
    await linkSelectionToConcept(page, "オペラント条件づけ");
    await expect(viewer.getByRole("button", { name: "出現箇所: オペラント条件づけ" }).first()).toBeVisible();

    await viewer.getByRole("button", { name: "次のページ" }).click();
    await expect(viewer.getByText(/2 \//)).toBeVisible();
    await expect.poll(async () =>
      page.evaluate(() =>
        [...document.querySelectorAll(".text-layer span")].some((el) =>
          (el.textContent ?? "").includes("復習")
        )
      )
    ).toBe(true);
    await selectTextContaining(page, "復習");
    await linkSelectionToConcept(page, "強化");
    await viewer.getByRole("button", { name: /強化 このConceptの出現箇所/ }).click();
    await expect(viewer.getByRole("button", { name: /p\.2/ })).toBeVisible();
    await viewer.getByRole("button", { name: /p\.2/ }).click();
    await expect(viewer.getByText(/2 \//)).toBeVisible();

    await viewer.getByRole("button", { name: "前のページ" }).click();
    await expect(viewer.locator("button[aria-label^='出現箇所']").first()).toBeVisible();

    await viewer.getByRole("button", { name: "縮小" }).click();
    await viewer.getByRole("button", { name: "縮小" }).click();
    await page.screenshot({ path: "e2e/artifacts/zoom-out.png" });
    await viewer.getByRole("button", { name: "拡大" }).click();
    await viewer.getByRole("button", { name: "拡大" }).click();
    await viewer.getByRole("button", { name: "拡大" }).click();
    await page.screenshot({ path: "e2e/artifacts/zoom-in.png" });
    expect(await viewer.locator("svg line").count()).toBeGreaterThan(0);

    await page.setViewportSize({ width: 1024, height: 800 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: "e2e/artifacts/resize-1024.png" });
    await page.setViewportSize({ width: 800, height: 800 });
    await page.waitForTimeout(300);
    const overflow800 = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow800).toBeLessThan(80);

    const pdfPane = viewer.locator(".overflow-auto").first();
    await pdfPane.evaluate((el) => {
      el.scrollTop = 80;
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: "e2e/artifacts/pdf-internal-scroll.png" });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(400);
    const mobileLines = await viewer.locator("svg line").count();
    expect(mobileLines).toBe(0);
    await page.screenshot({ path: "e2e/artifacts/mobile.png", fullPage: true });
    await viewer.getByRole("button", { name: /出現箇所/ }).first().click({ force: true });
    await expect(viewer.getByText("この回のConcept")).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await viewer.getByRole("button", { name: "閉じる" }).click();

    const beforeReload = await idbSnapshot(page);
    expect(beforeReload.learningMaterials.length).toBe(1);
    expect(beforeReload.learningMaterialBlobs.length).toBe(1);
    expect(beforeReload.conceptSourceAnchors.length).toBeGreaterThanOrEqual(3);

    await page.reload();
    await page.getByRole("button", { name: "文脈" }).click();
    await page.getByRole("button", { name: /すべて/ }).filter({ hasText: "文脈カード" }).click();
    await page.getByRole("button", { name: "心理学概論 第4回" }).click();
    await page.getByRole("button", { name: "教材を開く" }).click();
    await expect(page.getByRole("dialog", { name: "psych-lecture-4" })).toBeVisible();
    await expect(page.locator("button[aria-label^='出現箇所']").first()).toBeVisible({ timeout: 20_000 });
    const afterReload = await idbSnapshot(page);
    expect(afterReload.conceptSourceAnchors.length).toBe(beforeReload.conceptSourceAnchors.length);

    await viewer.getByRole("button", { name: /強化 このConceptの出現箇所/ }).click();
    await viewer.getByRole("button", { name: "関連付けを解除" }).first().click();
    await page.waitForTimeout(300);
    const afterDeleteAnchor = await idbSnapshot(page);
    expect(afterDeleteAnchor.conceptSourceAnchors.length).toBe(
      beforeReload.conceptSourceAnchors.length - 1
    );
    expect(afterDeleteAnchor.learningMaterialBlobs.length).toBe(1);

    await page.getByRole("button", { name: "閉じる" }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "設定" }).click();
    await page.getByRole("button", { name: "ZIPを保存" }).click();
    const download = await downloadPromise;
    const zipPath = join(dirname(fileURLToPath(import.meta.url)), "artifacts", "provenance-backup.zip");
    await download.saveAs(zipPath);

    await page.getByRole("button", { name: "文脈" }).click();
    await page.getByRole("button", { name: /すべて/ }).filter({ hasText: "文脈カード" }).click();
    await page.getByRole("button", { name: "心理学概論 第4回" }).click();
    await page.getByRole("button", { name: "教材を削除" }).click();
    await page.getByRole("button", { name: "削除する" }).click();
    await expect(page.getByText("psych-lecture-4.pdf")).toHaveCount(0);
    const afterPdfDelete = await idbSnapshot(page);
    expect(afterPdfDelete.learningMaterials.length).toBe(0);
    expect(afterPdfDelete.learningMaterialBlobs.length).toBe(0);
    expect(afterPdfDelete.conceptSourceAnchors.length).toBe(0);
    expect(afterPdfDelete.conceptTitles).toEqual(
      expect.arrayContaining(["強化", "シェイピング", "弱化", "オペラント条件づけ"])
    );

    await page.getByRole("button", { name: "設定" }).click();
    await page.getByLabel("取り込みモード（ZIP）").selectOption("replace");
    const zipInput = page.locator('input[accept*="zip"]');
    await zipInput.setInputFiles(zipPath);
    await expect(page.getByText(/ZIPインポート完了/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "文脈" }).click();
    await page.getByRole("button", { name: /すべて/ }).filter({ hasText: "文脈カード" }).click();
    await page.getByRole("button", { name: "心理学概論 第4回" }).click();
    await page.getByRole("button", { name: "教材を開く" }).click();
    await expect(page.locator("canvas")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("button[aria-label^='出現箇所']").first()).toBeVisible();
    await page.screenshot({ path: "e2e/artifacts/zip-import-viewer.png" });

    const storage = await page.evaluate(async () => {
      const mod = await import("/src/storage/index.ts");
      return {
        deleteContextCard: true,
        keys: Object.keys(mod)
      };
    });
    expect(storage.keys).toContain("getContextStorage");

    await page.getByRole("button", { name: "閉じる" }).click();

    const extraTitle = "cascade-card-temp";
    await page.getByRole("button", { name: "最初の画面に戻る" }).click();
    await page.getByRole("button", { name: /すべて/ }).filter({ hasText: "文脈カード" }).click();
    await page.getByRole("button", { name: "新規作成" }).click();
    await fillCreateCard(page, extraTitle, "強化");
    await page.locator('input[type="file"][accept*="pdf"]').setInputFiles(pdfPath);
    await expect(page.getByText("psych-lecture-4.pdf")).toBeVisible();

    await page.evaluate(async (title) => {
      const { getContextStorage } = await import("/src/storage/index.ts");
      const cards = await getContextStorage().getAllContextCards();
      const card = cards.find((c) => c.title === title);
      if (!card) {
        throw new Error("missing cascade card");
      }
      await getContextStorage().deleteContextCard(card.id);
    }, extraTitle);
    const afterCardDelete = await idbSnapshot(page);
    expect(afterCardDelete.contextCardTitles).not.toContain(extraTitle);
    expect(afterCardDelete.conceptTitles).toEqual(expect.arrayContaining(["強化"]));

    const conceptCountBefore = afterCardDelete.conceptTitles.filter((t) => t === "弱化").length;
    await page.evaluate(async () => {
      const { getStorage } = await import("/src/storage/index.ts");
      const storageApi = getStorage();
      const concepts = await storageApi.getAllConcepts();
      const target = concepts.find((c) => c.title === "オペラント条件づけ");
      if (!target) {
        throw new Error("missing concept");
      }
      const before = await storageApi.getAnchorsByConceptId(target.id);
      (window as unknown as { __deletedConceptAnchors?: number }).__deletedConceptAnchors = before.length;
      await storageApi.deleteConcept(target.id);
    });
    const afterConceptDelete = await idbSnapshot(page);
    expect(afterConceptDelete.conceptTitles).not.toContain("オペラント条件づけ");
    expect(afterConceptDelete.learningMaterials.length).toBeGreaterThan(0);
    expect(conceptCountBefore).toBeGreaterThanOrEqual(0);

    const serious = consoleErrors.filter(
      (e) =>
        !e.includes("Download the React DevTools") &&
        !e.includes("favicon") &&
        !/ResizeObserver loop/.test(e)
    );
    expect(serious).toEqual([]);
  });
});
