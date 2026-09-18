import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { getStorage } from "../../storage";
import type { Concept, ConceptInput, ConceptStatus } from "../../types/concept";
import type { ConceptMediaCommitItem } from "../../types/media";
import {
  applyDerivedStatusOnUpdate,
  applyDerivedStatusToInput,
  normalizeConceptStatuses,
  type ConceptSaveOptions
} from "../../utils/conceptStatus";
import { collectTagGroups, filterConcepts } from "./conceptFilters";

const storage = getStorage();

const CONCEPT_STALE_MUTATION_ERROR =
  "概念データが最新状態ではないため、再読み込みに成功するまで変更できません。";

const reloadFailureMessage = (error: unknown): string =>
  error instanceof Error && error.message.trim()
    ? error.message
    : "概念データの再読み込みに失敗しました。";

const shouldFailConceptReload = (): boolean =>
  typeof window !== "undefined" &&
  Boolean(
    (window as Window & { __CONCEPTBOOK_FAIL_CONCEPT_RELOAD?: boolean })
      .__CONCEPTBOOK_FAIL_CONCEPT_RELOAD
  );

export const useConcepts = () => {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedDomainTags, setSelectedDomainTags] = useState<string[]>([]);
  const [selectedResearchTags, setSelectedResearchTags] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<ConceptStatus[]>([]);
  const [onlyFavorite, setOnlyFavorite] = useState(false);
  const hasSuccessfulLoadRef = useRef(false);
  const reloadGenerationRef = useRef(0);

  const reload = useCallback(async () => {
    const generation = ++reloadGenerationRef.current;
    setLoading(true);
    try {
      if (shouldFailConceptReload()) {
        throw new Error("injected read failure");
      }
      const all = await storage.getAllConcepts();
      if (generation !== reloadGenerationRef.current) {
        return;
      }
      const { concepts: normalized, changedCount, changedIds } =
        normalizeConceptStatuses(all);

      if (changedCount > 0) {
        await Promise.all(
          changedIds.map((id) => {
            const concept = normalized.find((c) => c.id === id);
            if (!concept) {
              return Promise.resolve();
            }
            return storage.updateConcept(id, { status: concept.status });
          })
        );
        if (generation !== reloadGenerationRef.current) {
          return;
        }
        console.info(`[ConceptBook] normalized concept statuses: ${changedCount}`);
      }

      if (generation !== reloadGenerationRef.current) {
        return;
      }
      setConcepts(normalized);
      setReloadError(null);
      setIsStale(false);
      hasSuccessfulLoadRef.current = true;
    } catch (error) {
      if (generation !== reloadGenerationRef.current) {
        return;
      }
      setReloadError(reloadFailureMessage(error));
      setIsStale(hasSuccessfulLoadRef.current);
    } finally {
      if (generation === reloadGenerationRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const canMutateConcepts = !loading && reloadError === null;

  const assertCanMutateConcepts = useCallback(() => {
    if (!canMutateConcepts) {
      throw new Error(CONCEPT_STALE_MUTATION_ERROR);
    }
  }, [canMutateConcepts]);

  const create = useCallback(async (input: ConceptInput, options?: ConceptSaveOptions) => {
    assertCanMutateConcepts();
    const normalized = applyDerivedStatusToInput(input, options);
    const created = await storage.createConcept(normalized);
    await reload();
    return created;
  }, [assertCanMutateConcepts, reload]);

  const update = useCallback(
    async (id: string, updates: Partial<ConceptInput>, options?: ConceptSaveOptions) => {
      assertCanMutateConcepts();
      const existing = concepts.find((concept) => concept.id === id);
      const normalized = existing
        ? applyDerivedStatusOnUpdate(existing, updates, options)
        : updates;
      const updated = await storage.updateConcept(id, normalized);
      await reload();
      return updated;
    },
    [assertCanMutateConcepts, concepts, reload]
  );

  const remove = useCallback(
    async (id: string) => {
      assertCanMutateConcepts();
      await storage.deleteConcept(id);
      await reload();
    },
    [assertCanMutateConcepts, reload]
  );

  const saveWithMediaDraft = useCallback(
    async (
      args: {
        mode: "create" | "edit";
        conceptId?: string;
        input: ConceptInput;
        media: ConceptMediaCommitItem[];
      },
      options?: ConceptSaveOptions
    ) => {
      assertCanMutateConcepts();
      if (args.mode === "create") {
        const normalized = applyDerivedStatusToInput(args.input, options);
        const created = await storage.saveConceptWithMediaDraft({
          mode: "create",
          input: normalized,
          media: args.media
        });
        await reload();
        return created;
      }
      if (!args.conceptId) {
        throw new Error("更新対象の概念が指定されていません。");
      }
      const existing = concepts.find((concept) => concept.id === args.conceptId);
      const normalized = existing
        ? applyDerivedStatusOnUpdate(existing, args.input, options)
        : args.input;
      const updated = await storage.saveConceptWithMediaDraft({
        mode: "edit",
        conceptId: args.conceptId,
        input: normalized,
        media: args.media
      });
      await reload();
      return updated;
    },
    [assertCanMutateConcepts, concepts, reload]
  );

  const toggleFavorite = useCallback(
    async (concept: Concept) => {
      assertCanMutateConcepts();
      await storage.updateConcept(concept.id, { favorite: !concept.favorite });
      await reload();
    },
    [assertCanMutateConcepts, reload]
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
    reloadError,
    isStale,
    canMutateConcepts,
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
    saveWithMediaDraft,
    remove,
    reload,
    toggleFavorite
  };
};
