import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Concept } from "../../types/concept";
import { createEmptyConceptInput } from "../../types/concept";
import type { LearningMaterial } from "../../types/learningMaterial";
import type { ConceptSourceAnchor } from "../../types/conceptSourceAnchor";

const { getAnchors, getBlob, saveAnchor, deleteAnchor } = vi.hoisted(() => ({
  getAnchors: vi.fn(),
  getBlob: vi.fn(),
  saveAnchor: vi.fn(),
  deleteAnchor: vi.fn()
}));

vi.mock("../../storage", () => ({
  getStorage: () => ({
    getLearningMaterialBlob: (...args: unknown[]) => getBlob(...args),
    getAnchorsByMaterialId: (...args: unknown[]) => getAnchors(...args),
    saveConceptSourceAnchor: (...args: unknown[]) => saveAnchor(...args),
    deleteConceptSourceAnchor: (...args: unknown[]) => deleteAnchor(...args)
  })
}));

vi.mock("../../utils/pdf/loadPdfDocument", () => ({
  loadPdfDocument: vi.fn(async () => ({
    numPages: 1,
    destroy: async () => undefined,
    getPage: async () => ({
      getViewport: ({ scale }: { scale: number }) => ({
        width: 200 * scale,
        height: 80 * scale,
        convertToViewportPoint: (x: number, y: number) => [x * scale, y * scale]
      }),
      render: () => ({ promise: Promise.resolve() }),
      getTextContent: async () => ({
        items: [
          { str: "オペラント条件づけでは、強化によって行動を形成する。", width: 180, height: 12, transform: [1, 0, 0, 1, 10, 20], hasEOL: true },
          { str: "シェイピングは段階的な強化によって行われる。", width: 160, height: 12, transform: [1, 0, 0, 1, 10, 40], hasEOL: true }
        ]
      }),
      streamTextContent: () => ({})
    })
  }))
}));

vi.mock("pdfjs-dist", () => ({
  TextLayer: class {
    render() {
      return Promise.resolve();
    }
  }
}));

import { LearningMaterialPdfViewer } from "./LearningMaterialPdfViewer";

const iso = "2026-01-01T00:00:00.000Z";

const material: LearningMaterial = {
  id: "m1",
  contextCardId: "card1",
  type: "pdf",
  title: "第4回講義資料",
  fileName: "第4回講義資料.pdf",
  mimeType: "application/pdf",
  fileSize: 12,
  createdAt: iso,
  updatedAt: iso
};

const concept = (id: string, title: string, definition = ""): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title,
  definition,
  createdAt: iso,
  updatedAt: iso
});

const linked: Concept[] = [
  concept("c1", "強化", "行動の生起頻度を増加させる操作。"),
  concept("c2", "シェイピング"),
  concept("c3", "オペラント条件づけ", "行動とその結果の随伴性。"),
  concept("c4", "条件づけ")
];

const manualAnchor: ConceptSourceAnchor = {
  id: "a1",
  materialId: "m1",
  conceptId: "c1",
  pageIndex: 0,
  rects: [{ x: 0.48, y: 0.2, width: 0.08, height: 0.08 }],
  quotedText: "強化",
  createdAt: iso,
  updatedAt: iso
};

beforeEach(() => {
  getBlob.mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])], { type: "application/pdf" }));
  getAnchors.mockResolvedValue([]);
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    fillRect: vi.fn()
  }) as never;
});

describe("LearningMaterialPdfViewer auto concept highlights", () => {
  it("自動highlightを表示し、clickで定義を出す", async () => {
    const user = userEvent.setup();
    render(
      <LearningMaterialPdfViewer open material={material} linkedConcepts={linked} onClose={() => undefined} />
    );
    await waitFor(() => expect(screen.getAllByRole("button", { name: /登録済みConcept「強化」を表示/ }).length).toBeGreaterThan(1));
    expect(screen.getByRole("button", { name: /登録済みConcept「オペラント条件づけ」を表示/ })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /登録済みConcept「強化」を表示/ })[0]!);
    expect(screen.getByText("自分の定義")).toBeInTheDocument();
    expect(screen.getByText("行動の生起頻度を増加させる操作。")).toBeInTheDocument();
  });

  it("定義がないときは未登録メッセージを出す", async () => {
    const user = userEvent.setup();
    render(
      <LearningMaterialPdfViewer open material={material} linkedConcepts={linked} onClose={() => undefined} />
    );
    await waitFor(() => screen.getByRole("button", { name: /登録済みConcept「シェイピング」を表示/ }));
    await user.click(screen.getByRole("button", { name: /登録済みConcept「シェイピング」を表示/ }));
    expect(screen.getByText("定義はまだ登録されていません。")).toBeInTheDocument();
  });

  it("toggle OFFで自動highlightだけ消え、手動Anchorは残る", async () => {
    const user = userEvent.setup();
    getAnchors.mockResolvedValue([manualAnchor]);
    render(
      <LearningMaterialPdfViewer open material={material} linkedConcepts={linked} onClose={() => undefined} />
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "出現箇所: 強化" })).toBeInTheDocument());
    const checkbox = screen.getByRole("checkbox", { name: "登録済みConceptを表示" });
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(screen.queryAllByRole("button", { name: /登録済みConcept/ })).toHaveLength(0);
    expect(screen.getByRole("button", { name: "出現箇所: 強化" })).toBeInTheDocument();
    await user.click(checkbox);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /登録済みConcept/ }).length).toBeGreaterThan(0));
  });

  it("Conceptを開くを呼ぶ", async () => {
    const user = userEvent.setup();
    const onOpenConcept = vi.fn();
    const onClose = vi.fn();
    render(
      <LearningMaterialPdfViewer
        open
        material={material}
        linkedConcepts={linked}
        onClose={onClose}
        onOpenConcept={onOpenConcept}
      />
    );
    await waitFor(() => screen.getAllByRole("button", { name: /登録済みConcept「強化」を表示/ })[0]);
    await user.click(screen.getAllByRole("button", { name: /登録済みConcept「強化」を表示/ })[0]!);
    await user.click(screen.getByRole("button", { name: "Conceptを開く" }));
    expect(onOpenConcept).toHaveBeenCalledWith("c1");
    expect(onClose).toHaveBeenCalled();
  });
});
