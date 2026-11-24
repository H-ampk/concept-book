import { describe, expect, it } from "vitest";
import { assertDatasetIntegrity, generateSyntheticDataset } from "./generateSyntheticDataset";
import {
  assertSyntheticDatasetSpec,
  createXlSpec,
  DATASET_PRESETS,
  PERF_SEARCH_TOKEN
} from "./datasetSpec";
import { summarizeSamples, unmeasured } from "./summarizeSamples";
import { measurePerfSpan, noteIdbRead, perfReadStartedAt, type PerfProbeState } from "./probe";
import {
  datasetToFingerprintInput,
  fingerprintDataset,
  fingerprintPayload,
  firstFingerprintMismatch
} from "./datasetFingerprint";
import { selectLongTasks } from "./longTaskWindow";

describe("合成データセット", () => {
  it("同じ seed と設定から同じデータセットを生成する", () => {
    const first = generateSyntheticDataset(DATASET_PRESETS.S);
    const second = generateSyntheticDataset(DATASET_PRESETS.S);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("S/M/L の件数が指定と一致し、参照が閉じている", () => {
    for (const spec of Object.values(DATASET_PRESETS)) {
      const dataset = generateSyntheticDataset(spec);
      expect(dataset.counts).toEqual({
        concepts: spec.conceptCount,
        logs: spec.logCount,
        quizzes: spec.quizCount,
        contexts: spec.contextCount,
        relatedPairs: Math.floor(spec.relationCount / 2),
        prerequisiteEdges: spec.relationCount - Math.floor(spec.relationCount / 2),
        relations: spec.relationCount,
        attachmentBytes: 0
      });
      assertDatasetIntegrity(dataset);
      expect(dataset.concepts[0]?.title).toContain(PERF_SEARCH_TOKEN);
      expect(dataset.concepts.every((concept) => concept.createdAt.startsWith("2020-"))).toBe(true);
    }
  });

  it("XL は L を基準に指定した次元だけ増やす", () => {
    const spec = createXlSpec({ conceptCount: 6000, logCount: 60_000, attachmentBytes: 128 });
    expect(spec.quizCount).toBe(DATASET_PRESETS.L.quizCount);
    expect(spec.contextCount).toBe(DATASET_PRESETS.L.contextCount);
    const dataset = generateSyntheticDataset(spec);
    expect(dataset.counts.concepts).toBe(6000);
    expect(dataset.counts.logs).toBe(60_000);
    expect(dataset.counts.attachmentBytes).toBe(128);
    expect(dataset.attachment?.prefix).toHaveLength(64);
    assertDatasetIntegrity(dataset);
  });

  it("削除対象は隣接概念とクイズ問題から参照される", () => {
    const dataset = generateSyntheticDataset(DATASET_PRESETS.S);
    const target = dataset.concepts[2];
    expect(target?.title).toBe("PERF-DELETE-TARGET");
    expect(
      dataset.concepts.some(
        (concept) =>
          concept.relatedIds.includes(target!.id) || concept.prerequisiteIds.includes(target!.id)
      )
    ).toBe(true);
    expect(
      dataset.quizQuestions.some(
        (question) =>
          question.conceptId === target!.id ||
          question.choices.some((choice) => choice.sourceConceptId === target!.id)
      )
    ).toBe(true);
  });

  it("密な prerequisite でも循環を作らない", () => {
    const dataset = generateSyntheticDataset({
      ...DATASET_PRESETS.S,
      id: "dense",
      conceptCount: 4,
      logCount: 0,
      quizCount: 0,
      contextCount: 0,
      relationCount: 12
    });
    expect(dataset.counts.prerequisiteEdges).toBe(6);
    assertDatasetIntegrity(dataset);
  });

  it("指紋は関係、参照、更新日時の変化を検知する", () => {
    const dataset = generateSyntheticDataset(DATASET_PRESETS.S);
    const expected = fingerprintDataset(dataset);
    const changed = datasetToFingerprintInput(dataset);
    changed.concepts = changed.concepts.map((concept, index) =>
      index === 3 ? { ...concept, updatedAt: "2099-01-01T00:00:00.000Z" } : concept
    );
    expect(firstFingerprintMismatch(expected, fingerprintPayload(changed))).toBe("concepts");
    const questionChanged = datasetToFingerprintInput(dataset);
    questionChanged.quizQuestions = questionChanged.quizQuestions.map((question, index) =>
      index === 0 ? { ...question, conceptId: "" } : question
    );
    expect(firstFingerprintMismatch(expected, fingerprintPayload(questionChanged))).toBe("quizQuestions");
    const cardChanged = datasetToFingerprintInput(dataset);
    cardChanged.contextCards = cardChanged.contextCards.map((card, index) =>
      index === 0 ? { ...card, linkedConcepts: [] } : card
    );
    expect(firstFingerprintMismatch(expected, fingerprintPayload(cardChanged))).toBe("contextCards");
    cardChanged.emptyStores = { ...cardChanged.emptyStores, syncQueue: 1 };
    expect(fingerprintPayload(cardChanged).emptyStores).not.toBe(expected.emptyStores);
  });

  it("Long Task は開始点以上、終了点未満だけを数える", () => {
    const selected = selectLongTasks(
      [
        { startTime: 9, duration: 80 },
        { startTime: 10, duration: 60 },
        { startTime: 40, duration: 70 },
        { startTime: 50, duration: 90 }
      ],
      10,
      50
    );
    expect(selected.map((task) => task.startTime)).toEqual([10, 40]);
  });

  it("不正な設定を拒否する", () => {
    expect(() =>
      assertSyntheticDatasetSpec({ ...DATASET_PRESETS.S, conceptCount: -1 })
    ).toThrow(/conceptCount/);
    expect(() =>
      assertSyntheticDatasetSpec({ ...DATASET_PRESETS.S, logCount: 1.5 })
    ).toThrow(/logCount/);
    expect(() =>
      assertSyntheticDatasetSpec({ ...DATASET_PRESETS.S, quizCount: 0 })
    ).toThrow(/クイズ問題/);
    expect(() =>
      assertSyntheticDatasetSpec({
        ...DATASET_PRESETS.S,
        conceptCount: 1,
        relationCount: 10,
        logCount: 0,
        quizCount: 0
      })
    ).toThrow(/related/);
    expect(() => createXlSpec({ attachmentBytes: 10, contextCount: 0 })).toThrow(/文脈カード/);
  });
});

describe("計測値の集計", () => {
  it("中央値、最小、最大、ばらつきを記録し、試行が少ないときは p95 を付けない", () => {
    const summary = summarizeSamples([10, 30, 20, 40], "ms");
    expect(summary).toMatchObject({
      status: "measured",
      unit: "ms",
      count: 4,
      min: 10,
      max: 40,
      median: 25
    });
    expect(summary.stdev).toBeGreaterThan(0);
    expect(summary.p95).toBeUndefined();
  });

  it("20 試行以上では p95 を記録する", () => {
    const summary = summarizeSamples(
      Array.from({ length: 20 }, (_, index) => index + 1),
      "ms"
    );
    expect(summary.p95).toBe(19);
  });

  it("空の測定値は集計しない", () => {
    expect(() => summarizeSamples([], "ms")).toThrow(/測定値/);
  });

  it("未計測は理由つきで区別する", () => {
    expect(unmeasured("API が無い")).toEqual({
      status: "unmeasured",
      reason: "API が無い"
    });
  });
});

describe("計測プローブ", () => {
  it("プローブが無いときは計算結果を変えず記録しない", () => {
    expect(measurePerfSpan("bkt", () => 7)).toBe(7);
    expect(perfReadStartedAt()).toBeNull();
    noteIdbRead("concepts", 3, null);
  });

  it("プローブがあるときだけ回数と時間を残す", () => {
    const state: PerfProbeState = { idb: [], models: [] };
    (globalThis as { __CB_PERF_PROBE__?: PerfProbeState }).__CB_PERF_PROBE__ = state;
    try {
      expect(measurePerfSpan("bkt", () => 4)).toBe(4);
      noteIdbRead("concepts", 2, perfReadStartedAt());
      expect(state.models).toHaveLength(1);
      expect(state.models[0]?.name).toBe("bkt");
      expect(state.idb[0]).toMatchObject({ store: "concepts", count: 2 });
    } finally {
      delete (globalThis as { __CB_PERF_PROBE__?: PerfProbeState }).__CB_PERF_PROBE__;
    }
  });
});
