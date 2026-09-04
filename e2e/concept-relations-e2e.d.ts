type ConceptRelationE2eApi = {
  resetDb: () => Promise<void>;
  list: () => Promise<
    Array<{ id: string; title: string; relatedIds: string[]; updatedAt: string }>
  >;
  createUntitled: (title: string) => Promise<{
    id: string;
    title: string;
    relatedIds: string[];
    updatedAt: string;
  }>;
  addRelated: (fromId: string, toId: string) => Promise<void>;
  unlinkRelated: (fromId: string, toId: string) => Promise<void>;
  setRelatedIds: (id: string, relatedIds: string[]) => Promise<void>;
  deleteConcept: (id: string) => Promise<void>;
  putRawConcepts: (
    records: Array<{ id: string; title: string; relatedIds: string[]; updatedAt?: string }>
  ) => Promise<void>;
  seedLegacyV6: (
    records: Array<{ id: string; title: string; relatedIds: string[]; updatedAt?: string }>
  ) => Promise<void>;
  mergeImportConcepts: (
    records: Array<{ id: string; title: string; relatedIds: string[]; updatedAt?: string }>
  ) => Promise<void>;
  replaceImportConcepts: (
    records: Array<{ id: string; title: string; relatedIds: string[]; updatedAt?: string }>
  ) => Promise<void>;
  zipReplaceRoundtrip: () => Promise<void>;
};

interface Window {
  __conceptRelationE2e?: ConceptRelationE2eApi;
}
