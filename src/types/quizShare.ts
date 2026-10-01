import type { QuizDeck, QuizQuestion } from "./quiz";

/**
 * クイズ共有 JSON の識別子。
 * バックアップ JSON（concepts / quizQuestions などを持つ自分用形式）とは別物。
 */
export const QUIZ_SHARE_FORMAT = "conceptbook-quiz-share" as const;

/**
 * 共有パッケージ全体の version。
 * QuizQuestion.schemaVersion / QuizDeck.schemaVersion とは独立した概念。
 * 共有 JSON の構造が変わったときに migration または非対応判定に使う。
 */
export const QUIZ_SHARE_VERSION = 1 as const;

/** 現在のアプリが解釈できる共有パッケージ version。将来の migration はここへ追加する。 */
export const SUPPORTED_QUIZ_SHARE_VERSIONS = [QUIZ_SHARE_VERSION] as const;

/**
 * 共有元 Concept の再リンク用ヒント。
 * sourceId は共有元の Concept ID であり、受信側の Concept ID として採用しない。
 * Concept 定義本文・ノート・文脈カードは含めない。
 */
export interface QuizShareConceptRef {
  sourceId: string;
  title: string;
}

/**
 * QuizDeck を別環境へ渡すための canonical 共有形式（version 1）。
 * バックアップとは独立。学習ログ・個人設定・メディアは含めない。
 */
export interface QuizSharePackage {
  format: typeof QUIZ_SHARE_FORMAT;
  /** 共有パッケージの version。Question / Deck の schemaVersion ではない。 */
  version: typeof QUIZ_SHARE_VERSION;
  exportedAt: string;
  deck: QuizDeck;
  questions: QuizQuestion[];
  conceptRefs: QuizShareConceptRef[];
}
