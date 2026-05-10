import type { QuizAttemptLog } from "../types/quiz";

const parseYmdParts = (ymd: string): [number, number, number] | null => {
  const t = ymd.trim();
  if (!t) {
    return null;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) {
    return null;
  }
  const check = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (check.getFullYear() !== y || check.getMonth() !== mo - 1 || check.getDate() !== d) {
    return null;
  }
  return [y, mo, d];
};

const localDayStart = (ymd: string): Date | null => {
  const p = parseYmdParts(ymd);
  if (!p) {
    return null;
  }
  return new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0);
};

const localDayEndInclusive = (ymd: string): Date | null => {
  const p = parseYmdParts(ymd);
  if (!p) {
    return null;
  }
  return new Date(p[0], p[1] - 1, p[2], 23, 59, 59, 999);
};

/**
 * `answeredAt`（ISO 文字列）をローカル日付（input type="date" の値）と比較して絞り込む。
 * - 開始日のみ: その日 0:00（ローカル）以降
 * - 終了日のみ: その日 23:59:59.999（ローカル）以前
 * - 両方: 範囲内（端を含む）
 * - どちらも空: 全件
 * 不正な YYYY-MM-DD が渡った場合は該当側を「一致なし」扱い（空配列）にする。
 */
export const filterLogsByAnsweredDateRange = (
  logs: QuizAttemptLog[],
  startYmd: string,
  endYmd: string
): QuizAttemptLog[] => {
  const hasStart = Boolean(startYmd.trim());
  const hasEnd = Boolean(endYmd.trim());
  const start = hasStart ? localDayStart(startYmd) : null;
  const end = hasEnd ? localDayEndInclusive(endYmd) : null;
  if (hasStart && !start) {
    return [];
  }
  if (hasEnd && !end) {
    return [];
  }

  return logs.filter((log) => {
    const t = new Date(log.answeredAt).getTime();
    if (Number.isNaN(t)) {
      return false;
    }
    if (start && t < start.getTime()) {
      return false;
    }
    if (end && t > end.getTime()) {
      return false;
    }
    return true;
  });
};
