import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContextCard } from "../types/contextCard";
import { ContextCardsScreen } from "./ContextCardsScreen";

const iso = "2026-01-01T00:00:00.000Z";

const {
  saveContextCardWithConceptSync,
  reloadContextCards,
  reloadConcepts,
  getCards,
  setCards
} = vi.hoisted(() => {
  const cards: ContextCard[] = [];
  return {
    saveContextCardWithConceptSync: vi.fn(),
    reloadContextCards: vi.fn(),
    reloadConcepts: vi.fn(),
    getCards: () => cards,
    setCards: (next: ContextCard[]) => {
      cards.splice(0, cards.length, ...next);
    }
  };
});

const existingCard: ContextCard = {
  id: "card-old",
  title: "旧カード",
  domainTags: ["情報"],
  centralQuestion: "",
  background: "",
  flow: "",
  keyConcepts: "A",
  linkedConcepts: [],
  createdAt: iso,
  updatedAt: iso
};

vi.mock("../storage", () => ({
  getStorage: () => ({
    saveContextCardWithConceptSync,
    getAllConcepts: async () => [],
    getLearningMaterialsByContextCardId: async () => [],
    updateConcept: vi.fn()
  }),
  getContextStorage: () => ({
    getAllContextCards: async () => getCards(),
    createContextCard: vi.fn(),
    updateContextCard: vi.fn(),
    deleteContextCard: vi.fn()
  })
}));

vi.mock("../features/contextCards/useContextCards", () => ({
  useContextCards: () => ({
    contextCards: getCards(),
    loading: false,
    domains: [...new Set(getCards().map((card) => card.domainTags[0]).filter(Boolean))],
    reload: reloadContextCards,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  })
}));

vi.mock("../features/concepts/useConcepts", () => ({
  useConcepts: () => ({
    concepts: [],
    reload: reloadConcepts
  })
}));

vi.mock("../features/learningMaterials/useLearningMaterials", () => ({
  useLearningMaterials: () => ({
    materials: [],
    error: null,
    addPdf: vi.fn(),
    remove: vi.fn()
  })
}));

const openCreateModal = async () => {
  const user = userEvent.setup();
  render(<ContextCardsScreen onNavigateToConcept={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: /すべて/ }));
  await user.click(screen.getByRole("button", { name: "新規作成" }));
  return user;
};

describe("ContextCardsScreen atomic save (#200)", () => {
  beforeEach(() => {
    setCards([]);
    saveContextCardWithConceptSync.mockReset();
    reloadContextCards.mockReset();
    reloadConcepts.mockReset();
    reloadContextCards.mockResolvedValue(undefined);
    reloadConcepts.mockResolvedValue(undefined);
  });

  it("storage reject では成功feedbackもtoastもdetail遷移もなく modal が残る", async () => {
    saveContextCardWithConceptSync.mockRejectedValue(new Error("injected save failure"));
    const user = await openCreateModal();

    await user.type(screen.getByText("タイトル").parentElement!.querySelector("input")!, "新しいカード");
    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(
      await screen.findByText("文脈カードと重要概念の保存に失敗しました。変更は保存されていません。")
    ).toBeInTheDocument();
    expect(screen.getByText("文脈カードを作成")).toBeInTheDocument();
    expect(screen.queryByText("文脈カードを作成しました。")).not.toBeInTheDocument();
    expect(screen.queryByText(/件の概念を自動生成しました/)).not.toBeInTheDocument();
    expect(screen.queryByText("文脈カード詳細")).not.toBeInTheDocument();
  });

  it("成功時は modal close・detail・作成feedback・concept toast を出す", async () => {
    const saved: ContextCard = {
      ...existingCard,
      id: "card-new",
      title: "新しいカード",
      keyConcepts: "A, B"
    };
    saveContextCardWithConceptSync.mockImplementation(async () => {
      setCards([saved]);
      return {
        card: saved,
        createdCount: 2,
        updatedCount: 0,
        metadataUpdatedCount: 0
      };
    });
    reloadContextCards.mockImplementation(async () => undefined);

    const user = await openCreateModal();
    await user.type(screen.getByText("タイトル").parentElement!.querySelector("input")!, "新しいカード");
    await user.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(screen.queryByText("文脈カードを作成")).not.toBeInTheDocument();
    });
    expect(screen.getByText("文脈カードを作成しました。")).toBeInTheDocument();
    expect(screen.getByText("2件の概念を自動生成しました")).toBeInTheDocument();
    expect(screen.getByText("文脈カード詳細")).toBeInTheDocument();
  });

  it("edit の storage reject では更新成功表示も旧Card切替もなく modal が残る", async () => {
    setCards([existingCard]);
    saveContextCardWithConceptSync.mockRejectedValue(new Error("injected update failure"));
    const user = userEvent.setup();
    render(<ContextCardsScreen onNavigateToConcept={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /情報/ }));
    await user.click(screen.getByRole("button", { name: "編集" }));
    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(
      await screen.findByText("文脈カードと重要概念の保存に失敗しました。変更は保存されていません。")
    ).toBeInTheDocument();
    expect(screen.getByText("文脈カードを編集")).toBeInTheDocument();
    expect(screen.queryByText("文脈カードを更新しました。")).not.toBeInTheDocument();
    expect(screen.queryByText("文脈カード詳細")).not.toBeInTheDocument();
    expect(screen.getByText("旧カード")).toBeInTheDocument();
  });
});
