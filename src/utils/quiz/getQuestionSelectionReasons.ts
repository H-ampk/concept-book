import type { QuestionQuizStats } from "./getQuestionQuizStats";
import { buildQuestionPriorityContext, daysBetween } from "./questionPriorityContext";

export type QuestionSelectionReason =
  | "未学習"
  | "誤答が多い"
  | "正答率が低い"
  | "7日以上未復習"
  | "30日以上未復習"
  | "最近追加";

const RECENTLY_ADDED_DAYS = 7;

type ReasonCandidate = {
  reason: QuestionSelectionReason;
  priority: number;
};

/**
 * 重み計算と同じ条件から、出題優先の理由ラベルを生成する。
 * 抑制要因（直近解答・高正答率）は理由に含めない。
 */
export function getQuestionSelectionReasons(
  stats: QuestionQuizStats,
  opts?: {
    now?: Date;
    questionCreatedAt?: string;
    maxReasons?: number;
  }
): QuestionSelectionReason[] {
  const now = opts?.now ?? new Date();
  const maxReasons = opts?.maxReasons ?? 2;
  const ctx = buildQuestionPriorityContext(stats, now);
  const candidates: ReasonCandidate[] = [];

  if (ctx.neverAnswered) {
    candidates.push({ reason: "未学習", priority: 100 });
  }

  if (ctx.daysSinceLastAnswered !== null && ctx.daysSinceLastAnswered >= 30) {
    candidates.push({ reason: "30日以上未復習", priority: 80 });
  } else if (ctx.daysSinceLastAnswered !== null && ctx.daysSinceLastAnswered >= 7) {
    candidates.push({ reason: "7日以上未復習", priority: 50 });
  }

  if (ctx.accuracy !== null && ctx.accuracy < 0.6) {
    candidates.push({ reason: "正答率が低い", priority: 60 });
  }

  if (
    ctx.incorrectCount >= 2 ||
    (ctx.incorrectCount >= 1 && ctx.incorrectCount > ctx.correctCount)
  ) {
    candidates.push({
      reason: "誤答が多い",
      priority: 30 + ctx.incorrectCount * 3
    });
  }

  const createdAt = opts?.questionCreatedAt?.trim();
  if (createdAt) {
    const daysSinceCreated = daysBetween(createdAt, now);
    if (daysSinceCreated >= 0 && daysSinceCreated <= RECENTLY_ADDED_DAYS) {
      candidates.push({ reason: "最近追加", priority: 40 });
    }
  }

  return candidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxReasons)
    .map((c) => c.reason);
}
