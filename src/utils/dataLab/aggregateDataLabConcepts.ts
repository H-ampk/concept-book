import { conceptStatusList, type Concept, type ConceptStatus } from "../../types/concept";
import { buildUndirectedAdjacency } from "../conceptRelations";

/** 分野なしバケットの安定キー（学習ログ側の DATA_LAB_DOMAIN_NONE_KEY と同趣旨） */
export const DATA_LAB_CONCEPT_DOMAIN_NONE_KEY = "__data-lab-concept-domain-none__";

export type DataLabConceptStatusRow = {
  status: ConceptStatus;
  conceptCount: number;
};

export type DataLabConceptDomainRow = {
  /** 分野なしは null */
  domainTag: string | null;
  /** 安定ソート・識別用。分野なしは DATA_LAB_CONCEPT_DOMAIN_NONE_KEY */
  key: string;
  conceptCount: number;
  contextDefinitionCount: number;
};

export type DataLabConceptResearchTagRow = {
  researchTag: string;
  conceptCount: number;
};

export type DataLabConceptRelationSummary = {
  average: number | null;
  minimum: number | null;
  maximum: number | null;
  zeroRelationConceptCount: number;
};

export type DataLabConceptContextSummary = {
  conceptsWithContextDefinitions: number;
  conceptsWithoutContextDefinitions: number;
  totalContextDefinitionCount: number;
  averageContextDefinitionCount: number | null;
};

export type DataLabConceptCompleteness = {
  missingDefinitionCount: number;
  missingSourceCount: number;
  missingRelationCount: number;
  missingContextDefinitionCount: number;
};

export type DataLabConceptRow = {
  conceptId: string;
  title: string;
  relationCount: number;
  contextDefinitionCount: number;
  domainCount: number;
  researchTagCount: number;
  status: ConceptStatus;
  favorite: boolean;
};

export type DataLabConceptAggregate = {
  totalConceptCount: number;
  favoriteCount: number;
  statusRows: DataLabConceptStatusRow[];
  domainRows: DataLabConceptDomainRow[];
  researchTagRows: DataLabConceptResearchTagRow[];
  relationSummary: DataLabConceptRelationSummary;
  contextSummary: DataLabConceptContextSummary;
  completeness: DataLabConceptCompleteness;
  conceptRows: DataLabConceptRow[];
};

export type AggregateDataLabConceptsArgs = {
  /** 分析対象（フィルタ後） */
  concepts: readonly Concept[];
  /** 関連数計算の基準（通常は全 Concept） */
  allConcepts: readonly Concept[];
};

const normalizeTags = (tags: readonly string[] | undefined): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags ?? []) {
    const tag = raw.trim();
    if (!tag || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    out.push(tag);
  }
  return out;
};

/** context / definition がともに非空のものだけ有効な文脈別定義として数える */
export const countValidContextDefinitions = (
  concept: Pick<Concept, "contextDefinitions">
): number => {
  let count = 0;
  for (const item of concept.contextDefinitions ?? []) {
    if (item.context.trim() !== "" && item.definition.trim() !== "") {
      count += 1;
    }
  }
  return count;
};

export const isMissingConceptSource = (concept: Pick<Concept, "source">): boolean => {
  const book = concept.source?.book?.trim() ?? "";
  const page = concept.source?.page?.trim() ?? "";
  const author = (concept.source?.author ?? "").trim();
  return book === "" && page === "" && author === "";
};

const compareJa = (a: string, b: string): number => a.localeCompare(b, "ja");

const emptyAggregate = (): DataLabConceptAggregate => ({
  totalConceptCount: 0,
  favoriteCount: 0,
  statusRows: conceptStatusList.map((status) => ({ status, conceptCount: 0 })),
  domainRows: [],
  researchTagRows: [],
  relationSummary: {
    average: null,
    minimum: null,
    maximum: null,
    zeroRelationConceptCount: 0
  },
  contextSummary: {
    conceptsWithContextDefinitions: 0,
    conceptsWithoutContextDefinitions: 0,
    totalContextDefinitionCount: 0,
    averageContextDefinitionCount: null
  },
  completeness: {
    missingDefinitionCount: 0,
    missingSourceCount: 0,
    missingRelationCount: 0,
    missingContextDefinitionCount: 0
  },
  conceptRows: []
});

/**
 * Concept データ集計。入力 Concept / allConcepts は mutate しない。
 * relationCount は allConcepts 上の無向隣接リストから算出する（フィルタ外 Concept との関係も残す）。
 */
export const aggregateDataLabConcepts = ({
  concepts,
  allConcepts
}: AggregateDataLabConceptsArgs): DataLabConceptAggregate => {
  if (concepts.length === 0) {
    return emptyAggregate();
  }

  const adjacency = buildUndirectedAdjacency(allConcepts);

  const statusCount = new Map<ConceptStatus, number>(
    conceptStatusList.map((status) => [status, 0])
  );
  const domainMap = new Map<string, { domainTag: string | null; conceptCount: number; contextDefinitionCount: number }>();
  const researchMap = new Map<string, number>();

  let favoriteCount = 0;
  let totalContextDefinitionCount = 0;
  let conceptsWithContextDefinitions = 0;
  let missingDefinitionCount = 0;
  let missingSourceCount = 0;
  let missingRelationCount = 0;
  let missingContextDefinitionCount = 0;
  let relationSum = 0;
  let relationMin = Number.POSITIVE_INFINITY;
  let relationMax = Number.NEGATIVE_INFINITY;
  let zeroRelationConceptCount = 0;

  const conceptRows: DataLabConceptRow[] = [];

  for (const concept of concepts) {
    const relationCount = adjacency.get(concept.id)?.length ?? 0;
    const contextDefinitionCount = countValidContextDefinitions(concept);
    const domainTags = normalizeTags(concept.domainTags);
    const researchTags = normalizeTags(concept.researchTags);

    statusCount.set(concept.status, (statusCount.get(concept.status) ?? 0) + 1);
    if (concept.favorite) {
      favoriteCount += 1;
    }

    totalContextDefinitionCount += contextDefinitionCount;
    if (contextDefinitionCount > 0) {
      conceptsWithContextDefinitions += 1;
    } else {
      missingContextDefinitionCount += 1;
    }

    if (concept.definition.trim() === "") {
      missingDefinitionCount += 1;
    }
    if (isMissingConceptSource(concept)) {
      missingSourceCount += 1;
    }
    if (relationCount === 0) {
      missingRelationCount += 1;
      zeroRelationConceptCount += 1;
    }

    relationSum += relationCount;
    if (relationCount < relationMin) {
      relationMin = relationCount;
    }
    if (relationCount > relationMax) {
      relationMax = relationCount;
    }

    if (domainTags.length === 0) {
      const existing = domainMap.get(DATA_LAB_CONCEPT_DOMAIN_NONE_KEY);
      if (existing) {
        existing.conceptCount += 1;
        existing.contextDefinitionCount += contextDefinitionCount;
      } else {
        domainMap.set(DATA_LAB_CONCEPT_DOMAIN_NONE_KEY, {
          domainTag: null,
          conceptCount: 1,
          contextDefinitionCount
        });
      }
    } else {
      for (const tag of domainTags) {
        const existing = domainMap.get(tag);
        if (existing) {
          existing.conceptCount += 1;
          existing.contextDefinitionCount += contextDefinitionCount;
        } else {
          domainMap.set(tag, {
            domainTag: tag,
            conceptCount: 1,
            contextDefinitionCount
          });
        }
      }
    }

    for (const tag of researchTags) {
      researchMap.set(tag, (researchMap.get(tag) ?? 0) + 1);
    }

    conceptRows.push({
      conceptId: concept.id,
      title: concept.title,
      relationCount,
      contextDefinitionCount,
      domainCount: domainTags.length,
      researchTagCount: researchTags.length,
      status: concept.status,
      favorite: concept.favorite
    });
  }

  const n = concepts.length;
  conceptRows.sort((a, b) => {
    if (b.relationCount !== a.relationCount) {
      return b.relationCount - a.relationCount;
    }
    const byTitle = compareJa(a.title, b.title);
    if (byTitle !== 0) {
      return byTitle;
    }
    return a.conceptId.localeCompare(b.conceptId);
  });

  const domainRows: DataLabConceptDomainRow[] = [...domainMap.entries()]
    .map(([key, row]) => ({
      key,
      domainTag: row.domainTag,
      conceptCount: row.conceptCount,
      contextDefinitionCount: row.contextDefinitionCount
    }))
    .sort((a, b) => {
      if (a.domainTag === null && b.domainTag !== null) {
        return 1;
      }
      if (a.domainTag !== null && b.domainTag === null) {
        return -1;
      }
      if (a.domainTag === null && b.domainTag === null) {
        return 0;
      }
      const byCount = b.conceptCount - a.conceptCount;
      if (byCount !== 0) {
        return byCount;
      }
      return compareJa(a.domainTag ?? "", b.domainTag ?? "");
    });

  const researchTagRows: DataLabConceptResearchTagRow[] = [...researchMap.entries()]
    .map(([researchTag, conceptCount]) => ({ researchTag, conceptCount }))
    .sort((a, b) => {
      const byCount = b.conceptCount - a.conceptCount;
      if (byCount !== 0) {
        return byCount;
      }
      return compareJa(a.researchTag, b.researchTag);
    });

  return {
    totalConceptCount: n,
    favoriteCount,
    statusRows: conceptStatusList.map((status) => ({
      status,
      conceptCount: statusCount.get(status) ?? 0
    })),
    domainRows,
    researchTagRows,
    relationSummary: {
      average: relationSum / n,
      minimum: relationMin,
      maximum: relationMax,
      zeroRelationConceptCount
    },
    contextSummary: {
      conceptsWithContextDefinitions,
      conceptsWithoutContextDefinitions: missingContextDefinitionCount,
      totalContextDefinitionCount,
      averageContextDefinitionCount: totalContextDefinitionCount / n
    },
    completeness: {
      missingDefinitionCount,
      missingSourceCount,
      missingRelationCount,
      missingContextDefinitionCount
    },
    conceptRows
  };
};
