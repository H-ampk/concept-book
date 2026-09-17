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

  type LayoutFrame = {
    id: string;
    depth: number;
    childIndex: number;
    childYs: number[];
  };

  const frames: LayoutFrame[] = [{ id: rootId, depth: 0, childIndex: 0, childYs: [] }];

  while (frames.length > 0) {
    const frame = frames[frames.length - 1];
    const children = tree.get(frame.id) ?? [];

    if (children.length === 0) {
      const y = getSkillTreeLeafSlotY(nextLeafIndex);
      nextLeafIndex += 1;
      savePosition(frame.id, frame.depth, y);
      frames.pop();
      if (frames.length > 0) {
        frames[frames.length - 1].childYs.push(y);
      }
      continue;
    }

    if (frame.childIndex < children.length) {
      const child = children[frame.childIndex];
      frame.childIndex += 1;
      frames.push({ id: child, depth: frame.depth + 1, childIndex: 0, childYs: [] });
      continue;
    }

    const y =
      frame.childYs.length === 1
        ? frame.childYs[0]
        : (frame.childYs[0] + frame.childYs[frame.childYs.length - 1]) / 2;
    savePosition(frame.id, frame.depth, y);
    frames.pop();
    if (frames.length > 0) {
      frames[frames.length - 1].childYs.push(y);
    }
  }

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
