import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "fake-indexeddb/auto";
import { ContextCardMaterialsSection } from "./ContextCardMaterialsSection";
import type { LearningMaterial } from "../../types/learningMaterial";
import type { Concept } from "../../types/concept";
import { createEmptyConceptInput } from "../../types/concept";

vi.mock("../../utils/pdf/loadPdfDocument", () => ({
  loadPdfDocument: vi.fn()
}));

vi.mock("pdfjs-dist", () => ({
  TextLayer: class {
    render() {
      return Promise.resolve();
    }
  }
}));

const iso = "2026-01-01T00:00:00.000Z";

const material = (id: string): LearningMaterial => ({
  id,
  contextCardId: "card1",
  type: "pdf",
  title: "第4回講義資料",
  fileName: "第4回講義資料.pdf",
  mimeType: "application/pdf",
  fileSize: 12,
  createdAt: iso,
  updatedAt: iso
});

const concept: Concept = {
  ...createEmptyConceptInput(),
  id: "c1",
  title: "強化",
  createdAt: iso,
  updatedAt: iso
};

describe("ContextCardMaterialsSection", () => {
  it("PDF一覧・追加・削除確認を表示する", async () => {
    const user = userEvent.setup();
    const onAddPdf = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <ContextCardMaterialsSection
        materials={[material("m1")]}
        linkedConcepts={[concept]}
        onAddPdf={onAddPdf}
        onDelete={onDelete}
      />
    );
    expect(screen.getByText("教材")).toBeInTheDocument();
    expect(screen.getByText(/第4回講義資料\.pdf/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PDFを追加" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "教材を削除" }));
    expect(screen.getByText(/このPDFと出現箇所を削除します/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "削除する" }));
    expect(onDelete).toHaveBeenCalledWith("m1");
  });

  it("教材を開くと viewer dialog が出る", async () => {
    const user = userEvent.setup();
    render(
      <ContextCardMaterialsSection
        materials={[material("m1")]}
        linkedConcepts={[concept]}
        onAddPdf={async () => undefined}
        onDelete={async () => undefined}
      />
    );
    await user.click(screen.getByRole("button", { name: "教材を開く" }));
    expect(screen.getByRole("dialog", { name: "第4回講義資料" })).toBeInTheDocument();
    expect(screen.getByText("この回のConcept")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /強化/ })).toBeInTheDocument();
  });
});
