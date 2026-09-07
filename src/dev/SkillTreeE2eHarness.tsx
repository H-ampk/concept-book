import { useMemo, useState } from "react";
import { SkillTreeView } from "../components/SkillTreeView";
import {
  createSkillTreeE2eConcepts,
  isSkillTreeE2eDataset,
  type SkillTreeE2eDataset
} from "./skillTreeE2eData";

const datasetFromSearch = (): SkillTreeE2eDataset => {
  const value = new URLSearchParams(window.location.search).get("tree");
  return isSkillTreeE2eDataset(value) ? value : "asymmetric";
};

export const SkillTreeE2eHarness = () => {
  const dataset = useMemo(() => datasetFromSearch(), []);
  const concepts = useMemo(() => createSkillTreeE2eConcepts(dataset), [dataset]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  return (
    <div className="flex min-h-dvh flex-col bg-nordic-bg text-celestial-textMain">
      <header className="shrink-0 border-b border-celestial-border px-3 py-2">
        <p className="text-xs text-celestial-textSub">skill tree e2e harness (DEV)</p>
        <p className="text-xs text-celestial-textSub" data-testid="skill-tree-dataset">
          dataset: {dataset}
        </p>
        <p className="text-xs text-celestial-textSub" data-testid="skill-tree-selected">
          選択: {selectedId ?? "なし"}
        </p>
      </header>
      <div className="min-h-0 flex-1 p-3">
        <SkillTreeView
          concepts={concepts}
          domainColorMap={{}}
          selectedId={selectedId}
          onSelectConcept={setSelectedId}
          onClearSelection={() => setSelectedId(undefined)}
        />
      </div>
    </div>
  );
};
