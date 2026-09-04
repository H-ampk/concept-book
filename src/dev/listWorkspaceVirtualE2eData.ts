import { createEmptyConceptInput, type Concept } from "../types/concept";

export const VIRTUAL_LIST_E2E_COUNT = 140;
export const VIRTUAL_LIST_QUERY_A = "フィードバック";
export const VIRTUAL_LIST_QUERY_B = "再配置確認";

export const VIRTUAL_LIST_E2E_IDS = {
  first: "e2e-concept-000",
  last: "e2e-concept-139",
  titleHit: "e2e-concept-000",
  contextSnippet: "e2e-concept-001",
  longSnippet: "e2e-concept-002",
  tagHit: "e2e-concept-003",
  offscreen: "e2e-concept-080",
  missing: "e2e-concept-missing"
} as const;

const LONG_CONTEXT_DEFINITION =
  "学習者へのフィードバック設計に応用できる。評価指標の定義、介入タイミング、誤答時の説明粒度、次の課題提示まで一連の流れを長く記述して複数行の検索スニペットを発生させるための文脈別定義本文です。";

const padId = (index: number): string => `e2e-concept-${String(index).padStart(3, "0")}`;

const baseConcept = (id: string, overrides: Partial<Concept>): Concept => ({
  ...createEmptyConceptInput(),
  id,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  status: "active",
  ...overrides
});

/**
 * 検索語A「フィードバック」で title / context snippet / long snippet / tag が周期的に混在する。
 * 検索語B「再配置確認」では別フィールドが primary になり、行高パターンが入れ替わる。
 */
export const createVirtualListE2eConcepts = (count = VIRTUAL_LIST_E2E_COUNT): Concept[] =>
  Array.from({ length: count }, (_, index) => {
    const id = padId(index);
    const kind = index % 5;

    if (kind === 0) {
      return baseConcept(id, {
        title: `フィードバックタイトル ${index}`,
        definition: `再配置確認を定義側へ置いた通常寄りの概念 ${index}`,
        domainTags: ["学習科学"],
        researchTags: ["実験"]
      });
    }

    if (kind === 1) {
      return baseConcept(id, {
        title: index === 1 ? "強化学習" : `再配置確認タイトル ${index}`,
        definition: "本体定義には検索語Aを含めない",
        domainTags: ["学習科学"],
        researchTags: ["実験"],
        contextDefinitions: [
          {
            id: `${id}-ctx`,
            context: "教育",
            definition: "学習者へのフィードバック設計に応用できる"
          }
        ]
      });
    }

    if (kind === 2) {
      return baseConcept(id, {
        title: `再配置確認ロング ${index}`,
        definition: "本体定義には検索語Aを含めない",
        domainTags: ["学習科学"],
        contextDefinitions: [
          {
            id: `${id}-ctx`,
            context: "教育",
            definition: LONG_CONTEXT_DEFINITION
          }
        ]
      });
    }

    if (kind === 3) {
      return baseConcept(id, {
        title: `タグ強調概念 ${index}`,
        definition: "本体定義には検索語を含めない",
        myInterpretation: `再配置確認を解釈へ置いた概念 ${index}`,
        domainTags: index % 10 === 3 ? ["フィードバック分野"] : ["学習科学"],
        researchTags: index % 10 === 8 ? ["フィードバック研究"] : ["実験"]
      });
    }

    return baseConcept(id, {
      title: `フィードバック通常 ${index}`,
      definition: "短い定義",
      notes: `再配置確認をメモへ置いた概念 ${index}`,
      domainTags: ["学習科学"],
      researchTags: ["実験"]
    });
  });
