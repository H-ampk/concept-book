import { useMemo, useState } from "react";
import type { Concept } from "../../types/concept";
import type { QuizAttemptLog, QuizDeck } from "../../types/quiz";
import {
  aggregateDataLabLogs,
  type DataLabGroupBy
} from "../../utils/dataLab/aggregateDataLabLogs";
import { describeDataLabFilters } from "../../utils/dataLab/describeDataLabFilters";
import {
  DEFAULT_DATA_LAB_FILTERS,
  filterDataLabLogs,
  type DataLabFilters
} from "../../utils/dataLab/filterDataLabLogs";
import { OrnamentLine } from "../common/OrnamentLine";
import { DataLabControlsPanel } from "./DataLabControlsPanel";
import { DataLabFiltersPanel } from "./DataLabFiltersPanel";
import { DataLabResultsPanel } from "./DataLabResultsPanel";

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
  const [filters, setFilters] = useState<DataLabFilters>(DEFAULT_DATA_LAB_FILTERS);
  const [groupBy, setGroupBy] = useState<DataLabGroupBy>("concept");

  const conceptById = useMemo(() => new Map(concepts.map((concept) => [concept.id, concept])), [concepts]);
  const deckById = useMemo(() => new Map(decks.map((deck) => [deck.id, deck])), [decks]);

  const filteredLogs = useMemo(
    () => filterDataLabLogs(logs, filters, conceptById),
    [logs, filters, conceptById]
  );

  const aggregatedRows = useMemo(
    () =>
      aggregateDataLabLogs({
        logs: filteredLogs,
        groupBy,
        conceptById,
        deckById
      }),
    [filteredLogs, groupBy, conceptById, deckById]
  );

  const chips = useMemo(
    () => describeDataLabFilters(filters, conceptById, deckById),
    [filters, conceptById, deckById]
  );

  const totalLogs = logs.length;
  const displayedLogs = filteredLogs.length;

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 px-1 sm:px-0">
      <section
        className="relative min-w-0 max-w-full rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-6"
        aria-labelledby="data-lab-title"
      >
        <span className="card-corner card-corner-top-left" aria-hidden="true" />
        <span className="card-corner card-corner-top-right" aria-hidden="true" />
        <span className="card-corner card-corner-bottom-left" aria-hidden="true" />
        <span className="card-corner card-corner-bottom-right" aria-hidden="true" />

        <div className="relative z-[1] flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-celestial-gold/80">Lab · 観測室</p>
            <h1 id="data-lab-title" className="text-2xl font-semibold tracking-wide text-celestial-textMain md:text-3xl">
              Data Lab
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-celestial-textSub md:text-base">
              学習ログを条件指定して探索・分析します。
            </p>
            <OrnamentLine variant="header" className="max-w-md opacity-80" />
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 px-4 py-3">
              <p className="text-xs font-medium tracking-wide text-celestial-textSub">対象ログ</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-celestial-textMain" data-testid="data-lab-log-count">
                {loading ? "…" : error ? "—" : `${displayedLogs} / ${totalLogs}`}
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
      </section>

      {loading ? (
        <p className="text-center text-sm text-celestial-textSub" role="status">
          読み込み中…
        </p>
      ) : error ? (
        <p className="text-center text-sm text-celestial-textSub" role="alert">
          学習データを読み込めませんでした。
        </p>
      ) : (
        <>
          <DataLabFiltersPanel
            filters={filters}
            onChange={setFilters}
            concepts={concepts}
            decks={decks}
            chips={chips}
          />
          <DataLabControlsPanel groupBy={groupBy} onGroupByChange={setGroupBy} />
          <DataLabResultsPanel
            totalLogs={totalLogs}
            displayedLogs={displayedLogs}
            groupBy={groupBy}
            aggregatedRows={aggregatedRows}
            onGoToQuizPlay={onGoToQuizPlay}
          />
        </>
      )}
    </div>
  );
};
