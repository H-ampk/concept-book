import { createEmptyConceptInput, type Concept } from "../types/concept";

export const SKILL_TREE_E2E_DATASETS = [
  "single",
  "pair",
  "small-branch",
  "chain",
  "wide",
  "asymmetric",
  "extra-edge",
  "complex"
] as const;

export type SkillTreeE2eDataset = (typeof SKILL_TREE_E2E_DATASETS)[number];

export const SKILL_TREE_E2E_IDS = {
  single: { a: "st-single-a" },
  pair: { a: "st-pair-a", b: "st-pair-b" },
  smallBranch: { a: "st-branch-a", b: "st-branch-b", c: "st-branch-c" },
  chain: { a: "st-chain-a", b: "st-chain-b", c: "st-chain-c", d: "st-chain-d", e: "st-chain-e" },
  wide: {
    root: "st-wide-root",
    a: "st-wide-a",
    b: "st-wide-b",
    c: "st-wide-c",
    d: "st-wide-d",
    e: "st-wide-e",
    f: "st-wide-f"
  },
  asymmetric: {
    root: "st-asym-root",
    a: "st-asym-a",
    a1: "st-asym-a1",
    a2: "st-asym-a2",
    a3: "st-asym-a3",
    a4: "st-asym-a4",
    b: "st-asym-b",
    b1: "st-asym-b1",
    pad1: "st-asym-pad1",
    pad2: "st-asym-pad2",
    pad3: "st-asym-pad3",
    pad4: "st-asym-pad4"
  },
  extraEdge: {
    root: "st-extra-root",
    a: "st-extra-a",
    b: "st-extra-b",
    c: "st-extra-c"
  },
  complex: {
    hub: "st-cx-hub",
    deep: "st-cx-deep",
    wide: "st-cx-wide",
    mid: "st-cx-mid",
    leaf: "st-cx-leaf"
  }
} as const;

const FIXED_TIME = "2026-01-01T00:00:00.000Z";

const concept = (id: string, title: string, relatedIds: string[]): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title,
  relatedIds,
  status: "active",
  createdAt: FIXED_TIME,
  updatedAt: FIXED_TIME
});

const single = (): Concept[] => [concept(SKILL_TREE_E2E_IDS.single.a, "A", [])];

const pair = (): Concept[] => {
  const { a, b } = SKILL_TREE_E2E_IDS.pair;
  return [concept(a, "A", [b]), concept(b, "B", [a])];
};

const smallBranch = (): Concept[] => {
  const { a, b, c } = SKILL_TREE_E2E_IDS.smallBranch;
  return [concept(a, "A", [b, c]), concept(b, "B", [a]), concept(c, "C", [a])];
};

const chain = (): Concept[] => {
  const { a, b, c, d, e } = SKILL_TREE_E2E_IDS.chain;
  return [
    concept(a, "A", [b]),
    concept(b, "B", [a, c]),
    concept(c, "C", [b, d]),
    concept(d, "D", [c, e]),
    concept(e, "E", [d])
  ];
};

const wide = (): Concept[] => {
  const { root, a, b, c, d, e, f } = SKILL_TREE_E2E_IDS.wide;
  const children = [a, b, c, d, e, f];
  return [
    concept(root, "Root", children),
    concept(a, "A", [root]),
    concept(b, "B", [root]),
    concept(c, "C", [root]),
    concept(d, "D", [root]),
    concept(e, "E", [root]),
    concept(f, "F", [root])
  ];
};

/**
 * Root が max-degree になるよう pad 葉を足す（仕様の root 選択は変更しない）。
 * 意図する非対称部分: A(4葉) と B(1葉)。
 */
const asymmetric = (): Concept[] => {
  const ids = SKILL_TREE_E2E_IDS.asymmetric;
  const pads = [ids.pad1, ids.pad2, ids.pad3, ids.pad4];
  return [
    concept(ids.root, "Root", [ids.a, ids.b, ...pads]),
    concept(ids.a, "A", [ids.root, ids.a1, ids.a2, ids.a3, ids.a4]),
    concept(ids.a1, "A1", [ids.a]),
    concept(ids.a2, "A2", [ids.a]),
    concept(ids.a3, "A3", [ids.a]),
    concept(ids.a4, "A4", [ids.a]),
    concept(ids.b, "B", [ids.root, ids.b1]),
    concept(ids.b1, "B1", [ids.b]),
    ...pads.map((id, index) => concept(id, `P${index + 1}`, [ids.root]))
  ];
};

/** 三角形: BFS 主線以外に 1 本 extra edge。 */
const extraEdge = (): Concept[] => {
  const { root, a, b, c } = SKILL_TREE_E2E_IDS.extraEdge;
  return [
    concept(root, "Root", [a, b, c]),
    concept(a, "A", [root, b]),
    concept(b, "B", [root, a, c]),
    concept(c, "C", [root, b])
  ];
};

const complex = (): Concept[] => {
  const hub = SKILL_TREE_E2E_IDS.complex.hub;
  const deepParent = SKILL_TREE_E2E_IDS.complex.deep;
  const wideParent = SKILL_TREE_E2E_IDS.complex.wide;
  const midParent = SKILL_TREE_E2E_IDS.complex.mid;
  const concepts: Concept[] = [];

  const deepIds = Array.from({ length: 8 }, (_, i) => `st-cx-d${i}`);
  const wideIds = Array.from({ length: 6 }, (_, i) => `st-cx-w${i}`);
  const midLeft = ["st-cx-m0", "st-cx-m1", "st-cx-m2"];
  const midRight = ["st-cx-m3", "st-cx-m4"];
  const midLeaves = ["st-cx-m0a", "st-cx-m0b", "st-cx-m1a"];
  const pads = Array.from({ length: 8 }, (_, i) => `st-cx-p${i}`);
  const small = SKILL_TREE_E2E_IDS.complex.leaf;

  concepts.push(
    concept(hub, "Hub", [deepParent, wideParent, midParent, small, ...pads])
  );
  pads.forEach((id, i) => concepts.push(concept(id, `Pad ${i}`, [hub])));
  concepts.push(concept(small, "Leaf", [hub]));

  concepts.push(concept(deepParent, "Deep", [hub, deepIds[0]]));
  deepIds.forEach((id, i) => {
    const prev = i === 0 ? deepParent : deepIds[i - 1];
    const next = deepIds[i + 1];
    concepts.push(concept(id, `D${i}`, next ? [prev, next] : [prev]));
  });

  concepts.push(concept(wideParent, "Wide", [hub, ...wideIds]));
  wideIds.forEach((id, i) => concepts.push(concept(id, `W${i}`, [wideParent])));

  concepts.push(concept(midParent, "Mid", [hub, ...midLeft, ...midRight]));
  concepts.push(concept(midLeft[0], "M0", [midParent, midLeaves[0], midLeaves[1]]));
  concepts.push(concept(midLeft[1], "M1", [midParent, midLeaves[2]]));
  concepts.push(concept(midLeft[2], "M2", [midParent]));
  midRight.forEach((id, i) => concepts.push(concept(id, `MR${i}`, [midParent])));
  concepts.push(concept(midLeaves[0], "M0a", [midLeft[0]]));
  concepts.push(concept(midLeaves[1], "M0b", [midLeft[0], wideIds[0]]));
  concepts.push(concept(midLeaves[2], "M1a", [midLeft[1]]));

  return concepts;
};

const builders: Record<SkillTreeE2eDataset, () => Concept[]> = {
  single,
  pair,
  "small-branch": smallBranch,
  chain,
  wide,
  asymmetric,
  "extra-edge": extraEdge,
  complex
};

export const isSkillTreeE2eDataset = (value: string | null): value is SkillTreeE2eDataset =>
  Boolean(value && (SKILL_TREE_E2E_DATASETS as readonly string[]).includes(value));

export const createSkillTreeE2eConcepts = (dataset: SkillTreeE2eDataset): Concept[] =>
  builders[dataset]();
