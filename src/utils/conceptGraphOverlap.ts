import type { Concept } from "../types/concept";
import { getConceptGraphNodeRadius, type GraphMetricMode } from "./conceptGraphAttemptRadius";
import {
  getConceptGraphLabelHaloScreenWidth,
  getConceptGraphLabelStyle,
  getConceptGraphLabelText
} from "./conceptGraphLod";
import {
  getConceptGraphNodeGeometry,
  GRAPH_LABEL_NODE_GAP
} from "./conceptGraphNodeGeometry";

export type ConceptGraphOverlapMetrics = {
  nodeNodeOverlapCount: number;
  labelNodeOverlapCount: number;
  labelLabelOverlapCount: number;
  totalOverlapCount: number;
};

export type ConceptGraphLayoutPosition = {
  id: string;
  x: number;
  y: number;
};

export type ConceptGraphOverlapInput = {
  concepts: readonly Concept[];
  positions: readonly ConceptGraphLayoutPosition[];
  globalScale: number;
  selectedId?: string;
  metricMode?: GraphMetricMode;
};

type Circle = {
  id: string;
  x: number;
  y: number;
  radius: number;
};

type Rect = {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/** CI のフォント差を避ける決定的な文字幅係数。 */
export const LABEL_ASCII_WIDTH_FACTOR = 0.6;
export const LABEL_CJK_WIDTH_FACTOR = 1;

const isAsciiChar = (code: number): boolean => code <= 0x7f;

const isCjkOrFullWidthChar = (code: number): boolean =>
  (code >= 0x1100 && code <= 0x11ff) ||
  (code >= 0x2e80 && code <= 0x9fff) ||
  (code >= 0xac00 && code <= 0xd7af) ||
  (code >= 0xf900 && code <= 0xfaff) ||
  (code >= 0xff01 && code <= 0xff60) ||
  (code >= 0xffe0 && code <= 0xffe6);

export const estimateConceptGraphLabelScreenWidth = (
  text: string,
  screenFontSize: number
): number => {
  let width = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (isAsciiChar(code)) {
      width += screenFontSize * LABEL_ASCII_WIDTH_FACTOR;
    } else if (isCjkOrFullWidthChar(code)) {
      width += screenFontSize * LABEL_CJK_WIDTH_FACTOR;
    } else {
      width += screenFontSize * LABEL_ASCII_WIDTH_FACTOR;
    }
  }
  return width;
};

const circlesOverlap = (a: Circle, b: Circle): boolean => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const minDist = a.radius + b.radius;
  return dx * dx + dy * dy < minDist * minDist;
};

const circleIntersectsRect = (circle: Circle, rect: Rect): boolean => {
  const closestX = Math.min(rect.right, Math.max(rect.left, circle.x));
  const closestY = Math.min(rect.bottom, Math.max(rect.top, circle.y));
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.radius * circle.radius;
};

const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

export const getConceptGraphOverlapItems = ({
  concepts,
  positions,
  globalScale,
  selectedId,
  metricMode = "normal"
}: ConceptGraphOverlapInput): { nodes: Circle[]; labels: Rect[] } => {
  const positionById = new Map(positions.map((position) => [position.id, position]));
  const nodes: Circle[] = [];
  const labels: Rect[] = [];

  for (const concept of concepts) {
    const position = positionById.get(concept.id);
    if (!position) {
      continue;
    }
    const isSelected = selectedId === concept.id;
    const nodeRadius = getConceptGraphNodeRadius({
      metricMode,
      totalAttempts: 0,
      isFavorite: concept.favorite
    });
    const geometry = getConceptGraphNodeGeometry({
      nodeRadius,
      isSelected,
      isFavorite: concept.favorite
    });
    const screenX = position.x * globalScale;
    const screenY = position.y * globalScale;
    nodes.push({
      id: concept.id,
      x: screenX,
      y: screenY,
      radius: geometry.visualRadius * globalScale
    });

    const labelStyle = getConceptGraphLabelStyle({
      globalScale,
      isSelected,
      isFavorite: concept.favorite
    });
    const labelText = getConceptGraphLabelText({
      title: concept.title,
      globalScale,
      isSelected,
      isFavorite: concept.favorite
    });
    const halo = getConceptGraphLabelHaloScreenWidth({
      isSelected,
      isFavorite: concept.favorite
    });
    const textWidth = estimateConceptGraphLabelScreenWidth(labelText, labelStyle.screenFontSize);
    const width = textWidth + halo;
    const height = labelStyle.screenFontSize + halo;
    const labelTop =
      screenY + (geometry.labelOffset + GRAPH_LABEL_NODE_GAP) * globalScale - halo / 2;
    labels.push({
      id: concept.id,
      left: screenX - width / 2,
      top: labelTop,
      right: screenX + width / 2,
      bottom: labelTop + height
    });
  }

  return { nodes, labels };
};

export const getConceptGraphOverlapMetrics = (
  input: ConceptGraphOverlapInput
): ConceptGraphOverlapMetrics => {
  const { nodes, labels } = getConceptGraphOverlapItems(input);

  let nodeNodeOverlapCount = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      if (circlesOverlap(nodes[i], nodes[j])) {
        nodeNodeOverlapCount += 1;
      }
    }
  }

  let labelNodeOverlapCount = 0;
  for (const label of labels) {
    for (const node of nodes) {
      if (node.id === label.id) {
        continue;
      }
      if (circleIntersectsRect(node, label)) {
        labelNodeOverlapCount += 1;
      }
    }
  }

  let labelLabelOverlapCount = 0;
  for (let i = 0; i < labels.length; i += 1) {
    for (let j = i + 1; j < labels.length; j += 1) {
      if (rectsOverlap(labels[i], labels[j])) {
        labelLabelOverlapCount += 1;
      }
    }
  }

  return {
    nodeNodeOverlapCount,
    labelNodeOverlapCount,
    labelLabelOverlapCount,
    totalOverlapCount:
      nodeNodeOverlapCount + labelNodeOverlapCount + labelLabelOverlapCount
  };
};

export const normalizeOverlapFixtureFlags = (
  concepts: readonly Concept[],
  favoriteId: string
): Concept[] => concepts.map((concept) => ({ ...concept, favorite: concept.id === favoriteId }));
