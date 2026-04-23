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
  onSelect: (id: string) => void;
  onEdit: (concept: Concept) => void;
  onToggleFavorite: (concept: Concept) => void;
};

export const ConceptGroupSections = ({
  mode,
  sections,
  selectedId,
  domainColorMap,
  onSelect,
  onEdit,
  onToggleFavorite
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
        onSelect={onSelect}
        onEdit={onEdit}
        onToggleFavorite={onToggleFavorite}
      />
    );
  }

  if (sections.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-nordic-border bg-nordic-surface p-4 text-sm text-nordic-textSecondary">
        条件に一致する概念がありません。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sections.map((section) => {
        const open = openMap[section.key] ?? true;
        return (
          <section key={section.key} className="rounded-xl border border-nordic-border bg-nordic-surface shadow-quiet">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-nordic-bg"
              onClick={() => handleToggle(section.key)}
            >
              <span className="text-sm font-semibold text-nordic-textPrimary">{section.label}</span>
              <span className="text-xs text-nordic-textSecondary">
                {section.concepts.length}件 / {open ? "閉じる" : "開く"}
              </span>
            </button>
            {open && (
              <div className="border-t border-nordic-border p-2">
                <ConceptList
                  concepts={section.concepts}
                  selectedId={selectedId}
                  domainColorMap={domainColorMap}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  onToggleFavorite={onToggleFavorite}
                />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
