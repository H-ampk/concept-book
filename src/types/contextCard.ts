export type ContextCard = {
  id: string;
  title: string;
  domain: string;
  domainTags: string[];
  centralQuestion: string;
  background: string;
  flow: string;
  keyConcepts: string;
  linkedConcepts: string[];
  createdAt: string;
  updatedAt: string;
};

export type ContextCardInput = Omit<ContextCard, "id" | "createdAt" | "updatedAt">;

export const createEmptyContextCardInput = (): ContextCardInput => ({
  title: "",
  domain: "",
  domainTags: [],
  centralQuestion: "",
  background: "",
  flow: "",
  keyConcepts: "",
  linkedConcepts: []
});
