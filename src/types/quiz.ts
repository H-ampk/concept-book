/**
 * クイズ用の型（IndexedDB・自分用 JSON / ZIP バックアップ・学習 UI で利用）
 *
 * 自分用バックアップ（JSON / ZIP の concepts.json ルート）:
 *   {
 *     concepts: Concept[],
 *     contextCards: ContextCard[],
 *     quizQuestions?: QuizQuestion[],
 *     quizDecks?: QuizDeck[],
 *     quizAttemptLogs?: QuizAttemptLog[]
 *   }
 *
 * エクスポート:
 * - backup（自分用）: concepts / contextCards に加え、private / public の QuizQuestion・QuizDeck と
 *   quizAttemptLogs を含める。
 * - share（共有用）: public の QuizQuestion のみ含める想定。private の問題・quizAttemptLogs は
 *   デフォルトで除外（共有用 export では学習ログを扱わない）。
 *
 * インポート:
 * - quizQuestions / quizDecks / quizAttemptLogs が無い古いバックアップは空配列扱い。
 * - 古いデータで visibility が欠ける場合は private 扱いに正規化する。
 * - conceptId / linkedConceptId の参照先が無い場合はインポート時に参照を外す（Question 自体は保持）。
 * - QuizAttemptLog は履歴として immutable。同一 id は既存を優先し、重複は保存しない。
 */

/** private: 非公開（自分用）。public: 共有・公開用エクスポートの対象にできるクイズ。 */
export type QuizVisibility = "private" | "public";

export type QuizChoiceSourceStrategy =
  | "correct"
  | "same-context"
  | "related-context"
  | "same-domain"
  | "random"
  | "manual";

export type QuizGenerationQuality = "high" | "medium" | "low" | "failed";

export type QuizDeckSourceType = "manual" | "domain-tag";

/** クイズ作成フローで選ぶ作成元 */
export type QuizCreateSourceType = "contextualConceptCard" | "contextCard";

/** クイズ問題の出典種別 */
export type QuizQuestionSourceType = "contextualConceptCard" | "contextCard";

/** クイズ問題の出典情報（既存データとの互換のため optional） */
export type QuizQuestionSource = {
  type: QuizQuestionSourceType;
  sourceId: string;
  sourceTitle: string;
  fieldName?: string;
};

/** 出題時のフィルタ（source がない古い問題は分野別・全体出題では従来通り対象） */
export type QuizSessionFilter = {
  fieldTag?: string;
  contextCardId?: string;
  contextualCardId?: string;
  sourceType?: QuizQuestionSourceType;
};

/** 分野タグからの自動生成・再同期時に使う出題条件 */
export type QuizDeckGenerationFilters = {
  targetDomainTag: string;
  includeDraftConcepts?: boolean;
  generationMode?: "context-definition" | "concept-general" | "auto";
};

export type QuizDeckGenerationSummary = {
  targetConceptCount: number;
  generatedQuestionCount: number;
  warningCount: number;
  failedCount: number;
};

export interface QuizChoice {
  id: string;
  /** 元の文脈別定義本文（マスク前） */
  text: string;
  /** 表示用テキスト（概念名マスク済み）。未設定時は表示時に算出 */
  displayText?: string;
  /** 選択肢テキストと Concept タイトルが一意に一致したときに付与 */
  linkedConceptId?: string;
  /** 選択肢の元となった Concept ID */
  sourceConceptId?: string;
  /** 選択肢の元となった文脈別定義 ID */
  contextDefinitionId?: string;
  sourceStrategy?: QuizChoiceSourceStrategy;
}

export interface QuizQuestion {
  id: string;
  /** 問い全体の関連 Concept（任意） */
  conceptId?: string;
  /** 作成元の出典情報（古いデータには無い場合あり） */
  source?: QuizQuestionSource;
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
 * IndexedDB store: `quizDecks`, keyPath: `id`
 *
 * 自分用 ZIP / JSON バックアップには `quizDecks?: QuizDeck[]` を含める。
 * 古いバックアップで quizDecks が無い場合は空配列扱い。
 * questionIds に存在しない QuizQuestion ID はインポート時に除去する。
 * backup: private / public の QuizDeck を両方含める。
 * share: visibility === public の QuizDeck のみ（共有用。学習ログは含めない）。
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
  /** 自動生成クイズ集の場合の生成元種別 */
  sourceType?: QuizDeckSourceType;
  /** sourceType が domain-tag のときの対象分野タグ */
  sourceDomainTag?: string;
  /** 分野タグからの自動生成サマリー */
  generationSummary?: QuizDeckGenerationSummary;
  /** 再同期に使う生成条件（sourceType: domain-tag 作成時に保存） */
  generationFilters?: QuizDeckGenerationFilters;
  /** 最後に未反映概念を追加した日時 */
  lastSyncedAt?: string;
}

/** QuizDeck の schemaVersion 初期値・マイグレーション用 */
export const QUIZ_DECK_SCHEMA_VERSION = 1;

/** クイズ1回答あたりの観測ログ。自分用 JSON / ZIP バックアップ対象（共有用 export では扱わない） */
export interface QuizAttemptLog {
  id: string;
  /** 同一「学習開始」から結果までを束ねる ID */
  sessionId?: string;
  /** 集計対象の概念 ID（出題概念） */
  conceptId?: string;
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
  /** Deck 学習で解いた場合の QuizDeck ID。自由学習時は未設定 */
  deckId?: string;
  /** 回答時点の Deck タイトル（Deck 削除後も履歴表示用） */
  deckTitleSnapshot?: string;
  schemaVersion: number;
}

export const QUIZ_ATTEMPT_LOG_SCHEMA_VERSION = 1;
