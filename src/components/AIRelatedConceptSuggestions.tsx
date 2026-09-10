import { useMemo, useRef, useState } from "react";
import { getAIEmbeddingProvider, getAITextProvider, loadAISettings } from "../features/ai";
import {
  describeRelatedConceptAIError,
  suggestRelatedConceptsWithAI,
  type AIExistingRelatedConceptSuggestion,
  type AINewRelatedConceptSuggestion,
  type RelatedConceptAIProgress
} from "../features/ai/relatedConcepts";
import type { Concept } from "../types/concept";

type Props = {
  allConcepts: Concept[];
  selectedIds: string[];
  currentConceptId?: string;
  inputTitle: string;
  inputDefinition: string;
  inputMyInterpretation: string;
  onAdd: (conceptId: string) => void;
};

const formatSimilarity = (value: number): string => `類似度 ${value.toFixed(2)}`;

const progressLabel = (progress: RelatedConceptAIProgress | null, searching: boolean): string => {
  if (!searching) {
    return "";
  }
  if (progress?.stage === "embedding") {
    return `Embeddingを準備中 ${progress.completed} / ${progress.total}`;
  }
  if (progress?.stage === "analyzing") {
    return "関連候補を分析中…";
  }
  return "AI候補を検索中…";
};

export const AIRelatedConceptSuggestions = ({
  allConcepts,
  selectedIds,
  currentConceptId,
  inputTitle,
  inputDefinition,
  inputMyInterpretation,
  onAdd
}: Props) => {
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState<RelatedConceptAIProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<AIExistingRelatedConceptSuggestion[]>([]);
  const [news, setNews] = useState<AINewRelatedConceptSuggestion[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleExisting = useMemo(
    () => existing.filter((item) => !selectedIdSet.has(item.conceptId)),
    [existing, selectedIdSet]
  );

  const handleSearch = async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setSearching(true);
    setError(null);
    setCopiedTitle(null);
    setProgress({ stage: "embedding", completed: 0, total: Math.max(1, allConcepts.length) });

    try {
      const settings = loadAISettings();
      const result = await suggestRelatedConceptsWithAI({
        current: {
          id: currentConceptId,
          title: inputTitle,
          definition: inputDefinition,
          myInterpretation: inputMyInterpretation
        },
        allConcepts,
        selectedIds,
        embeddingProvider: getAIEmbeddingProvider(settings),
        textProvider: getAITextProvider(settings),
        embeddingModel: settings.embeddingModel,
        onProgress: (next) => {
          if (requestIdRef.current === requestId) {
            setProgress(next);
          }
        }
      });
      if (requestIdRef.current !== requestId) {
        return;
      }
      setExisting(result.existing);
      setNews(result.new);
      setHasSearched(true);
    } catch (caught) {
      if (requestIdRef.current !== requestId) {
        return;
      }
      setExisting([]);
      setNews([]);
      setHasSearched(true);
      setError(describeRelatedConceptAIError(caught));
    } finally {
      if (requestIdRef.current === requestId) {
        setSearching(false);
      }
    }
  };

  const handleCopy = async (title: string) => {
    try {
      await navigator.clipboard.writeText(title);
      setCopiedTitle(title);
    } catch {
      setCopiedTitle(null);
      setError("タイトルのコピーに失敗しました。");
    }
  };

  return (
    <div className="mb-2 rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-celestial-softGold">AI関連候補</p>
        <button
          type="button"
          disabled={searching}
          className="rounded border border-celestial-gold/50 px-3 py-1.5 text-xs text-celestial-softGold hover:bg-celestial-gold/15 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void handleSearch()}
        >
          {hasSearched ? "再検索" : "AIで候補を探す"}
        </button>
      </div>
      <p className="mt-1 text-xs text-celestial-textSub">
        Embedding で近い概念を探し、理由だけを生成します。追加しても保存するまで ConceptBook
        は変わりません。
      </p>

      {searching && (
        <p className="mt-2 text-xs text-celestial-textSub" role="status">
          AI候補を検索中…
          {progressLabel(progress, searching) ? ` ${progressLabel(progress, searching)}` : ""}
        </p>
      )}

      {error && (
        <p className="mt-2 text-xs text-celestial-danger" role="alert">
          {error}
        </p>
      )}

      {hasSearched && !searching && visibleExisting.length === 0 && news.length === 0 && !error && (
        <p className="mt-2 text-xs text-celestial-textSub">AI関連候補は見つかりませんでした</p>
      )}

      {visibleExisting.length > 0 && (
        <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto scrollbar-none pr-1">
          {visibleExisting.map((candidate) => (
            <li
              key={candidate.conceptId}
              className="rounded-2xl border border-celestial-gold/30 bg-celestial-panel px-2.5 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-celestial-softGold">{candidate.title}</p>
                  <p className="mt-0.5 text-xs text-celestial-textSub">{candidate.reason}</p>
                  <p className="mt-0.5 text-xs text-celestial-textSub">{formatSimilarity(candidate.similarity)}</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded border border-celestial-gold/50 px-2 py-1 text-xs text-celestial-softGold bg-transparent hover:bg-celestial-gold/15 transition-colors"
                  onClick={() => onAdd(candidate.conceptId)}
                  aria-label={`${candidate.title} をAI候補から追加`}
                >
                  追加
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {news.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-celestial-softGold">未登録の参考候補</p>
          <p className="mt-0.5 text-xs text-celestial-textSub">
            参考表示のみです。Concept は自動作成されません。
          </p>
          <ul className="mt-2 space-y-2">
            {news.map((candidate) => (
              <li
                key={candidate.title}
                className="rounded-2xl border border-dashed border-celestial-gold/30 bg-celestial-panel px-2.5 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-celestial-softGold">{candidate.title}</p>
                    <p className="mt-0.5 text-xs text-celestial-textSub">{candidate.reason}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded border border-celestial-gold/50 px-2 py-1 text-xs text-celestial-softGold bg-transparent hover:bg-celestial-gold/15 transition-colors"
                    onClick={() => void handleCopy(candidate.title)}
                    aria-label={`${candidate.title} のタイトルをコピー`}
                  >
                    {copiedTitle === candidate.title ? "コピー済み" : "コピー"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
