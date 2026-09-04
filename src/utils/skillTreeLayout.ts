export const SKILL_TREE_CARD_WIDTH = 240;
export const SKILL_TREE_CARD_HEIGHT = 64;
export const SKILL_TREE_HORIZONTAL_GAP = 130;
export const SKILL_TREE_VERTICAL_GAP = 80;
export const SKILL_TREE_CANVAS_MARGIN_X = 48;
export const SKILL_TREE_CANVAS_MARGIN_Y = 48;

export type SkillTreeLayoutPosition = {
  id: string;
  depth: number;
  x: number;
  y: number;
};

export type SkillTreeLayoutResult = {
  positions: Map<string, SkillTreeLayoutPosition>;
  canvasWidth: number;
  canvasHeight: number;
};

export const getSkillTreeLeafSlotY = (leafIndex: number): number =>
  SKILL_TREE_CANVAS_MARGIN_Y +
  SKILL_TREE_CARD_HEIGHT / 2 +
  leafIndex * (SKILL_TREE_CARD_HEIGHT + SKILL_TREE_VERTICAL_GAP);

const nodeXAtDepth = (depth: number): number =>
  SKILL_TREE_CANVAS_MARGIN_X +
  SKILL_TREE_CARD_WIDTH / 2 +
  depth * (SKILL_TREE_CARD_WIDTH + SKILL_TREE_HORIZONTAL_GAP);

/**
 * visibleTree に対する subtree-aware 決定的レイアウト。
 * 葉へ縦スロットを割り当て、親は子群の中央（子が1つなら同じ Y）に置く。
 */
export const computeSkillTreeLayout = (
  tree: Map<string, string[]>,
  rootId: string
): SkillTreeLayoutResult => {
  const positions = new Map<string, SkillTreeLayoutPosition>();

  if (!rootId) {
    return { positions, canvasWidth: 0, canvasHeight: 0 };
  }

  let nextLeafIndex = 0;
  let maxDepth = 0;

  const savePosition = (id: string, depth: number, y: number) => {
    maxDepth = Math.max(maxDepth, depth);
    positions.set(id, {
      id,
      depth,
      x: nodeXAtDepth(depth),
      y,
    });
  };

  const layoutNode = (id: string, depth: number): number => {
    const children = tree.get(id) ?? [];

    if (children.length === 0) {
      const y = getSkillTreeLeafSlotY(nextLeafIndex);
      nextLeafIndex += 1;
      savePosition(id, depth, y);
      return y;
    }

    const childYs = children.map((child) => layoutNode(child, depth + 1));
    const y =
      childYs.length === 1 ? childYs[0] : (childYs[0] + childYs[childYs.length - 1]) / 2;

    savePosition(id, depth, y);
    return y;
  };

  layoutNode(rootId, 0);

  const leafCount = Math.max(nextLeafIndex, 1);
  const canvasWidth =
    SKILL_TREE_CANVAS_MARGIN_X * 2 +
    (maxDepth + 1) * SKILL_TREE_CARD_WIDTH +
    maxDepth * SKILL_TREE_HORIZONTAL_GAP;
  const canvasHeight =
    SKILL_TREE_CANVAS_MARGIN_Y * 2 +
    leafCount * SKILL_TREE_CARD_HEIGHT +
    Math.max(0, leafCount - 1) * SKILL_TREE_VERTICAL_GAP;

  return { positions, canvasWidth, canvasHeight };
};
