import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataLabView } from "./DataLabView";

describe("DataLabView (#89)", () => {
  it("基本領域（ヘッダー・フィルタ・分析条件・結果）を表示する", () => {
    render(<DataLabView logCount={248} loading={false} error={false} onBack={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Data Lab" })).toBeInTheDocument();
    expect(screen.getByText("学習ログを条件指定して探索・分析します。")).toBeInTheDocument();
    expect(screen.getByTestId("data-lab-log-count")).toHaveTextContent("248件");
    expect(screen.getByRole("heading", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "分析条件" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "分析結果" })).toBeInTheDocument();
    expect(screen.getByText("248件の学習ログを読み込みました。")).toBeInTheDocument();
    expect(screen.getByLabelText("期間")).toBeDisabled();
    expect(screen.getByLabelText("集計軸")).toBeDisabled();
  });

  it("ログ0件で空状態になる", () => {
    render(<DataLabView logCount={0} loading={false} error={false} onBack={vi.fn()} />);

    expect(screen.getByTestId("data-lab-log-count")).toHaveTextContent("0件");
    expect(screen.getByText("まだ分析できる学習データがありません。")).toBeInTheDocument();
    expect(screen.queryByText(/件の学習ログを読み込みました/)).not.toBeInTheDocument();
  });

  it("loading 状態を表示する", () => {
    render(<DataLabView logCount={0} loading={true} error={false} onBack={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("読み込み中…");
    expect(screen.queryByRole("heading", { name: "Filters" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "分析結果" })).not.toBeInTheDocument();
  });

  it("読み込み失敗時はエラーメッセージを表示する", () => {
    render(<DataLabView logCount={0} loading={false} error={true} onBack={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("学習データを読み込めませんでした。");
    expect(screen.queryByRole("heading", { name: "分析結果" })).not.toBeInTheDocument();
  });
});
