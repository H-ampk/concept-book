import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { getStorage } from "../../storage";
import type { Concept, ConceptInput, ConceptStatus } from "../../types/concept";
import {
  applyDerivedStatusOnUpdate,
  applyDerivedStatusToInput,
  type ConceptSaveOptions
} from "../../utils/conceptStatus";
import { collectTagGroups, filterConcepts } from "./conceptFilters";

const storage = getStorage();

export const useConcepts = () => {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedDomainTags, setSelectedDomainTags] = useState<string[]>([]);
  const [selectedResearchTags, setSelectedResearchTags] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<ConceptStatus[]>([]);
  const [onlyFavorite, setOnlyFavorite] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const all = await storage.getAllConcepts();
      setConcepts(all);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(async (input: ConceptInput, options?: ConceptSaveOptions) => {
    const normalized = applyDerivedStatusToInput(input, options);
    const created = await storage.createConcept(normalized);
    await reload();
    return created;
  }, [reload]);

  const update = useCallback(
    async (id: string, updates: Partial<ConceptInput>, options?: ConceptSaveOptions) => {
      const existing = concepts.find((concept) => concept.id === id);
      const normalized = existing
        ? applyDerivedStatusOnUpdate(existing, updates, options)
        : updates;
      const updated = await storage.updateConcept(id, normalized);
      await reload();
      return updated;
    },
    [concepts, reload]
  );

  const remove = useCallback(
    async (id: string) => {
      await storage.deleteConcept(id);
      await reload();
    },
    [reload]
  );

  const toggleFavorite = useCallback(
    async (concept: Concept) => {
      await storage.updateConcept(concept.id, { favorite: !concept.favorite });
      await reload();
    },
    [reload]
  );

  const debouncedSearchQuery = useDebouncedValue(query, 200);

  const visibleConcepts = useMemo(
    () =>
      filterConcepts(
        concepts,
        debouncedSearchQuery,
        selectedDomainTags,
        selectedResearchTags,
        selectedStatuses,
        onlyFavorite
      ),
    [
      concepts,
      debouncedSearchQuery,
      onlyFavorite,
      selectedDomainTags,
      selectedResearchTags,
      selectedStatuses
    ]
  );

  const tagGroups = useMemo(() => collectTagGroups(concepts), [concepts]);

  return {
    concepts,
    visibleConcepts,
    debouncedSearchQuery,
    allDomainTags: tagGroups.domainTags,
    allResearchTags: tagGroups.researchTags,
    loading,
    query,
    setQuery,
    selectedDomainTags,
    setSelectedDomainTags,
    selectedResearchTags,
    setSelectedResearchTags,
    selectedStatuses,
    setSelectedStatuses,
    onlyFavorite,
    setOnlyFavorite,
    create,
    update,
    remove,
    reload,
    toggleFavorite
  };
};
