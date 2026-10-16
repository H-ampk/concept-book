import { expect, test, type Page } from "@playwright/test";

const seedVocabulary = async (page: Page) => {
  await page.evaluate(() => {
    const openDb = (): Promise<IDBDatabase> =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("concept-book-db");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("indexedDB.open failed"));
      });

    const now = "2026-10-16T00:00:00.000Z";
    return openDb().then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(["concepts", "contextCards"], "readwrite");
          tx.objectStore("concepts").put({
            id: "vocab-concept-1",
            title: "単語帳E2E概念",
            definition: "分野一覧から開く概念",
            myInterpretation: "",
            domainTags: ["心理学"],
            researchTags: [],
            relatedIds: [],
            prerequisiteIds: [],
            source: { book: "", page: "", author: null },
            notes: "",
            status: "active",
            favorite: false,
            createdAt: now,
            updatedAt: now,
            contextDefinitions: []
          });
          tx.objectStore("contextCards").put({
            id: "vocab-card-1",
            title: "単語帳E2E文脈",
            domainTags: ["心理学"],
            centralQuestion: "記憶はどのように保持されるか",
            background: "",
            flow: "",
            keyConcepts: "",
            linkedConcepts: [],
            createdAt: now,
            updatedAt: now
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        })
    );
  });
};

test("単語帳で分野と種別を保ったまま詳細から戻れる", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Concept Book App" })).toBeVisible();
  await seedVocabulary(page);
  await page.reload();
  await expect(page.getByText("読み込み中...")).toHaveCount(0);

  await page.getByRole("button", { name: "単語帳", exact: true }).click();
  await expect(page.getByRole("heading", { name: "単語帳", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /心理学/ }).click();
  await expect(page.getByRole("button", { name: /単語帳E2E概念/ })).toBeVisible();

  await page.getByRole("button", { name: "文脈カード", exact: true }).click();
  await expect(page.getByRole("button", { name: /単語帳E2E文脈/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /単語帳E2E概念/ })).toHaveCount(0);

  await page.getByRole("button", { name: /単語帳E2E文脈/ }).click();
  await expect(page.getByRole("heading", { name: "文脈カード詳細" })).toBeVisible();
  await page.getByRole("button", { name: "一覧へ戻る" }).click();

  await expect(page.getByRole("heading", { name: "心理学" })).toBeVisible();
  await expect(page.getByRole("button", { name: "文脈カード", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByRole("button", { name: /単語帳E2E文脈/ })).toBeVisible();
});
