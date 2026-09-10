import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import type { ConceptMastery } from "../utils/mastery/types";
import { ConceptList } from "./ConceptList";

const scrollToIndex = vi.fn();
const measure = vi.fn();
const measureElement = vi.fn();
const getVirtualItems = vi.fn(() => [] as { index: number; start: number }[]);
const getTotalSize = vi.fn(() => 0);

let isMobile = true;

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: () => ({
    scrollToIndex,
    measure,
    measureElement,
    getVirtualItems,
    getTotalSize
  })
}));

vi.mock("../hooks/useMatchMedia", () => ({
  useMatchMedia: () => isMobile
}));

const concept = (id: string, title = id): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

const renderList = (
  concepts: Concept[],
  selectedId?: string,
  searchQuery = ""
) =>
  render(
    <ConceptList
      concepts={concepts}
      selectedId={selectedId}
      domainColorMap={{}}
      onSelect={vi.fn()}
      cardRefs={{ current: new Map() }}
      searchQuery={searchQuery}
    />
  );

describe("ConceptList selectedId auto-scroll (#145)", () => {
  beforeEach(() => {
    isMobile = true;
    scrollToIndex.mockClear();
    measure.mockClear();
  });

  it("mobileでselectedId変更時はscrollToIndexする", () => {
    const items = [concept("a"), concept("b"), concept("c")];
    const { rerender } = renderList(items, "a");
    expect(scrollToIndex).toHaveBeenCalledWith(0, { align: "center" });

    scrollToIndex.mockClear();
    rerender(
      <ConceptList
        concepts={items}
        selectedId="c"
        domainColorMap={{}}
        onSelect={vi.fn()}
        cardRefs={{ current: new Map() }}
      />
    );
    expect(scrollToIndex).toHaveBeenCalledWith(2, { align: "center" });
  });

  it("searchQuery / concepts変更のみでは同じselectedIdへscrollToIndexし直さない", () => {
    const items = [concept("a"), concept("b"), concept("c")];
    const { rerender } = renderList(items, "b");
    scrollToIndex.mockClear();

    rerender(
      <ConceptList
        concepts={items}
        selectedId="b"
        domainColorMap={{}}
        onSelect={vi.fn()}
        cardRefs={{ current: new Map() }}
        searchQuery="フィードバック"
      />
    );
    expect(scrollToIndex).not.toHaveBeenCalled();

    rerender(
      <ConceptList
        concepts={[items[1], items[2]]}
        selectedId="b"
        domainColorMap={{}}
        onSelect={vi.fn()}
        cardRefs={{ current: new Map() }}
        searchQuery="フィードバック"
      />
    );
    expect(scrollToIndex).not.toHaveBeenCalled();
  });

  it("selectedIdが集合外ならscrollしない", () => {
    const items = [concept("a"), concept("b")];
    renderList(items, "missing");
    expect(scrollToIndex).not.toHaveBeenCalled();
  });

  it("desktopではscrollToIndexしない", () => {
    isMobile = false;
    renderList([concept("a"), concept("b")], "b");
    expect(scrollToIndex).not.toHaveBeenCalled();
  });
});

const mastery = (id: string, overrides: Partial<ConceptMastery>): ConceptMastery => ({
  conceptId: id,
  masteryProbability: 0.2,
  masteryScore: 20,
  state: "unlearned",
  attemptCount: 0,
  correctCount: 0,
  incorrectCount: 0,
  accuracy: null,
  confidence: "none",
  lastAnsweredAt: null,
  freshness: "never",
  recentResults: [],
  avgReactionTimeMs: null,
  ...overrides
});

describe("ConceptList mastery overview (#56)", () => {
  beforeEach(() => {
    isMobile = false;
  });

  const renderWithMastery = (
    items: Concept[],
    conceptMasteryMap: Map<string, ConceptMastery>,
    searchQuery = ""
  ) =>
    render(
      <ConceptList
        concepts={items}
        domainColorMap={{}}
        onSelect={vi.fn()}
        cardRefs={{ current: new Map() }}
        conceptMasteryMap={conceptMasteryMap}
        searchQuery={searchQuery}
      />
    );

  it("mastery 表示が出る", () => {
    renderWithMastery(
      [concept("learned", "学習済み概念")],
      new Map([
        [
          "learned",
          mastery("learned", {
            state: "developing",
            masteryScore: 67,
            attemptCount: 6,
            confidence: "high",
            freshness: "fresh"
          })
        ]
      ])
    );
    expect(screen.getByText("理解度 67 · 理解が進んでいる")).toBeInTheDocument();
  });

  it("未学習を区別する", () => {
    renderWithMastery(
      [concept("unseen", "未学習概念")],
      new Map([["unseen", mastery("unseen", { state: "unlearned", masteryScore: 20 })]])
    );
    expect(screen.getByText("未学習")).toBeInTheDocument();
    expect(screen.queryByText(/理解度 20/)).not.toBeInTheDocument();
  });

  it("データ不足を区別する", () => {
    renderWithMastery(
      [concept("thin", "データ不足概念")],
      new Map([
        [
          "thin",
          mastery("thin", {
            state: "insufficient-data",
            masteryScore: 28,
            attemptCount: 1,
            confidence: "low",
            freshness: "fresh"
          })
        ]
      ])
    );
    expect(screen.getByText("データ不足")).toBeInTheDocument();
    expect(screen.queryByText(/理解度 28/)).not.toBeInTheDocument();
  });

  it("stale で要再確認を出す", () => {
    renderWithMastery(
      [concept("stale", "要再確認概念")],
      new Map([
        [
          "stale",
          mastery("stale", {
            state: "developing",
            masteryScore: 67,
            attemptCount: 6,
            confidence: "high",
            freshness: "stale"
          })
        ]
      ])
    );
    expect(screen.getByText("理解度 67 · 理解が進んでいる · 要再確認")).toBeInTheDocument();
  });

  it("search highlight と共存する", () => {
    renderWithMastery(
      [concept("a", "フィードバック制御")],
      new Map([["a", mastery("a", { state: "unlearned" })]]),
      "フィードバック"
    );
    expect(screen.getByText("フィードバック")).toHaveClass("concept-search-mark");
    expect(screen.getByText("未学習")).toBeInTheDocument();
  });

  it("mobile virtualization の scroll コンテナは mastery map があっても残る", () => {
    isMobile = true;
    getVirtualItems.mockReturnValueOnce([]);
    render(
      <ConceptList
        concepts={[concept("a"), concept("b")]}
        domainColorMap={{}}
        onSelect={vi.fn()}
        cardRefs={{ current: new Map() }}
        conceptMasteryMap={new Map([["a", mastery("a", { state: "unlearned" })]])}
      />
    );
    expect(screen.getByTestId("concept-list-virtual-scroll")).toBeInTheDocument();
  });
});
