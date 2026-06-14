import type { QuizChoice, QuizDeck, QuizQuestion } from "../../types/quiz";
import { calculateQuestionWeight } from "./calculateQuestionWeight";
import { buildQuestionQuizStatsMap, getQuestionQuizStats, type QuestionQuizStats } from "./getQuestionQuizStats";
import { getQuestionSelectionReasons, type QuestionSelectionReason } from "./getQuestionSelectionReasons";
import { QUIZ_SESSION_SIZE, shuffleArray } from "./shuffle";
import { weightedSampleWithoutReplacement } from "./weightedSampleWithoutReplacement";

export type SessionQuestion = {
  question: QuizQuestion;
  shuffledChoices: QuizChoice[];
  selectionReasons: QuestionSelectionReason[];
};

export type WrongAnswerRecord = {
  question: QuizQuestion;
  selectedChoiceId: string;
  selectedText: string;
  correctText: string;
  selectionReasons?: QuestionSelectionReason[];
};

export type BuildQuizSessionOptions = {
  sessionSize?: number;
  excludeQuestionIds?: Set<string>;
  /** 未指定時は logs から構築。空 Map なら均等 weight 1 相当 */
  questionStatsMap?: Map<string, QuestionQuizStats>;
  now?: Date;
  random?: () => number;
};

const isPlayableQuestion = (q: QuizQuestion): boolean => {
  if (!q.prompt?.trim()) {
    return false;
  }
  const withText = q.choices.filter((c) => c.text.trim().length > 0);
  if (withText.length < 2) {
    return false;
  }
  if (!q.correctChoiceId || !q.choices.some((c) => c.id === q.correctChoiceId)) {
    return false;
  }
  const correct = q.choices.find((c) => c.id === q.correctChoiceId);
  if (!correct || !correct.text.trim()) {
    return false;
  }
  return true;
};

/** クイズ集の問題プールから出題可能な問題一覧を取得（保存順は使わない） */
export function getPlayablePoolFromDeck(deck: QuizDeck, allQuestions: QuizQuestion[]): QuizQuestion[] {
  const byId = new Map(allQuestions.map((q) => [q.id, q]));
  const out: QuizQuestion[] = [];
  const seen = new Set<string>();
  for (const id of deck.questionIds) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    const q = byId.get(id);
    if (q && isPlayableQuestion(q)) {
      out.push(q);
    }
  }
  return out;
}

function toSessionQuestions(
  questions: QuizQuestion[],
  statsMap: Map<string, QuestionQuizStats>,
  now: Date
): SessionQuestion[] {
  const shuffledOrder = shuffleArray(questions);
  return shuffledOrder.map((question) => {
    const withText = question.choices.filter((c) => c.text.trim().length > 0);
    const stats = getQuestionQuizStats(statsMap, question.id);
    return {
      question,
      shuffledChoices: shuffleArray(withText),
      selectionReasons: getQuestionSelectionReasons(stats, {
        now,
        questionCreatedAt: question.createdAt
      })
    };
  });
}

/**
 * 問題プールからセッション用の問題を重み付き非復元抽出。
 * 抽出後の出題順・選択肢順はシャッフルする。
 */
export function buildQuizSession(pool: QuizQuestion[], opts?: BuildQuizSessionOptions): SessionQuestion[] {
  const sessionSize = opts?.sessionSize ?? QUIZ_SESSION_SIZE;
  const exclude = opts?.excludeQuestionIds ?? new Set<string>();
  const now = opts?.now ?? new Date();
  const random = opts?.random ?? Math.random;
  const statsMap = opts?.questionStatsMap ?? new Map<string, QuestionQuizStats>();

  const candidates = pool.filter((q) => !exclude.has(q.id));
  if (candidates.length === 0) {
    return [];
  }

  const take = Math.min(sessionSize, candidates.length);
  const weights = candidates.map((q) => {
    const stats = getQuestionQuizStats(statsMap, q.id);
    return calculateQuestionWeight(stats, now);
  });

  const selected = weightedSampleWithoutReplacement(candidates, weights, take, random);
  return toSessionQuestions(selected, statsMap, now);
}

export { buildQuestionQuizStatsMap, isPlayableQuestion };
