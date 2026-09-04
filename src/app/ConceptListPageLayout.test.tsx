import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CONCEPT_LIST_PAGE_MAIN_CLASS, ConceptListPageLayout } from "./ConceptListPageLayout";

describe("ConceptListPageLayout (#52 / #138)", () => {
  it("一覧ページ外枠は全幅であり中央固定幅クラスを持たない", () => {
    render(
      <ConceptListPageLayout toolbar={<div>toolbar</div>} workspace={<div>workspace</div>} />
    );

    const page = screen.getByTestId("concept-list-page-layout");
    expect(page.tagName).toBe("MAIN");
    expect(page).toHaveClass(CONCEPT_LIST_PAGE_MAIN_CLASS);
    expect(page.className).toContain("w-full");
    expect(page.className).not.toMatch(/\bmax-w-/);
    expect(page.className).not.toMatch(/\bmx-auto\b/);
    expect(screen.getByText("toolbar")).toBeInTheDocument();
    expect(screen.getByText("workspace")).toBeInTheDocument();
  });
});
