import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TextLayer } from "pdfjs-dist";
import "./pdfTextLayer.css";
import { getStorage } from "../../storage";
import type { Concept } from "../../types/concept";
import type { ConceptSourceAnchor } from "../../types/conceptSourceAnchor";
import type { LearningMaterial } from "../../types/learningMaterial";
import { nowIso } from "../../utils/date";
import { denormalizeAnchorRectsRelative, normalizeSelectionRects } from "../../utils/pdf/normalizeSelectionRects";
import { loadPdfDocument, type PdfDocumentHandle } from "../../utils/pdf/loadPdfDocument";
import { useAnchorConnectors } from "../../hooks/useAnchorConnectors";
import { ModalPortal } from "../common/ModalPortal";
import { ConceptLinkDialog } from "./ConceptLinkDialog";

type Props = {
  open: boolean;
  material: LearningMaterial;
  linkedConcepts: Concept[];
  onClose: () => void;
};

const storage = getStorage();

export const LearningMaterialPdfViewer = ({ open, material, linkedConcepts, onClose }: Props) => {
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [anchors, setAnchors] = useState<ConceptSourceAnchor[]>([]);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [pendingQuote, setPendingQuote] = useState("");
  const [pendingRects, setPendingRects] = useState<ConceptSourceAnchor["rects"]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [wide, setWide] = useState(true);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [overlayEl, setOverlayEl] = useState<HTMLDivElement | null>(null);
  const [connectorTick, setConnectorTick] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const pageWrapRef = useRef<HTMLDivElement | null>(null);
  const pdfRef = useRef<PdfDocumentHandle | null>(null);
  const renderGenRef = useRef(0);
  const conceptRefs = useRef<Map<string, HTMLElement>>(new Map());
  const highlightRefs = useRef<Map<string, HTMLElement>>(new Map());

  const reloadAnchors = useCallback(async () => {
    setAnchors(await storage.getAnchorsByMaterialId(material.id));
  }, [material.id]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !linkOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, linkOpen]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let revoked: string | null = null;
    let cancelled = false;
    const run = async () => {
      setError(null);
      try {
        const blob = await storage.getLearningMaterialBlob(material.id);
        if (!blob) {
          throw new Error("missing");
        }
        const url = URL.createObjectURL(blob);
        revoked = url;
        const pdf = await loadPdfDocument(await blob.arrayBuffer());
        if (cancelled) {
          await pdf.destroy?.();
          URL.revokeObjectURL(url);
          return;
        }
        pdfRef.current = pdf;
        setPageCount(pdf.numPages);
        setPageIndex(0);
        await reloadAnchors();
      } catch {
        if (!cancelled) {
          setError("PDFを読み込めませんでした");
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
      if (revoked) {
        URL.revokeObjectURL(revoked);
      }
      void pdfRef.current?.destroy?.();
      pdfRef.current = null;
    };
  }, [open, material.id, reloadAnchors]);

  const renderPage = useCallback(async () => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    const textLayer = textLayerRef.current;
    if (!pdf || !canvas || !textLayer) {
      return;
    }
    const gen = ++renderGenRef.current;
    try {
      const page = await pdf.getPage(pageIndex + 1);
      if (gen !== renderGenRef.current) {
        return;
      }
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (gen !== renderGenRef.current) {
        return;
      }
      textLayer.replaceChildren();
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;
      textLayer.style.setProperty("--scale-factor", String(scale));
      const layer = new TextLayer({
        textContentSource: page.streamTextContent() as never,
        container: textLayer,
        viewport: viewport as never
      });
      await layer.render();
      if (gen !== renderGenRef.current) {
        return;
      }
      setPageSize({ width: viewport.width, height: viewport.height });
      setConnectorTick((value) => value + 1);
    } catch {
      if (gen === renderGenRef.current) {
        setError("PDFを読み込めませんでした");
      }
    }
  }, [pageIndex, scale]);

  useEffect(() => {
    if (open) {
      void renderPage();
    }
  }, [open, renderPage, pageCount, error]);

  const pageAnchors = useMemo(
    () => anchors.filter((anchor) => anchor.pageIndex === pageIndex),
    [anchors, pageIndex]
  );
  const getConnectorTargets = useCallback(
    () =>
      pageAnchors.map((anchor) => ({
        conceptId: anchor.conceptId,
        highlightEl: highlightRefs.current.get(anchor.id) ?? null,
        conceptEl: conceptRefs.current.get(anchor.conceptId) ?? null
      })),
    [pageAnchors, connectorTick]
  );
  const lines = useAnchorConnectors(overlayEl, getConnectorTargets, wide && open);

  const captureSelection = () => {
    const selection = window.getSelection();
    const quotedText = selection?.toString().trim() ?? "";
    const pageBox = pageWrapRef.current?.getBoundingClientRect();
    if (!selection || selection.rangeCount === 0 || !quotedText || !pageBox) {
      return;
    }
    const rects = normalizeSelectionRects(
      Array.from(selection.getRangeAt(0).getClientRects()).map((rect) => ({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      })),
      pageBox
    );
    if (rects.length === 0) {
      return;
    }
    setPendingQuote(quotedText);
    setPendingRects(rects);
    setLinkOpen(true);
  };

  if (!open) {
    return null;
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-nordic-overlay p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pdf-viewer-title">
        <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-celestial-border bg-celestial-panel">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-celestial-border px-4 py-3">
            <div>
              <h2 id="pdf-viewer-title" className="text-lg font-semibold text-celestial-textMain">
                {material.title || material.fileName}
              </h2>
              <p className="text-xs text-celestial-textSub">
                {pageIndex + 1} / {pageCount} ページ
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-2xl border border-celestial-gold/30 px-3 py-2 text-sm" disabled={pageIndex <= 0} onClick={() => setPageIndex((v) => Math.max(0, v - 1))}>
                前のページ
              </button>
              <button type="button" className="rounded-2xl border border-celestial-gold/30 px-3 py-2 text-sm" disabled={pageIndex >= pageCount - 1} onClick={() => setPageIndex((v) => Math.min(pageCount - 1, v + 1))}>
                次のページ
              </button>
              <button type="button" className="rounded-2xl border border-celestial-gold/30 px-3 py-2 text-sm" onClick={() => setScale((v) => Math.max(0.6, Number((v - 0.15).toFixed(2))))}>
                縮小
              </button>
              <button type="button" className="rounded-2xl border border-celestial-gold/30 px-3 py-2 text-sm" onClick={() => setScale((v) => Math.min(2.4, Number((v + 0.15).toFixed(2))))}>
                拡大
              </button>
              <button type="button" className="action-button rounded-2xl px-3 py-2 text-sm" onClick={captureSelection}>
                Conceptに関連付ける
              </button>
              <button type="button" className="rounded-2xl border border-celestial-gold/30 px-3 py-2 text-sm" onClick={onClose}>
                閉じる
              </button>
            </div>
          </header>
          {error ? <p className="px-4 py-3 text-sm text-celestial-textSub">{error}</p> : null}
          <div ref={setOverlayEl} className="relative flex min-h-0 flex-1 flex-col md:flex-row">
            <div className="min-h-0 flex-1 overflow-auto p-3">
              <div ref={pageWrapRef} className="relative inline-block bg-white">
                <canvas ref={canvasRef} className="block" />
                <div ref={textLayerRef} className="text-layer absolute left-0 top-0 overflow-hidden" />
                {pageAnchors.flatMap((anchor) =>
                  denormalizeAnchorRectsRelative(anchor.rects, pageSize).map((rect, index) => {
                    const active = selectedAnchorId === anchor.id || selectedConceptId === anchor.conceptId;
                    return (
                      <button
                        key={`${anchor.id}-${index}`}
                        type="button"
                        ref={(el) => {
                          if (index === 0 && el) {
                            highlightRefs.current.set(anchor.id, el);
                          }
                        }}
                        aria-label={`出現箇所: ${linkedConcepts.find((c) => c.id === anchor.conceptId)?.title ?? "Concept"}`}
                        className={`absolute border ${active ? "border-celestial-gold bg-celestial-gold/40" : "border-celestial-gold/40 bg-celestial-gold/20"}`}
                        style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
                        onClick={() => {
                          setSelectedAnchorId(anchor.id);
                          setSelectedConceptId(anchor.conceptId);
                        }}
                      />
                    );
                  })
                )}
              </div>
            </div>
            <aside className="w-full shrink-0 border-t border-celestial-border p-3 md:w-72 md:border-l md:border-t-0">
              <h3 className="text-sm font-semibold text-celestial-softGold">この回のConcept</h3>
              {linkedConcepts.length === 0 ? (
                <p className="mt-2 text-sm text-celestial-textSub">先にこの文脈カードへConceptを登録してください</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {linkedConcepts.map((concept) => {
                    const conceptAnchors = anchors.filter((anchor) => anchor.conceptId === concept.id);
                    const active = selectedConceptId === concept.id;
                    return (
                      <li key={concept.id}>
                        <button
                          type="button"
                          ref={(el) => {
                            if (el) {
                              conceptRefs.current.set(concept.id, el);
                            }
                          }}
                          className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${active ? "border-celestial-gold bg-celestial-gold/15" : "border-celestial-border bg-celestial-deepBlue"}`}
                          onClick={() => {
                            setSelectedConceptId(concept.id);
                            const first = conceptAnchors[0];
                            if (first) {
                              setSelectedAnchorId(first.id);
                              setPageIndex(first.pageIndex);
                            }
                          }}
                        >
                          {concept.title || "無題のConcept"}
                          <span className="mt-1 block text-xs text-celestial-textSub">このConceptの出現箇所 {conceptAnchors.length}件</span>
                        </button>
                        {active
                          ? conceptAnchors.map((anchor) => (
                              <div key={anchor.id} className="mt-1 pl-2 text-xs text-celestial-textSub">
                                <button
                                  type="button"
                                  className="mt-1 block text-left text-xs text-celestial-textSub"
                                  onClick={() => {
                                    setSelectedAnchorId(anchor.id);
                                    setPageIndex(anchor.pageIndex);
                                  }}
                                >
                                  p.{anchor.pageIndex + 1} {anchor.quotedText?.slice(0, 80)}
                                </button>
                                <button
                                  type="button"
                                  className="mt-1 text-celestial-softGold underline"
                                  onClick={() => void storage.deleteConceptSourceAnchor(anchor.id).then(reloadAnchors)}
                                >
                                  関連付けを解除
                                </button>
                              </div>
                            ))
                          : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>
            {wide ? (
              <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
                {lines.map((line) => (
                  <line key={line.id} x1={line.fromX} y1={line.fromY} x2={line.toX} y2={line.toY} stroke="rgba(212,175,55,0.85)" strokeWidth="2" />
                ))}
              </svg>
            ) : null}
          </div>
        </div>
        <ConceptLinkDialog
          open={linkOpen}
          concepts={linkedConcepts}
          quotedText={pendingQuote}
          onClose={() => setLinkOpen(false)}
          onSelect={(conceptId) => {
            void storage
              .saveConceptSourceAnchor({
                id: "",
                materialId: material.id,
                conceptId,
                pageIndex,
                rects: pendingRects,
                quotedText: pendingQuote,
                createdAt: nowIso(),
                updatedAt: nowIso()
              })
              .then(() => {
                setLinkOpen(false);
                setSelectedConceptId(conceptId);
                return reloadAnchors();
              });
          }}
        />
      </div>
    </ModalPortal>
  );
};
