import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { TextLayer } from "pdfjs-dist";
import "./pdfTextLayer.css";
import { getStorage } from "../../storage";
import type { Concept } from "../../types/concept";
import type { ConceptSourceAnchor, NormalizedRect } from "../../types/conceptSourceAnchor";
import type { LearningMaterial } from "../../types/learningMaterial";
import { nowIso } from "../../utils/date";
import { denormalizeAnchorRectsRelative, normalizeSelectionRects } from "../../utils/pdf/normalizeSelectionRects";
import { loadPdfDocument, type PdfDocumentHandle } from "../../utils/pdf/loadPdfDocument";
import { buildPdfPageTextIndex, type PdfPageTextIndex } from "../../utils/pdf/buildPdfPageTextIndex";
import { collectSearchableConceptTerms, findConceptTermMatches } from "../../utils/pdf/findConceptTermMatches";
import { mapTextMatchToRects, type ViewportLike } from "../../utils/pdf/mapTextMatchToRects";
import { rectSetsOverlap } from "../../utils/pdf/conceptTermMatchOverlap";
import { isPdfTextItem } from "../../utils/pdf/pdfTextItem";
import { useAnchorConnectors } from "../../hooks/useAnchorConnectors";
import { ModalPortal } from "../common/ModalPortal";
import { ConceptLinkDialog } from "./ConceptLinkDialog";

type Props = {
  open: boolean;
  material: LearningMaterial;
  linkedConcepts: Concept[];
  onClose: () => void;
  onOpenConcept?: (conceptId: string) => void;
};

const storage = getStorage();

type AutoMatchView = {
  id: string;
  conceptId: string;
  title: string;
  rects: NormalizedRect[];
};

export const LearningMaterialPdfViewer = ({ open, material, linkedConcepts, onClose, onOpenConcept }: Props) => {
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
  const [showRegisteredConcepts, setShowRegisteredConcepts] = useState(true);
  const [pdfReady, setPdfReady] = useState(0);
  const [textIndex, setTextIndex] = useState<PdfPageTextIndex | null>(null);
  const [baseViewport, setBaseViewport] = useState<ViewportLike | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const pageWrapRef = useRef<HTMLDivElement | null>(null);
  const pdfRef = useRef<PdfDocumentHandle | null>(null);
  const renderGenRef = useRef(0);
  const extractedPageRef = useRef<number | null>(null);
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
    let cancelled = false;
    const run = async () => {
      setError(null);
      extractedPageRef.current = null;
      try {
        const blob = await storage.getLearningMaterialBlob(material.id);
        if (!blob) {
          throw new Error("missing");
        }
        const pdf = await loadPdfDocument(await blob.arrayBuffer());
        if (cancelled) {
          await pdf.destroy?.();
          return;
        }
        pdfRef.current = pdf;
        setPageCount(pdf.numPages);
        setPageIndex(0);
        setPdfReady((value) => value + 1);
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
      if (extractedPageRef.current !== pageIndex) {
        const content = await page.getTextContent();
        const viewport1 = page.getViewport({ scale: 1 });
        if (gen !== renderGenRef.current) {
          return;
        }
        const items = content.items.filter(isPdfTextItem).map((item) => ({
          str: item.str,
          width: item.width || 0,
          height: item.height || 0,
          transform: item.transform,
          hasEOL: item.hasEOL
        }));
        setTextIndex(buildPdfPageTextIndex(items));
        setBaseViewport(viewport1);
        extractedPageRef.current = pageIndex;
      }
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setPageSize({ width: viewport.width, height: viewport.height });
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
  }, [open, renderPage, pageCount, error, pdfReady]);

  const pageAnchors = useMemo(
    () => anchors.filter((anchor) => anchor.pageIndex === pageIndex),
    [anchors, pageIndex]
  );

  const searchableTerms = useMemo(() => collectSearchableConceptTerms(linkedConcepts), [linkedConcepts]);

  const autoMatches = useMemo(() => {
    if (!textIndex || !baseViewport) {
      return [] as AutoMatchView[];
    }
    const matches = findConceptTermMatches(textIndex, searchableTerms);
    return matches.map((match, i) => ({
      id: `auto-${match.conceptId}-${match.rawStart}-${i}`,
      conceptId: match.conceptId,
      title: match.title,
      rects: mapTextMatchToRects(textIndex, match, baseViewport)
    }));
  }, [textIndex, baseViewport, searchableTerms]);

  const visibleAutoMatches = useMemo(() => {
    if (!showRegisteredConcepts) {
      return [] as AutoMatchView[];
    }
    return autoMatches.filter((match) => !pageAnchors.some((anchor) => rectSetsOverlap(match.rects, anchor.rects)));
  }, [autoMatches, pageAnchors, showRegisteredConcepts]);

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

  const selectedConcept = linkedConcepts.find((concept) => concept.id === selectedConceptId) ?? null;

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

  const handlePageClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!showRegisteredConcepts || pageSize.width <= 0) {
      return;
    }
    const selected = window.getSelection()?.toString().trim();
    if (selected) {
      return;
    }
    const box = pageWrapRef.current?.getBoundingClientRect();
    if (!box) {
      return;
    }
    const nx = (event.clientX - box.left) / pageSize.width;
    const ny = (event.clientY - box.top) / pageSize.height;
    const hit = visibleAutoMatches.find((match) =>
      match.rects.some(
        (rect) => nx >= rect.x && nx <= rect.x + rect.width && ny >= rect.y && ny <= rect.y + rect.height
      )
    );
    if (hit) {
      setSelectedConceptId(hit.conceptId);
      setSelectedAnchorId(null);
    }
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
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-celestial-textMain">
                <input
                  type="checkbox"
                  checked={showRegisteredConcepts}
                  onChange={(event) => setShowRegisteredConcepts(event.target.checked)}
                />
                登録済みConceptを表示
              </label>
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
              <div ref={pageWrapRef} className="relative inline-block bg-white" onClick={handlePageClick}>
                <canvas ref={canvasRef} className="block" />
                <div ref={textLayerRef} className="text-layer absolute left-0 top-0 overflow-hidden" />
                {visibleAutoMatches.flatMap((match) =>
                  denormalizeAnchorRectsRelative(match.rects, pageSize).map((rect, index) => {
                    const active = selectedConceptId === match.conceptId && selectedAnchorId === null;
                    return (
                      <button
                        key={`${match.id}-${index}`}
                        type="button"
                        aria-label={`登録済みConcept「${match.title}」を表示`}
                        className={`pointer-events-none absolute z-[1] border ${
                          active ? "border-nordic-blue bg-nordic-blue/35" : "border-nordic-blue/40 bg-nordic-blue/20"
                        }`}
                        style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
                        onClick={() => {
                          setSelectedConceptId(match.conceptId);
                          setSelectedAnchorId(null);
                        }}
                      />
                    );
                  })
                )}
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
                        className={`absolute z-[2] border ${active ? "border-celestial-gold bg-celestial-gold/40" : "border-celestial-gold/40 bg-celestial-gold/20"}`}
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
              {selectedConcept ? (
                <div className="mt-3 rounded-xl border border-nordic-blue/40 bg-celestial-deepBlue p-3">
                  <p className="text-sm font-semibold text-celestial-textMain">{selectedConcept.title || "無題のConcept"}</p>
                  <p className="mt-2 text-xs text-celestial-softGold">自分の定義</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-celestial-textMain">
                    {selectedConcept.definition.trim() ? selectedConcept.definition : "定義はまだ登録されていません。"}
                  </p>
                  {selectedConcept.domainTags.length > 0 ? (
                    <p className="mt-2 text-xs text-celestial-textSub">{selectedConcept.domainTags.join("、")}</p>
                  ) : null}
                  {onOpenConcept ? (
                    <button
                      type="button"
                      className="action-button mt-3 rounded-2xl px-3 py-1.5 text-sm"
                      onClick={() => {
                        onOpenConcept(selectedConcept.id);
                        onClose();
                      }}
                    >
                      Conceptを開く
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-xs text-celestial-textSub">PDF上の登録済みConceptを選ぶと、自分の定義を表示します。</p>
              )}
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
                            } else {
                              setSelectedAnchorId(null);
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
              <svg className="pointer-events-none absolute inset-0 z-[3] h-full w-full" aria-hidden="true">
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
