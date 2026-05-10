import type { QuizAttemptLog } from "../types/quiz";

/** リンク欠損を表す集計キー（UUID ではない） */
export const CONCEPT_GRAPH_UNCLASSIFIED_KEY = "__unclassified__";

export type ConceptConfusionEdge = {
  /** 実 Concept ID または `CONCEPT_GRAPH_UNCLASSIFIED_KEY`（リンク欠損） */
  selectedKey: string;
  /** 実 Concept ID または `CONCEPT_GRAPH_UNCLASSIFIED_KEY`（リンク欠損） */
  correctKey: string;
  count: number;
};

export type ConceptConfusionNodeStat = {
  conceptKey: string;
  chosenAsWrongCount: number;
  asCorrectInWrongCount: number;
  /** この Concept が選ばれた側または正解側のいずれかに現れる混同ペア（エッジ）の件数 */
  relatedPairCount: number;
  lastAppearanceAt: string | null;
};

export type ConceptGraphAnalysisSummary = {
  totalLogs: number;
  incorrectLogs: number;
  confusionPairCount: number;
  /** 誤って選ばれた回数が最大の Concept キー（ログが無い場合は null） */
  topMisleadingConceptKey: string | null;
};

const edgePairKey = (sel: string, corr: string): string => `${sel}\u0000${corr}`;

export const conceptKeyFromLinkId = (id: string | undefined | null): string => {
  const t = id?.trim();
  return t ? t : CONCEPT_GRAPH_UNCLASSIFIED_KEY;
};

export const formatConceptGraphNodeLabel = (
  conceptKey: string,
  titleById: Map<string, string>
): string => {
  if (conceptKey === CONCEPT_GRAPH_UNCLASSIFIED_KEY) {
    return "未分類";
  }
  if (!titleById.has(conceptKey)) {
    return "削除済みConcept";
  }
  return titleById.get(conceptKey) ?? "無題";
};

/**
 * 不正解ログについて、選んだ Concept → 正解 Concept の有向エッジを件数集計する。
 */
export const computeConfusionEdges = (logs: QuizAttemptLog[]): ConceptConfusionEdge[] => {
  const map = new Map<string, { selectedKey: string; correctKey: string; count: number }>();

  for (const log of logs) {
    if (log.correct) {
      continue;
    }
    const selK = conceptKeyFromLinkId(log.selectedLinkedConceptId);
    const corrK = conceptKeyFromLinkId(log.correctLinkedConceptId);
    const k = edgePairKey(selK, corrK);
    const cur = map.get(k);
    if (cur) {
      cur.count += 1;
    } else {
      map.set(k, { selectedKey: selK, correctKey: corrK, count: 1 });
    }
  }

  const rows: ConceptConfusionEdge[] = [...map.values()].map((v) => ({
    selectedKey: v.selectedKey,
    correctKey: v.correctKey,
    count: v.count
  }));

  rows.sort((a, b) => b.count - a.count);
  return rows;
};

const maxIso = (a: string, b: string): string => (a >= b ? a : b);

export const computeConceptConfusionNodeStats = (
  logs: QuizAttemptLog[],
  edges: ConceptConfusionEdge[]
): ConceptConfusionNodeStat[] => {
  const incorrect = logs.filter((l) => !l.correct);

  const chosenAsWrong = new Map<string, number>();
  const asCorrect = new Map<string, number>();
  const lastAt = new Map<string, string>();

  for (const log of incorrect) {
    const sk = conceptKeyFromLinkId(log.selectedLinkedConceptId);
    const ck = conceptKeyFromLinkId(log.correctLinkedConceptId);
    chosenAsWrong.set(sk, (chosenAsWrong.get(sk) ?? 0) + 1);
    asCorrect.set(ck, (asCorrect.get(ck) ?? 0) + 1);
    const prevS = lastAt.get(sk);
    lastAt.set(sk, prevS == null ? log.answeredAt : maxIso(prevS, log.answeredAt));
    const prevC = lastAt.get(ck);
    lastAt.set(ck, prevC == null ? log.answeredAt : maxIso(prevC, log.answeredAt));
  }

  const keys = new Set<string>();
  for (const e of edges) {
    keys.add(e.selectedKey);
    keys.add(e.correctKey);
  }
  for (const k of chosenAsWrong.keys()) {
    keys.add(k);
  }
  for (const k of asCorrect.keys()) {
    keys.add(k);
  }

  const relatedPairCount = (conceptKey: string): number =>
    edges.filter((e) => e.selectedKey === conceptKey || e.correctKey === conceptKey).length;

  const rows: ConceptConfusionNodeStat[] = [...keys].map((conceptKey) => ({
    conceptKey,
    chosenAsWrongCount: chosenAsWrong.get(conceptKey) ?? 0,
    asCorrectInWrongCount: asCorrect.get(conceptKey) ?? 0,
    relatedPairCount: relatedPairCount(conceptKey),
    lastAppearanceAt: lastAt.get(conceptKey) ?? null
  }));

  rows.sort((a, b) => {
    if (b.chosenAsWrongCount !== a.chosenAsWrongCount) {
      return b.chosenAsWrongCount - a.chosenAsWrongCount;
    }
    if (b.asCorrectInWrongCount !== a.asCorrectInWrongCount) {
      return b.asCorrectInWrongCount - a.asCorrectInWrongCount;
    }
    return (a.conceptKey || "").localeCompare(b.conceptKey || "", "ja");
  });

  return rows;
};

export const computeConceptGraphSummary = (
  logs: QuizAttemptLog[],
  edges: ConceptConfusionEdge[],
  nodeStats: ConceptConfusionNodeStat[]
): ConceptGraphAnalysisSummary => {
  const incorrectLogs = logs.filter((l) => !l.correct).length;

  let topMisleadingConceptKey: string | null = null;
  let topChosen = -1;
  for (const n of nodeStats) {
    if (n.chosenAsWrongCount > topChosen) {
      topChosen = n.chosenAsWrongCount;
      topMisleadingConceptKey = n.conceptKey;
    }
  }
  if (topChosen <= 0) {
    topMisleadingConceptKey = null;
  }

  return {
    totalLogs: logs.length,
    incorrectLogs,
    confusionPairCount: edges.length,
    topMisleadingConceptKey
  };
};

export type NetworkCardPartner = {
  partnerKey: string;
  count: number;
  direction: "selected_was_wrong_for" | "correct_when_missed";
};

/**
 * 簡易ネットワーク用: 各 Concept について、混同の相手方向ごとの件数。
 */
export const buildNetworkPartnersByConcept = (
  edges: ConceptConfusionEdge[]
): Map<string, NetworkCardPartner[]> => {
  const out = new Map<string, Map<string, NetworkCardPartner>>();

  const bump = (fromKey: string, partner: NetworkCardPartner) => {
    let inner = out.get(fromKey);
    if (!inner) {
      inner = new Map();
      out.set(fromKey, inner);
    }
    const pk = `${partner.direction}\u0000${partner.partnerKey}`;
    const cur = inner.get(pk);
    if (cur) {
      cur.count += partner.count;
    } else {
      inner.set(pk, { ...partner });
    }
  };

  for (const e of edges) {
    bump(e.selectedKey, {
      partnerKey: e.correctKey,
      count: e.count,
      direction: "selected_was_wrong_for"
    });
    bump(e.correctKey, {
      partnerKey: e.selectedKey,
      count: e.count,
      direction: "correct_when_missed"
    });
  }

  const result = new Map<string, NetworkCardPartner[]>();
  for (const [k, inner] of out) {
    result.set(
      k,
      [...inner.values()].sort((a, b) => b.count - a.count)
    );
  }
  return result;
};
