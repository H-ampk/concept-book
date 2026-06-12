import { useEffect, useMemo, useState } from "react";
import { getContextStorage, getStorage } from "../storage";
import type { Concept } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import type { QuizDeck } from "../types/quiz";
import { QUIZ_DECK_SCHEMA_VERSION } from "../types/quiz";
import { nowIso } from "../utils/date";
import {
  generateQuizSetFromDomainTag,
  type QuizSetGenerationMode,
  type QuizSetGenerationPreview
} from "../utils/generateQuizSetFromDomainTag";
import { applyAutoLinkedConceptIdsToChoices } from "../utils/quizConceptLink";

const storage = getStorage();
const contextStorage = getContextStorage();

const createDeckId = (): string =>
  `deck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const qualityLabelMap = {
  high: "高",
  medium: "中",
  low: "低",
  failed: "不足"
} as const;

type Props = {
  open: boolean;
  concepts: Concept[];
  onClose: () => void;
  onSaved: () => void;
};

export const QuizSetFromDomainTagModal = ({ open, concepts, onClose, onSaved }: Props) => {
  const [quizSetTitle, setQuizSetTitle] = useState("");
  const [targetDomainTag, setTargetDomainTag] = useState("");
  const [generationMode, setGenerationMode] = useState<QuizSetGenerationMode>("auto");
  const [includeDraftConcepts, setIncludeDraftConcepts] = useState(false);
  const [questionLimit, setQuestionLimit] = useState<string>("all");
  const [preview, setPreview] = useState<QuizSetGenerationPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextCards, setContextCards] = useState<ContextCard[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void contextStorage.getAllContextCards().then(setContextCards);
    setPreview(null);
    setError(null);
  }, [open]);

  const domainTagOptions = useMemo(() => {
    const tags = new Set<string>();
    for (const concept of concepts) {
      for (const tag of concept.domainTags ?? []) {
        const trimmed = tag.trim();
        if (trimmed) {
          tags.add(trimmed);
        }
      }
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b, "ja"));
  }, [concepts]);

  const handlePreview = () => {
    if (!quizSetTitle.trim()) {
      setError("クイズ集名を入力してください。");
      return;
    }
    if (!targetDomainTag.trim()) {
      setError("対象分野タグを入力してください。");
      return;
    }

    const limitValue =
      questionLimit === "all" ? "all" : Number.parseInt(questionLimit, 10);
    if (limitValue !== "all" && (!Number.isFinite(limitValue) || limitValue <= 0)) {
      setError("問題数は正の数値か「すべて」を指定してください。");
      return;
    }

    const result = generateQuizSetFromDomainTag({
      quizSetTitle,
      targetDomainTag,
      includeDraftConcepts,
      generationMode,
      questionLimit: limitValue,
      allConcepts: concepts,
      allContextCards: contextCards
    });

    setPreview(result);
    setError(null);
  };

  const handleSave = async () => {
    if (!preview || preview.questions.length === 0) {
      setError("保存できる問題がありません。先にプレビュー生成を実行してください。");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const questionIds: string[] = [];
      for (const draft of preview.questions) {
        const linkedChoices = applyAutoLinkedConceptIdsToChoices(
          draft.question.choices,
          concepts
        );
        const question = { ...draft.question, choices: linkedChoices };
        await storage.saveQuizQuestion(question);
        questionIds.push(question.id);
      }

      const now = nowIso();
      const deck: QuizDeck = {
        id: createDeckId(),
        title: preview.quizSetTitle,
        description: `分野タグ「${preview.targetDomainTag}」から自動生成`,
        domainTags: [preview.targetDomainTag],
        questionIds,
        visibility: "private",
        schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        sourceType: "domain-tag",
        sourceDomainTag: preview.targetDomainTag,
        generationSummary: preview.summary
      };
      await storage.saveQuizDeck(deck);
      onSaved();
      onClose();
    } catch {
      setError("クイズ集の保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-nordic-overlay px-3 py-6 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-set-generator-title"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto scrollbar-none rounded-2xl border border-celestial-border bg-celestial-panel p-4 shadow-xl sm:p-5">
        <header className="mb-4 flex items-center justify-between gap-2">
          <h2 id="quiz-set-generator-title" className="text-lg font-semibold text-celestial-textMain">
            分野タグからクイズ集を生成
          </h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
            onClick={onClose}
          >
            閉じる
          </button>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-celestial-textMain">クイズ集名 *</span>
            <input
              className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain"
              value={quizSetTitle}
              onChange={(e) => setQuizSetTitle(e.target.value)}
              placeholder="例: 情報処理概論 期末対策"
            />
          </label>

          <label>
            <span className="mb-1 block text-sm text-celestial-textMain">対象分野タグ *</span>
            <input
              className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain"
              value={targetDomainTag}
              onChange={(e) => setTargetDomainTag(e.target.value)}
              list="quiz-set-domain-tags"
              placeholder="例: 情報処理概論"
            />
            <datalist id="quiz-set-domain-tags">
              {domainTagOptions.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
          </label>

          <label>
            <span className="mb-1 block text-sm text-celestial-textMain">生成モード</span>
            <select
              className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain"
              value={generationMode}
              onChange={(e) => setGenerationMode(e.target.value as QuizSetGenerationMode)}
            >
              <option value="auto">自動（文脈別定義を優先）</option>
              <option value="context-definition">文脈別定義のみ</option>
              <option value="concept-general">概念の一般定義のみ</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block text-sm text-celestial-textMain">問題数</span>
            <select
              className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain"
              value={questionLimit}
              onChange={(e) => setQuestionLimit(e.target.value)}
            >
              <option value="all">すべて</option>
              <option value="10">10問まで</option>
              <option value="20">20問まで</option>
              <option value="30">30問まで</option>
              <option value="50">50問まで</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-celestial-textMain md:col-span-2">
            <input
              type="checkbox"
              checked={includeDraftConcepts}
              onChange={(e) => setIncludeDraftConcepts(e.target.checked)}
            />
            下書き概念（draft）も含める
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="action-button rounded-lg px-4 py-2 text-sm"
            onClick={handlePreview}
          >
            プレビュー生成
          </button>
          <button
            type="button"
            className="rounded-lg border border-celestial-gold/40 px-4 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10 disabled:opacity-50"
            onClick={() => void handleSave()}
            disabled={saving || !preview || preview.questions.length === 0}
          >
            {saving ? "保存中…" : "クイズ集として保存"}
          </button>
        </div>

        {error ? <p className="mt-4 text-sm text-celestial-danger">{error}</p> : null}

        {preview ? (
          <section className="mt-6 space-y-4 rounded-xl border border-celestial-border/70 bg-celestial-deepBlue/30 p-4">
            <h3 className="text-sm font-semibold text-celestial-textMain">生成プレビュー</h3>
            <div className="grid gap-2 text-sm text-celestial-textSub sm:grid-cols-2">
              <p>対象概念数: {preview.summary.targetConceptCount}</p>
              <p>生成成功数: {preview.summary.generatedQuestionCount}</p>
              <p>警告あり: {preview.summary.warningCount}</p>
              <p>生成不可: {preview.summary.failedCount}</p>
            </div>

            {preview.questions.length > 0 ? (
              <div>
                <h4 className="mb-2 text-xs font-medium text-celestial-softGold">生成された問題</h4>
                <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
                  {preview.questions.map((draft) => (
                    <li
                      key={draft.question.id}
                      className="rounded-lg border border-celestial-border/60 bg-celestial-panel/50 p-3"
                    >
                      <p className="font-medium text-celestial-textMain">{draft.conceptTitle}</p>
                      <p className="mt-1 text-xs text-celestial-textSub">
                        モード: {draft.modeUsed} / 品質: {qualityLabelMap[draft.quality]}
                      </p>
                      <p className="mt-1 line-clamp-2 text-celestial-textMain">{draft.question.prompt}</p>
                      {draft.warnings.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-xs text-amber-200/90">
                          {draft.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {preview.failedConcepts.length > 0 ? (
              <div>
                <h4 className="mb-2 text-xs font-medium text-celestial-softGold">生成できなかった概念</h4>
                <ul className="max-h-40 space-y-2 overflow-y-auto text-sm">
                  {preview.failedConcepts.map((item) => (
                    <li
                      key={item.conceptId}
                      className="rounded-lg border border-celestial-border/40 bg-celestial-deepBlue/40 p-2"
                    >
                      <p className="text-celestial-textMain">{item.conceptTitle}</p>
                      <p className="text-xs text-celestial-textSub">{item.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
};
