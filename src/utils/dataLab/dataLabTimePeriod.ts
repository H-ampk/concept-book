/** Data Lab の日 / 週 / 月バケットで共有するローカル暦ユーティリティ。 */

export const pad2 = (n: number): string => String(n).padStart(2, "0");

export const parseLocalYmd = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
};

export const localYmd = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const localYm = (date: Date): string => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

export const startOfLocalDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** ローカルカレンダー上、その日を含む週の月曜日 */
export const mondayOfLocalWeek = (date: Date): Date => {
  const start = startOfLocalDay(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + diff);
};

export const addLocalDays = (date: Date, days: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export const addLocalMonths = (date: Date, months: number): Date =>
  new Date(date.getFullYear(), date.getMonth() + months, 1);

/**
 * ISO week-year（木曜日が属する年）と週番号。キーは `YYYY-Www`。
 * `date.getFullYear()` をそのまま連結すると年末年始で週が割れるため使わない。
 */
export const isoWeekKeyAndRange = (
  date: Date
): { key: string; periodStart: string; periodEnd: string; label: string } => {
  const monday = mondayOfLocalWeek(date);
  const sunday = addLocalDays(monday, 6);
  const thursday = addLocalDays(monday, 3);
  const isoYear = thursday.getFullYear();
  const week1Monday = mondayOfLocalWeek(new Date(isoYear, 0, 4));
  const week =
    Math.round((monday.getTime() - week1Monday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  const periodStart = localYmd(monday);
  const periodEnd = localYmd(sunday);
  return {
    key: `${isoYear}-W${pad2(week)}`,
    periodStart,
    periodEnd,
    label: `${periodStart} ～ ${periodEnd}`
  };
};

export const lastLocalDayOfMonth = (date: Date): string =>
  localYmd(new Date(date.getFullYear(), date.getMonth() + 1, 0));
