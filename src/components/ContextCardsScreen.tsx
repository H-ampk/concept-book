import { useMemo, useState } from "react";
import { ContextCardFormModal } from "./ContextCardFormModal";
import { useContextCards } from "../features/contextCards/useContextCards";
import type { ContextCard, ContextCardInput } from "../types/contextCard";

const domainLabel = (domain: string) => (domain === "all" ? "すべて" : domain);

const DomainSelection = ({
  domains,
  onSelectDomain
}: {
  domains: string[];
  onSelectDomain: (domain: string) => void;
}) => (
  <section className="rounded-3xl border border-celestial-border bg-celestial-panel p-6 shadow-celestial backdrop-blur-sm">
    <div className="mb-4">
      <h2 className="text-xl font-semibold text-celestial-textMain">文脈カードの分野を選択</h2>
      <p className="mt-2 text-sm text-celestial-textSub">分野を選ぶと、その分野の文脈カード一覧に進みます。</p>
    </div>
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        className="rounded-2xl border border-celestial-gold/30 bg-celestial-panel px-4 py-3 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
        onClick={() => onSelectDomain("all")}
      >
        すべて
      </button>
      {domains.map((domain) => (
        <button
          key={domain}
          type="button"
          className="rounded-2xl border border-celestial-gold/30 bg-celestial-panel px-4 py-3 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
          onClick={() => onSelectDomain(domain)}
        >
          {domain}
        </button>
      ))}
    </div>
    {domains.length === 0 && (
      <p className="mt-4 text-sm text-celestial-textSub">まだ文脈カードがありません。新規作成で文脈カードを追加してください。</p>
    )}
  </section>
);

const ContextCardList = ({
  cards,
  selectedDomain,
  onBack,
  onCreate,
  onSelect,
  onEdit
}: {
  cards: ContextCard[];
  selectedDomain: string;
  onBack: () => void;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onEdit: (card: ContextCard) => void;
}) => (
  <section className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-celestial-textMain">文脈カード一覧</h2>
        <p className="mt-1 text-sm text-celestial-textSub">{domainLabel(selectedDomain)} の文脈カードを表示しています。</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-2xl border border-celestial-gold/30 bg-celestial-panel px-4 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
          onClick={onBack}
        >
          分野選択へ戻る
        </button>
        <button
          type="button"
          className="rounded-2xl bg-celestial-gold px-4 py-2 text-sm text-celestial-base hover:bg-celestial-softGold"
          onClick={onCreate}
        >
          新規作成
        </button>
      </div>
    </div>

    {cards.length === 0 ? (
      <div className="rounded-3xl border border-celestial-border bg-celestial-deepBlue p-6 text-sm text-celestial-textSub">
        選択した分野の文脈カードはありません。新規作成で追加してください。
      </div>
    ) : (
      <div className="grid gap-4">
        {cards.map((card) => (
          <div key={card.id} className="rounded-3xl border border-celestial-border bg-celestial-panel p-5 shadow-celestial">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <button
                  type="button"
                  className="text-left text-lg font-semibold text-celestial-gold hover:underline"
                  onClick={() => onSelect(card.id)}
                >
                  {card.title || "無題の文脈カード"}
                </button>
                <p className="text-sm text-celestial-textSub">分野: {card.domainTags[0] || "未設定"}</p>
                <p className="text-sm text-celestial-textMain">{card.centralQuestion || "中心的な問いは未入力です。"}</p>
                <p className="text-sm text-celestial-textSub line-clamp-2">重要概念: {card.keyConcepts || "未入力"}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-2xl border border-celestial-gold/30 bg-celestial-panel px-3 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
                  onClick={() => onEdit(card)}
                >
                  編集
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

const ContextCardDetail = ({
  card,
  onBack,
  onEdit
}: {
  card?: ContextCard;
  onBack: () => void;
  onEdit: (card: ContextCard) => void;
}) => {
  if (!card) {
    return (
      <section className="rounded-3xl border border-celestial-border bg-celestial-panel p-6 shadow-celestial backdrop-blur-sm">
        <button
          type="button"
          className="rounded-2xl border border-celestial-gold/30 bg-celestial-panel px-3 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
          onClick={onBack}
        >
          一覧へ戻る
        </button>
        <p className="mt-4 text-sm text-celestial-textSub">表示する文脈カードが選択されていません。</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-celestial-border bg-celestial-panel p-6 shadow-celestial backdrop-blur-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-celestial-textMain">文脈カード詳細</h2>
          <p className="mt-1 text-sm text-celestial-textSub">保存日時: {card.createdAt} / 更新日時: {card.updatedAt}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-2xl border border-celestial-gold/30 bg-celestial-panel px-4 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
            onClick={onBack}
          >
            一覧へ戻る
          </button>
          <button
            type="button"
            className="rounded-2xl bg-celestial-gold px-4 py-2 text-sm text-celestial-base hover:bg-celestial-softGold"
            onClick={() => onEdit(card)}
          >
            編集
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <div className="space-y-2 rounded-2xl border border-celestial-border bg-celestial-deepBlue p-4">
          <p className="text-sm text-celestial-softGold">分野</p>
          <p className="text-base text-celestial-textMain">{card.domainTags.length > 0 ? card.domainTags.join("、") : "未設定"}</p>
        </div>

        <div className="space-y-2 rounded-2xl border border-celestial-border bg-celestial-deepBlue p-4">
          <p className="text-sm text-celestial-softGold">中心的な問い</p>
          <p className="whitespace-pre-wrap text-base text-celestial-textMain">{card.centralQuestion || "未入力"}</p>
        </div>

        <div className="space-y-2 rounded-2xl border border-celestial-border bg-celestial-deepBlue p-4">
          <p className="text-sm text-celestial-softGold">背景</p>
          <p className="whitespace-pre-wrap text-base text-celestial-textMain">{card.background || "未入力"}</p>
        </div>

        <div className="space-y-2 rounded-2xl border border-celestial-border bg-celestial-deepBlue p-4">
          <p className="text-sm text-celestial-softGold">流れ</p>
          <p className="whitespace-pre-wrap text-base text-celestial-textMain">{card.flow || "未入力"}</p>
        </div>

        <div className="space-y-2 rounded-2xl border border-celestial-border bg-celestial-deepBlue p-4">
          <p className="text-sm text-celestial-softGold">重要概念</p>
          <p className="whitespace-pre-wrap text-base text-celestial-textMain">{card.keyConcepts || "未入力"}</p>
        </div>
      </div>
    </section>
  );
};

export const ContextCardsScreen = () => {
  const { contextCards, loading, domains, create, update } = useContextCards();
  const [activeScreen, setActiveScreen] = useState<"selection" | "list" | "detail">("selection");
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContext, setEditingContext] = useState<ContextCard | undefined>(undefined);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filteredCards = useMemo(
    () =>
      selectedDomain === "all"
        ? contextCards
        : contextCards.filter((card) => card.domainTags[0] === selectedDomain),
    [contextCards, selectedDomain]
  );

  const selectedCard = useMemo(
    () => selectedId ? contextCards.find((card) => card.id === selectedId) : undefined,
    [contextCards, selectedId]
  );

  const handleSelectDomain = (domain: string) => {
    setSelectedDomain(domain);
    setSelectedId(undefined);
    setActiveScreen("list");
  };

  const openCreate = () => {
    setEditingContext(undefined);
    setModalOpen(true);
  };

  const openEdit = (card: ContextCard) => {
    setEditingContext(card);
    setModalOpen(true);
  };

  const handleSubmit = async (payload: ContextCardInput) => {
    if (editingContext) {
      const updated = await update(editingContext.id, payload);
      if (updated) {
        setSelectedId(updated.id);
        setActiveScreen("detail");
        setFeedback("文脈カードを更新しました。");
        return updated;
      }
      return undefined;
    }
    const created = await create(payload);
    setSelectedId(created.id);
    setActiveScreen("detail");
    setFeedback("文脈カードを作成しました。");
    return created;
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleSelectCard = (id: string) => {
    setSelectedId(id);
    setActiveScreen("detail");
  };

  const handleBackToSelection = () => {
    setActiveScreen("selection");
    setSelectedId(undefined);
    setSelectedDomain("all");
  };

  const handleBackToList = () => {
    setActiveScreen("list");
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-celestial-border bg-celestial-panel p-6 shadow-celestial backdrop-blur-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-celestial-gold">文脈カード</h1>
            <p className="text-sm text-celestial-textSub">分野を選択して、文脈カードを一覧・詳細・編集できます。</p>
          </div>
          {activeScreen !== "selection" && (
            <button
              type="button"
              className="rounded-2xl border border-celestial-gold/30 bg-celestial-panel px-4 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
              onClick={handleBackToSelection}
            >
              最初の画面に戻る
            </button>
          )}
        </div>
      </section>

      {feedback && (
        <div className="rounded-2xl border border-celestial-border bg-celestial-deepBlue px-4 py-3 text-sm text-celestial-textMain">
          {feedback}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-celestial-textSub">読み込み中...</p>
      ) : activeScreen === "selection" ? (
        <DomainSelection domains={domains} onSelectDomain={handleSelectDomain} />
      ) : activeScreen === "list" ? (
        <ContextCardList
          cards={filteredCards}
          selectedDomain={selectedDomain}
          onBack={handleBackToSelection}
          onCreate={openCreate}
          onSelect={handleSelectCard}
          onEdit={openEdit}
        />
      ) : (
        <ContextCardDetail card={selectedCard} onBack={handleBackToList} onEdit={openEdit} />
      )}

      <ContextCardFormModal
        open={modalOpen}
        mode={editingContext ? "edit" : "create"}
        baseContextCard={editingContext}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
};
