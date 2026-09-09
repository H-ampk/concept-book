import { useState } from "react";
import { ConceptGraphView } from "../components/ConceptGraphView";
import {
  GRAPH_CONFUSION_FIXTURE_CONCEPTS,
  GRAPH_CONFUSION_FIXTURE_PAIRS,
  GRAPH_CONFUSION_FIXTURE_UNIVERSE_IDS
} from "./conceptGraphConfusionFixture";

export const ConceptGraphConfusionHarness = () => {
  const [selectedId, setSelectedId] = useState<string | undefined>("A");

  return (
    <div className="flex min-h-dvh flex-col bg-nordic-bg text-celestial-textMain">
      <header className="shrink-0 space-y-1 border-b border-celestial-border px-3 py-2">
        <p className="text-xs text-celestial-textSub">concept graph confusion harness (DEV)</p>
        <p className="text-xs text-celestial-textSub">
          IndexedDB 非使用。直接混同: A–B=3（細）/ A–C=6（太）。A–B は通常関連の実線と重なる。混同近傍: A–B が強く、A–D
          は弱い。
        </p>
        <p className="text-xs text-celestial-textSub">選択: {selectedId ?? "なし"}</p>
      </header>
      <div className="min-h-0 flex-1 p-3">
        <div className="h-[calc(100dvh-7rem)] min-h-[360px]">
          <ConceptGraphView
            concepts={GRAPH_CONFUSION_FIXTURE_CONCEPTS}
            domainColorMap={{}}
            selectedId={selectedId}
            onSelectConcept={setSelectedId}
            confusionPairs={GRAPH_CONFUSION_FIXTURE_PAIRS}
            confusionUniverseIds={GRAPH_CONFUSION_FIXTURE_UNIVERSE_IDS}
          />
        </div>
      </div>
    </div>
  );
};
