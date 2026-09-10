import { useMemo, useState } from "react";
import type { Concept } from "../../types/concept";
import type { QuizAttemptLog, QuizDeck } from "../../types/quiz";
import {
  aggregateDataLabLogs,
  type DataLabGroupBy
} from "../../utils/dataLab/aggregateDataLabLogs";
import { aggregateDataLabConcepts } from "../../utils/dataLab/aggregateDataLabConcepts";
import { attachDataLabConceptLearningModelMetrics } from "../../utils/dataLab/attachDataLabConceptLearningModelMetrics";
import type { DataLabMetric } from "../../utils/dataLab/dataLabChartMetrics";
import type { DataLabDisplayMode } from "../../utils/dataLab/dataLabDisplayMode";
import { describeDataLabConceptFilters } from "../../utils/dataLab/describeDataLabConceptFilters";
import { describeDataLabFilters } from "../../utils/dataLab/describeDataLabFilters";
import { filterLearningModelPredictionPointsByAttemptIds } from "../../utils/dataLab/filterLearningModelPredictionPointsByAttemptIds";
import { sanitizeDataLabAnalysisMetrics } from "../../utils/dataLab/sanitizeDataLabMetrics";
import type { DataLabBarChartLimit, DataLabBarChartSort } from "../../utils/dataLab/toDataLabBarChartRows";
import {
  DEFAULT_DATA_LAB_FILTERS,
  filterDataLabLogs,
  type DataLabFilters
} from "../../utils/dataLab/filterDataLabLogs";
import {
  DEFAULT_DATA_LAB_CONCEPT_FILTERS,
  filterDataLabConcepts,
  type DataLabConceptFilters
} from "../../utils/dataLab/filterDataLabConcepts";
import { fillDataLabTimeSeries } from "../../utils/dataLab/fillDataLabTimeSeries";
import { buildConceptHlrEstimateMap } from "../../utils/hlr/getConceptHlrEstimate";
import { buildOneStepAheadPredictionSeries } from "../../utils/learningModelEvaluation/oneStepAhead";
import {
  createBktLearningModelPredictor,
  createPfaLearningModelPredictor
} from "../../utils/learningModelEvaluation/predictors";
import { buildConceptMasteryMap } from "../../utils/mastery/getConceptMastery";
import { buildConceptPfaPredictionMap } from "../../utils/pfa/getConceptPfaPrediction";
import { OrnamentLine } from "../common/OrnamentLine";
import { DataLabAddToResearchReportPanel } from "./DataLabAddToResearchReportPanel";
import { DataLabConceptFiltersPanel } from "./DataLabConceptFiltersPanel";
import { DataLabConceptResultsPanel } from "./DataLabConceptResultsPanel";
import { DataLabControlsPanel } from "./DataLabControlsPanel";
import { DataLabExportPanel } from "./DataLabExportPanel";
import { DataLabFiltersPanel } from "./DataLabFiltersPanel";
import { DataLabLearningModelEvaluationPanel } from "./DataLabLearningModelEvaluationPanel";
import { DataLabResultsPanel } from "./DataLabResultsPanel";

const DATA_LAB_EVALUATION_PREDICTORS = [
  createBktLearningModelPredictor(),
  createPfaLearningModelPredictor()
];

export type DataLabAnalysisTarget = "learningLogs" | "concepts";

export type DataLabViewProps = {
  logs: QuizAttemptLog[];
  concepts: Concept[];
  decks: QuizDeck[];
  loading: boolean;
  error: boolean;
  onBack: () => void;
  onGoToQuizPlay?: () => void;
};

export const DataLabView = ({
  logs,
  concepts,
  decks,
  loading,
  error,
  onBack,
  onGoToQuizPlay
}: DataLabViewProps) => {
  const [analysisTarget, setAnalysisTarget] = useState<DataLabAnalysisTarget>("learningLogs");
  const [filters, setFilters] = useState<DataLabFilters>(DEFAULT_DATA_LAB_FILTERS);
  const [conceptFilters, setConceptFilters] = useState<DataLabConceptFilters>(
    DEFAULT_DATA_LAB_CONCEPT_FILTERS
  );
  const [groupBy, setGroupBy] = useState<DataLabGroupBy>("concept");
  const [metric, setMetric] = useState<DataLabMetric>("accuracy");
  const [scatterXMetric, setScatterXMetric] = useState<DataLabMetric>("averageResponseTimeMs");
  const [scatterYMetric, setScatterYMetric] = useState<DataLabMetric>("accuracy");
  const [displayMode, setDisplayMode] = useState<DataLabDisplayMode>("table");
  const [barSort, setBarSort] = useState<DataLabBarChartSort>("valueDesc");
  const [barLimit, setBarLimit] = useState<DataLabBarChartLimit>(10);
  const [modelNow] = useState(() => new Date());

  const conceptById = useMemo(() => new Map(concepts.map((concept) => [concept.id, concept])), [concepts]);
  const deckById = useMemo(() => new Map(decks.map((deck) => [deck.id, deck])), [decks]);

  const filteredLogs = useMemo(
    () => filterDataLabLogs(logs, filters, conceptById),
    [logs, filters, conceptById]
  );

  const filteredConcepts = useMemo(
    () => filterDataLabConcepts(concepts, conceptFilters),
    [concepts, conceptFilters]
  );

  const conceptAggregate = useMemo(
    () =>
      aggregateDataLabConcepts({
        concepts: filteredConcepts,
        allConcepts: concepts
      }),
    [filteredConcepts, concepts]
  );

  const masteryByConceptId = useMemo(() => buildConceptMasteryMap(logs), [logs]);
  const pfaByConceptId = useMemo(() => buildConceptPfaPredictionMap(logs), [logs]);
  const hlrByConceptId = useMemo(
    () => buildConceptHlrEstimateMap(logs, { now: modelNow }),
    [logs, modelNow]
  );
  const allPredictionPoints = useMemo(
    () => buildOneStepAheadPredictionSeries(logs, DATA_LAB_EVALUATION_PREDICTORS),
    [logs]
  );
  const filteredPredictionPoints = useMemo(() => {
    const targetAttemptIds = new Set(filteredLogs.map((log) => log.id));
    return filterLearningModelPredictionPointsByAttemptIds(allPredictionPoints, targetAttemptIds);
  }, [allPredictionPoints, filteredLogs]);

  const aggregatedRows = useMemo(() => {
    const rows = aggregateDataLabLogs({
      logs: filteredLogs,
      groupBy,
      conceptById,
      deckById
    });
    const withModels = attachDataLabConceptLearningModelMetrics(
      rows,
      { masteryByConceptId, pfaByConceptId, hlrByConceptId },
      conceptById
    );
    return fillDataLabTimeSeries(withModels, {
      groupBy,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo
    });
  }, [
    filteredLogs,
    groupBy,
    conceptById,
    deckById,
    masteryByConceptId,
    pfaByConceptId,
    hlrByConceptId,
    filters.dateFrom,
    filters.dateTo
  ]);

  const handleGroupByChange = (nextGroupBy: DataLabGroupBy) => {
    const sanitized = sanitizeDataLabAnalysisMetrics({
      groupBy: nextGroupBy,
      metric,
      scatterXMetric,
      scatterYMetric
    });
    setGroupBy(nextGroupBy);
    setMetric(sanitized.metric);
    setScatterXMetric(sanitized.scatterXMetric);
    setScatterYMetric(sanitized.scatterYMetric);
  };

  const chips = useMemo(
    () => describeDataLabFilters(filters, conceptById, deckById),
    [filters, conceptById, deckById]
  );

  const conceptChips = useMemo(
    () => describeDataLabConceptFilters(conceptFilters),
    [conceptFilters]
  );

  const totalLogs = logs.length;
  const displayedLogs = filteredLogs.length;
  const totalConcepts = concepts.length;
  const displayedConcepts = filteredConcepts.length;
  const isConceptMode = analysisTarget === "concepts";

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px] space-y-6 px-6 lg:px-8">
      <section
        className="relative min-w-0 max-w-full rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-6"
        aria-labelledby="data-lab-title"
      >
        <div className="relative z-[1] flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-celestial-gold/80">Lab · 観測室</p>
            <h1 id="data-lab-title" className="text-2xl font-semibold tracking-wide text-celestial-textMain md:text-3xl">
              Data Lab
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-celestial-textSub md:text-base">
              {isConceptMode
                ? "Concept データの構成・充足状況を集計します。"
                : "学習ログを条件指定して探索・分析します。"}
            </p>
            <OrnamentLine variant="header" className="max-w-md opacity-80" />
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 px-4 py-3">
              <p className="text-xs font-medium tracking-wide text-celestial-textSub">
                {isConceptMode ? "対象 Concept" : "対象ログ"}
              </p>
              <p
                className="mt-1 text-xl font-semibold tabular-nums text-celestial-textMain"
                data-testid={isConceptMode ? "data-lab-concept-count" : "data-lab-log-count"}
              >
                {loading
                  ? "…"
                  : error
                    ? "—"
                    : isConceptMode
                      ? `${displayedConcepts} / ${totalConcepts}`
                      : `${displayedLogs} / ${totalLogs}`}
              </p>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="header-nav-button shrink-0 rounded-md border border-celestial-gold/50 bg-transparent px-3 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
            >
              戻る（概念へ）
            </button>
          </div>
        </div>

        <div className="relative z-[1] mt-5 space-y-2" data-testid="data-lab-analysis-target">
          <p className="text-xs font-medium text-celestial-textSub" id="data-lab-analysis-target-label">
            分析対象
          </p>
          <div
            className="inline-flex flex-wrap gap-2 rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-1"
            role="group"
            aria-labelledby="data-lab-analysis-target-label"
          >
            <button
              type="button"
              aria-pressed={analysisTarget === "learningLogs"}
              onClick={() => setAnalysisTarget("learningLogs")}
              className={`rounded-lg px-3 py-2 text-sm transition ${
                analysisTarget === "learningLogs"
                  ? "theme-selected"
                  : "text-celestial-textMain hover:bg-celestial-gold/10"
              }`}
              data-testid="data-lab-target-learning-logs"
            >
              学習ログ
            </button>
            <button
              type="button"
              aria-pressed={analysisTarget === "concepts"}
              onClick={() => setAnalysisTarget("concepts")}
              className={`rounded-lg px-3 py-2 text-sm transition ${
                analysisTarget === "concepts"
                  ? "theme-selected"
                  : "text-celestial-textMain hover:bg-celestial-gold/10"
              }`}
              data-testid="data-lab-target-concepts"
            >
              概念データ
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <p className="text-center text-sm text-celestial-textSub" role="status">
          読み込み中…
        </p>
      ) : error ? (
        <p className="text-center text-sm text-celestial-textSub" role="alert">
          {isConceptMode ? "Concept データを読み込めませんでした。" : "学習データを読み込めませんでした。"}
        </p>
      ) : isConceptMode ? (
        <>
          <DataLabConceptFiltersPanel
            filters={conceptFilters}
            onChange={setConceptFilters}
            concepts={concepts}
            chips={conceptChips}
          />
          <DataLabConceptResultsPanel
            totalConcepts={totalConcepts}
            displayedConcepts={displayedConcepts}
            aggregate={conceptAggregate}
          />
        </>
      ) : (
        <>
          <DataLabFiltersPanel
            filters={filters}
            onChange={setFilters}
            concepts={concepts}
            decks={decks}
            chips={chips}
          />
          <DataLabControlsPanel
            groupBy={groupBy}
            onGroupByChange={handleGroupByChange}
            metric={metric}
            onMetricChange={setMetric}
            scatterXMetric={scatterXMetric}
            onScatterXMetricChange={setScatterXMetric}
            scatterYMetric={scatterYMetric}
            onScatterYMetricChange={setScatterYMetric}
            displayMode={displayMode}
            onDisplayModeChange={setDisplayMode}
            barSort={barSort}
            onBarSortChange={setBarSort}
            barLimit={barLimit}
            onBarLimitChange={setBarLimit}
          />
          <DataLabExportPanel
            filteredLogs={filteredLogs}
            aggregatedRows={aggregatedRows}
            predictionPoints={filteredPredictionPoints}
            groupBy={groupBy}
            conceptById={conceptById}
            deckById={deckById}
          />
          <DataLabAddToResearchReportPanel
            filters={filters}
            filterChips={chips}
            groupBy={groupBy}
            metric={metric}
            scatterXMetric={scatterXMetric}
            scatterYMetric={scatterYMetric}
            displayMode={displayMode}
            barSort={barSort}
            barLimit={barLimit}
            filteredLogCount={displayedLogs}
            aggregatedRows={aggregatedRows}
          />
          <DataLabResultsPanel
            totalLogs={totalLogs}
            displayedLogs={displayedLogs}
            groupBy={groupBy}
            metric={metric}
            scatterXMetric={scatterXMetric}
            scatterYMetric={scatterYMetric}
            displayMode={displayMode}
            barSort={barSort}
            barLimit={barLimit}
            aggregatedRows={aggregatedRows}
            onGoToQuizPlay={onGoToQuizPlay}
          />
          {totalLogs > 0 ? (
            <DataLabLearningModelEvaluationPanel
              points={filteredPredictionPoints}
              conceptById={conceptById}
            />
          ) : null}
        </>
      )}
    </div>
  );
};
