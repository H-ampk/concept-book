export const MEDIUM_LABEL_SCALE = 0.8;
export const FULL_LABEL_SCALE = 1.5;

const FAR_LABEL_STYLE = {
  screenFontSize: 7,
  opacity: 0.55,
  fontWeight: 400
} as const;

const MEDIUM_LABEL_STYLE = {
  screenFontSize: 9,
  opacity: 0.75,
  fontWeight: 400
} as const;

const NEAR_LABEL_STYLE = {
  screenFontSize: 12,
  opacity: 1,
  fontWeight: 400
} as const;

export type ConceptGraphLabelStyleInput = {
  globalScale: number;
  isSelected: boolean;
  isFavorite: boolean;
};

export type ConceptGraphLabelStyle = {
  screenFontSize: number;
  opacity: number;
  fontWeight: number;
};

const getLodBandStyle = (globalScale: number): ConceptGraphLabelStyle => {
  if (!(globalScale >= MEDIUM_LABEL_SCALE)) {
    return { ...FAR_LABEL_STYLE };
  }

  if (globalScale < FULL_LABEL_SCALE) {
    return { ...MEDIUM_LABEL_STYLE };
  }

  return { ...NEAR_LABEL_STYLE };
};

export const getConceptGraphLabelStyle = ({
  globalScale,
  isSelected,
  isFavorite
}: ConceptGraphLabelStyleInput): ConceptGraphLabelStyle => {
  const base = getLodBandStyle(globalScale);

  if (isSelected) {
    return {
      screenFontSize: Math.max(base.screenFontSize, 12),
      opacity: 1,
      fontWeight: 600
    };
  }

  if (isFavorite) {
    return {
      screenFontSize: Math.max(base.screenFontSize, 10),
      opacity: Math.max(base.opacity, 0.95),
      fontWeight: 600
    };
  }

  return base;
};
