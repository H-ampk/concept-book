import { useCallback, useEffect, useMemo, useState } from "react";
import { getContextStorage, getStorage } from "../storage";
import type { Concept } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import type { QuizDeck, QuizQuestion } from "../types/quiz";
import { nowIso } from "../utils/date";
import {
  previewQuizDeckSync,
  syncQuizDeckFromFilters,
  type QuizDeckSyncResult
} from "../utils/syncQuizDeckFromFilters";
import { applyAutoLinkedConceptIdsToChoices } from "../utils/quizConceptLink";

const storage = getStorage();
const contextStorage = getContextStorage();

const createQuestionId = (): string =>
  `quiz_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const skipReasonLabel: Record<string, string> = {
  "already-in-pool": "プール済み",
  "generation-failed": "生成不可",
  "missing-definition": "定義不足"
};

type Props = {
  open: boolean;
  deck: QuizDeck | null;
  concepts: Concept[];
  allQuestions: QuizQuestion[];
  onClose: () => void;
  onSynced: () => void;
};

export const QuizDeckSyncModal = ({ open, deck, concepts, allQuestions, onClose, onSynced }: Props) => {
  const [contextCards, setContextCards] = useState<ContextCard[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<QuizDeckSyncResult | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    void contextStorage.getAllContextCards().then(setContextCards);
    setError(null);
    setLastResult(null);
  }, [open, deck?.id]);

  const preview = useMemo(() => {
    if (!deck) {
      return null;
    }
    return previewQuizDeckSync({ deck, allConcepts: concepts, allQuestions });
  }, [deck, concepts, allQuestions]);

  const handleSync = useCallback(async () => {
    if (!deck) {
      return;
    }
    setSyncing(true);
    setError(null);
    try {
      const result = syncQuizDeckFromFilters({
        deck,
        allConcepts: concepts,
        allContextCards: contextCards,
        allQuestions,
        createQuestionId,
        nowIso: nowIso()
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.newQuestions.length === 0) {
        setLastResult(result);
        return;
      }

      for (const q of result.newQuestions) {
        const linkedChoices = applyAutoLinkedConceptIdsToChoices(q.choices, concepts);
        await storage.saveQuizQuestion({ ...q, choices: linkedChoices });
      }
      await storage.saveQuizDeck(result.updatedDeck);
      setLastResult(result);
      onSynced();
    } catch {
      setError("クイズ集の更新に失敗しました。");
    } finally {
      setSyncing(false);
    }
  }, [deck, concepts, contextCards, allQuestions, onSynced]);

  if (!open || !deck) {
    return null;
  }

  const generationFailedEntries =
    lastResult?.skippedEntries.filter((e) => e.reason === "generation-failed") ??
    preview?.skippedEntries.filter((e) => e.reason === "generation-failed") ??
    [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-nordic-overlay px-3 py-6 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-deck-sync-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto scrollbar-none rounded-2xl border border-celestial-border bg-celestial-panel p-4 shadow-xl sm:p-5">
        <header className="mb-4 flex items-center justify-between gap-2">
          <h2 id="quiz-deck-sync-title" className="text-lg font-semibold text-celestial-textMain">
            クイズ集を更新
          </h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
            onClick={onClose}
          >
            閉じる
          </button>
        </header>

        <p className="text-sm text-celestial-textSub">
          「{deck.title}」の出題条件に合う概念のうち、まだ問題プールにない概念から問題を追加します。
        </p>

        {!preview?.canSync ? (
          <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-950/25 px-3 py-2 text-sm text-amber-100/95">
            このクイズ集には再同期条件（分野タグ）が保存されていません。分野タグから自動生成したクイズ集のみ更新できます。
          </p>
        ) : (
          <div className="mt-4 space-y-3 rounded-xl border border-celestial-border/70 bg-celestial-deepBlue/30 p-4 text-sm">
            <p className="text-celestial-textMain">
              対象分野タグ:{" "}
              <span className="font-medium text-celestial-softGold">{preview.filters?.targetDomainTag}</span>
            </p>
            <div className="grid gap-2 text-celestial-textSub sm:grid-cols-2">
              <p>
                追加可能な概念:{" "}
                <span className="font-medium text-celestial-softGold">{preview.addableConceptCount}</span> 件
              </p>
              <p>
                プール済み（スキップ）:{" "}
                <span className="font-medium text-celestial-textSub">
                  {preview.skippedEntries.filter((e) => e.reason === "already-in-pool").length}
                </span>{" "}
                件
              </p>
              {preview.questionsWithoutConceptId > 0 ? (
                <p className="sm:col-span-2 text-xs text-amber-200/90">
                  conceptId 未設定の問題が {preview.questionsWithoutConceptId}{" "}
                  件あります（重複防止の対象外）。
                </p>
              ) : null}
              {deck.lastSyncedAt ? (
                <p className="sm:col-span-2 text-xs text-celestial-textSub">
                  最終同期: {new Date(deck.lastSyncedAt).toLocaleString("ja-JP")}
                </p>
              ) : null}
            </div>
          </div>
        )}

        {lastResult ? (
          <section className="mt-4 space-y-2 rounded-xl border border-celestial-gold/30 bg-celestial-gold/5 p-4 text-sm">
            <h3 className="font-semibold text-celestial-textMain">更新結果</h3>
            <p className="text-celestial-textSub">
              追加された問題:{" "}
              <span className="font-medium text-celestial-softGold">{lastResult.addedQuestionCount}</span> 問
            </p>
            <p className="text-celestial-textSub">
              スキップ:{" "}
              <span className="font-medium text-celestial-textSub">{lastResult.skippedCount}</span> 件
            </p>
            {lastResult.addedQuestionCount === 0 && lastResult.skippedCount === 0 ? (
              <p className="text-celestial-textSub">追加できる未反映の概念はありませんでした。</p>
            ) : null}
          </section>
        ) : null}

        {generationFailedEntries.length > 0 ? (
          <div className="mt-4">
            <h4 className="mb-2 text-xs font-medium text-celestial-softGold">スキップ理由</h4>
            <ul className="max-h-40 space-y-2 overflow-y-auto text-sm">
              {generationFailedEntries.map((item) => (
                <li
                  key={item.conceptId}
                  className="rounded-lg border border-celestial-border/40 bg-celestial-deepBlue/40 p-2"
                >
                  <p className="text-celestial-textMain">
                    {item.conceptTitle}{" "}
                    <span className="text-xs text-celestial-textSub">
                      ({skipReasonLabel[item.reason] ?? item.reason})
                    </span>
                  </p>
                  <p className="text-xs text-celestial-textSub">{item.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-celestial-danger">{error}</p> : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className="action-button rounded-lg px-4 py-2 text-sm disabled:opacity-50"
            onClick={() => void handleSync()}
            disabled={syncing || !preview?.canSync}
          >
            {syncing ? "更新中…" : "未反映の概念を追加"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-celestial-border px-4 py-2 text-sm text-celestial-textSub hover:bg-celestial-gold/10"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
