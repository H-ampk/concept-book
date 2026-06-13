import { useEffect, useMemo, useState } from "react";
import type { Concept } from "../types/concept";
import { ConceptList } from "./ConceptList";

export type ListViewMode = "all" | "domain" | "research";

export type ConceptGroupSection = {
  key: string;
  label: string;
  concepts: Concept[];
};

type Props = {
  mode: ListViewMode;
  sections: ConceptGroupSection[];
  selectedId?: string;
  domainColorMap: Record<string, string>;
  conceptQuizStatsText?: Map<string, string>;
  onSelect: (id: string) => void;
  cardRefs: React.RefObject<Map<string, HTMLElement>>;
};

export const ConceptGroupSections = ({
  mode,
  sections,
  selectedId,
  domainColorMap,
  conceptQuizStatsText,
  onSelect,
  cardRefs
}: Props) => {
  const initialOpenState = useMemo(
    () =>
      Object.fromEntries(
        sections.map((section, index) => [section.key, index < 3 || section.key === "unclassified"])
      ),
    [sections]
  );
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(initialOpenState);

  useEffect(() => {
    setOpenMap((prev) => {
      const next: Record<string, boolean> = {};
      sections.forEach((section, index) => {
        const fallback = index < 3 || section.key === "unclassified";
        next[section.key] = prev[section.key] ?? fallback;
      });
      return next;
    });
  }, [sections]);

  const handleToggle = (key: string) => {
    setOpenMap((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));
  };

  if (mode === "all") {
    return (
      <ConceptList
        concepts={sections[0]?.concepts ?? []}
        selectedId={selectedId}
        domainColorMap={domainColorMap}
        conceptQuizStatsText={conceptQuizStatsText}
        onSelect={onSelect}
        cardRefs={cardRefs}
        listLayout="full"
      />
    );
  }

  if (sections.length === 0) {
    return (
      <p className="concept-index-empty">条件に一致する概念がありません。</p>
    );
  }

  return (
    <div className="concept-index-groups">
      {sections.map((section) => {
        const open = openMap[section.key] ?? true;
        return (
          <section key={section.key} className="concept-index-group">
            <button
              type="button"
              className="concept-index-group-toggle"
              onClick={() => handleToggle(section.key)}
            >
              <span className="concept-index-group-label">{section.label}</span>
              <span className="concept-index-group-count">
                {section.concepts.length}件 / {open ? "閉じる" : "開く"}
              </span>
            </button>
            {open && (
              <div className="concept-index-group-body">
                <ConceptList
                  concepts={section.concepts}
                  selectedId={selectedId}
                  domainColorMap={domainColorMap}
                  conceptQuizStatsText={conceptQuizStatsText}
                  onSelect={onSelect}
                  cardRefs={cardRefs}
                  listLayout="grouped"
                />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
