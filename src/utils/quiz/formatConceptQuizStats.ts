import type { ConceptQuizStats } from "./getConceptQuizStats";

const startOfLocalDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function formatRelativeDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  const today = startOfLocalDay(now);
  const target = startOfLocalDay(date);
  const diffDays = Math.round((today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) {
    return "今日";
  }
  if (diffDays === 1) {
    return "昨日";
  }
  if (diffDays >= 2 && diffDays <= 7) {
    return `${diffDays}日前`;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

export function formatConceptQuizStats(stats: ConceptQuizStats): string {
  if (stats.totalAttempts === 0 || stats.accuracy === null || !stats.lastAnsweredAt) {
    return "未学習";
  }

  return `正答率 ${stats.accuracy}%　${stats.correctAttempts}勝${stats.wrongAttempts}敗　最終学習: ${formatRelativeDate(stats.lastAnsweredAt)}`;
}
