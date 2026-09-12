import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { QuizConceptPicker, QUIZ_CONCEPT_SEARCH_MAX } from "./QuizConceptPicker";

const concept = (overrides: Partial<Concept>): Concept => ({
  ...createEmptyConceptInput(),
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

const LARGE_CONCEPT_COUNT = 10_000;

const largeConcepts: Concept[] = Array.from({ length: LARGE_CONCEPT_COUNT }, (_, index) => {
  if (index === 42) {
    return concept({
      id: "bayes",
      title: "ベイズ推論",
      domainTags: ["統計", "機械学習"]
    });
  }
  if (index === 99) {
    return concept({
      id: "ml-tag-only",
      title: "勾配降下法",
      domainTags: ["最適化", "機械学習"]
    });
  }
  return concept({
    id: `c${index}`,
    title: `Concept ${index}`,
    domainTags: index % 17 === 0 ? [`分野${index}`] : []
  });
});

const getSearchInput = () =>
  screen.getByRole("combobox", { name: "Conceptを検索（タイトル・分野タグで絞り込み）" });

const typeAndWaitForOptions = async (text: string) => {
  const user = userEvent.setup();
  await user.type(getSearchInput(), text);
  await waitFor(() => {
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });
  return user;
};

describe("QuizConceptPicker", () => {
  it("検索前に 10,000 件の option / list item を DOM 描画しない", () => {
    const { container } = render(
      <QuizConceptPicker concepts={largeConcepts} value="" onChange={vi.fn()} />
    );

    expect(container.querySelectorAll("option")).toHaveLength(0);
    expect(container.querySelectorAll("[role='option']")).toHaveLength(0);
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText("未選択（なし）")).toBeInTheDocument();
    expect(screen.queryByText("名前または分野タグを入力してください")).not.toBeInTheDocument();
  });

  it("フォーカスしても検索前は全件を描画せず案内だけ出す", async () => {
    const user = userEvent.setup();
    render(<QuizConceptPicker concepts={largeConcepts} value="" onChange={vi.fn()} />);

    await user.click(getSearchInput());

    expect(screen.getByText("名前または分野タグを入力してください")).toBeVisible();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("タイトル検索で対象 Concept が表示される", async () => {
    render(<QuizConceptPicker concepts={largeConcepts} value="" onChange={vi.fn()} />);
    await typeAndWaitForOptions("ベイズ推論");

    expect(screen.getByRole("option", { name: /ベイズ推論/ })).toBeInTheDocument();
    expect(screen.getByText("統計 / 機械学習")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Concept 0/ })).not.toBeInTheDocument();
  });

  it("domainTags から検索できる", async () => {
    render(<QuizConceptPicker concepts={largeConcepts} value="" onChange={vi.fn()} />);
    await typeAndWaitForOptions("機械学習");

    expect(screen.getByRole("option", { name: /ベイズ推論/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /勾配降下法/ })).toBeInTheDocument();
  });

  it("結果件数が上限を超えて DOM 描画されない", async () => {
    render(<QuizConceptPicker concepts={largeConcepts} value="" onChange={vi.fn()} />);
    await typeAndWaitForOptions("Concept");

    expect(screen.getAllByRole("option")).toHaveLength(QUIZ_CONCEPT_SEARCH_MAX);
    expect(screen.getByText(`上位${QUIZ_CONCEPT_SEARCH_MAX}件まで表示しています`)).toBeInTheDocument();
  });

  it("候補クリックで Concept ID が onChange に渡る", async () => {
    const onChange = vi.fn();
    render(<QuizConceptPicker concepts={largeConcepts} value="" onChange={onChange} />);
    const user = await typeAndWaitForOptions("ベイズ推論");

    await user.click(screen.getByRole("option", { name: /ベイズ推論/ }));

    expect(onChange).toHaveBeenCalledWith("bayes");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("ArrowDown + Enter で選択できる", async () => {
    const onChange = vi.fn();
    render(<QuizConceptPicker concepts={largeConcepts} value="" onChange={onChange} />);
    const user = await typeAndWaitForOptions("Concept");

    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("c1");
  });

  it("ArrowUp が動作する", async () => {
    const onChange = vi.fn();
    render(<QuizConceptPicker concepts={largeConcepts} value="" onChange={onChange} />);
    const user = await typeAndWaitForOptions("Concept");

    await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");

    expect(onChange).toHaveBeenCalledWith("c0");
  });

  it("Escape で候補だけ閉じられる", async () => {
    const onWindowEscape = vi.fn();
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onWindowEscape();
      }
    };
    window.addEventListener("keydown", handleWindowKeyDown);

    try {
      render(<QuizConceptPicker concepts={largeConcepts} value="" onChange={vi.fn()} />);
      const user = await typeAndWaitForOptions("ベイズ推論");
      expect(screen.getByRole("option", { name: /ベイズ推論/ })).toBeInTheDocument();

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("option")).not.toBeInTheDocument();
      expect(getSearchInput()).toBeInTheDocument();
      expect(onWindowEscape).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", handleWindowKeyDown);
    }
  });

  it("選択済み Concept が表示される", () => {
    render(<QuizConceptPicker concepts={largeConcepts} value="bayes" onChange={vi.fn()} />);

    expect(screen.getByText("選択中")).toBeInTheDocument();
    const selected = screen.getByText("選択中").parentElement;
    expect(selected).not.toBeNull();
    expect(within(selected as HTMLElement).getByText("ベイズ推論")).toBeInTheDocument();
    expect(within(selected as HTMLElement).getByText("統計 / 機械学習")).toBeInTheDocument();
  });

  it("クリアすると空文字が返る", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<QuizConceptPicker concepts={largeConcepts} value="bayes" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "クリア" }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("該当なし状態が表示される", async () => {
    const user = userEvent.setup();
    render(<QuizConceptPicker concepts={largeConcepts} value="" onChange={vi.fn()} />);

    await user.type(getSearchInput(), "存在しないキーワードxyz");

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("該当する Concept がありません");
    });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});
