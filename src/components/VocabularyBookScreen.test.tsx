import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { createEmptyContextCardInput, type ContextCard } from "../types/contextCard";
import { VocabularyBookScreen } from "./VocabularyBookScreen";

const cards: ContextCard[] = [];
let cardsLoading = false;
let cardsError: string | null = null;

vi.mock("../features/contextCards/useContextCards", () => ({
  useContextCards: () => ({
    contextCards: cards,
    loading: cardsLoading,
    reloadError: cardsError,
    reload: vi.fn(),
    domains: [],
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  })
}));

vi.mock("../storage", () => ({
  getStorage: () => ({
    getMediaBlob: async () => null,
    saveContextCardWithConceptSync: vi.fn()
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

const concept = (id: string, domainTags: string[], title: string): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title,
  definition: `${title}の定義`,
  domainTags,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

const card = (id: string, title: string, domainTags: string[]): ContextCard => ({
  ...createEmptyContextCardInput(),
  id,
  title,
  domainTags,
  centralQuestion: `${title}の問い`,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

const setCards = (next: ContextCard[], loading = false, error: string | null = null) => {
  cards.splice(0, cards.length, ...next);
  cardsLoading = loading;
  cardsError = error;
};

const renderBook = (concepts: Concept[] = [], conceptsError: string | null = null, conceptsLoading = false) => {
  const conceptMap = new Map(concepts.map((item) => [item.id, item]));
  render(
    <VocabularyBookScreen
      concepts={concepts}
      conceptsLoading={conceptsLoading}
      conceptsError={conceptsError}
      conceptMap={conceptMap}
      domainColorMap={{}}
      deleting={false}
      onEditConcept={vi.fn()}
      onToggleFavorite={vi.fn()}
      onRequestDelete={vi.fn()}
    />
  );
};

describe("VocabularyBookScreen", () => {
  it("分野一覧から Concept と文脈カードを切り替えられる", async () => {
    const user = userEvent.setup();
    setCards([card("k1", "記憶のカード", ["心理学"])]);
    renderBook([concept("c1", ["心理学", "英語"], "記憶")]);

    expect(screen.getByRole("button", { name: /心理学/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /英語/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /心理学/ })).toHaveTextContent("Concept 1件");
    expect(screen.getByRole("button", { name: /心理学/ })).toHaveTextContent("文脈カード 1件");

    await user.click(screen.getByRole("button", { name: /心理学/ }));
    expect(screen.getByRole("button", { name: /記憶の定義/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /記憶のカード/ })).toBeInTheDocument();
    expect(screen.getAllByText("Concept").length).toBeGreaterThan(1);
    expect(screen.getAllByText("文脈カード").length).toBeGreaterThan(1);

    await user.click(screen.getByRole("button", { name: "Concept", pressed: false }));
    expect(screen.queryByRole("button", { name: /記憶のカード/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /記憶の定義/ })).toBeInTheDocument();
  });

  it("未登録のときは空状態を出す", () => {
    setCards([]);
    renderBook([]);
    expect(screen.getByTestId("vocabulary-empty-none")).toBeInTheDocument();
  });

  it("種別を絞って0件のときは読み込み失敗と区別する", async () => {
    const user = userEvent.setup();
    setCards([]);
    renderBook([concept("c1", ["哲学"], "存在")]);
    await user.click(screen.getByRole("button", { name: /哲学/ }));
    await user.click(screen.getByRole("button", { name: "文脈カード" }));
    expect(screen.getByTestId("vocabulary-empty-kind")).toBeInTheDocument();
    expect(screen.queryByTestId("vocabulary-load-error")).not.toBeInTheDocument();
  });

  it("読み込み失敗を0件として扱わない", () => {
    setCards([], false, "context read failed");
    renderBook([concept("c1", ["英語"], "apple")]);
    expect(screen.getByTestId("vocabulary-load-error")).toHaveTextContent("context read failed");
    expect(screen.queryByTestId("vocabulary-empty-none")).not.toBeInTheDocument();
  });
});
