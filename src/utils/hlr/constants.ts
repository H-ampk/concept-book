import type { HlrParameters } from "./types";

/**
 * ConceptBook 用 HLR の provisional / experimental な固定初期値。
 *
 * HLR 原論文で Leitner system の特殊ケースとして示される
 * intercept=0 / successWeight=1 / failureWeight=-1 に対応する baseline であり、
 * ConceptBook の個人データから学習済みの HLR coefficient ではない。
 *
 * 初期状態では概念的に、正答で half-life が倍、誤答で half-life が半分になる。
 * 将来の parameter fitting 実装から差し替えられるよう、呼び出し側で注入可能にしている。
 */
export const DEFAULT_HLR_PARAMETERS: HlrParameters = {
  intercept: 0,
  successWeight: 1,
  failureWeight: -1
};

/**
 * 複数の異なる学習日が揃うまで retention / half-life を確定値として返さない。
 * 学習済み HLR parameters を持たない初期実装向けの threshold。将来変更可能。
 */
export const MIN_DISTINCT_STUDY_DAYS_FOR_ESTIMATE = 2;
