import type { QuizAttemptLog } from "../../types/quiz";

/**
 * 学習モデルの one-step-ahead 予測点。
 *
 * これは「予測」（次回正答確率）であり、理解度スコア・mastery ではない。
 * BKT masteryProbability や PFA の内部状態そのものでもない。
 *
 * prediction / evaluation は derived data であり、IndexedDB には保存しない。
 * QuizAttemptLog とモデルパラメータから再計算する。
 */
export type LearningModelPredictionPoint = {
  conceptId: string;
  attemptId: string;
  answeredAt: string;
  /** その回答時点より前の履歴だけから得た正答確率予測（0〜1）。理解度スコアではない。 */
  predictedCorrectProbability: number;
  actualCorrect: boolean;
  /** モデル識別子。BKT / PFA 以外の将来モデルも追加できる。 */
  model: string;
  /** この予測に渡した過去履歴件数（同一 Concept・対象より前の timestamp のみ）。 */
  historyCount: number;
};

/**
 * 学習モデルを one-step-ahead evaluator から呼ぶための薄い interface。
 * 返値が null の場合はデータ不足 / 評価不能であり、0 に変換してはいけない。
 */
export type LearningModelPredictor = {
  id: string;
  predictNextCorrectProbability(args: {
    conceptId: string;
    historyLogs: QuizAttemptLog[];
  }): number | null;
};

/**
 * one-step-ahead 予測点群の評価指標。
 * 評価対象が 0 件のとき brierScore / logLoss は null（0 ではない）。
 */
export type LearningModelPredictionMetrics = {
  count: number;
  brierScore: number | null;
  logLoss: number | null;
};

export type LearningModelPredictionPointFilter = {
  model?: string;
  conceptId?: string;
};
