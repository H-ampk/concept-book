export type ConnectorEndpoint = {
  id: string;
  x: number;
  y: number;
};

export type ConnectorLine = {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

export const buildConnectorLines = (
  highlights: ConnectorEndpoint[],
  concepts: ConnectorEndpoint[],
  svgOrigin: { left: number; top: number }
): ConnectorLine[] => {
  const conceptById = new Map(concepts.map((item) => [item.id, item]));
  const lines: ConnectorLine[] = [];
  for (const highlight of highlights) {
    const concept = conceptById.get(highlight.id);
    if (!concept) {
      continue;
    }
    lines.push({
      id: `${highlight.id}-${highlight.x}-${highlight.y}`,
      fromX: highlight.x - svgOrigin.left,
      fromY: highlight.y - svgOrigin.top,
      toX: concept.x - svgOrigin.left,
      toY: concept.y - svgOrigin.top
    });
  }
  return lines;
};
