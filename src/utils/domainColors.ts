const DOMAIN_COLOR_STORAGE_KEY = "concept-book-domain-colors";

const fallbackPalette = [
  "#2d6b52",
  "#047857",
  "#0f766e",
  "#15803d",
  "#166534",
  "#3d8f6f",
  "#14532d",
  "#365314"
];

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const isHexColor = (value: string): boolean => /^#[0-9a-fA-F]{6}$/.test(value);

export const loadDomainColorMap = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(DOMAIN_COLOR_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const clean: Record<string, string> = {};
    Object.entries(parsed).forEach(([tag, color]) => {
      if (typeof color === "string" && isHexColor(color)) {
        clean[tag] = color;
      }
    });
    return clean;
  } catch {
    return {};
  }
};

export const saveDomainColorMap = (map: Record<string, string>): void => {
  localStorage.setItem(DOMAIN_COLOR_STORAGE_KEY, JSON.stringify(map));
};

export const getFallbackDomainColor = (tag: string): string => {
  if (!tag) {
    return "#5f7d70";
  }
  return fallbackPalette[hashString(tag) % fallbackPalette.length];
};

export const getDomainTagColor = (tag: string, map: Record<string, string>): string =>
  map[tag] ?? getFallbackDomainColor(tag);

export const colorToSoftTagStyle = (
  color: string
): { backgroundColor: string; borderColor: string; color: string } => ({
  backgroundColor: `${color}1A`,
  borderColor: `${color}66`,
  color
});
