import { GRAPH_LABEL_NODE_GAP } from "./conceptGraphNodeGeometry";

export const CONCEPT_GRAPH_LABEL_DIRECTIONS = [
  "right",
  "bottomRight",
  "bottom",
  "bottomLeft",
  "left",
  "topLeft",
  "top",
  "topRight"
] as const;

export type ConceptGraphLabelDirection = (typeof CONCEPT_GRAPH_LABEL_DIRECTIONS)[number];

export type ConceptGraphTextAlign = "left" | "right" | "center";
export type ConceptGraphTextBaseline = "top" | "bottom" | "middle";

export type ConceptGraphLabelPlacement = {
  x: number;
  y: number;
  textAlign: ConceptGraphTextAlign;
  textBaseline: ConceptGraphTextBaseline;
  direction: ConceptGraphLabelDirection;
};

export type ConceptGraphLabelRect = {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type ConceptGraphLabelLayoutNode = {
  id: string;
  nodeX: number;
  nodeY: number;
  visualRadius: number;
  labelOffset: number;
  textWidth: number;
  screenFontSize: number;
  halo: number;
  isSelected: boolean;
  isFavorite: boolean;
};

type Circle = {
  id: string;
  x: number;
  y: number;
  radius: number;
};

const LABEL_HASH_CELL_SIZE = 64;
const DIAGONAL_AXIS = Math.SQRT1_2;

const circleIntersectsRect = (circle: Circle, rect: ConceptGraphLabelRect): boolean => {
  const closestX = Math.min(rect.right, Math.max(rect.left, circle.x));
  const closestY = Math.min(rect.bottom, Math.max(rect.top, circle.y));
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.radius * circle.radius;
};

const rectsOverlap = (a: ConceptGraphLabelRect, b: ConceptGraphLabelRect): boolean =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

export const getConceptGraphLabelAnchorDistance = (labelOffset: number): number =>
  labelOffset + GRAPH_LABEL_NODE_GAP;

export const getPreferredConceptGraphLabelDirection = (
  nodeX: number,
  nodeY: number
): ConceptGraphLabelDirection => {
  if (nodeX === 0 && nodeY === 0) {
    return "bottom";
  }
  const twoPi = Math.PI * 2;
  const normalized = (Math.atan2(nodeY, nodeX) + twoPi) % twoPi;
  const index = Math.round(normalized / (Math.PI / 4)) % CONCEPT_GRAPH_LABEL_DIRECTIONS.length;
  return CONCEPT_GRAPH_LABEL_DIRECTIONS[index];
};

const candidateDirections = (preferred: ConceptGraphLabelDirection): ConceptGraphLabelDirection[] => {
  const start = CONCEPT_GRAPH_LABEL_DIRECTIONS.indexOf(preferred);
  return [
    ...CONCEPT_GRAPH_LABEL_DIRECTIONS.slice(start),
    ...CONCEPT_GRAPH_LABEL_DIRECTIONS.slice(0, start)
  ];
};

export const getConceptGraphLabelPlacement = ({
  nodeX,
  nodeY,
  labelOffset,
  direction
}: {
  nodeX: number;
  nodeY: number;
  labelOffset: number;
  direction: ConceptGraphLabelDirection;
}): ConceptGraphLabelPlacement => {
  const distance = getConceptGraphLabelAnchorDistance(labelOffset);
  const diagonal = distance * DIAGONAL_AXIS;

  switch (direction) {
    case "top":
      return {
        x: nodeX,
        y: nodeY - distance,
        textAlign: "center",
        textBaseline: "bottom",
        direction
      };
    case "left":
      return {
        x: nodeX - distance,
        y: nodeY,
        textAlign: "right",
        textBaseline: "middle",
        direction
      };
    case "right":
      return {
        x: nodeX + distance,
        y: nodeY,
        textAlign: "left",
        textBaseline: "middle",
        direction
      };
    case "topLeft":
      return {
        x: nodeX - diagonal,
        y: nodeY - diagonal,
        textAlign: "right",
        textBaseline: "bottom",
        direction
      };
    case "topRight":
      return {
        x: nodeX + diagonal,
        y: nodeY - diagonal,
        textAlign: "left",
        textBaseline: "bottom",
        direction
      };
    case "bottomLeft":
      return {
        x: nodeX - diagonal,
        y: nodeY + diagonal,
        textAlign: "right",
        textBaseline: "top",
        direction
      };
    case "bottomRight":
      return {
        x: nodeX + diagonal,
        y: nodeY + diagonal,
        textAlign: "left",
        textBaseline: "top",
        direction
      };
    case "bottom":
    default:
      return {
        x: nodeX,
        y: nodeY + distance,
        textAlign: "center",
        textBaseline: "top",
        direction: "bottom"
      };
  }
};

export const getConceptGraphLabelScreenBounds = ({
  id,
  placement,
  textWidth,
  screenFontSize,
  halo,
  globalScale
}: {
  id: string;
  placement: ConceptGraphLabelPlacement;
  textWidth: number;
  screenFontSize: number;
  halo: number;
  globalScale: number;
}): ConceptGraphLabelRect => {
  const sx = placement.x * globalScale;
  const sy = placement.y * globalScale;
  const width = textWidth + halo;
  const height = screenFontSize + halo;
  let left: number;
  let right: number;
  let top: number;
  let bottom: number;

  if (placement.textAlign === "left") {
    left = sx - halo / 2;
    right = left + width;
  } else if (placement.textAlign === "right") {
    right = sx + halo / 2;
    left = right - width;
  } else {
    left = sx - width / 2;
    right = sx + width / 2;
  }

  if (placement.textBaseline === "top") {
    top = sy - halo / 2;
    bottom = top + height;
  } else if (placement.textBaseline === "bottom") {
    bottom = sy + halo / 2;
    top = bottom - height;
  } else {
    top = sy - height / 2;
    bottom = sy + height / 2;
  }

  return { id, left, top, right, bottom };
};

export const getConceptGraphMetricLabelAnchor = ({
  placement,
  titleScreenFontSize,
  globalScale
}: {
  placement: ConceptGraphLabelPlacement;
  titleScreenFontSize: number;
  globalScale: number;
}): { x: number; y: number; textAlign: ConceptGraphTextAlign; textBaseline: "top" } => {
  const gap = 2 / globalScale;
  const titleHeight = titleScreenFontSize / globalScale;
  let titleBottom = placement.y;
  if (placement.textBaseline === "top") {
    titleBottom = placement.y + titleHeight;
  } else if (placement.textBaseline === "middle") {
    titleBottom = placement.y + titleHeight / 2;
  }
  return {
    x: placement.x,
    y: titleBottom + gap,
    textAlign: placement.textAlign,
    textBaseline: "top"
  };
};

const cellKey = (cx: number, cy: number): string => `${cx}:${cy}`;

class SpatialHash<T> {
  private readonly cells = new Map<string, T[]>();

  insertRect(item: T, rect: ConceptGraphLabelRect): void {
    const minX = Math.floor(rect.left / LABEL_HASH_CELL_SIZE);
    const maxX = Math.floor(rect.right / LABEL_HASH_CELL_SIZE);
    const minY = Math.floor(rect.top / LABEL_HASH_CELL_SIZE);
    const maxY = Math.floor(rect.bottom / LABEL_HASH_CELL_SIZE);
    for (let cx = minX; cx <= maxX; cx += 1) {
      for (let cy = minY; cy <= maxY; cy += 1) {
        const key = cellKey(cx, cy);
        const bucket = this.cells.get(key);
        if (bucket) {
          bucket.push(item);
        } else {
          this.cells.set(key, [item]);
        }
      }
    }
  }

  insertCircle(item: T, circle: Circle): void {
    this.insertRect(item, {
      id: circle.id,
      left: circle.x - circle.radius,
      top: circle.y - circle.radius,
      right: circle.x + circle.radius,
      bottom: circle.y + circle.radius
    });
  }

  queryRect(rect: ConceptGraphLabelRect): T[] {
    const minX = Math.floor(rect.left / LABEL_HASH_CELL_SIZE);
    const maxX = Math.floor(rect.right / LABEL_HASH_CELL_SIZE);
    const minY = Math.floor(rect.top / LABEL_HASH_CELL_SIZE);
    const maxY = Math.floor(rect.bottom / LABEL_HASH_CELL_SIZE);
    const seen = new Set<T>();
    const results: T[] = [];
    for (let cx = minX; cx <= maxX; cx += 1) {
      for (let cy = minY; cy <= maxY; cy += 1) {
        const bucket = this.cells.get(cellKey(cx, cy));
        if (!bucket) {
          continue;
        }
        for (const item of bucket) {
          if (seen.has(item)) {
            continue;
          }
          seen.add(item);
          results.push(item);
        }
      }
    }
    return results;
  }
}

const placementPriority = (node: ConceptGraphLabelLayoutNode): number => {
  if (node.isSelected) {
    return 0;
  }
  if (node.isFavorite) {
    return 1;
  }
  return 2;
};

const compareLayoutNodes = (a: ConceptGraphLabelLayoutNode, b: ConceptGraphLabelLayoutNode): number => {
  const byPriority = placementPriority(a) - placementPriority(b);
  if (byPriority !== 0) {
    return byPriority;
  }
  if (a.id < b.id) {
    return -1;
  }
  if (a.id > b.id) {
    return 1;
  }
  return 0;
};

const scoreCandidate = (
  rect: ConceptGraphLabelRect,
  nodeHash: SpatialHash<Circle>,
  labelHash: SpatialHash<ConceptGraphLabelRect>
): number => {
  let score = 0;
  for (const circle of nodeHash.queryRect(rect)) {
    if (circle.id === rect.id) {
      continue;
    }
    if (circleIntersectsRect(circle, rect)) {
      score += 1;
    }
  }
  for (const other of labelHash.queryRect(rect)) {
    if (other.id === rect.id) {
      continue;
    }
    if (rectsOverlap(rect, other)) {
      score += 1;
    }
  }
  return score;
};

export const placeConceptGraphLabels = (
  nodes: readonly ConceptGraphLabelLayoutNode[],
  globalScale: number
): Map<string, ConceptGraphLabelPlacement> => {
  const ordered = nodes.slice().sort(compareLayoutNodes);
  const nodeHash = new SpatialHash<Circle>();
  const labelHash = new SpatialHash<ConceptGraphLabelRect>();
  const placements = new Map<string, ConceptGraphLabelPlacement>();

  for (const node of ordered) {
    nodeHash.insertCircle(
      {
        id: node.id,
        x: node.nodeX * globalScale,
        y: node.nodeY * globalScale,
        radius: node.visualRadius * globalScale
      },
      {
        id: node.id,
        x: node.nodeX * globalScale,
        y: node.nodeY * globalScale,
        radius: node.visualRadius * globalScale
      }
    );
  }

  for (const node of ordered) {
    const preferred = getPreferredConceptGraphLabelDirection(node.nodeX, node.nodeY);
    let bestPlacement = getConceptGraphLabelPlacement({
      nodeX: node.nodeX,
      nodeY: node.nodeY,
      labelOffset: node.labelOffset,
      direction: preferred
    });
    let bestRect = getConceptGraphLabelScreenBounds({
      id: node.id,
      placement: bestPlacement,
      textWidth: node.textWidth,
      screenFontSize: node.screenFontSize,
      halo: node.halo,
      globalScale
    });
    let bestScore = Number.POSITIVE_INFINITY;

    for (const direction of candidateDirections(preferred)) {
      const placement = getConceptGraphLabelPlacement({
        nodeX: node.nodeX,
        nodeY: node.nodeY,
        labelOffset: node.labelOffset,
        direction
      });
      const rect = getConceptGraphLabelScreenBounds({
        id: node.id,
        placement,
        textWidth: node.textWidth,
        screenFontSize: node.screenFontSize,
        halo: node.halo,
        globalScale
      });
      const score = scoreCandidate(rect, nodeHash, labelHash);
      if (score < bestScore) {
        bestScore = score;
        bestPlacement = placement;
        bestRect = rect;
        if (score === 0) {
          break;
        }
      }
    }

    placements.set(node.id, bestPlacement);
    labelHash.insertRect(bestRect, bestRect);
  }

  return placements;
};

export const getIndependentConceptGraphLabelPlacement = ({
  nodeX,
  nodeY,
  labelOffset
}: {
  nodeX: number;
  nodeY: number;
  labelOffset: number;
}): ConceptGraphLabelPlacement =>
  getConceptGraphLabelPlacement({
    nodeX,
    nodeY,
    labelOffset,
    direction: getPreferredConceptGraphLabelDirection(nodeX, nodeY)
  });
