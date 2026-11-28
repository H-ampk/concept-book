import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { DATASET_PRESETS, type SyntheticDatasetSpec } from "../src/perf/datasetSpec";
import {
  generateSyntheticDataset,
  type SyntheticDataset
} from "../src/perf/generateSyntheticDataset";
import { summarizeSamples, unmeasured, type Metric } from "../src/perf/summarizeSamples";
import {
  datasetToFingerprintInput,
  fingerprintPayload,
  firstFingerprintMismatch,
  type FingerprintInput
} from "../src/perf/datasetFingerprint";
import { mergeLongTasks, selectLongTasks } from "../src/perf/longTaskWindow";
import {
  hasMeasuredSourceCommit,
  sourceContentDiffersFromHead
} from "../src/perf/measurementSource";
import {
  STARTUP_LEARNING_MODEL_NAMES,
  learningModelsCoverLatestLogRead
} from "../src/perf/startupLearningModels";

const DB_NAME = "concept-book-db";
const RESULTS_DIR = path.resolve(process.env.PERF_RESULTS_DIR ?? "docs/perf/results");

type StartupSample = {
  ms: number;
  domElements: number;
  longTaskCount: number;
  longTaskMs: number;
  idbCalls: number;
  idbMs: number;
  idbRecords: number;
  modelCalls: number;
  modelMs: number;
};

const installObservers = (): void => {
  const host = window as unknown as {
    __CB_PERF_PROBE__: { idb: unknown[]; models: unknown[]; nextSeq: number };
    __longTasks: Array<{ startTime: number; duration: number }>;
    __appReadyAt: number | null;
    __startupProbeCounts: { idb: number; models: number } | null;
    __longTaskObserver: PerformanceObserver | null;
  };
  host.__CB_PERF_PROBE__ = { idb: [], models: [], nextSeq: 0 };
  host.__longTasks = [];
  host.__appReadyAt = null;
  host.__startupProbeCounts = null;
  host.__longTaskObserver = null;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const task = { startTime: entry.startTime, duration: entry.duration };
        const key = `${task.startTime}:${task.duration}`;
        if (host.__longTasks.some((existing) => `${existing.startTime}:${existing.duration}` === key)) {
          continue;
        }
        host.__longTasks.push(task);
      }
    });
    observer.observe({ type: "longtask", buffered: true });
    host.__longTaskObserver = observer;
  } catch {
    host.__longTasks = [];
    host.__longTaskObserver = null;
  }
  const markReady = (): void => {
    if (host.__appReadyAt != null) {
      return;
    }
    const button = [...document.querySelectorAll("button")].find(
      (element) => element.textContent?.trim() === "概念を追加"
    );
    const idb = host.__CB_PERF_PROBE__.idb as Array<{ store: string; seq: number }>;
    const models = host.__CB_PERF_PROBE__.models as Array<{ name: string; seq: number }>;
    const stores = new Set(idb.map((sample) => sample.store));
    const learningModelsReady = learningModelsCoverLatestLogRead(idb, models);
    if (
      button instanceof HTMLButtonElement &&
      !button.disabled &&
      stores.has("concepts") &&
      stores.has("quizQuestions") &&
      stores.has("quizAttemptLogs") &&
      learningModelsReady
    ) {
      host.__appReadyAt = performance.now();
      host.__startupProbeCounts = {
        idb: host.__CB_PERF_PROBE__.idb.length,
        models: host.__CB_PERF_PROBE__.models.length
      };
    }
  };
  const mutation = new MutationObserver(markReady);
  const watch = (): void => {
    markReady();
    if (host.__appReadyAt == null) {
      requestAnimationFrame(watch);
    }
  };
  const start = (): void => {
    mutation.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true
    });
    watch();
  };
  if (document.documentElement) {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start);
  }
};

const resetProbe = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const host = window as unknown as {
      __CB_PERF_PROBE__: { idb: unknown[]; models: unknown[]; nextSeq: number };
      __longTasks: Array<{ startTime: number; duration: number }>;
      __appReadyAt: number | null;
      __startupProbeCounts: { idb: number; models: number } | null;
    };
    host.__CB_PERF_PROBE__ = { idb: [], models: [], nextSeq: 0 };
    host.__longTasks = [];
    host.__appReadyAt = null;
    host.__startupProbeCounts = null;
  });
};

const readStartup = async (page: Page): Promise<StartupSample> => {
  const raw = await page.evaluate(() => {
    const host = window as unknown as {
      __CB_PERF_PROBE__: { idb: Array<{ count: number; ms: number }>; models: Array<{ ms: number }> };
      __longTasks: Array<{ startTime: number; duration: number }>;
      __appReadyAt: number | null;
      __startupProbeCounts: { idb: number; models: number } | null;
      __longTaskObserver: { takeRecords: () => Array<{ startTime: number; duration: number }> } | null;
    };
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const start = navigation?.startTime ?? 0;
    const ready = host.__appReadyAt;
    const counts = host.__startupProbeCounts;
    if (ready == null || counts == null) {
      throw new Error("起動完了時点が記録されていません。");
    }
    const idb = host.__CB_PERF_PROBE__.idb.slice(0, counts.idb);
    const models = host.__CB_PERF_PROBE__.models.slice(0, counts.models);
    const pending = host.__longTaskObserver?.takeRecords() ?? [];
    return {
      ms: ready - start,
      windowStart: start,
      windowEnd: ready,
      domElements: document.getElementsByTagName("*").length,
      longTasks: host.__longTasks,
      pendingLongTasks: pending.map((entry) => ({ startTime: entry.startTime, duration: entry.duration })),
      idbCalls: idb.length,
      idbMs: idb.reduce((sum, sample) => sum + sample.ms, 0),
      idbRecords: idb.reduce((sum, sample) => sum + sample.count, 0),
      modelCalls: models.length,
      modelMs: models.reduce((sum, sample) => sum + sample.ms, 0)
    };
  });
  const longTasks = selectLongTasks(
    mergeLongTasks(raw.longTasks, raw.pendingLongTasks),
    raw.windowStart,
    raw.windowEnd
  );
  return {
    ms: raw.ms,
    domElements: raw.domElements,
    longTaskCount: longTasks.length,
    longTaskMs: longTasks.reduce((sum, task) => sum + task.duration, 0),
    idbCalls: raw.idbCalls,
    idbMs: raw.idbMs,
    idbRecords: raw.idbRecords,
    modelCalls: raw.modelCalls,
    modelMs: raw.modelMs
  };
};

const waitUntilReady = async (page: Page): Promise<void> => {
  await page.waitForFunction(
    () => (window as unknown as { __appReadyAt: number | null }).__appReadyAt != null,
    undefined,
    { timeout: 180_000 }
  );
};

const seedDataset = async (page: Page, dataset: SyntheticDataset): Promise<void> => {
  const chunkSize = 500;
  const putChunk = async (store: string, records: unknown[]): Promise<void> => {
    for (let offset = 0; offset < records.length; offset += chunkSize) {
      const chunk = records.slice(offset, offset + chunkSize);
      await page.evaluate(
        async ({ dbName, storeName, rows }) => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(dbName);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
          });
          try {
            await new Promise<void>((resolve, reject) => {
              const tx = db.transaction(storeName, "readwrite");
              const objectStore = tx.objectStore(storeName);
              for (const row of rows) {
                objectStore.put(row);
              }
              let settled = false;
              tx.oncomplete = () => {
                if (settled) {
                  return;
                }
                settled = true;
                resolve();
              };
              const fail = () => {
                if (settled) {
                  return;
                }
                settled = true;
                reject(tx.error ?? new Error("IndexedDB transaction aborted"));
              };
              tx.onerror = fail;
              tx.onabort = fail;
            });
          } finally {
            db.close();
          }
        },
        { dbName: DB_NAME, storeName: store, rows: chunk }
      );
    }
  };

  await putChunk("concepts", dataset.concepts);
  await putChunk("contextCards", dataset.contextCards);
  await putChunk("quizQuestions", dataset.quizQuestions);
  await putChunk("quizAttemptLogs", dataset.quizAttemptLogs);
  if (dataset.attachment) {
    await page.evaluate(
      async ({ dbName, material, byteLength, prefix }) => {
        const bytes = new Uint8Array(byteLength);
        prefix.forEach((value, index) => {
          bytes[index] = value;
        });
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(dbName);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        try {
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(["learningMaterials", "learningMaterialBlobs"], "readwrite");
            tx.objectStore("learningMaterials").put(material);
            tx.objectStore("learningMaterialBlobs").put({
              id: material.id,
              blob: new Blob([bytes], { type: "application/pdf" })
            });
            let settled = false;
            tx.oncomplete = () => {
              if (settled) {
                return;
              }
              settled = true;
              resolve();
            };
            const fail = () => {
              if (settled) {
                return;
              }
              settled = true;
              reject(tx.error ?? new Error("IndexedDB transaction aborted"));
            };
            tx.onerror = fail;
            tx.onabort = fail;
          });
        } finally {
          db.close();
        }
      },
      {
        dbName: DB_NAME,
        material: dataset.attachment.material,
        byteLength: dataset.attachment.byteLength,
        prefix: dataset.attachment.prefix
      }
    );
  }
};

const readCounts = async (page: Page): Promise<Record<string, number>> => {
  return page.evaluate(async (dbName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const names = ["concepts", "contextCards", "quizQuestions", "quizAttemptLogs", "learningMaterials"] as const;
    const counts: Record<string, number> = {};
    for (const name of names) {
      counts[name] = await new Promise<number>((resolve, reject) => {
        const tx = db.transaction(name, "readonly");
        const request = tx.objectStore(name).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    db.close();
    return counts;
  }, DB_NAME);
};

const STORES_TO_CLEAR = [
  "concepts",
  "contextCards",
  "quizQuestions",
  "quizAttemptLogs",
  "learningMaterials",
  "learningMaterialBlobs",
  "media",
  "conceptSourceAnchors",
  "quizDecks",
  "researchReports",
  "vocabularyBooks",
  "syncQueue",
  "syncState"
] as const;

const clearSyntheticStores = async (page: Page): Promise<void> => {
  await page.evaluate(
    async ({ dbName, stores }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(stores, "readwrite");
          for (const store of stores) {
            tx.objectStore(store).clear();
          }
          let settled = false;
          tx.oncomplete = () => {
            if (settled) {
              return;
            }
            settled = true;
            resolve();
          };
          const fail = () => {
            if (settled) {
              return;
            }
            settled = true;
            reject(tx.error ?? new Error("IndexedDB transaction aborted"));
          };
          tx.onerror = fail;
          tx.onabort = fail;
        });
      } finally {
        db.close();
      }
    },
    { dbName: DB_NAME, stores: STORES_TO_CLEAR }
  );
};

const readFingerprintInput = async (page: Page): Promise<FingerprintInput> => {
  return page.evaluate(async (dbName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const getAll = (storeName: string) =>
      new Promise<unknown[]>((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result as unknown[]);
        request.onerror = () => reject(request.error);
      });
    const count = (storeName: string) =>
      new Promise<number>((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const emptyStoreNames = [
      "media",
      "conceptSourceAnchors",
      "quizDecks",
      "researchReports",
      "vocabularyBooks",
      "learningMaterialBlobs",
      "syncQueue",
      "syncState"
    ];
    const emptyStores: Record<string, number> = {};
    for (const storeName of emptyStoreNames) {
      emptyStores[storeName] = await count(storeName);
    }
    const payload = {
      concepts: (await getAll("concepts")) as FingerprintInput["concepts"],
      contextCards: (await getAll("contextCards")) as FingerprintInput["contextCards"],
      quizQuestions: (await getAll("quizQuestions")) as FingerprintInput["quizQuestions"],
      quizAttemptLogs: (await getAll("quizAttemptLogs")) as FingerprintInput["quizAttemptLogs"],
      learningMaterials: (await getAll("learningMaterials")) as FingerprintInput["learningMaterials"],
      emptyStores
    };
    db.close();
    return payload;
  }, DB_NAME);
};

const assertDatasetRestored = async (page: Page, dataset: SyntheticDataset): Promise<void> => {
  const actual = fingerprintPayload(await readFingerprintInput(page));
  const expected = fingerprintPayload(datasetToFingerprintInput(dataset));
  const mismatch = firstFingerprintMismatch(expected, actual);
  if (mismatch) {
    throw new Error(`試行開始前の IndexedDB が合成データと一致しません: ${mismatch}`);
  }
};

const restoreDataset = async (page: Page, dataset: SyntheticDataset): Promise<void> => {
  await clearSyntheticStores(page);
  await seedDataset(page, dataset);
};

const SOURCE_PATHS = ["src", "perf", "playwright.perf.config.ts", "package.json", "vite.config.js"];

const describeMeasuredSource = (): Record<string, unknown> => {
  const commit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  const tree = execSync("git log -1 --format=%T", { encoding: "utf8" }).trim();
  const paths = SOURCE_PATHS.join(" ");
  const status = execSync(`git status --porcelain -- ${paths}`, { encoding: "utf8" }).trim();
  const diff = execSync(`git diff HEAD --numstat --ignore-cr-at-eol -- ${paths}`, { encoding: "utf8" }).trim();
  const rawDiff = execSync(`git diff HEAD --numstat -- ${paths}`, { encoding: "utf8" }).trim();
  const untracked = execSync(`git ls-files --others --exclude-standard -- ${paths}`, {
    encoding: "utf8"
  }).trim();
  if (sourceContentDiffersFromHead({ diff, rawDiff, untracked })) {
    throw new Error(`計測対象に HEAD と異なる変更があります。\n${diff || rawDiff || untracked}`);
  }
  return {
    measuredSourceCommit: commit,
    measuredSourceTree: tree,
    contentMatchesHead: true,
    resultsCommit: null,
    note: "measuredSourceCommit と measuredSourceTree は計測したソースである。contentMatchesHead が true のとき、計測対象パスの git diff HEAD と未追跡ファイルは空で、その commit のツリーと内容が一致する。status 表示だけでは失敗させない。結果 JSON を記録する commit は後の別 commit であり、resultsCommit には入れない。",
    uncommittedContentDiff: null,
    uncommittedStatus: status || null
  };
};

const archiveLegacyResult = (name: string): void => {
  const file = path.join(RESULTS_DIR, name);
  if (!existsSync(file)) {
    return;
  }
  const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
  if (hasMeasuredSourceCommit(parsed)) {
    return;
  }
  const dir = path.join(RESULTS_DIR, "superseded");
  mkdirSync(dir, { recursive: true });
  renameSync(file, path.join(dir, name));
};

const clearHttpCache = async (page: Page): Promise<void> => {
  const client = await page.context().newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.clearBrowserCache");
  await client.detach();
};

const loadCold = async (page: Page): Promise<StartupSample> => {
  await resetProbe(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitUntilReady(page);
  return readStartup(page);
};

const loadWarm = async (page: Page): Promise<StartupSample> => {
  await resetProbe(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitUntilReady(page);
  return readStartup(page);
};

const timeUntil = async (page: Page, action: () => Promise<void>, ready: () => Promise<void>): Promise<number> => {
  await page.evaluate(() => {
    (window as unknown as { __mark: number }).__mark = performance.now();
  });
  await action();
  await ready();
  return page.evaluate(() => performance.now() - (window as unknown as { __mark: number }).__mark);
};

const openConcepts = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "概念", exact: true }).click();
  await page.getByPlaceholder("タイトル・定義・解釈・分野タグ・研究テーマタグ・メモを検索").waitFor();
};

const measureScreens = async (page: Page): Promise<Record<string, number>> => {
  const screens: Record<string, number> = {};
  screens.contexts = await timeUntil(
    page,
    () => page.getByRole("button", { name: "文脈", exact: true }).click(),
    () => page.getByRole("heading", { name: "文脈カード", exact: true }).waitFor()
  );
  screens.vocabulary = await timeUntil(
    page,
    () => page.getByRole("button", { name: "単語帳", exact: true }).click(),
    () => page.getByRole("heading", { name: "単語帳", exact: true }).waitFor()
  );
  screens.settings = await timeUntil(
    page,
    () => page.getByRole("button", { name: "設定", exact: true }).click(),
    () => page.getByRole("heading", { name: "設定", exact: true }).waitFor()
  );
  screens.guide = await timeUntil(
    page,
    () => page.getByRole("button", { name: "ConceptBook の使い方", exact: true }).click(),
    () => page.getByRole("heading", { name: "ConceptBook の使い方", exact: true }).waitFor()
  );
  screens.dataLab = await timeUntil(
    page,
    async () => {
      await page.getByRole("button", { name: "Lab", exact: true }).click();
      await page.getByRole("menuitem", { name: /Data Lab/ }).click();
    },
    () => page.locator("#data-lab-title").waitFor()
  );
  screens.concepts = await timeUntil(
    page,
    () => page.getByRole("button", { name: "概念", exact: true }).click(),
    () => page.getByPlaceholder("タイトル・定義・解釈・分野タグ・研究テーマタグ・メモを検索").waitFor()
  );
  return screens;
};

const measureSearch = async (page: Page): Promise<number> => {
  const input = page.getByPlaceholder("タイトル・定義・解釈・分野タグ・研究テーマタグ・メモを検索");
  await input.fill("");
  await page.waitForFunction(() => document.querySelectorAll("[data-testid^='concept-list-item-']").length > 1);
  return timeUntil(
    page,
    () => input.fill("perfprobe-alpha"),
    () =>
      page.waitForFunction(() => {
        const items = [...document.querySelectorAll("[data-testid^='concept-list-item-']")];
        return items.length === 1 && (items[0]?.textContent ?? "").includes("perfprobe-alpha");
      })
  );
};

const measureCrud = async (
  page: Page,
  deleteTarget: SyntheticDataset["concepts"][number]
): Promise<{ create: number; edit: number; delete: number }> => {
  await page.getByRole("button", { name: "概念を追加", exact: true }).click();
  await page.getByRole("heading", { name: "新しい概念" }).waitFor();
  await page.locator("form").getByRole("textbox").first().fill(`perf-created-${Date.now()}`);
  const create = await timeUntil(
    page,
    () => page.getByRole("button", { name: "保存", exact: true }).click(),
    () => page.getByRole("heading", { name: "新しい概念" }).waitFor({ state: "hidden" })
  );

  const input = page.getByPlaceholder("タイトル・定義・解釈・分野タグ・研究テーマタグ・メモを検索");
  await input.fill("PERF-EDIT-TARGET");
  await page.getByText("PERF-EDIT-TARGET").first().click();
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await page.locator("form").getByRole("textbox").first().fill("PERF-EDIT-TARGET-UPDATED");
  const edit = await timeUntil(
    page,
    () => page.getByRole("button", { name: "保存", exact: true }).click(),
    () => page.getByRole("heading", { name: "概念を編集" }).waitFor({ state: "hidden" })
  );
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await page.locator("form").getByRole("textbox").first().fill("PERF-EDIT-TARGET");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("heading", { name: "概念を編集" }).waitFor({ state: "hidden" });

  await input.fill("PERF-DELETE-TARGET");
  await page.getByText("PERF-DELETE-TARGET").first().click();
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.getByRole("heading", { name: "この概念を削除しますか？" }).waitFor();
  const remove = await timeUntil(
    page,
    () => page.getByRole("button", { name: "削除", exact: true }).last().click(),
    () => page.getByText("PERF-DELETE-TARGET").first().waitFor({ state: "hidden" })
  );
  await page.evaluate(
    async ({ dbName, concept }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction("concepts", "readwrite");
          tx.objectStore("concepts").put(concept);
          let settled = false;
          tx.oncomplete = () => {
            if (settled) {
              return;
            }
            settled = true;
            resolve();
          };
          const fail = () => {
            if (settled) {
              return;
            }
            settled = true;
            reject(tx.error ?? new Error("IndexedDB transaction aborted"));
          };
          tx.onerror = fail;
          tx.onabort = fail;
        });
      } finally {
        db.close();
      }
    },
    { dbName: DB_NAME, concept: deleteTarget }
  );
  return { create, edit, delete: remove };
};

const bundleMetrics = (): { initialBytes: number; lazyBytes: number; files: Array<{ file: string; bytes: number; initial: boolean }> } => {
  const indexHtml = readFileSync(path.resolve("dist/index.html"), "utf8");
  const initial = new Set<string>();
  for (const match of indexHtml.matchAll(/(?:src|href)="(?:\.\/|\/)?(assets\/[^"]+\.js)"/g)) {
    initial.add(match[1]!);
  }
  const assetDir = path.resolve("dist/assets");
  const files = readdirSync(assetDir)
    .filter((file) => file.endsWith(".js"))
    .map((file) => {
      const rel = `assets/${file}`;
      return {
        file: rel,
        bytes: statSync(path.join(assetDir, file)).size,
        initial: initial.has(rel)
      };
    });
  return {
    initialBytes: files.filter((file) => file.initial).reduce((sum, file) => sum + file.bytes, 0),
    lazyBytes: files.filter((file) => !file.initial).reduce((sum, file) => sum + file.bytes, 0),
    files
  };
};

const metricFrom = (values: number[], unit: string): Metric =>
  values.length > 0 ? summarizeSamples(values, unit) : unmeasured("測定値がありません。");

const writeResult = (name: string, value: unknown): void => {
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(path.join(RESULTS_DIR, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

test.describe.configure({ mode: "serial" });

test("本番ビルドの専用コンテキストで S と M のベースラインを記録する", async ({ browser }) => {
  test.setTimeout(45 * 60 * 1000);
  const source = describeMeasuredSource();
  for (const name of ["S.json", "M.json", "L.json", "XL.json", "bundle.json", "environment.json"]) {
    archiveLegacyResult(name);
  }
  const browserVersion = browser.version();
  const environment = {
    ...source,
    measuredAt: new Date().toISOString(),
    os: `${os.type()} ${os.release()}`,
    cpu: os.cpus()[0]?.model ?? "unknown",
    cpuCores: os.cpus().length,
    memoryBytes: os.totalmem(),
    browser: `Chromium ${browserVersion}`,
    build: "vite build + vite preview（本番モード。React Profiler ビルドではない）"
  };
  writeResult("environment.json", environment);
  writeResult("bundle.json", {
    ...environment,
    ...bundleMetrics(),
    unit: "bytes",
    note: "この bundle.json は measuredSourceCommit の本番ビルドから集計した。比較に使う初期チャンクはここを参照する。"
  });

  for (const spec of [DATASET_PRESETS.S, DATASET_PRESETS.M]) {
    const result = await measureSpec(browser, spec, environment, {
      warmup: 1,
      trials: spec.id === "S" ? 5 : 3,
      interactions: 3
    });
    writeResult(`${spec.id}.json`, result);
  }

  writeResult("XL.json", {
    ...source,
    status: "not-run",
    reason:
      "XL は L を基準に概念数・ログ数・添付容量を増やすストレステストである。この実行では時間の都合で未実施。回帰比較には使わない。"
  });
});

test("L を 1 試行で記録できるか試す", async ({ browser }) => {
  test.setTimeout(20 * 60 * 1000);
  const source = describeMeasuredSource();
  const environment = {
    ...source,
    measuredAt: new Date().toISOString(),
    os: `${os.type()} ${os.release()}`,
    cpu: os.cpus()[0]?.model ?? "unknown",
    cpuCores: os.cpus().length,
    memoryBytes: os.totalmem(),
    browser: `Chromium ${browser.version()}`,
    build: "vite build + vite preview（本番モード。React Profiler ビルドではない）"
  };
  try {
    const result = await measureSpec(browser, DATASET_PRESETS.L, environment, {
      warmup: 0,
      trials: 1,
      interactions: 0
    });
    writeResult("L.json", result);
  } catch (error) {
    writeResult("L.json", {
      status: "not-run",
      reason: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
});

const measureSpec = async (
  browser: Browser,
  spec: SyntheticDatasetSpec,
  environment: Record<string, unknown>,
  plan: { warmup: number; trials: number; interactions: number }
): Promise<unknown> => {
  const dataset = generateSyntheticDataset(spec);
  const cold: StartupSample[] = [];
  const warm: StartupSample[] = [];
  const screens: Record<string, number[]> = {};
  const search: number[] = [];
  const crud = { create: [] as number[], edit: [] as number[], delete: [] as number[] };
  let memory: Metric = unmeasured(
    "performance.measureUserAgentSpecificMemory がこのオリジンでは利用できない。"
  );
  let verifiedCounts: Record<string, number> | null = null;

  for (let index = 0; index < plan.warmup + plan.trials; index += 1) {
    const recorded = index >= plan.warmup;
    console.log(`[perf] ${spec.id} trial ${index + 1}/${plan.warmup + plan.trials} recorded=${recorded}`);
    const context = await browser.newContext();
    try {
    const page = await context.newPage();
    await page.addInitScript({
      content: [
        `const STARTUP_LEARNING_MODEL_NAMES = ${JSON.stringify([...STARTUP_LEARNING_MODEL_NAMES])};`,
        `const learningModelsCoverLatestLogRead = ${learningModelsCoverLatestLogRead.toString()};`,
        `(${installObservers.toString()})();`
      ].join("\n")
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitUntilReady(page);
    await seedDataset(page, dataset);
    verifiedCounts = await readCounts(page);
    expect(verifiedCounts.concepts).toBe(spec.conceptCount);
    expect(verifiedCounts.quizAttemptLogs).toBe(spec.logCount);
    expect(verifiedCounts.quizQuestions).toBe(spec.quizCount);
    expect(verifiedCounts.contextCards).toBe(spec.contextCount);
    await assertDatasetRestored(page, dataset);
    await clearHttpCache(page);
    await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker?.getRegistrations();
      if (registrations) {
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    });
    const coldSample = await loadCold(page);
    await assertDatasetRestored(page, dataset);
    const warmSample = await loadWarm(page);
    if (recorded) {
      cold.push(coldSample);
      warm.push(warmSample);
    }
    if (recorded && plan.interactions > 0 && index === plan.warmup + plan.trials - 1) {
      for (let interaction = 0; interaction < plan.interactions; interaction += 1) {
        await assertDatasetRestored(page, dataset);
        await openConcepts(page);
        const screenSample = await measureScreens(page);
        for (const [name, value] of Object.entries(screenSample)) {
          screens[name] ??= [];
          screens[name].push(value);
        }
        await openConcepts(page);
        search.push(await measureSearch(page));
        const crudSample = await measureCrud(page, dataset.concepts[2]!);
        crud.create.push(crudSample.create);
        crud.edit.push(crudSample.edit);
        crud.delete.push(crudSample.delete);
        await restoreDataset(page, dataset);
        await page.reload({ waitUntil: "domcontentloaded" });
        await waitUntilReady(page);
      }
      const memoryResult = await page.evaluate(async () => {
        const performanceWithMemory = performance as Performance & {
          measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
        };
        if (typeof performanceWithMemory.measureUserAgentSpecificMemory !== "function") {
          return { status: "unmeasured" as const, reason: "performance.measureUserAgentSpecificMemory が存在しない。" };
        }
        try {
          const reading = await performanceWithMemory.measureUserAgentSpecificMemory();
          return { status: "measured" as const, bytes: reading.bytes };
        } catch (error) {
          return {
            status: "unmeasured" as const,
            reason: error instanceof Error ? error.message : "measureUserAgentSpecificMemory が拒否された。"
          };
        }
      });
      memory =
        memoryResult.status === "measured"
          ? summarizeSamples([memoryResult.bytes], "bytes")
          : unmeasured(memoryResult.reason);
    }
    } finally {
      await context.close();
    }
  }

  const startupMetric = (samples: StartupSample[], pick: (sample: StartupSample) => number, unit: string): Metric =>
    metricFrom(samples.map(pick), unit);

  return {
    schemaVersion: 1,
    purpose: "phase-0-baseline",
    p95: unmeasured("試行数が 20 未満のため p95 は記録しない。"),
    dataset: dataset.spec,
    counts: dataset.counts,
    verifiedIndexedDbCounts: verifiedCounts,
    seed: spec.seed,
    warmup: plan.warmup,
    trials: plan.trials,
    interactionTrials: plan.interactions,
    conditions: {
      cold:
        "専用コンテキストで合成データを投入したあと、HTTP キャッシュを消してから最初の document 再読み込み。IndexedDB の合成データは残す。ウォームアップ試行は集計しない。",
      warm:
        "同じコンテキストで、コールド計測の直後に reload した document。HTTP キャッシュと IndexedDB を保持する。",
      startup:
        "navigation startTime から、ボタン「概念を追加」が有効で、concepts、quizQuestions、quizAttemptLogs の読み取りがそれぞれ 1 回以上記録され、最新の quizAttemptLogs 読み取りより大きい連番で BKT・クイズ統計・混同ペアの計算が各 1 回以上完了した最初の performance.now() まで。順序は performance.now() ではなくプローブの単調増加連番で判定する。同じ時刻でも読み取り前の計算は含めず、読み取り後の計算は含める。所要時間は performance.now() の差分である。その時点の idb と models の件数だけを起動集計に使う。ログ読み取りが無い状態の modelCalls 0 は完了としない。準備完了後に増えた試料は含めない。",
      navigation:
        "ページ内の performance.now() で、操作開始直前から遷移先の見出しが表示されるまで。検索の 200ms デバウンスは製品の待ち時間として検索指標に含まれる。",
      crud:
        "保存または削除確定の操作から、ダイアログが閉じるか削除対象が一覧から消えるまで。各試行のあと、追加概念を削除し、概念・クイズ・文脈カードを合成データで put し直してから reload する。削除が隣接概念と参照先問題を書き換えるため、対象概念だけの put では次の試行の状態が揃わない。",
      excluded: "データ生成と IndexedDB への投入時間は操作時間に含めない。"
    },
    units: {
      time: "ms",
      bytes: "bytes",
      count: "count"
    },
    startup: {
      cold: startupMetric(cold, (sample) => sample.ms, "ms"),
      warm: startupMetric(warm, (sample) => sample.ms, "ms")
    },
    screens: Object.fromEntries(Object.entries(screens).map(([name, values]) => [name, metricFrom(values, "ms")])),
    search: metricFrom(search, "ms"),
    crud: {
      create: metricFrom(crud.create, "ms"),
      edit: metricFrom(crud.edit, "ms"),
      delete: metricFrom(crud.delete, "ms")
    },
    indexedDb: {
      cold: {
        calls: startupMetric(cold, (sample) => sample.idbCalls, "count"),
        duration: startupMetric(cold, (sample) => sample.idbMs, "ms"),
        records: startupMetric(cold, (sample) => sample.idbRecords, "count")
      },
      warm: {
        calls: startupMetric(warm, (sample) => sample.idbCalls, "count"),
        duration: startupMetric(warm, (sample) => sample.idbMs, "ms"),
        records: startupMetric(warm, (sample) => sample.idbRecords, "count")
      },
      note: "duration は各読み取りの所要時間の合計であり、並行する読み取りでは壁時計時間より長くなる。getAllConcepts / getQuizQuestions / getQuizAttemptLogs の本番経路に、プローブがあるときだけ記録を足している。プローブが無いときは performance.now() を呼ばず、従来どおりの処理だけを行う。"
    },
    learningModel: {
      cold: {
        calls: startupMetric(cold, (sample) => sample.modelCalls, "count"),
        duration: startupMetric(cold, (sample) => sample.modelMs, "ms")
      },
      warm: {
        calls: startupMetric(warm, (sample) => sample.modelCalls, "count"),
        duration: startupMetric(warm, (sample) => sample.modelMs, "ms")
      },
      note: "BKT mastery map、クイズ統計、混同ペアの既存関数を計時している。計算式は変えていない。Data Lab 固有の追加モデルはこの起動区間には含まれない。"
    },
    react: unmeasured(
      "通常の本番ビルドには React Profiler が含まれない。profiling ビルドの描画時間は、この本番ビルドの起動時間やバンドルサイズと比較しない。"
    ),
    domElements: {
      cold: startupMetric(cold, (sample) => sample.domElements, "count"),
      warm: startupMetric(warm, (sample) => sample.domElements, "count")
    },
    longTasks: {
      window: "navigation startTime 以上、起動完了の performance.now() 未満に開始した longtask だけを合計する。",
      cold: {
        count: startupMetric(cold, (sample) => sample.longTaskCount, "count"),
        duration: startupMetric(cold, (sample) => sample.longTaskMs, "ms")
      },
      warm: {
        count: startupMetric(warm, (sample) => sample.longTaskCount, "count"),
        duration: startupMetric(warm, (sample) => sample.longTaskMs, "ms")
      }
    },
    memory,
    bundle: unmeasured("バンドルサイズはデータセットに依存しないため bundle.json に記録する。"),
    trialsRaw: { cold, warm },
    environment
  };
};
