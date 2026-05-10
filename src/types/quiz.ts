/**
 * クイズ用の型（IndexedDB・ZIP・UI は未接続）
 *
 * --- 将来の Import / Export 方針（実装は ZIP 対応フェーズで行う）---
 *
 * ZIP ペイロード想定（concepts.json 相当の JSON ルート）:
 *   {
 *     concepts: Concept[],
 *     contextCards: ContextCard[],
 *     quizQuestions?: QuizQuestion[],
 *     quizAttemptLogs?: QuizAttemptLog[]  // ZIP 同梱は別フェーズ（プライバシー）
 *   }
 *
 * エクスポートモード案:
 * - backup（自分用バックアップ）: concepts / contextCards に加え、visibility が private / public の
 *   QuizQuestion を両方含める想定。quizAttemptLogs はオプション（含めるか UI で選択できる余地）。
 * - share（共有用）: public の QuizQuestion のみ含める想定。private の問題・quizAttemptLogs は
 *   デフォルトで除外。
 *
 * インポート方針案（ZIP 対応フェーズで確定）:
 * - quizQuestions が無い古い ZIP は空配列扱い。
 * - 古いデータで visibility が欠ける場合は private 扱いに正規化する。
 * - conceptId / linkedConceptId の参照先が無い場合はインポート時に参照を外す（Question 自体は保持）。
 * - 同一 id のマージ（上書き / スキップ / 複製）はそのフェーズで決める。
 *
 * 学習ログはプライバシーが強いため、将来エクスポート対象をモードまたはチェックで選べる余地を残す。
 */

/** private: 非公開（自分用）。public: 共有・公開用エクスポートの対象にできるクイズ。 */
export type QuizVisibility = "private" | "public";

export interface QuizChoice {
  id: string;
  text: string;
  /** 選択肢テキストと Concept タイトルが一意に一致したときに付与 */
  linkedConceptId?: string;
}

export interface QuizQuestion {
  id: string;
  /** 問い全体の関連 Concept（任意） */
  conceptId?: string;
  prompt: string;
  choices: QuizChoice[];
  correctChoiceId: string;
  explanation?: string;
  /** 公開 / 非公開。新規作成時の初期値は private を想定 */
  visibility: QuizVisibility;
  sortOrder?: number;
  /** クイズ問題スキーマのバージョン。新規は QUIZ_QUESTION_SCHEMA_VERSION を入れる想定 */
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** 将来のマイグレーション・検証・新規レコードの schemaVersion 初期値 */
export const QUIZ_QUESTION_SCHEMA_VERSION = 1;

/** クイズ1回答あたりの観測ログ（IndexedDB のみ。ZIP には今回含めない） */
export interface QuizAttemptLog {
  id: string;
  /** 同一「学習開始」から結果までを束ねる ID */
  sessionId?: string;
  questionId: string;
  /** 回答時点の問題文スナップショット */
  questionPromptSnapshot: string;
  /** 回答時点の Question.conceptId */
  questionConceptId?: string;
  selectedChoiceId: string;
  selectedChoiceTextSnapshot: string;
  selectedLinkedConceptId?: string;
  correctChoiceId: string;
  correctChoiceTextSnapshot: string;
  correctLinkedConceptId?: string;
  correct: boolean;
  startedAt: string;
  answeredAt: string;
  /** 表示開始から回答までの経過（ミリ秒） */
  timeMs: number;
  schemaVersion: number;
}

export const QUIZ_ATTEMPT_LOG_SCHEMA_VERSION = 1;
