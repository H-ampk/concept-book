import { useEffect, useMemo, useState } from "react";
import { getContextStorage, getStorage } from "../storage";
import type { Concept } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import type { QuizDeck, QuizQuestion } from "../types/quiz";
import { QUIZ_DECK_SCHEMA_VERSION } from "../types/quiz";
import { nowIso } from "../utils/date";
import {
  generateQuizFromSingleContextualCard,
  generateQuizSetFromDomainTag,
  type QuizSetGenerationMode,
  type QuizSetGenerationPreview
} from "../utils/generateQuizSetFromDomainTag";
import { applyAutoLinkedConceptIdsToChoices } from "../utils/quizConceptLink";
import { parseContextualCardSourceId } from "../utils/quizQuestionSource";

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
  concepts: Concept[];
  allQuestions: QuizQuestion[];
  initialContextualCardId?: string;
  onBack?: () => void;
  onClose: () => void;
  onSaved: () => void;
};

export const QuizSetFromDomainTagPanel = ({
  concepts,
  allQuestions,
  initialContextualCardId,
  onBack,
  onClose,
  onSaved
}: Props) => {
  const isSingleMode = Boolean(initialContextualCardId);
  const parsedSingle = initialContextualCardId
    ? parseContextualCardSourceId(initialContextualCardId)
    : null;

  const [quizSetTitle, setQuizSetTitle] = useState("");
  const [targetDomainTag, setTargetDomainTag] = useState("");
  const [generationMode, setGenerationMode] = useState<QuizSetGenerationMode>("auto");
  const [includeDraftConcepts, setIncludeDraftConcepts] = useState(false);
  const [questionLimit, setQuestionLimit] = useState<string>("all");
  const [preview, setPreview] = useState<QuizSetGenerationPreview | null>(null);
  const [singlePreview, setSinglePreview] = useState<
    ReturnType<typeof generateQuizFromSingleContextualCard> | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextCards, setContextCards] = useState<ContextCard[]>([]);

  useEffect(() => {
    void contextStorage.getAllContextCards().then(setContextCards);
  }, []);

  const singleConcept = useMemo(() => {
    if (!parsedSingle) {
      return undefined;
    }
    return concepts.find((c) => c.id === parsedSingle.conceptId);
  }, [concepts, parsedSingle]);

  const singleContextDef = useMemo(() => {
    if (!singleConcept || !parsedSingle) {
      return undefined;
    }
    return (singleConcept.contextDefinitions ?? []).find(
      (d) => d.id === parsedSingle.contextDefinitionId
    );
  }, [singleConcept, parsedSingle]);

  useEffect(() => {
    if (!isSingleMode || !singleConcept) {
      return;
    }
    const contextLabel = singleContextDef?.context.trim();
    setQuizSetTitle(
      contextLabel
        ? `${singleConcept.title}（${contextLabel}）クイズ`
        : `${singleConcept.title} クイズ`
    );
    if (singleConcept.domainTags[0]) {
      setTargetDomainTag(singleConcept.domainTags[0]);
    }
  }, [isSingleMode, singleConcept, singleContextDef]);

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

    if (isSingleMode && parsedSingle) {
      const result = generateQuizFromSingleContextualCard({
        conceptId: parsedSingle.conceptId,
        contextDefinitionId: parsedSingle.contextDefinitionId,
        allConcepts: concepts,
        allContextCards: contextCards,
        existingQuestions: allQuestions
      });
      setSinglePreview(result);
      setPreview(null);
      if ("failed" in result) {
        setError(result.reason);
      } else {
        setError(null);
      }
      return;
    }

    if (!targetDomainTag.trim()) {
      setError("対象分野タグを入力してください。");
      return;
    }

    const limitValue = questionLimit === "all" ? "all" : Number.parseInt(questionLimit, 10);
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
      allContextCards: contextCards,
      existingQuestions: allQuestions
    });

    setPreview(result);
    setSinglePreview(null);
    setError(null);
  };

  const handleSave = async () => {
    const drafts =
      isSingleMode && singlePreview && !("failed" in singlePreview)
        ? [singlePreview]
        : preview?.questions ?? [];

    if (drafts.length === 0) {
      setError("保存できる問題がありません。先にプレビュー生成を実行してください。");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const questionIds: string[] = [];
      for (const draft of drafts) {
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
        title: quizSetTitle.trim(),
        description: isSingleMode
          ? `文脈別カード「${singleConcept?.title ?? ""}」から自動生成`
          : `分野タグ「${preview?.targetDomainTag ?? targetDomainTag}」から自動生成`,
        domainTags: isSingleMode
          ? singleConcept?.domainTags
          : preview?.targetDomainTag
            ? [preview.targetDomainTag]
            : targetDomainTag.trim()
              ? [targetDomainTag.trim()]
              : undefined,
        questionIds,
        visibility: "private",
        schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        ...(isSingleMode
          ? {}
          : {
              sourceType: "domain-tag" as const,
              sourceDomainTag: preview?.targetDomainTag ?? targetDomainTag.trim(),
              generationSummary: preview?.summary,
              generationFilters: {
                targetDomainTag: preview?.targetDomainTag ?? targetDomainTag.trim(),
                includeDraftConcepts,
                generationMode
              },
              lastSyncedAt: now
            })
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

  const canSave =
    (isSingleMode &&
      singlePreview &&
      !("failed" in singlePreview)) ||
    (preview && preview.questions.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-celestial-textMain">
            {isSingleMode ? "この文脈別カードからクイズ作成" : "文脈別カードからクイズを作成"}
          </h2>
          <p className="mt-1 text-sm text-celestial-textSub">
            {isSingleMode
              ? "選択した文脈別定義をもとに、穴埋めクイズを作成します。"
              : "分野タグに属する概念の文脈別定義から、穴埋めクイズを一括作成します。"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {onBack ? (
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
              onClick={onBack}
            >
              戻る
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
      </div>

      {isSingleMode && singleConcept ? (
        <div className="rounded-xl border border-celestial-border/70 bg-celestial-deepBlue/30 p-4 text-sm">
          <p className="font-medium text-celestial-textMain">{singleConcept.title}</p>
          {singleContextDef ? (
            <p className="mt-1 text-celestial-textSub">
              文脈：{singleContextDef.context.trim() || "未指定"}
            </p>
          ) : null}
        </div>
      ) : null}

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

        {!isSingleMode ? (
          <>
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
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="action-button rounded-lg px-4 py-2 text-sm" onClick={handlePreview}>
          プレビュー生成
        </button>
        <button
          type="button"
          className="rounded-lg border border-celestial-gold/40 px-4 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10 disabled:opacity-50"
          onClick={() => void handleSave()}
          disabled={saving || !canSave}
        >
          {saving ? "保存中…" : "クイズ集として保存"}
        </button>
      </div>

      {error ? <p className="text-sm text-celestial-danger">{error}</p> : null}

      {singlePreview && !("failed" in singlePreview) ? (
        <section className="space-y-3 rounded-xl border border-celestial-border/70 bg-celestial-deepBlue/30 p-4">
          <h3 className="text-sm font-semibold text-celestial-textMain">生成プレビュー</h3>
          <p className="text-sm text-celestial-textSub">作成予定：1問</p>
          <div className="rounded-lg border border-celestial-border/60 bg-celestial-panel/50 p-3 text-sm">
            <p className="font-medium text-celestial-textMain">{singlePreview.conceptTitle}</p>
            <p className="mt-1 line-clamp-2 text-celestial-textMain">{singlePreview.question.prompt}</p>
          </div>
        </section>
      ) : null}

      {preview ? (
        <section className="mt-2 space-y-4 rounded-xl border border-celestial-border/70 bg-celestial-deepBlue/30 p-4">
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
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};
