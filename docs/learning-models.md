# ConceptBook の学習モデル

## Overview

ConceptBook は、学習状態を単一の「理解度」に押し込みません。複数のモデルと指標を **別責務** として扱い、加算や加重平均による総合スコアは作りません。

いずれも `QuizAttemptLog` から導出する derived data です。IndexedDB には保存せず、ログとパラメータから再計算します。Concept への帰属は `resolveConceptIdFromLog()`（`questionConceptId` → `conceptId`）を使います。

現行の既定パラメータは初期デフォルト値であり、ConceptBook の個人データから推定した係数ではありません。

関連:

- IRT は未導入。判断根拠は [irt-feasibility.md](./irt-feasibility.md)
- Data Lab からの可視化・CSV・研究レポート保存は README の Data Lab / Research Report を参照

---

## BKT

Bayesian Knowledge Tracing。Concept 単位の **習得状態** を推定します。

実装: `src/utils/mastery/`

### 役割

過去の正答・誤答から、その Concept を学習済みである確率 \(P(L)\) を更新します。「真の理解」そのものではなく、回答履歴に基づく習得状態の推定です。

### パラメータ（既定値）

`DEFAULT_BKT_PARAMETERS`:

| パラメータ | 意味 | 既定 |
| --- | --- | --- |
| `initialMastery` | \(P(L_0)\): 未回答時点で習得済みである事前確率 | 0.2 |
| `learnProbability` | \(P(T)\): 1 回の学習機会で未習得から習得へ移行する確率 | 0.1 |
| `guessProbability` | \(P(G)\): 未習得でも正解する確率 | 0.2 |
| `slipProbability` | \(P(S)\): 習得済みでも誤答する確率 | 0.1 |

忘却パラメータはありません。観測は `answeredAt` 昇順で処理します。

### 出力（`ConceptMastery`）

| フィールド | 意味 |
| --- | --- |
| `masteryProbability` | 習得確率 \(P(L)\)（0〜1） |
| `masteryScore` | `masteryProbability` を 0〜100 の整数に丸めた表示用スコア |
| `state` | `unlearned` / `insufficient-data` / `learning` / `developing` / `mastered` |
| `attemptCount` / `correctCount` / `incorrectCount` | 回答件数 |
| `accuracy` | 正答率。0 件では `null` |
| `confidence` | 回答件数からの信頼度（`none` / `low` / `medium` / `high`）。BKT 内部の不確かさそのものではない |
| `freshness` | 最終回答からの経過ラベル（`never` / `fresh` / `aging` / `stale`） |
| `lastAnsweredAt` | 最終回答時刻 |
| `recentResults` | 直近最大 5 件の正誤 |
| `avgReactionTimeMs` | 有効な反応時間の平均。無ければ `null` |

`freshness` の区分は最終回答からの経過日数です（7 日以内が `fresh`、30 日以内が `aging`、それ以降が `stale`）。HLR の保持確率とは別物です。

### 次回正答確率との区別

BKT は observation model から次回正答確率も計算できます。

\[
P(\text{correct}) = P(L)\,(1 - P(S)) + (1 - P(L))\,P(G)
\]

`masteryProbability` と `nextCorrectProbability` は同一ではありません。one-step-ahead 評価では後者を使います。一覧やグラフの「理解度」表示は前者（習得状態）です。

履歴 0 件では `initialMastery` を prior として予測します。

---

## PFA

Performance Factors Analysis。Concept 単位の **次回正答確率** を推定します。

実装: `src/utils/pfa/`

### 役割

成功回数と失敗回数から、次の回答が正解する確率を出します。理解度・習得度・mastery ではありません。回答の時刻順や経過時間は使いません。

### パラメータ（既定値）

`DEFAULT_PFA_PARAMETERS`:

| パラメータ | 意味 | 既定 |
| --- | --- | --- |
| `intercept` | logit の切片 | 0 |
| `successWeight` | 成功回数の重み | 0.4 |
| `failureWeight` | 失敗回数の重み | -0.4 |

\[
\operatorname{logit}(P(\text{correct})) = \text{intercept} + \text{successWeight} \times \text{successCount} + \text{failureWeight} \times \text{failureCount}
\]

\[
P(\text{correct}) = \sigma(\operatorname{logit})
\]

### 出力（`PfaPrediction`）

| フィールド | 意味 |
| --- | --- |
| `nextCorrectProbability` | 次回正答確率（0〜1） |
| `successCount` | 正答回数 |
| `failureCount` | 誤答回数 |

履歴 0 件でも `successCount = 0` / `failureCount = 0` として `sigmoid(intercept)` を返します。評価不能を 0 で代用することはしません。

---

## HLR

Half-Life Regression。Concept 単位の **記憶保持** を推定します。

実装: `src/utils/hlr/`

### 役割

- `halfLifeDays`: 保持確率が 0.5 になるまでの推定日数
- `retentionProbability`: 現時点でその記憶を保持している確率
- `elapsedDays`: 最終学習からの経過日数

BKT の習得状態でも、PFA の次回正答確率でもありません。BKT の `freshness`（最終回答からの粗いラベル）とも別です。

### パラメータ（既定値）

`DEFAULT_HLR_PARAMETERS` は、HLR 原論文で Leitner の特殊ケースとして示される baseline です。

| パラメータ | 意味 | 既定 |
| --- | --- | --- |
| `intercept` | \(\log_2(\text{half-life})\) の切片 | 0 |
| `successWeight` | 成功回数の重み | 1 |
| `failureWeight` | 失敗回数の重み | -1 |

初期 feature は bias / successCount / failureCount のみです。間隔の平均（`meanSpacingDays`）は履歴サマリーとして計算しますが、半減期の式には入れていません。

\[
\log_2 h = \text{intercept} + \text{successWeight} \times \text{successCount} + \text{failureWeight} \times \text{failureCount}
\]

\[
h = 2^{\log_2 h}
\]

\[
p = 2^{-\Delta / h}
\]

概念的には、正答で half-life が倍、誤答で半分になる設定です。

### 出力（`MemoryRetentionEstimate`）

| フィールド | 意味 |
| --- | --- |
| `status` | `insufficient-data` または `estimated` |
| `halfLifeDays` | 半減期（日）。推定不能時は `null` |
| `retentionProbability` | 保持確率。推定不能時は `null` |
| `elapsedDays` | 最終学習からの経過日数 |
| `attemptCount` / `successCount` / `failureCount` | 回数 |
| `distinctStudyDayCount` | 異なる UTC 学習日の数 |
| `meanSpacingDays` | 学習日間隔の平均 |
| `lastAnsweredAt` | 最終回答時刻 |

異なる学習日が `MIN_DISTINCT_STUDY_DAYS_FOR_ESTIMATE`（現行 2 日）未満のときは `insufficient-data` とし、半減期も保持確率も `null` のままにします。0 や仮の確率では埋めません。

HLR の `status` は BKT の `confidence` とは独立です。

---

## IRT

IRT（項目反応理論）は **現在実装しません**。BKT / PFA / HLR と同列の実装済みモデルとして扱いません。

単一ユーザーの個人ログから item difficulty と learner ability を分離推定する条件を満たさない、というのが current main での判断です。詳細と結論は [irt-feasibility.md](./irt-feasibility.md) を参照してください。

---

## One-step-ahead evaluation

実装: `src/utils/learningModelEvaluation/`

各回答 \(t\) の正答確率を、**その回答自身と未来の回答を使わず、時点 \(t\) より前の同一 Concept 履歴だけ** から予測します。同一 `answeredAt` のログは同じ timestamp group とし、group 内では互いを history に入れません。group 内の予測を出し終えてから history に追加します。

不正な `answeredAt`、Concept を解決できないログは対象外です。predictor が `null` または 0〜1 以外を返した場合、その点は生成せず 0 に変換しません。予測系列は IndexedDB に保存しません。

### Predictor

| id | 返す値 | 履歴 0 件 |
| --- | --- | --- |
| `bkt` | BKT observation model の \(P(\text{correct})\)。`masteryProbability` ではない | `initialMastery` を prior にして予測する |
| `pfa` | PFA の `nextCorrectProbability` | intercept の sigmoid を prior にする |

HLR の保持確率は次回正答確率ではないため、この比較には入れていません。HLR predictor は current main にありません。

### 評価指標

`LearningModelPredictionMetrics`:

| 指標 | 意味 |
| --- | --- |
| `count` | 評価対象の予測点数 |
| `brierScore` | \((p - y)^2\) の平均。小さいほど誤差が小さい。0 件では `null` |
| `logLoss` | 平均 log loss。計算時のみ \(\varepsilon\) clip。0 件では `null` |

全体、モデル単位、Concept 単位、モデル×Concept で集計できます。

---

## Data Lab integration

実装: `src/components/dataLab/DataLabView.tsx`、`DataLabLearningModelEvaluationPanel.tsx`

Data Lab の学習ログ分析では、モデル出力を 2 層で扱います。

### 現在値（集計テーブル・グラフ）

Concept 集計のとき、全学習履歴から算出した **現在値** を行に付与します。

- BKT `masteryProbability`
- PFA `nextCorrectProbability`
- HLR `retentionProbability` / `halfLifeDays` / `elapsedDays`

期間フィルタは「いまの推定に使う履歴」を切りません。画面のフィルタは表示する回答・集計行の選択に使います。

### 学習モデル評価パネル

学習ログが 1 件以上あるとき表示します。BKT と PFA の one-step-ahead を比較します。

表示内容:

- モデル比較サマリー（prediction 数、Brier score、Log loss）
- 予測正答確率 × 実際の正誤（散布図）
- Concept ごとの予測誤差
- 学習回数（`historyCount`）× 二乗誤差

予測系列は全学習履歴から生成し、画面フィルタは **評価対象にする回答 ID** にだけ適用します。HLR はこのパネルの比較対象ではありません。

CSV では予測評価データも書き出せます。

---

## モデルの役割比較

| Model | 主な役割 | 主な出力 | 時間要素 |
| --- | --- | --- | --- |
| BKT | Concept の習得状態 | `masteryProbability` / `masteryScore` / `state` / `confidence` / `freshness`。評価時のみ `nextCorrectProbability` | 回答を時系列で更新。`freshness` は最終回答からの経過。忘却パラメータなし |
| PFA | 次回正答確率 | `nextCorrectProbability`、成功/失敗回数 | 回数の累積のみ。経過時間は使わない |
| HLR | 記憶保持 | `halfLifeDays`、`retentionProbability`、`elapsedDays` | 最終学習からの経過日数と半減期。学習日が 2 日未満では推定しない |
| IRT | 現在未導入 | — | — |

これらを合成した総合理解度はありません。
