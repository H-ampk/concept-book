import type { PfaParameters } from "./types";

/**
 * ConceptBook 用 PFA の初期デフォルト値。
 * 初期デフォルト値であり、ConceptBook の実データから推定された係数ではない。
 * 将来 Data Lab 等から係数推定・比較できるよう、呼び出し側で差し替え可能な構造にしている。
 */
export const DEFAULT_PFA_PARAMETERS: PfaParameters = {
  intercept: 0,
  successWeight: 0.4,
  failureWeight: -0.4
};
