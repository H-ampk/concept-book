import { useEffect, useRef, useState, type Ref } from "react";
import { ConceptDetail } from "./ConceptDetail";
import { ContextCardDetail, RelatedConceptsScreen } from "./ContextCardsScreen";
import { ContextCardFormModal } from "./ContextCardFormModal";
import { useContextCards } from "../features/contextCards/useContextCards";
import { getStorage } from "../storage";
import type { Concept } from "../types/concept";
import type { ContextCard, ContextCardInput } from "../types/contextCard";
import type { ConceptPrerequisiteIndex } from "../utils/conceptPrerequisites";
import {
  buildVocabularyDomainSummaries,
  buildVocabularyEntries,
  type VocabularyKindFilter
} from "../utils/vocabularyBook";

type View =
  | { name: "domains" }
  | { name: "entries" }
  | { name: "concept"; conceptId: string; back: { name: "entries" } | { name: "context"; cardId: string } }
  | { name: "context"; cardId: string }
  | { name: "related"; cardId: string };

type Props = {
  concepts: Concept[];
  conceptsLoading: boolean;
  conceptsError: string | null;
  conceptMap: Map<string, Concept>;
  domainColorMap: Record<string, string>;
  prerequisiteIndex?: ConceptPrerequisiteIndex;
  mutationDisabled?: boolean;
  deleting: boolean;
  onEditConcept: (concept: Concept) => void;
  onToggleFavorite: (concept: Concept) => void;
  onRequestDelete: (concept: Concept) => void;
  onCreateQuizFromContextCard?: (contextCardId: string) => void;
  onConceptsChanged?: () => Promise<void> | void;
};

const kindOptions: { value: VocabularyKindFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "concept", label: "Concept" },
  { value: "context", label: "文脈カード" }
];

export const VocabularyDomainList = ({
  concepts,
  contextCards,
  onSelectDomain
}: {
  concepts: Concept[];
  contextCards: Parameters<typeof buildVocabularyDomainSummaries>[1];
  onSelectDomain: (domain: string) => void;
}) => {
  const summaries = buildVocabularyDomainSummaries(concepts, contextCards);
  if (summaries.length === 0) {
    return (
      <section
        className="rounded-3xl border border-celestial-border bg-celestial-panel p-6"
        data-testid="vocabulary-empty-none"
      >
        <h2 className="text-lg font-semibold text-celestial-textMain">まだ登録がありません</h2>
        <p className="mt-2 text-sm text-celestial-textSub">
          Concept か文脈カードを登録すると、分野ごとの単語帳を開けます。
        </p>
      </section>
    );
  }

  return (
    <section data-testid="vocabulary-domain-list">
      <h2 className="text-lg font-semibold text-celestial-textMain">分野</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summaries.map((summary) => (
          <button
            key={summary.domain}
            type="button"
            className="rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue p-4 text-left hover:bg-celestial-gold/10"
            onClick={() => onSelectDomain(summary.domain)}
          >
            <p className="text-base font-semibold text-celestial-gold">{summary.domain}</p>
            <p className="mt-2 text-sm text-celestial-textSub">Concept {summary.conceptCount}件</p>
            <p className="text-sm text-celestial-textSub">文脈カード {summary.contextCardCount}件</p>
          </button>
        ))}
      </div>
    </section>
  );
};

export const VocabularyEntryList = ({
  domain,
  concepts,
  contextCards,
  kind,
  onKindChange,
  onBack,
  onOpenConcept,
  onOpenContextCard,
  listRef
}: {
  domain: string;
  concepts: Concept[];
  contextCards: Parameters<typeof buildVocabularyEntries>[2];
  kind: VocabularyKindFilter;
  onKindChange: (kind: VocabularyKindFilter) => void;
  onBack: () => void;
  onOpenConcept: (id: string) => void;
  onOpenContextCard: (id: string) => void;
  listRef: Ref<HTMLDivElement>;
}) => {
  const entries = buildVocabularyEntries(domain, concepts, contextCards, kind);
  const domainEntries = buildVocabularyEntries(domain, concepts, contextCards, "all");

  return (
    <section className="space-y-4" data-testid="vocabulary-entry-list">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-celestial-textMain">{domain}</h2>
          <p className="text-sm text-celestial-textSub">この分野の Concept と文脈カード</p>
        </div>
        <button
          type="button"
          className="rounded-2xl border border-celestial-gold/30 px-4 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
          onClick={onBack}
        >
          分野一覧へ戻る
        </button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="表示するカード種別">
        {kindOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={kind === option.value}
            className={`index-filter-chip${kind === option.value ? " index-filter-chip--active" : ""}`}
            onClick={() => onKindChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {domainEntries.length === 0 ? (
        <p className="text-sm text-celestial-textSub" data-testid="vocabulary-empty-domain">
          この分野に該当するデータはありません。
        </p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-celestial-textSub" data-testid="vocabulary-empty-kind">
          この種別のカードはありません。
        </p>
      ) : (
        <div ref={listRef} className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <button
              key={`${entry.kind}-${entry.id}`}
              type="button"
              className={`rounded-2xl border p-4 text-left ${
                entry.kind === "concept"
                  ? "border-celestial-gold/50 bg-celestial-panel"
                  : "border-sky-400/40 bg-celestial-deepBlue"
              }`}
              onClick={() =>
                entry.kind === "concept" ? onOpenConcept(entry.id) : onOpenContextCard(entry.id)
              }
            >
              <p className="text-xs text-celestial-softGold">
                {entry.kind === "concept" ? "Concept" : "文脈カード"}
              </p>
              <h3 className="mt-1 text-base font-semibold text-celestial-textMain">{entry.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm text-celestial-textSub">{entry.summary}</p>
              <p className="mt-2 text-xs text-celestial-textSub">分野: {entry.domains.join("、")}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export const VocabularyBookScreen = ({
  concepts,
  conceptsLoading,
  conceptsError,
  conceptMap,
  domainColorMap,
  prerequisiteIndex,
  mutationDisabled,
  deleting,
  onEditConcept,
  onToggleFavorite,
  onRequestDelete,
  onCreateQuizFromContextCard,
  onConceptsChanged
}: Props) => {
  const {
    contextCards,
    loading: contextCardsLoading,
    reloadError: contextCardsError,
    reload: reloadContextCards
  } = useContextCards();
  const [editingCard, setEditingCard] = useState<ContextCard | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [view, setView] = useState<View>({ name: "domains" });
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [kind, setKind] = useState<VocabularyKindFilter>("all");
  const entryScrollRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef(0);

  const loading = conceptsLoading || contextCardsLoading;
  const loadError = conceptsError ?? contextCardsError;

  useEffect(() => {
    if (view.name !== "entries") {
      return;
    }
    const node = entryScrollRef.current;
    if (node) {
      node.scrollTop = savedScrollRef.current;
    }
  }, [view]);

  const rememberScroll = () => {
    savedScrollRef.current = entryScrollRef.current?.scrollTop ?? 0;
  };

  const handleContextSubmit = async (payload: ContextCardInput) => {
    const isEdit = Boolean(editingCard);
    const result = await getStorage().saveContextCardWithConceptSync({
      mode: isEdit ? "edit" : "create",
      contextCardId: editingCard?.id,
      input: payload
    });
    await reloadContextCards();
    await onConceptsChanged?.();
    return result.card;
  };

  const openEntries = (domain: string) => {
    savedScrollRef.current = 0;
    setSelectedDomain(domain);
    setView({ name: "entries" });
  };

  return (
    <div className="space-y-4" data-testid="vocabulary-book">
      <section className="rounded-3xl border border-celestial-border bg-celestial-panel p-6 shadow-celestial">
        <h1 className="text-xl font-semibold text-celestial-gold">単語帳</h1>
        <p className="mt-1 text-sm text-celestial-textSub">
          登録済みの Concept と文脈カードを分野ごとに閲覧します。データは複製しません。
        </p>
      </section>

      {loading ? (
        <p className="text-sm text-celestial-textSub" data-testid="vocabulary-loading">
          読み込み中...
        </p>
      ) : loadError ? (
        <p className="text-sm text-celestial-textMain" role="alert" data-testid="vocabulary-load-error">
          読み込みに失敗しました。{loadError}
        </p>
      ) : view.name === "domains" || !selectedDomain ? (
        <VocabularyDomainList
          concepts={concepts}
          contextCards={contextCards}
          onSelectDomain={openEntries}
        />
      ) : view.name === "entries" ? (
        <VocabularyEntryList
          domain={selectedDomain}
          concepts={concepts}
          contextCards={contextCards}
          kind={kind}
          onKindChange={setKind}
          onBack={() => setView({ name: "domains" })}
          listRef={entryScrollRef}
          onOpenConcept={(conceptId) => {
            rememberScroll();
            setView({ name: "concept", conceptId, back: { name: "entries" } });
          }}
          onOpenContextCard={(cardId) => {
            rememberScroll();
            setView({ name: "context", cardId });
          }}
        />
      ) : view.name === "concept" ? (
        <div className="space-y-3">
          <button
            type="button"
            className="index-text-button"
            onClick={() => setView(view.back.name === "entries" ? { name: "entries" } : view.back)}
          >
            単語帳へ戻る
          </button>
          <ConceptDetail
            concept={conceptMap.get(view.conceptId) ?? concepts.find((item) => item.id === view.conceptId)}
            conceptMap={conceptMap}
            domainColorMap={domainColorMap}
            prerequisiteIndex={prerequisiteIndex}
            onEdit={onEditConcept}
            onToggleFavorite={onToggleFavorite}
            onRequestDelete={onRequestDelete}
            deleting={deleting}
            mutationDisabled={mutationDisabled}
            onSelectRelated={(id) => setView({ name: "concept", conceptId: id, back: view.back })}
          />
        </div>
      ) : view.name === "related" ? (
        (() => {
          const card = contextCards.find((item) => item.id === view.cardId);
          if (!card) {
            return (
              <p className="text-sm text-celestial-textSub">表示する文脈カードが見つかりません。</p>
            );
          }
          return (
            <RelatedConceptsScreen
              contextCard={card}
              concepts={concepts}
              onBack={() => setView({ name: "context", cardId: view.cardId })}
              onNavigateToConcept={(conceptId) =>
                setView({ name: "concept", conceptId, back: { name: "context", cardId: view.cardId } })
              }
            />
          );
        })()
      ) : (
        <ContextCardDetail
          card={contextCards.find((card) => card.id === view.cardId)}
          concepts={concepts}
          onBack={() => setView({ name: "entries" })}
          onEdit={(card) => {
            setEditingCard(card);
            setModalOpen(true);
          }}
          onNavigateToConcept={(conceptId) =>
            setView({ name: "concept", conceptId, back: { name: "context", cardId: view.cardId } })
          }
          onViewRelatedConcepts={() => setView({ name: "related", cardId: view.cardId })}
          onCreateQuiz={
            onCreateQuizFromContextCard
              ? (card) => onCreateQuizFromContextCard(card.id)
              : undefined
          }
        />
      )}
      <ContextCardFormModal
        open={modalOpen}
        mode="edit"
        baseContextCard={editingCard}
        onClose={() => setModalOpen(false)}
        onSubmit={handleContextSubmit}
      />
    </div>
  );
};
