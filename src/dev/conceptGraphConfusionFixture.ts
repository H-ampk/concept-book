import type { Concept } from "../types/concept";
import type { ConfusionPairStat } from "../utils/quizStats";
import { GRAPH_TEST_TIMESTAMP } from "../utils/conceptGraphTestData";

const makeConcept = (id: string, title: string, relatedIds: string[] = []): Concept => ({
  id,
  title,
  definition: "Issue #21 synthetic fixture",
  myInterpretation: "",
  domainTags: ["検証"],
  researchTags: [],
  relatedIds,
  source: { book: "", page: "", author: null },
  notes: "",
  status: "active",
  favorite: false,
  createdAt: GRAPH_TEST_TIMESTAMP,
  updatedAt: GRAPH_TEST_TIMESTAMP
});

/**
 * DEV 専用。IndexedDB には書き込まない。
 * 直接混同: A-B=3, A-C=6。k-NN: A と B の誤答パターンが近い。
 */
export const GRAPH_CONFUSION_FIXTURE_CONCEPTS: Concept[] = [
  makeConcept("A", "A（混同ハブ）", ["B"]),
  makeConcept("B", "B（直接+近傍）", ["A"]),
  makeConcept("C", "C（直接が多い）"),
  makeConcept("D", "D（弱い近傍）"),
  makeConcept("X", "X（誤答先）"),
  makeConcept("Y", "Y（誤答先）"),
  makeConcept("Z", "Z（Cの誤答先）")
];

export const GRAPH_CONFUSION_FIXTURE_PAIRS: ConfusionPairStat[] = [
  { selectedConceptId: "B", correctConceptId: "A", count: 1 },
  { selectedConceptId: "A", correctConceptId: "B", count: 2 },
  { selectedConceptId: "C", correctConceptId: "A", count: 6 },
  { selectedConceptId: "X", correctConceptId: "A", count: 5 },
  { selectedConceptId: "Y", correctConceptId: "A", count: 2 },
  { selectedConceptId: "X", correctConceptId: "B", count: 4 },
  { selectedConceptId: "Y", correctConceptId: "B", count: 2 },
  { selectedConceptId: "Z", correctConceptId: "C", count: 5 },
  { selectedConceptId: "X", correctConceptId: "D", count: 1 }
];

export const GRAPH_CONFUSION_FIXTURE_UNIVERSE_IDS =
  GRAPH_CONFUSION_FIXTURE_CONCEPTS.map((concept) => concept.id);
