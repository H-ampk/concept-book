import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Concept } from "../types/concept";

const { reload, concept, concepts, emptyTags } = vi.hoisted(() => {
  const reload = vi.fn(async () => undefined);
  const concept: Concept = {
    id: "concept-a",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    title: "概念A",
    definition: "定義",
    myInterpretation: "",
    domainTags: [],
    researchTags: [],
    relatedIds: [],
    prerequisiteIds: [],
    media: [],
    source: { book: "", page: "", author: null },
    notes: "",
    status: "active",
    favorite: false,
    contextDefinitions: []
  };
  const concepts = [concept];
  const emptyTags: string[] = [];
  return { reload, concept, concepts, emptyTags };
});

vi.mock("../storage", () => {
  const methods: Record<string, unknown> = {
    getQuizAttemptLogs: vi.fn(async () => []),
    getQuizQuestions: vi.fn(async () => []),
    getAllConcepts: vi.fn(async () => []),
    getMediaBlob: vi.fn(async () => undefined)
  };
  const storage = new Proxy(methods, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return vi.fn(async () => []);
    }
  });
  return {
    getStorage: () => storage,
    getContextStorage: () => storage
  };
});

vi.mock("../features/concepts/useConcepts", () => ({
  useConcepts: () => ({
    concepts,
    visibleConcepts: concepts,
    debouncedSearchQuery: "",
    allDomainTags: emptyTags,
    allResearchTags: emptyTags,
    loading: false,
    reloadError: "injected read failure",
    isStale: true,
    canMutateConcepts: false,
    query: "",
    setQuery: vi.fn(),
    selectedDomainTags: emptyTags,
    setSelectedDomainTags: vi.fn(),
    selectedResearchTags: emptyTags,
    setSelectedResearchTags: vi.fn(),
    selectedStatuses: emptyTags,
    setSelectedStatuses: vi.fn(),
    onlyFavorite: false,
    setOnlyFavorite: vi.fn(),
    saveWithMediaDraft: vi.fn(),
    remove: vi.fn(),
    reload,
    toggleFavorite: vi.fn()
  })
}));

import { App } from "./App";

describe("App concept reload failure UI (#201)", () => {
  beforeEach(() => {
    reload.mockClear();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn()
    });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn()
    });
  });

  it("stale banner を表示し mutation UI を無効化する", async () => {
    const user = userEvent.setup();
    render(<App />);

    const banner = await screen.findByTestId("concept-reload-error");
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveTextContent("概念データの再読み込みに失敗しました。");
    expect(banner).toHaveTextContent("前回の読み込み成功時点");
    const retry = screen.getByRole("button", { name: "再読み込み" });
    expect(retry).toBeInTheDocument();

    await user.click(retry);
    expect(reload).toHaveBeenCalledTimes(1);

    expect(screen.getByRole("button", { name: "概念を追加" })).toBeDisabled();

    const listItem = screen.getByTestId("concept-list-item-concept-a");
    await user.click(within(listItem).getByRole("button"));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "編集" })).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "お気に入り" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "削除" })).toBeDisabled();
  });
});
