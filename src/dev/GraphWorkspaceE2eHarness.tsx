import { useState } from "react";
import { GraphWorkspaceLayout } from "../app/GraphWorkspaceLayout";
import { ConceptGraphView } from "../components/ConceptGraphView";
import type { Concept } from "../types/concept";
import { createGraphTestConcepts } from "../utils/conceptGraphTestData";

const sampleConcepts: Concept[] = createGraphTestConcepts({ conceptCount: 250, seed: 136 });

export const GraphWorkspaceE2eHarness = () => {
  const [detailOpen, setDetailOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | undefined>(sampleConcepts[0]?.id);

  return (
    <div className="flex min-h-dvh flex-col bg-nordic-bg text-celestial-textMain">
      <div className="fixed inset-0 pointer-events-none z-[1]" data-testid="decorative-background" />
      <header className="relative z-[2] shrink-0 border-b border-celestial-border px-3 py-2">
        <p className="text-xs text-celestial-textSub">graph workspace e2e harness (DEV)</p>
      </header>
      <div className="relative z-[2] min-h-0 flex-1">
        <GraphWorkspaceLayout
          detailOpen={detailOpen}
          graph={
            <ConceptGraphView
              concepts={sampleConcepts}
              domainColorMap={{}}
              selectedId={selectedId}
              onSelectConcept={(id) => {
                setSelectedId(id);
                setDetailOpen(true);
              }}
            />
          }
          detail={
            <>
              <div className="mb-2 flex justify-end">
                <button type="button" className="index-text-button" onClick={() => setDetailOpen(false)}>
                  閉じる
                </button>
              </div>
              <p>選択: {selectedId ?? "なし"}</p>
              <button type="button" className="index-text-button mt-2">
                お気に入り
              </button>
            </>
          }
        />
      </div>
    </div>
  );
};
