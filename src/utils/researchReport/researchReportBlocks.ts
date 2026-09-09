import type { DataLabAnalysisSnapshot, ResearchReport, ResearchReportBlock } from "../../types/researchReport";
import { DATA_LAB_GROUP_BY_CONTROL_LABELS } from "../dataLab/dataLabGroupByLabels";
import { DATA_LAB_METRIC_LABELS } from "../dataLab/dataLabChartMetrics";
import { nowIso } from "../date";

export const createResearchReportId = (): string =>
  `research_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export const createResearchReportBlockId = (): string =>
  `rblock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export const buildDataLabResearchReportTitle = (
  snapshot: DataLabAnalysisSnapshot,
  now: Date = new Date()
): string => {
  const groupLabel = DATA_LAB_GROUP_BY_CONTROL_LABELS[snapshot.groupBy];
  const metricLabel = DATA_LAB_METRIC_LABELS[snapshot.metric];
  const domainLabel = snapshot.filterLabels.find((label) => label.startsWith("分野:"));
  if (domainLabel) {
    const domain = domainLabel.replace(/^分野:\s*/, "").trim();
    if (domain) {
      return `${domain} ${groupLabel}別 ${metricLabel}の分析`;
    }
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `Data Lab 分析 ${y}/${m}/${d}`;
};

const cloneSnapshot = (snapshot: DataLabAnalysisSnapshot): DataLabAnalysisSnapshot => ({
  ...snapshot,
  filters: {
    ...snapshot.filters,
    conceptIds: [...snapshot.filters.conceptIds],
    domainTags: [...snapshot.filters.domainTags],
    deckIds: [...snapshot.filters.deckIds]
  },
  filterChips: snapshot.filterChips.map((chip) => ({ ...chip })),
  filterLabels: [...snapshot.filterLabels],
  rows: snapshot.rows.map((row) => ({ ...row }))
});

export const createDataLabAnalysisBlock = (
  snapshot: DataLabAnalysisSnapshot,
  options?: { id?: string; commentary?: string }
): ResearchReportBlock => ({
  id: options?.id ?? createResearchReportBlockId(),
  type: "data-lab-analysis",
  snapshot: cloneSnapshot(snapshot),
  commentary: options?.commentary ?? ""
});

export const createResearchReportFromSnapshot = (
  snapshot: DataLabAnalysisSnapshot,
  options?: { id?: string; title?: string; now?: string }
): ResearchReport => {
  const timestamp = options?.now ?? nowIso();
  return {
    id: options?.id ?? createResearchReportId(),
    title: options?.title ?? buildDataLabResearchReportTitle(snapshot, new Date(timestamp)),
    blocks: [createDataLabAnalysisBlock(snapshot)],
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

export const appendDataLabAnalysisBlock = (
  report: ResearchReport,
  snapshot: DataLabAnalysisSnapshot,
  options?: { now?: string; blockId?: string }
): ResearchReport => ({
  id: report.id,
  title: report.title,
  createdAt: report.createdAt,
  updatedAt: options?.now ?? nowIso(),
  blocks: [...report.blocks, createDataLabAnalysisBlock(snapshot, { id: options?.blockId })]
});

export const updateResearchReportTitle = (
  report: ResearchReport,
  title: string,
  now: string = nowIso()
): ResearchReport => ({
  ...report,
  title,
  updatedAt: now
});

export const updateResearchReportBlockCommentary = (
  report: ResearchReport,
  blockId: string,
  commentary: string,
  now: string = nowIso()
): ResearchReport => ({
  ...report,
  updatedAt: now,
  blocks: report.blocks.map((block) => (block.id === blockId ? { ...block, commentary } : block))
});

export const deleteResearchReportBlock = (
  report: ResearchReport,
  blockId: string,
  now: string = nowIso()
): ResearchReport => ({
  ...report,
  updatedAt: now,
  blocks: report.blocks.filter((block) => block.id !== blockId)
});
