import { useEffect, useId, useState } from "react";
import { ModalPortal } from "../common/ModalPortal";
import type { Concept } from "../../types/concept";

type Props = {
  open: boolean;
  concepts: Concept[];
  quotedText: string;
  onClose: () => void;
  onSelect: (conceptId: string) => void;
};

export const ConceptLinkDialog = ({ open, concepts, quotedText, onClose, onSelect }: Props) => {
  const titleId = useId();
  const [selectedId, setSelectedId] = useState(concepts[0]?.id ?? "");
  useEffect(() => {
    if (open) {
      setSelectedId(concepts[0]?.id ?? "");
    }
  }, [open, concepts]);
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) {
    return null;
  }
  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-nordic-overlay px-4 py-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="w-full max-w-lg rounded-2xl border border-celestial-border bg-celestial-panel p-5">
          <h2 id={titleId} className="text-lg font-semibold text-celestial-textMain">
            Conceptに関連付ける
          </h2>
          {quotedText ? <p className="mt-2 max-h-24 overflow-auto text-sm text-celestial-textSub">{quotedText}</p> : null}
          {concepts.length === 0 ? (
            <p className="mt-4 text-sm text-celestial-textSub">先にこの文脈カードへConceptを登録してください</p>
          ) : (
            <ul className="mt-4 max-h-64 space-y-2 overflow-auto">
              {concepts.map((concept) => (
                <li key={concept.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-celestial-border px-3 py-2 text-sm">
                    <input
                      type="radio"
                      name="concept-link"
                      checked={selectedId === concept.id}
                      onChange={() => setSelectedId(concept.id)}
                    />
                    {concept.title || "無題のConcept"}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="rounded-2xl border border-celestial-gold/30 px-4 py-2 text-sm" onClick={onClose}>
              キャンセル
            </button>
            <button
              type="button"
              className="action-button rounded-2xl px-4 py-2 text-sm disabled:opacity-50"
              disabled={!selectedId || concepts.length === 0}
              onClick={() => selectedId && onSelect(selectedId)}
            >
              関連付ける
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
