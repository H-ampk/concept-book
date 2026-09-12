import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import type { Concept } from "../types/concept";
import { getStorage } from "../storage";
import { shortDateTime } from "../utils/date";
import { getDisplayStatus } from "../utils/conceptStatus";
import { StatusBadge } from "./StatusBadge";
import { OrnamentLine } from "./common/OrnamentLine";
import type { ConceptMastery, ConceptMasteryPoint } from "../utils/mastery/types";
import { toConceptMasteryDetailView } from "../utils/mastery/formatConceptMastery";
import { ConceptMasteryHistoryChart } from "./mastery/ConceptMasteryHistoryChart";
import type { ConceptPrerequisiteIndex } from "../utils/conceptPrerequisites";
import { MASTERY_CONFIDENCE_LABELS } from "../utils/mastery/constants";
import {
  buildConceptLearningSequence,
  buildPersonalizedConceptLearningSequence,
  formatPrerequisiteDepthLabel,
  type ConceptLearningSequenceItem,
  type ConceptLearningSequenceResult,
  type PersonalizedConceptLearningSequenceItem,
  type PersonalizedConceptLearningSequenceResult,
  type PersonalizedLearningSequenceReason,
  type SatisfiedPrerequisiteBoundary
} from "../utils/learningSequence";

const storage = getStorage();

const decorUrl = (path: string): string =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

type Props = {
  concept?: Concept;
  conceptMap: Map<string, Concept>;
  domainColorMap: Record<string, string>;
  conceptQuizStatsText?: string;
  conceptMastery?: ConceptMastery;
  conceptMasteryHistory?: ConceptMasteryPoint[];
  onSelectRelated: (id: string) => void;
  onEdit?: (concept: Concept) => void;
  onToggleFavorite?: (concept: Concept) => void;
  onCreateQuizFromContextualCard?: (conceptId: string, contextDefinitionId: string) => void;
  onRequestDelete: (concept: Concept) => void;
  deleting: boolean;
  /** App 側で concepts から一度だけ構築した index。dependents 表示に使う */
  prerequisiteIndex?: ConceptPrerequisiteIndex;
  /** App 側で一括構築した mastery map。personalized sequence 用 */
  conceptMasteryMap?: ReadonlyMap<string, ConceptMastery>;
  /** 通常グラフ詳細からのみ渡す。渡されたときだけ「この概念を分析」を表示する */
  onOpenGraphAnalysis?: (conceptId: string) => void;
};

const ConceptMediaGallery = ({ concept }: { concept: Concept }) => {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const revokeRef = useRef<string[]>([]);
  const idKey = useMemo(
    () =>
      [...(concept.media ?? [])]
        .map((m) => m.id)
        .sort()
        .join(","),
    [concept.media]
  );

  useEffect(() => {
    revokeRef.current.forEach((u) => URL.revokeObjectURL(u));
    revokeRef.current = [];
    let cancelled = false;
    const load = async () => {
      const next: Record<string, string> = {};
      const sorted = [...(concept.media ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
      for (const ref of sorted) {
        const blob = await storage.getMediaBlob(ref.id);
        if (cancelled || !blob) {
          continue;
        }
        const u = URL.createObjectURL(blob);
        revokeRef.current.push(u);
        next[ref.id] = u;
      }
      if (!cancelled) {
        setUrls(next);
      }
    };
    void load();
    return () => {
      cancelled = true;
      revokeRef.current.forEach((u) => URL.revokeObjectURL(u));
      revokeRef.current = [];
    };
  }, [concept.id, idKey]);

  const sorted = [...(concept.media ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  if (sorted.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">添付メディア</h3>
      <ul className="space-y-3">
        {sorted.map((ref) => (
            <li key={ref.id} className="detail-media-item">
            {ref.caption && <p className="mb-1 text-xs text-nordic-textSecondary">{ref.caption}</p>}
            <p className="mb-1 text-xs text-nordic-textMuted">{ref.fileName}</p>
            {ref.kind === "image" && urls[ref.id] ? (
              <img src={urls[ref.id]} alt={ref.caption ?? ref.fileName} className="max-h-64 w-full rounded object-contain" />
            ) : ref.kind === "video" && urls[ref.id] ? (
              <video src={urls[ref.id]} controls className="max-h-72 w-full rounded bg-black" playsInline />
            ) : (
              <p className="text-xs text-nordic-textMuted">読み込み中…</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

const personalizedReasonLabel = (reason: PersonalizedLearningSequenceReason): string => {
  switch (reason) {
    case "target":
      return "学習対象";
    case "needs-learning":
      return "学習が必要";
    case "insufficient-evidence":
      return "データ不足";
  }
};

const ConceptSequenceNavLabel = ({
  conceptId,
  conceptMap,
  onSelectRelated
}: {
  conceptId: string;
  conceptMap: Map<string, Concept>;
  onSelectRelated: (id: string) => void;
}) => {
  const itemConcept = conceptMap.get(conceptId);
  if (!itemConcept) {
    return <span className="text-xs text-amber-800">不明なID: {conceptId}</span>;
  }
  return (
    <button
      type="button"
      className="detail-related-link"
      onClick={() => onSelectRelated(conceptId)}
    >
      {itemConcept.title}
    </button>
  );
};

const FullLearningSequenceList = ({
  items,
  conceptMap,
  onSelectRelated
}: {
  items: ConceptLearningSequenceItem[];
  conceptMap: Map<string, Concept>;
  onSelectRelated: (id: string) => void;
}) => (
  <ol className="space-y-2">
    {items.map((item, index) => (
      <li key={item.conceptId} className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm text-nordic-textMuted">{index + 1}.</span>
        <ConceptSequenceNavLabel
          conceptId={item.conceptId}
          conceptMap={conceptMap}
          onSelectRelated={onSelectRelated}
        />
        <span className="text-xs text-nordic-textMuted">
          {formatPrerequisiteDepthLabel(item)}
        </span>
      </li>
    ))}
  </ol>
);

const PersonalizedLearningSequenceList = ({
  items,
  conceptMap,
  onSelectRelated
}: {
  items: PersonalizedConceptLearningSequenceItem[];
  conceptMap: Map<string, Concept>;
  onSelectRelated: (id: string) => void;
}) => (
  <ol className="space-y-2">
    {items.map((item, index) => (
      <li
        key={item.conceptId}
        className="flex flex-wrap items-baseline gap-2"
        data-reason={item.reason}
      >
        <span className="text-sm text-nordic-textMuted">{index + 1}.</span>
        <ConceptSequenceNavLabel
          conceptId={item.conceptId}
          conceptMap={conceptMap}
          onSelectRelated={onSelectRelated}
        />
        <span className="text-xs text-nordic-textMuted">
          {personalizedReasonLabel(item.reason)}
        </span>
      </li>
    ))}
  </ol>
);

const SatisfiedPrerequisiteBoundaryList = ({
  boundaries,
  conceptMap,
  onSelectRelated
}: {
  boundaries: SatisfiedPrerequisiteBoundary[];
  conceptMap: Map<string, Concept>;
  onSelectRelated: (id: string) => void;
}) => {
  if (boundaries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" data-testid="satisfied-prerequisite-boundaries">
      <p className="text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">
        習得済みのため省略
      </p>
      <ul className="space-y-2">
        {boundaries.map((boundary) => (
          <li key={boundary.conceptId} className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm text-nordic-textMuted" aria-hidden="true">
              ✓
            </span>
            <ConceptSequenceNavLabel
              conceptId={boundary.conceptId}
              conceptMap={conceptMap}
              onSelectRelated={onSelectRelated}
            />
            <span className="text-xs text-nordic-textMuted">
              習得済み / 信頼度 {MASTERY_CONFIDENCE_LABELS[boundary.confidence]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const ConceptLearningSequenceSection = ({
  result,
  personalizedResult,
  conceptMap,
  onSelectRelated
}: {
  result: ConceptLearningSequenceResult;
  personalizedResult: PersonalizedConceptLearningSequenceResult;
  conceptMap: Map<string, Concept>;
  onSelectRelated: (id: string) => void;
}) => {
  if (result.status === "target-not-found") {
    return null;
  }

  const cycleDetected =
    result.status === "cycle-detected" || personalizedResult.status === "cycle-detected";

  return (
    <div className="space-y-3" data-testid="concept-learning-sequence">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">
        学習順序
      </h3>
      {cycleDetected ? (
        <p className="text-sm text-nordic-textSecondary">
          前提概念の循環があるため学習順序を生成できません。
        </p>
      ) : (
        <>
          <div className="space-y-2" data-testid="personalized-learning-sequence">
            <p className="text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">
              あなた向け
            </p>
            {personalizedResult.status === "ok" && personalizedResult.targetAlreadyMastered ? (
              <p className="text-sm text-nordic-textSecondary" data-testid="target-already-mastered">
                この概念は習得済みです。
              </p>
            ) : null}
            {personalizedResult.status === "ok" ? (
              <PersonalizedLearningSequenceList
                items={personalizedResult.items}
                conceptMap={conceptMap}
                onSelectRelated={onSelectRelated}
              />
            ) : null}
          </div>
          {personalizedResult.status === "ok" ? (
            <SatisfiedPrerequisiteBoundaryList
              boundaries={personalizedResult.satisfiedBoundaries}
              conceptMap={conceptMap}
              onSelectRelated={onSelectRelated}
            />
          ) : null}
          {result.status === "ok" ? (
            <details className="space-y-2" data-testid="full-learning-sequence">
              <summary className="cursor-pointer text-sm text-nordic-textSecondary">
                すべての学習順序を見る
              </summary>
              <FullLearningSequenceList
                items={result.items}
                conceptMap={conceptMap}
                onSelectRelated={onSelectRelated}
              />
            </details>
          ) : null}
        </>
      )}
    </div>
  );
};

const ConceptMasteryPanel = ({ mastery }: { mastery: ConceptMastery }) => {
  const view = toConceptMasteryDetailView(mastery);

  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">理解度</h3>
      <p className="text-sm font-medium text-nordic-textPrimary">{view.stateLabel}</p>
      {view.showScore && (
        <p className="mt-1 text-sm text-nordic-textSecondary">
          {view.scoreText}
          {view.isReferenceScore ? "（参考値）" : ""}
        </p>
      )}
      <ul className="mt-2 space-y-0.5 text-sm text-nordic-textSecondary">
        <li>信頼度: {view.confidenceLabel}</li>
        {view.accuracyText && view.attemptText && (
          <li>
            正答率: {view.accuracyText}（{view.attemptText}）
          </li>
        )}
        {view.lastAnsweredText && (
          <li>
            最終学習: {view.lastAnsweredText} / {view.freshnessLabel}
          </li>
        )}
        {view.recentMarks && <li>直近: {view.recentMarks}</li>}
        {view.avgReactionText && <li>平均回答時間: {view.avgReactionText}</li>}
      </ul>
      <p className="mt-2 text-xs leading-relaxed text-nordic-textMuted">
        クイズ回答履歴から推定した習得状態です。概念の意味理解そのものを測った値ではありません。
      </p>
    </div>
  );
};

export const ConceptDetail = forwardRef<HTMLDivElement, Props>(({
  concept,
  conceptMap,
  domainColorMap: _domainColorMap,
  conceptQuizStatsText,
  conceptMastery,
  conceptMasteryHistory,
  onSelectRelated,
  onEdit,
  onToggleFavorite,
  onCreateQuizFromContextualCard,
  onRequestDelete,
  deleting,
  prerequisiteIndex,
  conceptMasteryMap,
  onOpenGraphAnalysis
}, ref) => {
  const targetConceptId = concept?.id;
  const learningSequence = useMemo(() => {
    if (!targetConceptId || !prerequisiteIndex) {
      return undefined;
    }
    return buildConceptLearningSequence({
      targetConceptId,
      prerequisiteIndex
    });
  }, [targetConceptId, prerequisiteIndex]);
  const personalizedLearningSequence = useMemo(() => {
    if (!targetConceptId || !prerequisiteIndex || !learningSequence) {
      return undefined;
    }
    return buildPersonalizedConceptLearningSequence({
      targetConceptId,
      prerequisiteIndex,
      masteryByConceptId: conceptMasteryMap ?? new Map(),
      fullSequence: learningSequence
    });
  }, [targetConceptId, prerequisiteIndex, conceptMasteryMap, learningSequence]);

  if (!concept) {
    return (
      <section className="concept-detail-panel concept-detail-empty w-full rounded-xl border border-nordic-border p-8">
        <img
          src={decorUrl("decorations/cup.png")}
          alt=""
          aria-hidden="true"
          className="study-empty-image"
          width={220}
          height={220}
        />
        <p className="max-w-sm text-sm leading-relaxed text-nordic-textSecondary">
          左の一覧から概念を選ぶと、定義・メモ・関連がこの紙面に現れます。
        </p>
      </section>
    );
  }

  const dependentIds = prerequisiteIndex?.dependentsByConceptId.get(concept.id) ?? [];
  const contextDefinitions = (concept.contextDefinitions ?? []).filter((item) => {
    const context = (item.context ?? "").trim();
    const definition = (item.definition ?? "").trim();
    return context !== "" || definition !== "";
  });

  return (
    <section
      ref={ref}
      className="concept-detail-panel w-full space-y-5 rounded-xl border border-nordic-border p-6"
    >
      <OrnamentLine variant="panel" />
      <header className="hud-detail-heading flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold text-nordic-textPrimary">{concept.title}</h2>
        {concept.favorite && (
          <span className="text-xs text-nordic-textSecondary">お気に入り</span>
        )}
        <StatusBadge status={getDisplayStatus(concept)} />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(concept)}
              className="detail-action-button"
            >
              編集
            </button>
          )}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(concept)}
              className="detail-action-button"
            >
              {concept.favorite ? "お気に入り解除" : "お気に入り"}
            </button>
          )}
          {onOpenGraphAnalysis && (
            <button
              type="button"
              onClick={() => onOpenGraphAnalysis(concept.id)}
              className="detail-action-button"
            >
              この概念を分析
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onRequestDelete(concept)}
          disabled={deleting}
          className="detail-delete-button"
        >
          {deleting ? "削除中..." : "削除"}
        </button>
      </div>

      {conceptMastery ? (
        <>
          <ConceptMasteryPanel mastery={conceptMastery} />
          <ConceptMasteryHistoryChart
            history={conceptMasteryHistory ?? []}
            confidence={conceptMastery.confidence}
          />
        </>
      ) : conceptQuizStatsText ? (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">学習状況</h3>
          <p className="text-sm text-nordic-textSecondary">{conceptQuizStatsText}</p>
        </div>
      ) : null}

      <ConceptMediaGallery concept={concept} />

      <article className="w-full max-w-4xl space-y-4 text-nordic-textPrimary">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">定義</h3>
          <p className="whitespace-pre-wrap break-words text-base leading-7">
            {concept.definition || <span className="concept-detail-muted">未入力</span>}
          </p>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">自分の解釈</h3>
          <p className="whitespace-pre-wrap break-words text-base leading-7">
            {concept.myInterpretation || <span className="concept-detail-muted">未入力</span>}
          </p>
        </div>
        {contextDefinitions.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">文脈別定義</h3>
            <div className="space-y-3">
              {contextDefinitions.map((ctxDef) => (
                <div key={ctxDef.id} className="detail-context-block">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-medium text-nordic-textPrimary">
                      {ctxDef.context.trim() || <span className="concept-detail-muted">文脈未指定</span>}
                    </h4>
                    {onCreateQuizFromContextualCard && ctxDef.definition.trim() ? (
                      <button
                        type="button"
                        className="rounded-lg border border-nordic-border px-2.5 py-1 text-xs text-nordic-textSecondary hover:border-nordic-accent/50 hover:text-nordic-accent"
                        onClick={() => onCreateQuizFromContextualCard(concept.id, ctxDef.id)}
                      >
                        この文脈別カードからクイズ作成
                      </button>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-nordic-textSecondary">
                    {ctxDef.definition.trim() || <span className="concept-detail-muted">定義未入力</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">メモ</h3>
          <p className="whitespace-pre-wrap break-words text-base leading-7">
            {concept.notes || <span className="concept-detail-muted">未入力</span>}
          </p>
        </div>
      </article>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">分野タグ</h3>
        <div className="flex flex-wrap gap-1">
          {concept.domainTags.length === 0 ? (
            <span className="text-sm text-nordic-textMuted">なし</span>
          ) : (
            concept.domainTags.map((tag) => (
              <span key={tag} className="detail-inline-tag">
                {tag}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">
          研究テーマタグ
        </h3>
        <div className="flex flex-wrap gap-1">
          {concept.researchTags.length === 0 ? (
            <span className="text-sm text-nordic-textMuted">なし</span>
          ) : (
            concept.researchTags.map((tag) => (
              <span key={tag} className="detail-inline-tag">
                {tag}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">関連概念</h3>
        {concept.relatedIds.length === 0 ? (
          <p className="text-sm text-nordic-textMuted">関連概念なし</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {concept.relatedIds.map((relatedId) => {
              const related = conceptMap.get(relatedId);
              if (!related) {
                return (
                  <li
                    key={relatedId}
                    className="text-xs text-amber-800"
                  >
                    不明なID: {relatedId}
                  </li>
                );
              }
              return (
                <li key={relatedId}>
                  <button
                    className="detail-related-link"
                    onClick={() => onSelectRelated(relatedId)}
                    type="button"
                  >
                    {related.title}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">前提概念</h3>
        {concept.prerequisiteIds.length === 0 ? (
          <p className="text-sm text-nordic-textMuted">前提概念なし</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {concept.prerequisiteIds.map((prerequisiteId) => {
              const prerequisite = conceptMap.get(prerequisiteId);
              if (!prerequisite) {
                return (
                  <li key={prerequisiteId} className="text-xs text-amber-800">
                    不明なID: {prerequisiteId}
                  </li>
                );
              }
              return (
                <li key={prerequisiteId}>
                  <button
                    className="detail-related-link"
                    onClick={() => onSelectRelated(prerequisiteId)}
                    type="button"
                  >
                    {prerequisite.title}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">
          この概念を前提とする概念
        </h3>
        {(dependentIds.length === 0) ? (
          <p className="text-sm text-nordic-textMuted">この概念を前提とする概念なし</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {dependentIds.map((dependentId) => {
              const dependent = conceptMap.get(dependentId);
              if (!dependent) {
                return (
                  <li key={dependentId} className="text-xs text-amber-800">
                    不明なID: {dependentId}
                  </li>
                );
              }
              return (
                <li key={dependentId}>
                  <button
                    className="detail-related-link"
                    onClick={() => onSelectRelated(dependentId)}
                    type="button"
                  >
                    {dependent.title}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {learningSequence && personalizedLearningSequence ? (
        <ConceptLearningSequenceSection
          result={learningSequence}
          personalizedResult={personalizedLearningSequence}
          conceptMap={conceptMap}
          onSelectRelated={onSelectRelated}
        />
      ) : null}

      <div className="detail-meta-block">
        <p>
          出典: {concept.source.book || <span className="concept-detail-muted">未入力</span>} / p.
          {concept.source.page || "-"} / {concept.source.author || <span className="concept-detail-muted">著者未入力</span>}
        </p>
        <p>作成: {shortDateTime(concept.createdAt)}</p>
        <p>更新: {shortDateTime(concept.updatedAt)}</p>
      </div>
    </section>
  );
});
