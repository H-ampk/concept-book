import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
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
