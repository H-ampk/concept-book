import { useCallback, useEffect, useMemo, useState } from "react";
import { getStorage } from "../../storage";
import type { Concept, ConceptInput, ConceptStatus } from "../../types/concept";
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

  const create = useCallback(async (input: ConceptInput) => {
    await storage.createConcept(input);
    await reload();
  }, [reload]);

  const update = useCallback(
    async (id: string, updates: Partial<ConceptInput>) => {
      await storage.updateConcept(id, updates);
      await reload();
    },
    [reload]
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

  const visibleConcepts = useMemo(
    () =>
      filterConcepts(
        concepts,
        query,
        selectedDomainTags,
        selectedResearchTags,
        selectedStatuses,
        onlyFavorite
      ),
    [
      concepts,
      onlyFavorite,
      query,
      selectedDomainTags,
      selectedResearchTags,
      selectedStatuses
    ]
  );

  const tagGroups = useMemo(() => collectTagGroups(concepts), [concepts]);

  return {
    concepts,
    visibleConcepts,
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
