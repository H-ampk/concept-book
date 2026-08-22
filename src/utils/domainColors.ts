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

export const isHexColor = (value: string): boolean => /^#[0-9a-fA-F]{6}$/.test(value);

export const normalizeDomainColorMap = (input: unknown): Record<string, string> => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {};
  }
  const clean: Record<string, string> = {};
  Object.entries(input as Record<string, unknown>).forEach(([tag, color]) => {
    if (typeof tag === "string" && tag.length > 0 && typeof color === "string" && isHexColor(color)) {
      clean[tag] = color;
    }
  });
  return clean;
};

/** バックアップに domainColors オブジェクトがある場合のみ正規化マップを返す。無い／非オブジェクトなら undefined。 */
export const extractBackupDomainColors = (payload: unknown): Record<string, string> | undefined => {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return undefined;
  }
  if (!Object.prototype.hasOwnProperty.call(payload, "domainColors")) {
    return undefined;
  }
  const value = (payload as { domainColors: unknown }).domainColors;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return normalizeDomainColorMap(value);
};

export const mergeDomainColorMaps = (
  current: Record<string, string>,
  imported: Record<string, string>,
  mode: "replace" | "merge"
): Record<string, string> => (mode === "replace" ? { ...imported } : { ...current, ...imported });

export const restoreDomainColorsFromBackup = (
  imported: Record<string, string> | undefined,
  mode: "replace" | "merge"
): Record<string, string> | undefined => {
  if (imported === undefined) {
    return undefined;
  }
  const next = mergeDomainColorMaps(loadDomainColorMap(), imported, mode);
  saveDomainColorMap(next);
  return next;
};

export const attachDomainColorsToBackup = <T extends object>(
  data: T,
  domainColors: Record<string, string>
): T & { domainColors: Record<string, string> } => ({
  ...data,
  domainColors
});

export const loadDomainColorMap = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(DOMAIN_COLOR_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return normalizeDomainColorMap(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
};

export const saveDomainColorMap = (map: Record<string, string>): void => {
  localStorage.setItem(DOMAIN_COLOR_STORAGE_KEY, JSON.stringify(normalizeDomainColorMap(map)));
};

export const getFallbackDomainColor = (tag: string): string => {
  if (!tag) {
    return "#5f7d70";
  }
  return fallbackPalette[hashString(tag) % fallbackPalette.length];
};

export const getDomainTagColor = (tag: string, map: Record<string, string>): string =>
  map[tag] ?? getFallbackDomainColor(tag);

export const getDomainTagColors = (
  tags: string[],
  map: Record<string, string>,
  limit = 4
): string[] =>
  [...tags]
    .sort((a, b) => a.localeCompare(b, "ja"))
    .slice(0, limit)
    .map((tag) => getDomainTagColor(tag, map));

export const colorToSoftTagStyle = (
  color: string
): { backgroundColor: string; borderColor: string; color: string } => ({
  backgroundColor: `${color}1A`,
  borderColor: `${color}66`,
  color
});
