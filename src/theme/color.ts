const HEX6 = /^#[0-9a-fA-F]{6}$/;

export const isThemeHexColor = (value: unknown): value is string =>
  typeof value === "string" && HEX6.test(value);

type Rgb = { r: number; g: number; b: number };

const parseHex = (hex: string): Rgb | null => {
  if (!isThemeHexColor(hex)) {
    return null;
  }
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16)
  };
};

const toHex = (n: number): string =>
  Math.round(Math.max(0, Math.min(255, n)))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

export const rgbToHex = (r: number, g: number, b: number): string =>
  `#${toHex(r)}${toHex(g)}${toHex(b)}`;

const linearize = (channel: number): number => {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance (0–1) */
export const relativeLuminance = (hex: string): number => {
  const rgb = parseHex(hex);
  if (!rgb) {
    return 0;
  }
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
};

export const mixHex = (hex: string, target: string, amount: number): string => {
  const from = parseHex(hex);
  const to = parseHex(target);
  if (!from || !to) {
    return isThemeHexColor(hex) ? hex.toUpperCase() : "#000000";
  }
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex(
    from.r + (to.r - from.r) * t,
    from.g + (to.g - from.g) * t,
    from.b + (to.b - from.b) * t
  );
};

const DARK_TEXT = "#24313A";
const LIGHT_TEXT = "#F9FBFC";

export const contrastTextColor = (backgroundHex: string): string =>
  relativeLuminance(backgroundHex) > 0.45 ? DARK_TEXT : LIGHT_TEXT;

export const deriveHoverColor = (hex: string): string =>
  relativeLuminance(hex) > 0.45 ? mixHex(hex, "#000000", 0.1) : mixHex(hex, "#FFFFFF", 0.14);

export const deriveActiveColor = (hex: string): string => mixHex(hex, "#000000", 0.16);

export const deriveHeaderDeepColor = (hex: string): string => mixHex(hex, "#000000", 0.12);

export const normalizeHexColor = (value: unknown, fallback: string): string => {
  if (!isThemeHexColor(value)) {
    return fallback.toUpperCase();
  }
  return value.toUpperCase();
};
