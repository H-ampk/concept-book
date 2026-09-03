export const MEDIUM_LABEL_SCALE = 0.8;
export const FULL_LABEL_SCALE = 1.5;
export const FAR_LABEL_MAX_CHARS = 12;
export const LABEL_ELLIPSIS = "…";
export const LABEL_HALO_COLOR = "#FFFDF8";
export const LABEL_HALO_SCREEN_WIDTH = 1.15;
export const LABEL_HALO_EMPHASIS_SCREEN_WIDTH = 1.55;

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

export type ConceptGraphLabelTextInput = {
  title: string;
  globalScale: number;
  isSelected: boolean;
  isFavorite: boolean;
};

const isFarLabelScale = (globalScale: number): boolean => !(globalScale >= MEDIUM_LABEL_SCALE);

export const getConceptGraphLabelText = ({
  title,
  globalScale,
  isSelected,
  isFavorite
}: ConceptGraphLabelTextInput): string => {
  if (isSelected || isFavorite || !isFarLabelScale(globalScale) || title.length <= FAR_LABEL_MAX_CHARS) {
    return title;
  }

  return `${title.slice(0, FAR_LABEL_MAX_CHARS)}${LABEL_ELLIPSIS}`;
};

export const getConceptGraphLabelHaloScreenWidth = ({
  isSelected,
  isFavorite
}: {
  isSelected: boolean;
  isFavorite: boolean;
}): number => (isSelected || isFavorite ? LABEL_HALO_EMPHASIS_SCREEN_WIDTH : LABEL_HALO_SCREEN_WIDTH);
