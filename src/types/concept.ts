export const conceptStatusList = [
  "active",
  "researching",
  "unclear",
  "archived"
] as const;

export type ConceptStatus = (typeof conceptStatusList)[number];

export type ConceptSource = {
  book: string;
  page: string;
  author: string | null;
};

export type Concept = {
  id: string;
  title: string;
  definition: string;
  myInterpretation: string;
  domainTags: string[];
  researchTags: string[];
  relatedIds: string[];
  source: ConceptSource;
  notes: string;
  status: ConceptStatus;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ConceptInput = Omit<Concept, "id" | "createdAt" | "updatedAt">;

export const createEmptyConceptInput = (): ConceptInput => ({
  title: "",
  definition: "",
  myInterpretation: "",
  domainTags: [],
  researchTags: [],
  relatedIds: [],
  source: {
    book: "",
    page: "",
    author: null
  },
  notes: "",
  status: "active",
  favorite: false
});
