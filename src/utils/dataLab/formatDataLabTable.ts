import { shortDateTime } from "../date";
import { formatConceptMasteryProbability } from "../mastery/formatConceptMastery";

export const DATA_LAB_MISSING_VALUE = "—";

const formatTrimmedOneDecimal = (value: number, suffix: string): string => {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}${suffix}`;
};

export const formatDataLabAccuracy = (accuracy: number | null): string => {
  if (accuracy == null) {
    return DATA_LAB_MISSING_VALUE;
  }
  return formatTrimmedOneDecimal(accuracy * 100, "%");
};

export const formatDataLabMastery = (masteryProbability: number | null): string =>
  formatConceptMasteryProbability(masteryProbability) ?? DATA_LAB_MISSING_VALUE;

export const formatDataLabDays = (days: number | null): string => {
  if (days == null) {
    return DATA_LAB_MISSING_VALUE;
  }
  return formatTrimmedOneDecimal(days, "日");
};

export const formatDataLabNullableCount = (value: number | null): string => {
  if (value == null) {
    return DATA_LAB_MISSING_VALUE;
  }
  return String(value);
};

export const formatDataLabEvaluationScore = (value: number | null): string => {
  if (value == null) {
    return DATA_LAB_MISSING_VALUE;
  }
  if (value === 0) {
    return "0";
  }
  return value.toFixed(4);
};

export const formatDataLabAverageResponseTime = (averageResponseTimeMs: number | null): string => {
  if (averageResponseTimeMs == null) {
    return DATA_LAB_MISSING_VALUE;
  }
  return formatTrimmedOneDecimal(averageResponseTimeMs / 1000, "秒");
};

export const formatDataLabDateTime = (iso: string | null): string => {
  if (iso == null || iso === "") {
    return DATA_LAB_MISSING_VALUE;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return DATA_LAB_MISSING_VALUE;
  }
  return shortDateTime(iso);
};
