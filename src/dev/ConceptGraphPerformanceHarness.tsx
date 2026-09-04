import { useMemo, useState } from "react";
import { ConceptGraphView } from "../components/ConceptGraphView";
import {
  createGraphTestConcepts,
  GRAPH_TEST_DEFAULT_AVERAGE_RELATIONS,
  GRAPH_TEST_DEFAULT_SEED,
  GRAPH_TEST_DOMAIN_TAGS
} from "../utils/conceptGraphTestData";
import { rankConceptsForGraphFromIndex } from "../utils/conceptGraphPriority";
import { collectUndirectedConceptEdges, createConceptRelationIndex } from "../utils/conceptRelations";

const GRAPH_PERF_PRESETS = [
  { count: 200, label: "200" },
  { count: 1000, label: "1k" },
  { count: 2000, label: "2k" },
  { count: 5000, label: "5k" },
  { count: 10000, label: "10k" }
] as const;

const parsePositiveInt = (raw: string | null, fallback: number): number => {
  if (raw == null || raw === "") {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
};

const formatMs = (ms: number): string => `${ms.toFixed(1)} ms`;

const harnessHref = (count: number, averageRelations: number, seed: number): string => {
  const params = new URLSearchParams();
  params.set("graphPerf", String(count));
  params.set("relations", String(averageRelations));
  params.set("seed", String(seed));
  return `?${params.toString()}`;
};

export const ConceptGraphPerformanceHarness = () => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const conceptCount = parsePositiveInt(params.get("graphPerf"), 0);
  const averageRelations = parsePositiveInt(
    params.get("relations"),
    GRAPH_TEST_DEFAULT_AVERAGE_RELATIONS
  );
  const seed = parsePositiveInt(params.get("seed"), GRAPH_TEST_DEFAULT_SEED);

  const generated = useMemo(() => {
    const startedAt = performance.now();
    const concepts = createGraphTestConcepts({
      conceptCount,
      averageRelations,
      seed
    });
    return {
      concepts,
      generateMs: performance.now() - startedAt
    };
  }, [averageRelations, conceptCount, seed]);

  const concepts = generated.concepts;

  const [titleQuery, setTitleQuery] = useState("");
  const [domainTag, setDomainTag] = useState("");
  const [selectedId, setSelectedId] = useState<string>();

  const filtered = useMemo(() => {
    const startedAt = performance.now();
    const q = titleQuery.trim().toLowerCase();
    const next = concepts.filter((concept) => {
      const byTitle = q.length === 0 || concept.title.toLowerCase().includes(q);
      const byDomain = domainTag.length === 0 || concept.domainTags.includes(domainTag);
      return byTitle && byDomain;
    });
    return {
      concepts: next,
      filterMs: performance.now() - startedAt
    };
  }, [concepts, domainTag, titleQuery]);

  const filteredConcepts = filtered.concepts;

  const edges = useMemo(() => {
    const startedAt = performance.now();
    const edgeCount = collectUndirectedConceptEdges(filteredConcepts).length;
    return {
      edgeCount,
      edgeMs: performance.now() - startedAt
    };
  }, [filteredConcepts]);

  const relationIndex = useMemo(() => {
    const startedAt = performance.now();
    const index = createConceptRelationIndex(filteredConcepts);
    return {
      index,
      indexMs: performance.now() - startedAt
    };
  }, [filteredConcepts]);

  const ranking = useMemo(() => {
    if (!selectedId || !relationIndex.index.conceptById.has(selectedId)) {
      return { ms: null as number | null, selected: false as const };
    }
    const startedAt = performance.now();
    rankConceptsForGraphFromIndex(relationIndex.index, selectedId);
    return { ms: performance.now() - startedAt, selected: true as const };
  }, [relationIndex.index, selectedId]);

  return (
    <div className="flex min-h-dvh flex-col bg-nordic-bg text-celestial-textMain">
      <header className="shrink-0 border-b border-celestial-border bg-celestial-panel px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-celestial-softGold">
          Concept graph performance harness (DEV)
        </p>
        <h1 className="mt-1 text-lg font-semibold">大規模グラフ性能確認</h1>
        <nav className="mt-2 flex flex-wrap items-center gap-2" aria-label="規模 preset">
          {GRAPH_PERF_PRESETS.map((preset) => {
            const href = harnessHref(preset.count, averageRelations, seed);
            const active = conceptCount === preset.count;
            return (
              <a
                key={preset.count}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md border px-2 py-1 text-xs ${
                  active
                    ? "border-celestial-softGold bg-celestial-gold/15 text-celestial-softGold"
                    : "border-celestial-border text-celestial-textSub hover:bg-celestial-gold/10"
                }`}
              >
                {preset.label}
              </a>
            );
          })}
        </nav>
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-celestial-textSub">
          <div>
            生成 Concept 数: <span className="text-celestial-textMain">{concepts.length}</span>
          </div>
          <div>
            filter後 Concept 数:{" "}
            <span className="text-celestial-textMain">{filteredConcepts.length}</span>
          </div>
          <div>
            edge 数: <span className="text-celestial-textMain">{edges.edgeCount}</span>
          </div>
          <div>
            seed: <span className="text-celestial-textMain">{seed}</span>
          </div>
          <div>
            averageRelations: <span className="text-celestial-textMain">{averageRelations}</span>
          </div>
          <div>
            fixture生成: <span className="text-celestial-textMain">{formatMs(generated.generateMs)}</span>
          </div>
          <div>
            filter処理: <span className="text-celestial-textMain">{formatMs(filtered.filterMs)}</span>
          </div>
          <div>
            edge生成: <span className="text-celestial-textMain">{formatMs(edges.edgeMs)}</span>
          </div>
          <div>
            relation index: <span className="text-celestial-textMain">{formatMs(relationIndex.indexMs)}</span>
          </div>
          <div>
            priority計算:{" "}
            <span className="text-celestial-textMain">
              {ranking.selected && ranking.ms != null ? formatMs(ranking.ms) : "未選択"}
            </span>
          </div>
          <div>
            selected:{" "}
            <span className="text-celestial-textMain">{selectedId ?? "未選択"}</span>
          </div>
        </dl>
        <p className="mt-1 text-xs text-celestial-textSub">
          この画面の Concept はメモリ上のみです。IndexedDB には書き込みません。計測値は比較用で、固定閾値の合否には使いません。
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-celestial-textSub">
            タイトル filter
            <input
              type="search"
              value={titleQuery}
              onChange={(event) => setTitleQuery(event.target.value)}
              className="min-w-[16rem] rounded-md border border-celestial-border bg-nordic-surface px-2 py-1 text-sm text-celestial-textMain"
              placeholder="Performance Concept"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-celestial-textSub">
            分野タグ filter
            <select
              value={domainTag}
              onChange={(event) => setDomainTag(event.target.value)}
              className="min-w-[10rem] rounded-md border border-celestial-border bg-nordic-surface px-2 py-1 text-sm text-celestial-textMain"
            >
              <option value="">すべて</option>
              {GRAPH_TEST_DOMAIN_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="rounded-md border border-celestial-border px-2 py-1 text-xs text-celestial-softGold hover:bg-celestial-gold/10"
            onClick={() => setSelectedId(filteredConcepts[0]?.id)}
          >
            先頭を選択
          </button>
          <button
            type="button"
            className="rounded-md border border-celestial-border px-2 py-1 text-xs text-celestial-softGold hover:bg-celestial-gold/10"
            onClick={() => setSelectedId(undefined)}
          >
            選択解除
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 p-3">
        <div className="h-[calc(100dvh-14.5rem)] min-h-[360px]">
          <ConceptGraphView
            concepts={filteredConcepts}
            domainColorMap={{}}
            selectedId={selectedId}
            onSelectConcept={setSelectedId}
          />
        </div>
      </div>
    </div>
  );
};
