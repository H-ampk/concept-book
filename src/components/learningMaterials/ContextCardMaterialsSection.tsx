import { useId, useRef, useState } from "react";
import type { Concept } from "../../types/concept";
import type { LearningMaterial } from "../../types/learningMaterial";
import { LearningMaterialPdfViewer } from "./LearningMaterialPdfViewer";

type Props = {
  materials: LearningMaterial[];
  linkedConcepts: Concept[];
  busy?: boolean;
  error?: string | null;
  onAddPdf: (file: File) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export const ContextCardMaterialsSection = ({
  materials,
  linkedConcepts,
  busy,
  error,
  onAddPdf,
  onDelete
}: Props) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [openMaterial, setOpenMaterial] = useState<LearningMaterial | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div className="space-y-2 rounded-2xl border border-celestial-border bg-celestial-deepBlue p-4">
      <p className="text-sm text-celestial-softGold">教材</p>
      {error || localError ? <p className="text-sm text-rose-300">{error || localError}</p> : null}
      {materials.length === 0 ? (
        <p className="text-sm text-celestial-textSub">まだPDF教材は登録されていません。</p>
      ) : (
        <ul className="space-y-2">
          {materials.map((material) => (
            <li
              key={material.id}
              className="flex flex-col gap-2 rounded-xl border border-celestial-border bg-celestial-panel px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm text-celestial-textMain">📄 {material.title || material.fileName}</p>
                <p className="text-xs text-celestial-textSub">{material.fileName}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="action-button rounded-2xl px-3 py-1.5 text-sm" onClick={() => setOpenMaterial(material)}>
                  教材を開く
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-celestial-gold/30 px-3 py-1.5 text-sm text-celestial-softGold"
                  onClick={() => setPendingDeleteId(material.id)}
                >
                  教材を削除
                </button>
              </div>
              {pendingDeleteId === material.id ? (
                <div className="w-full text-sm text-celestial-textSub">
                  このPDFと出現箇所を削除します。よろしいですか？
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="rounded-2xl border px-3 py-1" onClick={() => setPendingDeleteId(null)}>
                      キャンセル
                    </button>
                    <button
                      type="button"
                      className="action-button rounded-2xl px-3 py-1"
                      onClick={async () => {
                        await onDelete(material.id);
                        setPendingDeleteId(null);
                      }}
                    >
                      削除する
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }
          setLocalError(null);
          void onAddPdf(file).catch((err) => {
            setLocalError(err instanceof Error ? err.message : "PDFの追加に失敗しました。");
          });
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className="rounded-2xl border border-celestial-gold/30 px-4 py-2 text-sm text-celestial-softGold"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        PDFを追加
      </button>
      {openMaterial ? (
        <LearningMaterialPdfViewer open material={openMaterial} linkedConcepts={linkedConcepts} onClose={() => setOpenMaterial(null)} />
      ) : null}
    </div>
  );
};
