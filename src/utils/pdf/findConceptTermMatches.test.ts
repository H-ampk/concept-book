import { describe, expect, it } from "vitest";
import { buildPdfPageTextIndex } from "./buildPdfPageTextIndex";
import { rectSetsOverlap } from "./conceptTermMatchOverlap";
import { collectSearchableConceptTerms, findConceptTermMatches } from "./findConceptTermMatches";
import { mapTextMatchToRects } from "./mapTextMatchToRects";
import { isTooNoisyConceptTitle, toConceptSearchKey } from "./toConceptSearchKey";
import { createEmptyConceptInput, type Concept } from "../../types/concept";

const iso = "2026-01-01T00:00:00.000Z";

const concept = (id: string, title: string, extra?: Partial<Concept>): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title,
  createdAt: iso,
  updatedAt: iso,
  ...extra
});

const identityViewport = {
  width: 100,
  height: 100,
  convertToViewportPoint: (x: number, y: number) => [x, y] as [number, number]
};

describe("toConceptSearchKey", () => {
  it("英字caseと全角半角と空白を正規化する", () => {
    expect(toConceptSearchKey("  Reinforcement\n ")).toBe("reinforcement");
    expect(toConceptSearchKey("ＲＥＩＮＦＯＲＣＥ")).toBe("reinforce");
    expect(toConceptSearchKey("オペラント 条件づけ")).toBe("オペラント条件づけ");
  });
});

describe("isTooNoisyConceptTitle", () => {
  it("英数字1文字だけ除外し、日本語2文字や漢字1文字は残す", () => {
    expect(isTooNoisyConceptTitle("A")).toBe(true);
    expect(isTooNoisyConceptTitle("Ｒ")).toBe(true);
    expect(isTooNoisyConceptTitle("1")).toBe(true);
    expect(isTooNoisyConceptTitle("強化")).toBe(false);
    expect(isTooNoisyConceptTitle("木")).toBe(false);
  });
});

describe("findConceptTermMatches", () => {
  it("exact match / 日本語 / 0件", () => {
    const index = buildPdfPageTextIndex([{ str: "強化とは操作である", width: 80, height: 10, transform: [1, 0, 0, 1, 0, 10] }]);
    const terms = collectSearchableConceptTerms([concept("c1", "強化")]);
    const matches = findConceptTermMatches(index, terms);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.conceptId).toBe("c1");
    expect(findConceptTermMatches(index, collectSearchableConceptTerms([concept("c2", "消去")]))).toEqual([]);
  });

  it("英字caseと全角半角を吸収する", () => {
    const index = buildPdfPageTextIndex([{ str: "Reinforcement と Ｒ", width: 90, height: 10, transform: [1, 0, 0, 1, 0, 10] }]);
    const matches = findConceptTermMatches(index, collectSearchableConceptTerms([concept("c1", "reinforcement")]));
    expect(matches).toHaveLength(1);
  });

  it("text itemをまたぐConceptを検出する", () => {
    const index = buildPdfPageTextIndex([
      { str: "オペラント", width: 40, height: 10, transform: [1, 0, 0, 1, 0, 10] },
      { str: "条件づけ", width: 40, height: 10, transform: [1, 0, 0, 1, 40, 10] }
    ]);
    const matches = findConceptTermMatches(index, collectSearchableConceptTerms([concept("c1", "オペラント条件づけ")]));
    expect(matches).toHaveLength(1);
    expect(matches[0]?.rawStart).toBe(0);
    expect(matches[0]?.rawEnd).toBe(9);
  });

  it("同一Conceptの複数出現をすべて返す", () => {
    const index = buildPdfPageTextIndex([
      { str: "強化によって形成する。段階的な強化。", width: 120, height: 10, transform: [1, 0, 0, 1, 0, 10] }
    ]);
    const matches = findConceptTermMatches(index, collectSearchableConceptTerms([concept("c1", "強化")]));
    expect(matches).toHaveLength(2);
  });

  it("longest match first で内部の短い語を重ねない", () => {
    const index = buildPdfPageTextIndex([
      { str: "オペラント条件づけでは、条件づけも扱う", width: 160, height: 10, transform: [1, 0, 0, 1, 0, 10] }
    ]);
    const matches = findConceptTermMatches(
      index,
      collectSearchableConceptTerms([concept("a", "条件づけ"), concept("b", "オペラント条件づけ")])
    );
    expect(matches.map((m) => m.title)).toEqual(["オペラント条件づけ", "条件づけ"]);
    expect(matches[0]?.rawStart).toBe(0);
    expect(matches[1]?.rawStart).toBeGreaterThan(8);
  });

  it("同名Conceptは自動highlight対象から除外する", () => {
    const index = buildPdfPageTextIndex([{ str: "強化", width: 20, height: 10, transform: [1, 0, 0, 1, 0, 10] }]);
    const terms = collectSearchableConceptTerms([concept("c1", "強化"), concept("c2", "強化")]);
    expect(terms).toEqual([]);
    expect(findConceptTermMatches(index, terms)).toEqual([]);
  });
});

describe("mapTextMatchToRects / overlap", () => {
  it("item跨ぎmatchをrectsへ写す", () => {
    const index = buildPdfPageTextIndex([
      { str: "オペラント", width: 40, height: 10, transform: [1, 0, 0, 1, 0, 20] },
      { str: "条件づけ", width: 40, height: 10, transform: [1, 0, 0, 1, 40, 20] }
    ]);
    const match = findConceptTermMatches(index, collectSearchableConceptTerms([concept("c1", "オペラント条件づけ")]))[0];
    expect(match).toBeTruthy();
    const rects = mapTextMatchToRects(index, match!, identityViewport);
    expect(rects.length).toBe(2);
  });

  it("manual Anchorとの重複を判定する", () => {
    expect(
      rectSetsOverlap(
        [{ x: 0.1, y: 0.1, width: 0.2, height: 0.05 }],
        [{ x: 0.15, y: 0.11, width: 0.2, height: 0.05 }]
      )
    ).toBe(true);
    expect(
      rectSetsOverlap(
        [{ x: 0.1, y: 0.1, width: 0.1, height: 0.05 }],
        [{ x: 0.5, y: 0.5, width: 0.1, height: 0.05 }]
      )
    ).toBe(false);
  });
});
