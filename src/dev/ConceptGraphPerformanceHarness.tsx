import { useMemo, useState } from "react";
import { ConceptGraphView } from "../components/ConceptGraphView";
import {
  createGraphTestConcepts,
  GRAPH_TEST_DEFAULT_AVERAGE_RELATIONS,
  GRAPH_TEST_DEFAULT_SEED,
  GRAPH_TEST_DOMAIN_TAGS
} from "../utils/conceptGraphTestData";
import { collectUndirectedConceptEdges } from "../utils/conceptRelations";

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

export const ConceptGraphPerformanceHarness = () => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const conceptCount = parsePositiveInt(params.get("graphPerf"), 0);
  const averageRelations = parsePositiveInt(
    params.get("relations"),
    GRAPH_TEST_DEFAULT_AVERAGE_RELATIONS
  );
  const seed = parsePositiveInt(params.get("seed"), GRAPH_TEST_DEFAULT_SEED);

  const concepts = useMemo(
    () =>
      createGraphTestConcepts({
        conceptCount,
        averageRelations,
        seed
      }),
    [averageRelations, conceptCount, seed]
  );

  const [titleQuery, setTitleQuery] = useState("");
  const [domainTag, setDomainTag] = useState("");
  const [selectedId, setSelectedId] = useState<string>();

  const filteredConcepts = useMemo(() => {
    const q = titleQuery.trim().toLowerCase();
    return concepts.filter((concept) => {
      const byTitle = q.length === 0 || concept.title.toLowerCase().includes(q);
      const byDomain = domainTag.length === 0 || concept.domainTags.includes(domainTag);
      return byTitle && byDomain;
    });
  }, [concepts, domainTag, titleQuery]);

  const edgeCount = useMemo(
    () => collectUndirectedConceptEdges(filteredConcepts).length,
    [filteredConcepts]
  );

  return (
    <div className="flex min-h-dvh flex-col bg-nordic-bg text-celestial-textMain">
      <header className="shrink-0 border-b border-celestial-border bg-celestial-panel px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-celestial-softGold">
          Concept graph performance harness (DEV)
        </p>
        <h1 className="mt-1 text-lg font-semibold">大規模グラフ性能確認</h1>
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-celestial-textSub">
          <div>
            生成 Concept 数: <span className="text-celestial-textMain">{concepts.length}</span>
          </div>
          <div>
            表示対象 Concept 数:{" "}
            <span className="text-celestial-textMain">{filteredConcepts.length}</span>
          </div>
          <div>
            edge 数: <span className="text-celestial-textMain">{edgeCount}</span>
          </div>
          <div>
            seed: <span className="text-celestial-textMain">{seed}</span>
          </div>
          <div>
            averageRelations: <span className="text-celestial-textMain">{averageRelations}</span>
          </div>
        </dl>
        <p className="mt-1 text-xs text-celestial-textSub">
          この画面の Concept はメモリ上のみです。IndexedDB には書き込みません。
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
        </div>
      </header>
      <div className="min-h-0 flex-1 p-3">
        <div className="h-[calc(100dvh-12.5rem)] min-h-[360px]">
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
