import { useEffect, useMemo, useState } from "react";
import { getContextStorage, getStorage } from "../storage";
import type { Concept } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import type { QuizDeck, QuizQuestion } from "../types/quiz";
import { QUIZ_DECK_SCHEMA_VERSION } from "../types/quiz";
import { nowIso } from "../utils/date";
import {
  generateQuizSetFromContextCard,
  type ContextCardQuizGenerationPreview
} from "../utils/generateQuizSetFromContextCard";
import { applyAutoLinkedConceptIdsToChoices } from "../utils/quizConceptLink";

const storage = getStorage();
const contextStorage = getContextStorage();

const createDeckId = (): string =>
  `deck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

type Props = {
  concepts: Concept[];
  allQuestions: QuizQuestion[];
  initialContextCardId?: string;
  onBack?: () => void;
  onClose: () => void;
  onSaved: () => void;
};

export const QuizSetFromContextCardPanel = ({
  concepts,
  allQuestions,
  initialContextCardId,
  onBack,
  onClose,
  onSaved
}: Props) => {
  const [contextCards, setContextCards] = useState<ContextCard[]>([]);
  const [quizSetTitle, setQuizSetTitle] = useState("");
  const [targetDomainTag, setTargetDomainTag] = useState("");
  const [selectedContextCardId, setSelectedContextCardId] = useState(initialContextCardId ?? "");
  const [preview, setPreview] = useState<ContextCardQuizGenerationPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void contextStorage.getAllContextCards().then(setContextCards);
  }, []);

  useEffect(() => {
    if (initialContextCardId) {
      setSelectedContextCardId(initialContextCardId);
    }
  }, [initialContextCardId]);

  const domainTagOptions = useMemo(() => {
    const tags = new Set<string>();
    for (const card of contextCards) {
      for (const tag of card.domainTags ?? []) {
        const trimmed = tag.trim();
        if (trimmed) {
          tags.add(trimmed);
        }
      }
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b, "ja"));
  }, [contextCards]);

  const filteredContextCards = useMemo(() => {
    const tag = targetDomainTag.trim();
    if (!tag) {
      return contextCards;
    }
    return contextCards.filter((card) =>
      card.domainTags.some((domainTag) => domainTag.trim() === tag)
    );
  }, [contextCards, targetDomainTag]);

  const selectedCard = useMemo(
    () => contextCards.find((card) => card.id === selectedContextCardId),
    [contextCards, selectedContextCardId]
  );

  useEffect(() => {
    if (!selectedCard || quizSetTitle.trim()) {
      return;
    }
    setQuizSetTitle(`${selectedCard.title} クイズ`);
  }, [selectedCard, quizSetTitle]);

  const handlePreview = () => {
    if (!quizSetTitle.trim()) {
      setError("クイズ集名を入力してください。");
      return;
    }
    if (!selectedCard) {
      setError("文脈カードを選択してください。");
      return;
    }

    const result = generateQuizSetFromContextCard({
      contextCard: selectedCard,
      allConcepts: concepts,
      existingQuestions: allQuestions
    });

    setPreview(result);
    setError(result.emptyStateMessage ?? null);
  };

  const handleSave = async () => {
    if (!preview || preview.questions.length === 0) {
      setError(preview?.emptyStateMessage ?? "保存できる問題がありません。先にプレビュー生成を実行してください。");
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
        title: quizSetTitle.trim(),
        description: `文脈カード「${preview.contextCardTitle}」から自動生成`,
        domainTags: preview.fieldName ? [preview.fieldName] : selectedCard?.domainTags,
        questionIds,
        visibility: "private",
        schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now
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

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-celestial-textMain">文脈カードからクイズを作成</h2>
          <p className="mt-1 text-sm text-celestial-textSub">
            文脈カードの本文と重要語句から、穴埋めクイズを作成します。
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

      <div className="grid gap-4 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="mb-1 block text-sm text-celestial-textMain">クイズ集名 *</span>
          <input
            className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain"
            value={quizSetTitle}
            onChange={(e) => setQuizSetTitle(e.target.value)}
            placeholder="例: 第6回 演算回路と論理回路 クイズ"
          />
        </label>

        {!initialContextCardId ? (
          <label>
            <span className="mb-1 block text-sm text-celestial-textMain">分野 *</span>
            <input
              className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain"
              value={targetDomainTag}
              onChange={(e) => {
                setTargetDomainTag(e.target.value);
                setSelectedContextCardId("");
                setPreview(null);
              }}
              list="quiz-context-card-domain-tags"
              placeholder="例: 情報処理概論"
            />
            <datalist id="quiz-context-card-domain-tags">
              {domainTagOptions.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
          </label>
        ) : null}

        <label className={initialContextCardId ? "md:col-span-2" : ""}>
          <span className="mb-1 block text-sm text-celestial-textMain">文脈カード *</span>
          {initialContextCardId ? (
            <p className="rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain">
              {selectedCard?.title ?? "読み込み中…"}
            </p>
          ) : (
            <select
              className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain"
              value={selectedContextCardId}
              onChange={(e) => {
                setSelectedContextCardId(e.target.value);
                setPreview(null);
              }}
              disabled={!targetDomainTag.trim()}
            >
              <option value="">選択してください</option>
              {filteredContextCards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.title}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="action-button rounded-lg px-4 py-2 text-sm" onClick={handlePreview}>
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

      {error ? <p className="text-sm text-celestial-danger whitespace-pre-line">{error}</p> : null}

      {preview ? (
        <section className="space-y-3 rounded-xl border border-celestial-border/70 bg-celestial-deepBlue/30 p-4">
          <h3 className="text-sm font-semibold text-celestial-textMain">生成プレビュー</h3>
          <div className="grid gap-1 text-sm text-celestial-textSub">
            <p>
              作成予定：<span className="font-semibold text-celestial-softGold">{preview.questions.length}問</span>
            </p>
            <p>対象：{preview.contextCardTitle}</p>
            <p>作成元：文脈カード</p>
            {preview.usedTerms.length > 0 ? (
              <p className="line-clamp-2">使用語句：{preview.usedTerms.join("、")}</p>
            ) : null}
          </div>

          {preview.emptyStateMessage ? (
            <p className="text-sm text-celestial-textSub whitespace-pre-line">{preview.emptyStateMessage}</p>
          ) : null}

          {preview.questions.length > 0 ? (
            <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
              {preview.questions.map((draft) => (
                <li
                  key={draft.question.id}
                  className="rounded-lg border border-celestial-border/60 bg-celestial-panel/50 p-3"
                >
                  <p className="font-medium text-celestial-textMain">{draft.conceptTitle}</p>
                  <p className="mt-1 line-clamp-2 text-celestial-textMain">{draft.question.prompt}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};
