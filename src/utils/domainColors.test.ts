import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  attachDomainColorsToBackup,
  extractBackupDomainColors,
  getDomainTagColor,
  getDomainTagColors,
  isHexColor,
  loadDomainColorMap,
  mergeDomainColorMaps,
  normalizeDomainColorMap,
  restoreDomainColorsFromBackup,
  saveDomainColorMap
} from "./domainColors";

const STORAGE_KEY = "concept-book-domain-colors";

const installLocalStorage = () => {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    }
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorage,
    configurable: true
  });
};

describe("normalizeDomainColorMap", () => {
  it("不正なカラー値を保存しない", () => {
    expect(
      normalizeDomainColorMap({
        人工知能: "#2563EB",
        哲学: "blue",
        無効: "#fff",
        "": "#000000",
        数字: 1
      })
    ).toEqual({ 人工知能: "#2563EB" });
  });

  it("オブジェクト以外は空マップにする", () => {
    expect(normalizeDomainColorMap("#2563EB")).toEqual({});
    expect(normalizeDomainColorMap(["#2563EB"])).toEqual({});
    expect(normalizeDomainColorMap(null)).toEqual({});
  });
});

describe("extractBackupDomainColors", () => {
  it("domainColors付きバックアップを正規化して読み込む", () => {
    expect(
      extractBackupDomainColors({
        concepts: [],
        domainColors: { 人工知能: "#2563EB", 哲学: "bad" }
      })
    ).toEqual({ 人工知能: "#2563EB" });
  });

  it("domainColorsなしの旧バックアップでは undefined を返す", () => {
    expect(extractBackupDomainColors({ concepts: [] })).toBeUndefined();
  });

  it("明示的な空オブジェクトは空マップとして扱う", () => {
    expect(extractBackupDomainColors({ concepts: [], domainColors: {} })).toEqual({});
  });
});

describe("mergeDomainColorMaps", () => {
  const current = { 人工知能: "#111111", 哲学: "#7C3AED" };
  const imported = { 人工知能: "#2563EB", 数学: "#0F766E" };

  it("replaceで現在のカラー設定を置換できる", () => {
    expect(mergeDomainColorMaps(current, imported, "replace")).toEqual(imported);
  });

  it("mergeで既存設定を維持しつつimport側を上書きできる", () => {
    expect(mergeDomainColorMaps(current, imported, "merge")).toEqual({
      人工知能: "#2563EB",
      哲学: "#7C3AED",
      数学: "#0F766E"
    });
  });

  it("domainColors: {} をreplaceすると設定を空にできる", () => {
    expect(mergeDomainColorMaps(current, {}, "replace")).toEqual({});
  });

  it("domainColors: {} をmergeすると現在の設定を維持する", () => {
    expect(mergeDomainColorMaps(current, {}, "merge")).toEqual(current);
  });
});

describe("JSON export payload", () => {
  it("JSON exportにdomainColorsが含まれる", () => {
    const payload = attachDomainColorsToBackup(
      { concepts: [], contextCards: [], quizQuestions: [], quizDecks: [] },
      { 人工知能: "#2563EB" }
    );
    expect(payload.domainColors).toEqual({ 人工知能: "#2563EB" });
  });
});

describe("getDomainTagColors", () => {
  const map = {
    AI: "#111111",
    HCI: "#222222",
    教育: "#333333",
    心理: "#444444",
    社会科学: "#555555"
  };

  it("0件は空配列を返す（UI側fallbackとは責務を分ける）", () => {
    expect(getDomainTagColors([], map)).toEqual([]);
  });

  it("1件は1色", () => {
    expect(getDomainTagColors(["AI"], map)).toEqual(["#111111"]);
  });

  it("2件は2色", () => {
    expect(getDomainTagColors(["AI", "教育"], map)).toHaveLength(2);
    expect(getDomainTagColors(["AI", "教育"], map)).toEqual(
      ["AI", "教育"].sort((a, b) => a.localeCompare(b, "ja")).map((tag) => map[tag])
    );
  });

  it("4件は4色", () => {
    expect(getDomainTagColors(["AI", "HCI", "教育", "心理"], map)).toHaveLength(4);
  });

  it("5件以上は最大4色", () => {
    expect(getDomainTagColors(["AI", "教育", "心理", "HCI", "社会科学"], map)).toHaveLength(4);
  });

  it("入力順が違っても ja localeCompare で同じ色配列になる", () => {
    const a = getDomainTagColors(["AI", "教育", "HCI"], map);
    const b = getDomainTagColors(["HCI", "AI", "教育"], map);
    const expected = ["AI", "HCI", "教育"].map((tag) => map[tag]);
    expect(a).toEqual(expected);
    expect(b).toEqual(expected);
  });

  it("重複タグは表示対象だけ除去してから sort / slice する", () => {
    const colors = getDomainTagColors(["AI", "AI", "教育"], map);
    expect(colors).toEqual(
      ["AI", "教育"].sort((a, b) => a.localeCompare(b, "ja")).map((tag) => map[tag])
    );
    const original = ["AI", "AI", "教育"];
    getDomainTagColors(original, map);
    expect(original).toEqual(["AI", "AI", "教育"]);
  });

  it("未登録タグでも #RRGGBB の string を返し undefined にしない", () => {
    const colors = getDomainTagColors(["未登録タグXYZ"], {});
    expect(colors).toHaveLength(1);
    expect(colors[0]).toBeTypeOf("string");
    expect(colors[0]).toBeDefined();
    expect(isHexColor(colors[0]!)).toBe(true);
    expect(colors[0]).toBe(getDomainTagColor("未登録タグXYZ", {}));
  });
});

describe("restoreDomainColorsFromBackup", () => {
  beforeEach(() => {
    installLocalStorage();
    saveDomainColorMap({ 哲学: "#7C3AED" });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("フィールドが無い場合は現在のカラー設定を変更しない", () => {
    expect(restoreDomainColorsFromBackup(undefined, "replace")).toBeUndefined();
    expect(loadDomainColorMap()).toEqual({ 哲学: "#7C3AED" });
  });

  it("import直後にloadDomainColorMapで反映される", () => {
    restoreDomainColorsFromBackup({ 人工知能: "#2563EB" }, "replace");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toEqual({
      人工知能: "#2563EB"
    });
    expect(loadDomainColorMap()).toEqual({ 人工知能: "#2563EB" });
  });
});
