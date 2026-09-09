import { expect, test, type Page } from "@playwright/test";

const CONCEPT_ID = "e2e-concept-a";
const DECK_ID = "e2e-deck-a";
const LOG_IDS = ["e2e-log-1", "e2e-log-2"] as const;

const seedDataLabFixture = async (page: Page) => {
  await page.evaluate(
    ({ conceptId, deckId, logIds }) => {
      const openDb = (): Promise<IDBDatabase> =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open("concept-book-db");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error ?? new Error("indexedDB.open failed"));
        });

      const putAll = (store: IDBObjectStore, rows: object[]): Promise<void> =>
        Promise.all(
          rows.map(
            (row) =>
              new Promise<void>((resolve, reject) => {
                const req = store.put(row);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
              })
          )
        ).then(() => undefined);

      const now = "2026-09-01T12:00:00.000Z";
      return openDb().then(async (db) => {
        try {
          const tx = db.transaction(["concepts", "quizDecks", "quizAttemptLogs"], "readwrite");
          await putAll(tx.objectStore("concepts"), [
            {
              id: conceptId,
              title: "E2E心理学概念",
              definition: "e2e",
              myInterpretation: "",
              domainTags: ["心理学"],
              researchTags: [],
              relatedIds: [],
              source: { book: "", page: "", author: null },
              notes: "",
              status: "active",
              favorite: false,
              createdAt: now,
              updatedAt: now,
              contextDefinitions: []
            }
          ]);
          await putAll(tx.objectStore("quizDecks"), [
            {
              id: deckId,
              title: "E2Eデッキ",
              questionIds: ["e2e-q1"],
              visibility: "private",
              schemaVersion: 1,
              createdAt: now,
              updatedAt: now
            }
          ]);
          await putAll(tx.objectStore("quizAttemptLogs"), [
            {
              id: logIds[0],
              questionId: "e2e-q1",
              questionPromptSnapshot: "問い1",
              selectedChoiceId: "c1",
              selectedChoiceTextSnapshot: "選択",
              correctChoiceId: "c1",
              correctChoiceTextSnapshot: "選択",
              correct: true,
              startedAt: "2026-08-15T03:00:00.000Z",
              answeredAt: "2026-08-15T03:00:01.000Z",
              timeMs: 1200,
              schemaVersion: 1,
              conceptId,
              deckId
            },
            {
              id: logIds[1],
              questionId: "e2e-q1",
              questionPromptSnapshot: "問い1",
              selectedChoiceId: "c2",
              selectedChoiceTextSnapshot: "誤答",
              correctChoiceId: "c1",
              correctChoiceTextSnapshot: "選択",
              correct: false,
              startedAt: "2026-08-16T03:00:00.000Z",
              answeredAt: "2026-08-16T03:00:02.000Z",
              timeMs: 800,
              schemaVersion: 1,
              conceptId,
              deckId
            }
          ]);
          await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error ?? new Error("seed abort"));
          });
        } finally {
          db.close();
        }
      });
    },
    { conceptId: CONCEPT_ID, deckId: DECK_ID, logIds: LOG_IDS }
  );
};

const countQuizAttemptLogs = async (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open("concept-book-db");
        request.onerror = () => reject(request.error ?? new Error("indexedDB.open failed"));
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("quizAttemptLogs", "readonly");
          const getAll = tx.objectStore("quizAttemptLogs").getAll();
          getAll.onsuccess = () => {
            const count = (getAll.result ?? []).length;
            db.close();
            resolve(count);
          };
          getAll.onerror = () => {
            db.close();
            reject(getAll.error);
          };
        };
      })
  );

const openLabRoute = async (page: Page, label: "Data Lab" | "研究レポート") => {
  await page.getByRole("button", { name: "Lab" }).click();
  const item = page.getByRole("menuitem", { name: new RegExp(`^${label}`) });
  await item.scrollIntoViewIfNeeded();
  await item.click();
};

test.describe("Data Lab → research report persistence (#98)", () => {
  test("Snapshot を新規・既存レポートへ保存し、考察と削除がログを壊さない", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Concept Book App" })).toBeVisible();
    await expect(page.getByPlaceholder("タイトル・定義・解釈・分野タグ・研究テーマタグ・メモを検索")).toBeVisible();
    await expect(page.getByText("読み込み中...")).toHaveCount(0);

    await seedDataLabFixture(page);
    await page.reload();
    await expect(page.getByPlaceholder("タイトル・定義・解釈・分野タグ・研究テーマタグ・メモを検索")).toBeVisible();
    await expect(page.getByText("E2E心理学概念")).toBeVisible();

    await openLabRoute(page, "Data Lab");
    await expect(page.getByRole("heading", { name: "Data Lab" })).toBeVisible();
    await expect(page.getByTestId("data-lab-log-count")).toHaveText("2 / 2");
    await expect(page.getByTestId("data-lab-table")).toContainText("E2E心理学概念");
    await expect(page.getByRole("button", { name: "研究レポートに追加" })).toBeEnabled();

    await page.getByLabel("表示").selectOption("scatter");
    await expect(page.getByTestId("data-lab-scatter-plot")).toBeVisible();
    await expect(page.getByTestId("data-lab-aggregate-summary")).toContainText("X軸: 平均回答時間");
    await expect(page.getByTestId("data-lab-aggregate-summary")).toContainText("Y軸: 正答率");

    await page.getByRole("button", { name: "研究レポートに追加" }).click();
    const addDialog = page.getByRole("dialog", { name: "研究レポートに追加" });
    await expect(addDialog).toBeVisible();
    await addDialog.getByRole("radio", { name: "新しい研究レポート" }).check();
    await addDialog.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByTestId("data-lab-research-report-saved")).toBeVisible();

    await openLabRoute(page, "研究レポート");
    await expect(page.getByTestId("saved-research-report-detail")).toBeVisible();
    await expect(page.getByTestId("research-analysis-block")).toHaveCount(1);
    await expect(page.getByText("X 指標")).toBeVisible();
    await expect(page.getByText("平均回答時間").first()).toBeVisible();
    await expect(page.getByText("Y 指標")).toBeVisible();
    await expect(page.getByTestId("research-analysis-snapshot-table")).toContainText("E2E心理学概念");

    const commentary = page.getByLabel("考察");
    await commentary.fill("正答率が低い可能性がある。");
    await commentary.blur();
    await expect(commentary).toHaveValue("正答率が低い可能性がある。");

    await page.reload();
    await expect(page.getByRole("heading", { name: "Concept Book App" })).toBeVisible();
    await openLabRoute(page, "研究レポート");
    await expect(page.getByLabel("考察")).toHaveValue("正答率が低い可能性がある。");
    await expect(page.getByTestId("research-analysis-block")).toHaveCount(1);
    await expect(page.getByText("X 指標")).toBeVisible();

    await openLabRoute(page, "Data Lab");
    await page.getByLabel("表示").selectOption("table");
    await expect(page.getByTestId("data-lab-table")).toBeVisible();
    await page.getByRole("button", { name: "研究レポートに追加" }).click();
    await expect(addDialog).toBeVisible();
    await addDialog.getByRole("radio", { name: "既存の研究レポート" }).check();
    await expect(addDialog.getByLabel("追加先の研究レポート")).toBeVisible();
    await addDialog.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByTestId("data-lab-research-report-saved")).toContainText("へ分析を追加しました");

    await openLabRoute(page, "研究レポート");
    await expect(page.getByTestId("research-analysis-block")).toHaveCount(2);

    const logCountBeforeDelete = await countQuizAttemptLogs(page);
    expect(logCountBeforeDelete).toBe(2);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "分析ブロックを削除" }).first().click();
    await expect(page.getByTestId("research-analysis-block")).toHaveCount(1);
    expect(await countQuizAttemptLogs(page)).toBe(2);
  });
});
