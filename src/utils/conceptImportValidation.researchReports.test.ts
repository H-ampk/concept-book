import { describe, expect, it } from "vitest";
import {
  DATA_LAB_ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
  type ResearchReport
} from "../types/researchReport";
import { DEFAULT_DATA_LAB_FILTERS } from "./dataLab/filterDataLabLogs";
import {
  normalizeResearchReportsForBackupImport,
  validateBackupImportPayload
} from "./conceptImportValidation";

const iso = "2026-01-01T00:00:00.000Z";

const snapshot = {
  schemaVersion: DATA_LAB_ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
  createdAt: iso,
  source: "data-lab" as const,
  filters: { ...DEFAULT_DATA_LAB_FILTERS },
  filterChips: [],
  filterLabels: [],
  groupBy: "concept" as const,
  metric: "accuracy" as const,
  displayMode: "table" as const,
  sourceLogCount: 0,
  rows: [],
  totalRowCount: 0,
  savedRowCount: 0,
  truncated: false
};

const validReport = (id = "rr1"): ResearchReport => ({
  id,
  title: "分析",
  blocks: [
    {
      id: `${id}-b1`,
      type: "data-lab-analysis",
      snapshot,
      commentary: "memo"
    }
  ],
  createdAt: iso,
  updatedAt: iso
});

const baseBackup = {
  concepts: [],
  contextCards: [],
  quizQuestions: [],
  quizDecks: [],
  quizAttemptLogs: []
};

describe("validateBackupImportPayload researchReports", () => {
  it("researchReports を含む新形式バックアップを validation できる", () => {
    const result = validateBackupImportPayload({
      ...baseBackup,
      researchReports: [validReport()]
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.researchReportsPresent).toBe(true);
    expect(result.researchReports).toHaveLength(1);
    expect(result.researchReports[0]?.id).toBe("rr1");
    expect(result.researchReportParseSkipped).toBe(0);
  });

  it("researchReports: [] はフィールドありの空配列として扱う", () => {
    const result = validateBackupImportPayload({
      ...baseBackup,
      researchReports: []
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.researchReportsPresent).toBe(true);
    expect(result.researchReports).toEqual([]);
    expect(result.researchReportParseSkipped).toBe(0);
  });

  it("researchReports が無い旧バックアップは present=false", () => {
    const result = validateBackupImportPayload(baseBackup);
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.researchReportsPresent).toBe(false);
    expect(result.researchReports).toEqual([]);
    expect(result.researchReportParseSkipped).toBe(0);
  });

  it("legacy concept 配列は researchReports を触らない（present=false）", () => {
    const result = validateBackupImportPayload([
      {
        id: "c1",
        title: "概念",
        definition: "",
        myInterpretation: "",
        domainTags: [],
        researchTags: [],
        relatedIds: [],
        source: { book: "", page: "", author: null },
        notes: "",
        status: "draft",
        favorite: false,
        createdAt: iso,
        updatedAt: iso
      }
    ]);
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.researchReportsPresent).toBe(false);
  });

  it("不正な ResearchReport entry は skip する", () => {
    const result = validateBackupImportPayload({
      ...baseBackup,
      researchReports: [
        validReport("ok"),
        { id: "bad" },
        { ...validReport("bad-type"), blocks: [{ id: "b", type: "unknown", snapshot, commentary: "" }] }
      ]
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.researchReportsPresent).toBe(true);
    expect(result.researchReports.map((r) => r.id)).toEqual(["ok"]);
    expect(result.researchReportParseSkipped).toBe(2);
  });

  it("未知フィールドを削除しない", () => {
    const withExtra = {
      ...validReport("extra"),
      extraKeep: "keep-me",
      blocks: [
        {
          id: "b1",
          type: "data-lab-analysis" as const,
          snapshot: { ...snapshot, extraSnap: 1 },
          commentary: "",
          extraBlock: true
        }
      ]
    };
    const { reports, skipped } = normalizeResearchReportsForBackupImport([withExtra]);
    expect(skipped).toBe(0);
    expect(reports[0]).toMatchObject({ extraKeep: "keep-me" });
    expect(reports[0]?.blocks[0]).toMatchObject({ extraBlock: true });
    expect(reports[0]?.blocks[0]?.snapshot).toMatchObject({ extraSnap: 1 });
  });

  it("researchReports が配列でない場合は validation 失敗", () => {
    const result = validateBackupImportPayload({
      ...baseBackup,
      researchReports: { id: "rr1" }
    });
    expect(result.success).toBe(false);
  });
});
