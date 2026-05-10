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
 *     quizDecks?: QuizDeck[],           // 型は定義済み。ZIP 同梱は別フェーズ
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

/**
 * 複数の QuizQuestion をまとめたクイズ集（「この分野のセット」「復習デッキ」など）。
 * 分類は固定カテゴリーではなく、自由記述の deckKey / domainTags で行う。
 * 同一 Question を複数 Deck に含められる（questionIds は参照のみ。Question 本体は独立保存）。
 *
 * --- 将来の IndexedDB（未実装）---
 * - store 名案: `quizDecks`, keyPath: `id`
 * - index 案: `deckKey`（unique: false）, `visibility`, `updatedAt`
 * - DB_VERSION 引き上げはそのフェーズで行う
 *
 * --- 将来の ZIP Import / Export（未実装）---
 * - ルートに `quizDecks?: QuizDeck[]` を追加する想定
 * - 古い ZIP で quizDecks が無い場合は空配列扱い
 * - questionIds に存在しない QuizQuestion ID はインポート時に除去する想定
 * - questionIds が空になった Deck を保存するかスキップするかは次フェーズで決める
 * - backup: private / public の QuizDeck を両方含める想定
 * - share: visibility === public の QuizDeck のみ。public Deck に private Question が混在する場合の扱いは別途決める
 *
 * --- 将来のクイズで学習 UI（未実装）---
 * - Deck 選択 → questionIds 順に出題（未選択時は従来どおり全 Question / Concept 絞り込みでも可）
 *
 * --- 将来の QuizAttemptLog 拡張案（未実装）---
 * - `deckId?: string` … どの QuizDeck で解いたか
 * - `deckTitleSnapshot?: string` … 回答時点の Deck タイトル（Deck 別分析・履歴用）
 *
 * --- 将来フィールド候補（型にはまだ含めない）---
 * - coverConceptId, shuffleMode: "fixed" | "shuffle", estimatedMinutes, source: "manual" | "auto"
 *
 * --- 運用メモ ---
 * - Deck 削除時も QuizQuestion 本体は削除しない
 * - Question 削除時は、将来 Deck.questionIds から該当 ID を除去する方針
 */
export interface QuizDeck {
  id: string;
  /** 表示用タイトル（例: 心理学検定・社会心理） */
  title: string;
  /** クイズ集の説明 */
  description?: string;
  /**
   * ユーザーが自由に決める識別子（例: psychology-social, 情報理論, 心理学検定-社会心理）。
   * システム ID ではない。必須ではなく、一意制約も初期段階では設けない。
   */
  deckKey?: string;
  /**
   * 分野・目的・教材名などの自由記述タグ（固定候補リストは作らない）。
   * 例: 心理学検定, 社会心理, 情報理論
   */
  domainTags?: string[];
  /** 含める QuizQuestion の ID。配列順を基本の出題順として扱う */
  questionIds: string[];
  /** 公開 / 非公開。新規作成時の初期値は private を想定 */
  visibility: QuizVisibility;
  /** QuizDeck スキーマのバージョン。新規は QUIZ_DECK_SCHEMA_VERSION を入れる想定 */
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** QuizDeck の schemaVersion 初期値・マイグレーション用 */
export const QUIZ_DECK_SCHEMA_VERSION = 1;

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
