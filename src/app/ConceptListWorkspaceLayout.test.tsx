import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ConceptListWorkspaceLayout } from "./ConceptListWorkspaceLayout";

describe("ConceptListWorkspaceLayout (#52 / #138)", () => {
  it("一覧と詳細のDOM構造とclass契約を持つ", () => {
    render(
      <ConceptListWorkspaceLayout
        mobileDetail={false}
        list={<p>一覧本文</p>}
        detail={<p>詳細本文</p>}
      />
    );

    const workspace = screen.getByTestId("concept-list-workspace");
    expect(workspace).toHaveClass("grid", "lg:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)]");
    expect(screen.getByTestId("concept-list-pane")).toHaveClass("lg:block");
    expect(screen.getByTestId("concept-detail-pane")).toHaveClass("lg:block");
    expect(screen.getByText("一覧本文")).toBeInTheDocument();
    expect(screen.getByText("詳細本文")).toBeInTheDocument();
  });

  it("選択Conceptの差し替えで詳細が更新される", async () => {
    const user = userEvent.setup();

    const Harness = () => {
      const [selected, setSelected] = useState("A");
      return (
        <ConceptListWorkspaceLayout
          mobileDetail={false}
          list={
            <>
              <button type="button" onClick={() => setSelected("A")}>
                Concept A
              </button>
              <button type="button" onClick={() => setSelected("B")}>
                Concept B
              </button>
            </>
          }
          detail={<p data-testid="selected-detail">詳細 {selected}</p>}
        />
      );
    };

    render(<Harness />);
    expect(screen.getByTestId("selected-detail")).toHaveTextContent("詳細 A");
    await user.click(screen.getByRole("button", { name: "Concept B" }));
    expect(screen.getByTestId("selected-detail")).toHaveTextContent("詳細 B");
  });

  it("mobileDetail時は狭幅向けに一覧を隠し詳細を出すclassになる", () => {
    render(
      <ConceptListWorkspaceLayout
        mobileDetail
        list={<p>一覧本文</p>}
        detail={<p>詳細本文</p>}
      />
    );

    expect(screen.getByTestId("concept-list-pane")).toHaveClass("hidden");
    expect(screen.getByTestId("concept-detail-pane")).toHaveClass("block");
  });
});
