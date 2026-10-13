import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ContextCard } from "../types/contextCard";
import { ContextCardFormModal } from "./ContextCardFormModal";

const renderModal = () => {
  const onSubmit = vi.fn().mockResolvedValue({ id: "card-1" });
  render(
    <ContextCardFormModal
      open
      mode="create"
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />
  );
  return { onSubmit };
};

const indexSample = ["インターネット 12, 38, 52", "ISP 40-42", "データ通信 66-70"].join("\n");

describe("ContextCardFormModal index extraction", () => {
  it("抽出だけでは重要概念を変えず、選択した用語だけを追加する", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();
    const keyConcepts = screen.getByRole("textbox", { name: "重要概念" });

    await user.type(keyConcepts, "機械学習, 過学習");
    await user.click(screen.getByRole("textbox", { name: "索引テキスト" }));
    await user.paste(indexSample);
    await user.type(screen.getByRole("textbox", { name: "開始ページ" }), "36");
    await user.type(screen.getByRole("textbox", { name: "終了ページ" }), "65");
    await user.click(screen.getByRole("button", { name: "指定範囲から用語を抽出" }));

    expect(keyConcepts).toHaveValue("機械学習, 過学習");
    expect(screen.getByRole("checkbox", { name: /インターネット/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /ISP/ })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: /データ通信/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /ISP/ }));
    await user.click(screen.getByRole("button", { name: "選択した用語を重要概念に追加" }));

    expect(keyConcepts).toHaveValue("機械学習, 過学習, インターネット");
  });

  it("全解除では追加できず、同じ用語の再追加でも重複しない", async () => {
    const user = userEvent.setup();
    renderModal();
    const keyConcepts = screen.getByRole("textbox", { name: "重要概念" });

    await user.click(screen.getByRole("textbox", { name: "索引テキスト" }));
    await user.paste("機械学習 42");
    await user.type(screen.getByRole("textbox", { name: "開始ページ" }), "36");
    await user.type(screen.getByRole("textbox", { name: "終了ページ" }), "65");
    await user.click(screen.getByRole("button", { name: "指定範囲から用語を抽出" }));
    await user.click(screen.getByRole("button", { name: "全解除" }));

    expect(screen.getByRole("button", { name: "選択した用語を重要概念に追加" })).toBeDisabled();
    expect(keyConcepts).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "全選択" }));
    await user.click(screen.getByRole("button", { name: "選択した用語を重要概念に追加" }));
    await user.click(screen.getByRole("button", { name: "選択した用語を重要概念に追加" }));

    expect(keyConcepts).toHaveValue("機械学習");
  });

  it("不正なページ範囲はエラーになり、重要概念を変えない", async () => {
    const user = userEvent.setup();
    renderModal();
    const keyConcepts = screen.getByRole("textbox", { name: "重要概念" });
    await user.type(keyConcepts, "既存");
    await user.click(screen.getByRole("textbox", { name: "索引テキスト" }));
    await user.paste("機械学習 42");
    await user.type(screen.getByRole("textbox", { name: "開始ページ" }), "70");
    await user.type(screen.getByRole("textbox", { name: "終了ページ" }), "36");
    await user.click(screen.getByRole("button", { name: "指定範囲から用語を抽出" }));

    expect(screen.getByText("開始ページは終了ページ以下にしてください。")).toBeInTheDocument();
    expect(keyConcepts).toHaveValue("既存");
    expect(screen.queryByRole("button", { name: "選択した用語を重要概念に追加" })).not.toBeInTheDocument();
  });

  it("追加した重要概念は保存ペイロードに含まれ、索引テキストは含まれない", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    await user.type(screen.getByRole("textbox", { name: "タイトル" }), "第2章");
    await user.click(screen.getByRole("textbox", { name: "索引テキスト" }));
    await user.paste("FTTH 44");
    await user.type(screen.getByRole("textbox", { name: "開始ページ" }), "36");
    await user.type(screen.getByRole("textbox", { name: "終了ページ" }), "65");
    await user.click(screen.getByRole("button", { name: "指定範囲から用語を抽出" }));
    await user.click(screen.getByRole("button", { name: "選択した用語を重要概念に追加" }));
    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "第2章",
        keyConcepts: "FTTH"
      })
    );
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("indexText");
  });

  it("既存カードでは既存の重要概念を保ったまま新規語だけを保存し、キャンセルでは保存しない", async () => {
    const user = userEvent.setup();
    const existing: ContextCard = {
      id: "card-old",
      title: "既存カード",
      domainTags: ["情報"],
      centralQuestion: "問",
      background: "背景文",
      flow: "流れ文",
      keyConcepts: "機械学習, 過学習",
      linkedConcepts: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };
    const onSubmit = vi.fn().mockResolvedValue(existing);
    const onClose = vi.fn();
    const { rerender } = render(
      <ContextCardFormModal open mode="edit" baseContextCard={existing} onClose={onClose} onSubmit={onSubmit} />
    );

    await user.click(screen.getByRole("textbox", { name: "索引テキスト" }));
    await user.paste("機械学習 42\n教師あり学習 50");
    await user.type(screen.getByRole("textbox", { name: "開始ページ" }), "36");
    await user.type(screen.getByRole("textbox", { name: "終了ページ" }), "65");
    await user.click(screen.getByRole("button", { name: "指定範囲から用語を抽出" }));
    expect(screen.getByRole("textbox", { name: "重要概念" })).toHaveValue("機械学習, 過学習");
    await user.click(screen.getByRole("button", { name: "選択した用語を重要概念に追加" }));
    expect(screen.getByRole("textbox", { name: "重要概念" })).toHaveValue("機械学習, 過学習, 教師あり学習");
    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "既存カード",
        background: "背景文",
        flow: "流れ文",
        keyConcepts: "機械学習, 過学習, 教師あり学習"
      })
    );

    onSubmit.mockClear();
    rerender(
      <ContextCardFormModal open={false} mode="edit" baseContextCard={existing} onClose={onClose} onSubmit={onSubmit} />
    );
    rerender(
      <ContextCardFormModal open mode="edit" baseContextCard={existing} onClose={onClose} onSubmit={onSubmit} />
    );
    await user.click(screen.getByRole("textbox", { name: "索引テキスト" }));
    await user.paste("FTTH 44");
    await user.type(screen.getByRole("textbox", { name: "開始ページ" }), "36");
    await user.type(screen.getByRole("textbox", { name: "終了ページ" }), "65");
    await user.click(screen.getByRole("button", { name: "指定範囲から用語を抽出" }));
    await user.click(screen.getByRole("button", { name: "選択した用語を重要概念に追加" }));
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
