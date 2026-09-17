import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Concept } from "../types/concept";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../types/quiz";

const {
  getAllConcepts,
  getQuizAttemptLogs,
  getConceptById,
  capturedGraph,
  storedConcepts,
  conceptA,
  conceptB
} = vi.hoisted(() => {
  const createEmpty = () => ({
    title: "",
    definition: "",
    myInterpretation: "",
    domainTags: [] as string[],
    researchTags: [] as string[],
    relatedIds: [] as string[],
    prerequisiteIds: [] as string[],
    media: [],
    source: { book: "", page: "", author: null as string | null },
    notes: "",
    status: "draft" as const,
    favorite: false,
    contextDefinitions: []
  });

  const conceptA = (overrides: Partial<Concept> = {}): Concept => ({
    ...createEmpty(),
    id: "concept-a",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    title: "概念A",
    definition: "Aの定義",
    domainTags: ["AI"],
    status: "active",
    favorite: false,
    ...overrides
  });

  const conceptB = (overrides: Partial<Concept> = {}): Concept => ({
    ...createEmpty(),
    id: "concept-b",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z",
    title: "概念B",
    definition: "Bの定義",
    domainTags: ["HCI"],
    status: "active",
    favorite: true,
    ...overrides
  });

  return {
    getAllConcepts: vi.fn(),
    getQuizAttemptLogs: vi.fn(),
    getConceptById: vi.fn(),
    storedConcepts: { current: [] as Concept[] },
    capturedGraph: {
      conceptIds: [] as string[],
      selectedId: undefined as string | undefined
    },
    conceptA,
    conceptB
  };
});

vi.mock("../storage", () => {
  const methods: Record<string, unknown> = {
    getAllConcepts,
    getQuizAttemptLogs,
    getConceptById,
    updateConcept: vi.fn(async () => undefined),
    getMediaBlob: vi.fn(async () => undefined),
    getAllContextCards: vi.fn(async () => [])
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

vi.mock("../components/ContextCardsScreen", () => ({
  ContextCardsScreen: ({
    onNavigateToConcept
  }: {
    onNavigateToConcept: (id: string) => void | Promise<void>;
  }) => (
    <button
      type="button"
      onClick={() => {
        if (!storedConcepts.current.some((item) => item.id === "concept-a")) {
          storedConcepts.current = [...storedConcepts.current, conceptA()];
        }
        void onNavigateToConcept("concept-a");
      }}
    >
      mock-open-context-concept
    </button>
  )
}));

vi.mock("../components/QuizAnalysisDashboardPage", () => ({
  QuizAnalysisDashboardPage: ({
    onOpenConcept
  }: {
    onOpenConcept?: (conceptId: string) => void;
  }) => (
    <button type="button" onClick={() => onOpenConcept?.("concept-a")}>
      mock-open-dashboard-concept
    </button>
  )
}));

vi.mock("../components/ConceptGraphAnalysisPage", () => ({
  ConceptGraphAnalysisPage: ({
    onOpenConceptInGraph
  }: {
    onOpenConceptInGraph?: (conceptId: string) => void;
  }) => (
    <button type="button" onClick={() => onOpenConceptInGraph?.("concept-a")}>
      mock-open-graph-analysis-concept
    </button>
  )
}));

vi.mock("../components/ConceptGraphView", () => ({
  ConceptGraphView: (props: { concepts: { id: string }[]; selectedId?: string }) => {
    capturedGraph.conceptIds = props.concepts.map((item) => item.id);
    capturedGraph.selectedId = props.selectedId;
    return <div data-testid="concept-graph-view">graph</div>;
  }
}));

import { App } from "./App";

const log = (overrides: Partial<QuizAttemptLog> = {}): QuizAttemptLog => ({
  id: "log-1",
  questionId: "q1",
  questionType: "multiple-choice",
  questionPromptSnapshot: "問い",
  selectedChoiceId: "c1",
  selectedChoiceTextSnapshot: "選択",
  correctChoiceId: "c1",
  correctChoiceTextSnapshot: "正解",
  correct: true,
  startedAt: "2026-01-01T00:00:00.000Z",
  answeredAt: "2026-01-01T00:00:01.000Z",
  timeMs: 1000,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  questionConceptId: "concept-b",
  ...overrides
});

const seedConcepts = (concepts: Concept[]) => {
  storedConcepts.current = concepts;
  getAllConcepts.mockImplementation(async () => storedConcepts.current);
  getConceptById.mockImplementation(async (id: string) =>
    storedConcepts.current.find((item) => item.id === id)
  );
};

const expandDomainTags = async (user: ReturnType<typeof userEvent.setup>) => {
  const toolbar = screen.getByTestId("concept-list-toolbar");
  const expand = within(toolbar).queryByRole("button", { name: "展開" });
  if (expand) {
    await user.click(expand);
  }
};

const openLabPage = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click(screen.getByRole("button", { name: "Lab" }));
  await user.click(await screen.findByRole("menuitem", { name: new RegExp(label) }));
};

describe("App concept reveal navigation (#197)", () => {
  beforeEach(() => {
    getAllConcepts.mockReset();
    getQuizAttemptLogs.mockReset();
    getConceptById.mockReset();
    capturedGraph.conceptIds = [];
    capturedGraph.selectedId = undefined;
    seedConcepts([conceptA(), conceptB()]);
    getQuizAttemptLogs.mockResolvedValue([log()]);
  });

  it("ContextCard から filter 外 Concept を開くと必要な domain filter だけ解除する", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("concept-list-item-concept-a")).toBeInTheDocument();
    });
    await expandDomainTags(user);
    await user.click(within(screen.getByTestId("concept-list-toolbar")).getByRole("button", { name: "HCI" }));
    expect(screen.queryByTestId("concept-list-item-concept-a")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "文脈" }));
    await user.click(screen.getByRole("button", { name: "mock-open-context-concept" }));

    await waitFor(() => {
      expect(screen.getByTestId("concept-list-item-concept-a")).toBeInTheDocument();
    });
    expect(screen.getByTestId("concept-list-item-concept-a")).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("button", { name: "一覧表示" })).toHaveClass("index-filter-tab--active");
    expect(screen.getByText("対象の概念を表示するためフィルタを解除しました。")).toBeInTheDocument();
  });

  it("分析ダッシュボードから filter 外 Concept を list で開く", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("concept-list-item-concept-a")).toBeInTheDocument();
    });
    await expandDomainTags(user);
    await user.click(within(screen.getByTestId("concept-list-toolbar")).getByRole("button", { name: "HCI" }));
    expect(screen.queryByTestId("concept-list-item-concept-a")).not.toBeInTheDocument();

    await openLabPage(user, "分析ダッシュボード");
    await user.click(screen.getByRole("button", { name: "mock-open-dashboard-concept" }));

    await waitFor(() => {
      expect(screen.getByTestId("concept-list-item-concept-a")).toBeInTheDocument();
    });
    expect(screen.getByTestId("concept-list-item-concept-a")).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("button", { name: "一覧表示" })).toHaveClass("index-filter-tab--active");
  });

  it("query mismatch なら検索を解除して対象を表示する", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("concept-list-item-concept-a")).toBeInTheDocument();
    });
    await user.type(
      screen.getByPlaceholderText("タイトル・定義・解釈・分野タグ・研究テーマタグ・メモを検索"),
      "B"
    );
    await waitFor(() => {
      expect(screen.queryByTestId("concept-list-item-concept-a")).not.toBeInTheDocument();
    });

    await openLabPage(user, "分析ダッシュボード");
    await user.click(screen.getByRole("button", { name: "mock-open-dashboard-concept" }));

    await waitFor(() => {
      expect(screen.getByTestId("concept-list-item-concept-a")).toBeInTheDocument();
    });
    expect(screen.getByTestId("concept-list-item-concept-a")).toHaveAttribute("data-selected", "true");
    expect(
      screen.getByPlaceholderText("タイトル・定義・解釈・分野タグ・研究テーマタグ・メモを検索")
    ).toHaveValue("");
  });

  it("favorite-only 中の非 favorite Concept を開くと onlyFavorite を外す", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("concept-list-item-concept-a")).toBeInTheDocument();
    });
    const toolbar = screen.getByTestId("concept-list-toolbar");
    await user.click(toolbar.querySelector(".index-filter-toggle") as HTMLButtonElement);
    expect(screen.queryByTestId("concept-list-item-concept-a")).not.toBeInTheDocument();

    await openLabPage(user, "分析ダッシュボード");
    await user.click(screen.getByRole("button", { name: "mock-open-dashboard-concept" }));

    await waitFor(() => {
      expect(screen.getByTestId("concept-list-item-concept-a")).toBeInTheDocument();
    });
    expect(screen.getByTestId("concept-list-item-concept-a")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("concept-list-toolbar").querySelector(".index-filter-toggle")).toHaveTextContent(
      "すべて"
    );
  });

  it("すでに適合している domain filter は維持する", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("concept-list-item-concept-a")).toBeInTheDocument();
    });
    await expandDomainTags(user);
    const toolbar = screen.getByTestId("concept-list-toolbar");
    await user.click(within(toolbar).getByRole("button", { name: "AI" }));
    expect(screen.getByTestId("concept-list-item-concept-a")).toBeInTheDocument();
    expect(screen.queryByTestId("concept-list-item-concept-b")).not.toBeInTheDocument();

    await openLabPage(user, "分析ダッシュボード");
    await user.click(screen.getByRole("button", { name: "mock-open-dashboard-concept" }));

    await waitFor(() => {
      expect(screen.getByTestId("concept-list-item-concept-a")).toHaveAttribute("data-selected", "true");
    });
    expect(within(screen.getByTestId("concept-list-toolbar")).getByRole("button", { name: "AI" })).toHaveClass(
      "index-filter-chip--active"
    );
    expect(screen.queryByText("対象の概念を表示するためフィルタを解除しました。")).not.toBeInTheDocument();
  });

  it("Graph 分析から開くと graph に対象が含まれ selected になる", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("concept-list-item-concept-a")).toBeInTheDocument();
    });
    await expandDomainTags(user);
    await user.click(within(screen.getByTestId("concept-list-toolbar")).getByRole("button", { name: "HCI" }));

    await openLabPage(user, "概念グラフ分析");
    await user.click(screen.getByRole("button", { name: "mock-open-graph-analysis-concept" }));

    await waitFor(() => {
      expect(screen.getByTestId("concept-graph-view")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "グラフ表示" })).toHaveClass("index-filter-tab--active");
    expect(capturedGraph.selectedId).toBe("concept-a");
    expect(capturedGraph.conceptIds).toContain("concept-a");
  });

  it("mastery filter が除外しているとき all に解除し、一致するなら維持する", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("concept-list-item-concept-a")).toBeInTheDocument();
    });
    const filter = screen.getByTestId("mastery-overview-filter");
    await user.click(within(filter).getByRole("button", { name: "データ不足" }));
    expect(screen.queryByTestId("concept-list-item-concept-a")).not.toBeInTheDocument();

    await openLabPage(user, "分析ダッシュボード");
    await user.click(screen.getByRole("button", { name: "mock-open-dashboard-concept" }));

    await waitFor(() => {
      expect(screen.getByTestId("concept-list-item-concept-a")).toBeInTheDocument();
    });
    expect(
      within(screen.getByTestId("mastery-overview-filter")).getByRole("button", { name: "すべて" })
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(within(screen.getByTestId("mastery-overview-filter")).getByRole("button", { name: "未学習" }));
    expect(screen.getByTestId("concept-list-item-concept-a")).toBeInTheDocument();

    await openLabPage(user, "分析ダッシュボード");
    await user.click(screen.getByRole("button", { name: "mock-open-dashboard-concept" }));

    await waitFor(() => {
      expect(screen.getByTestId("concept-list-item-concept-a")).toHaveAttribute("data-selected", "true");
    });
    expect(
      within(screen.getByTestId("mastery-overview-filter")).getByRole("button", { name: "未学習" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("ContextCard reload 後に conceptMap が古くても storage fallback で reveal できる", async () => {
    const user = userEvent.setup();
    seedConcepts([conceptB()]);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("concept-list-item-concept-b")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("concept-list-item-concept-a")).not.toBeInTheDocument();
    await expandDomainTags(user);
    await user.click(within(screen.getByTestId("concept-list-toolbar")).getByRole("button", { name: "HCI" }));

    await user.click(screen.getByRole("button", { name: "文脈" }));
    await user.click(screen.getByRole("button", { name: "mock-open-context-concept" }));

    await waitFor(() => {
      expect(screen.getByTestId("concept-list-item-concept-a")).toBeInTheDocument();
    });
    expect(screen.getByTestId("concept-list-item-concept-a")).toHaveAttribute("data-selected", "true");
  });
});
