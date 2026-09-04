import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GraphWorkspaceLayout } from "./GraphWorkspaceLayout";

describe("GraphWorkspaceLayout (#104)", () => {
  it("背面装飾は pointer-events-none、詳細パネルは pointer-events-auto", () => {
    render(
      <GraphWorkspaceLayout
        detailOpen
        graph={<button type="button">全体</button>}
        detail={
          <button type="button" onClick={() => undefined}>
            閉じる
          </button>
        }
      />
    );

    expect(screen.getByTestId("graph-detail-backdrop")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("graph-detail-panel")).toHaveClass("pointer-events-auto");
  });

  it("詳細パネル表示中でもグラフ操作ボタンと閉じるを押せる", async () => {
    const user = userEvent.setup();
    const onFit = vi.fn();
    const onClose = vi.fn();
    render(
      <GraphWorkspaceLayout
        detailOpen
        graph={
          <div>
            <button type="button">全体</button>
            <button type="button">1-hop</button>
            <button type="button">2-hop</button>
            <button type="button" onClick={onFit}>
              全体を収める
            </button>
            <button type="button">表示をリセット</button>
            <button type="button">さらに表示</button>
          </div>
        }
        detail={
          <button type="button" onClick={onClose}>
            閉じる
          </button>
        }
      />
    );

    await user.click(screen.getByRole("button", { name: "全体を収める" }));
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onFit).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
