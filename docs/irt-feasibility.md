# ConceptBook IRT 導入可能性調査

調査対象: current `main`（#166 PFA / #167 HLR 実装済み）  
調査日: 2026-09-10  
対象 Issue: #168（親設計: #55、Data Lab 比較: #170）

本ドキュメントは IRT 本体の実装仕様ではない。ConceptBook の現行データ構造・利用形態で、通常の IRT item parameter を導入することが統計的・実装的に妥当かを整理し、採否を確定するための調査結果である。

---

## 結論

**C. 現状では IRT を導入せず、manual / heuristic difficulty を利用する**

これは「IRT 自体に価値がない」という判断ではない。

現行の ConceptBook はローカル IndexedDB を source of truth とする単一ユーザー中心の個人学習アプリであり、通常の静的 IRT / Rasch が想定する「複数の独立した学習者 × 複数の項目」から item difficulty と learner ability を分離推定する条件を満たさない。同じ `QuizAttemptLog` が大量にあっても、それを独立した大量の学習者として扱ってはならない。

したがって:

- 現時点では IRT を実装しない
- 現時点では IRT 実装 Issue は作らない
- 将来的に複数ユーザーから同一 Item への回答データを収集できる構造になった場合は再評価可能
- 現在の difficulty の扱いとしては、IRT ではなく manual / heuristic を候補とする

Decision のラベルは Issue #168 の選択肢 **C** とする。D（将来の複数ユーザー環境まで保留）と実質的に連続するが、現状の difficulty 代替を明示するため C を採用する。再検討条件を満たすまでは IRT は保留である。

---

## IRT / Rasch の役割

IRT（Item Response Theory / 項目反応理論）は、観測された正答・誤答から、学習者側の能力と問題側の特性を分離して扱うモデル群である。

1PL / Rasch の基本形は次のとおりである。

```text
P(correct) = logistic(θ − b)
```

ここで:

- `θ`（theta）: 学習者側の ability
- `b`: 問題側の item difficulty
- `logistic(x) = 1 / (1 + exp(−x))`

同じ正答でも、「易しい問題に正解した」のか「難しい問題に正解した」のかを、学習者の能力水準との関係として区別できる点が IRT の中心的な役割である。通常の静的 Rasch は、複数の学習者が複数の項目に回答した応答行列から、ability と difficulty を同時に推定することを想定する。

#55 の設計どおり、ConceptBook では IRT difficulty を次の指標とは **別責務** として扱う。

| 指標 | 役割 |
| --- | --- |
| BKT `masteryProbability` | Concept についての現在の習得状態の推定 |
| PFA `nextCorrectProbability` | 次回その Concept に正解する確率 |
| HLR `retentionProbability` | 現在その記憶を保持している確率の推定 |
| IRT item difficulty | 問題側の項目特性（導入する場合） |

これらを加算・合成した総合理解度は作らない。IRT を導入するとしても、BKT mastery を difficulty で補正したり、PFA / HLR の出力へ混ぜたりしない。

現行実装もこの分離を維持している。

- BKT: `src/utils/mastery/`
- PFA: `src/utils/pfa/`（#166）
- HLR: `src/utils/hlr/`（#167）
- Concept 帰属: `resolveConceptIdFromLog()`（`questionConceptId` → `conceptId`）

IRT utilities は存在せず、本調査でも作成しない。

---

## 現在利用可能なデータ

### 保持しているもの

`QuizAttemptLog` はクイズ 1 回答あたりの観測ログであり、自分用 JSON / ZIP バックアップ対象である。現行 schema が保持している主なフィールドは次のとおりである。

| フィールド | 意味 |
| --- | --- |
| `id` | ログ ID |
| `questionId` | 回答した問題 ID |
| `conceptId` | 集計対象の概念 ID（出題概念） |
| `questionConceptId` | 回答時点の `Question.conceptId` |
| `correct` | 正答 / 誤答 |
| `startedAt` | 表示開始時刻 |
| `answeredAt` | 回答時刻 |
| `timeMs` | 表示開始から回答までの経過（ミリ秒） |
| `sessionId` | 同一学習セッションを束ねる ID |
| `deckId` | Deck 学習時の `QuizDeck` ID |

このほか、回答時点の問題文・選択肢スナップショット、`selectedChoiceId`、`correctChoiceId`、リンク先 Concept ID、`deckTitleSnapshot`、`schemaVersion` を保持する。ログは履歴として immutable である。

`resolveConceptIdFromLog()` は mastery / PFA / HLR / 概念別集計の帰属に使う。優先順は `questionConceptId` → `conceptId` であり、混同分析用の `selectedLinkedConceptId` / `correctLinkedConceptId` は使わない。

`QuizQuestion` は `id` / `conceptId` / `prompt` / `choices` / `correctChoiceId` / `visibility` / `schemaVersion` 等を持つが、difficulty・IRT parameter・ability は持たない。本調査では `QuizQuestion` schema を変更しない。

永続化はブラウザの IndexedDB（`concept-book-db` / store: `quizAttemptLogs`）である。学習ログに複数ユーザーを跨ぐ識別子はなく、ローカル・個人利用が基本である。

### 存在しないもの

現行の `QuizAttemptLog` / `QuizQuestion` / IndexedDB には、次のものは存在しない。

- `userId` / `learnerId`
- 複数ユーザーを跨ぐ回答者識別
- 複数学習者回答を前提とした calibration dataset
- item difficulty
- learner ability
- IRT parameter（difficulty / discrimination / guessing 等）
- item version

したがって、現在のログから「この問題の IRT difficulty はいくつか」を通常の item calibration として推定する入力が足りない。

---

## 単一ユーザー中心環境の問題

ConceptBook の実際の応答過程は、概ね次のとおりである。

```text
同一ユーザー
↓
同じ / 異なる問題を繰り返し回答
↓
学習によって ability 自体が時間変化
```

通常の静的 Rasch が想定するのは、次の構造である。

```text
複数の学習者 × 複数の項目
↓
各学習者の（その時点では比較的安定した）ability
と
各項目の difficulty
を分離推定
```

現在の ConceptBook では一人の反復回答しかないため、

- 「この問題が難しかった」
- 「その時点ではまだ学習者が理解していなかった」

を、通常の静的 IRT として十分に分離できない。同じ `questionId` への誤答が、item difficulty によるものなのか、その時点の未習得・未保持によるものなのかが識別できない。

**同一ユーザーの 100 回答を、100 人の独立学習者として扱ってはいけない。** IRT の N は回答ログ数ではなく、独立した学習者数として見る。現行 ConceptBook ではほぼ **N = 1** である。

加えて、反復回答では過去の回答・学習・復習の影響がある。通常の IRT が置く local independence（所与の ability のもとで項目反応が独立）は、同一学習者の時系列的な学習ログでは成立しにくい。BKT / PFA / HLR が扱う「学習による状態変化」は、静的 IRT の仮定と衝突する情報である。

バックアップ import で別端末のログをマージできても、それは同一ユーザーの履歴結合であり、独立学習者の増加ではない。

---

## Concept 単位との相性

ConceptBook 固有の重要な制約として、能力・理解状態は Concept ごとに異なる。#55 でも BKT / PFA / HLR は Concept 単位であり、全 Concept を単一の理解度へ合成しない。

IRT でも latent dimension の定義が必要になる。

- 全 Concept の問題を一つの Rasch モデルへ入れる場合、「単一の ability dimension」とみなすことになる。心理学・情報理論・別分野の問題を同一 θ で並べるのは、ConceptBook の Concept 単位設計と整合しない。
- Concept ごとに Rasch モデルを作る場合、1 Concept あたりの問題数は少なく、回答者は基本 1 人である。item parameter 推定用データはさらに不足する。

したがって現在の構造では、通常の Rasch model と相性が良くない。将来再検討するときも、先に latent dimension / Concept grouping を定義する必要がある。

---

## 必要データ量

絶対的な固定閾値は存在しない。必要な学習者数・項目数・1 項目あたりの応答数は、item targeting、求める精度、モデル（1PL / 2PL / 3PL）、推定法、欠測デザイン、目的によって変わる。文献上も、一般的な経験則より simulation-based sample size planning が推奨される（Schroeders & Gnambs, 2025）。

その前提で、文献に現れる目安を **絶対条件ではなく探索的な参考** として整理する。

- Rasch / 1PL は、2PL / 3PL よりパラメータが少なく、比較的小さい sample でも利用されることがある
- 30〜50 程度は、exploratory / pilot 的な item calibration で言及される例がある（Linacre, 1994）
- 100 程度で妥当な推定が可能になる場合もある（推定法や事前情報による。Finch & French, 2019; Schroeders & Gnambs, 2025 が引用する小標本研究）
- より複雑なモデルや guessing / slipping、混合モデルでは、はるかに大きな N でも不足することがある
- 必要数は item targeting、精度、モデル、目的によって変化する
- 固有のデザインに対しては simulation-based sample size planning が推奨される

**ConceptBook の現在の N は「回答ログ数」ではなく、IRT の独立学習者として見るとほぼ N = 1 である。** 「回答を 100 回したので N = 100」とはしない。

1 問あたりについても、単純な回答回数だけでは不足する。item difficulty calibration には、複数の能力水準を持つ独立した学習者から、correct / incorrect の両方の情報が得られることが重要である。同一学習者が同じ問題を何度も解けば、学習後の正答が増えるだけで、項目の安定した difficulty を一般化できる対象集団にはならない。

---

## 1PL / Rasch

評価結果: **現状では採用しない。**

理由:

- learner が基本 1 人である
- ability が学習により時間変化する
- repeated responses は独立な受験者ではない
- Concept ごとの latent ability が想定される
- Concept ごとに分割すると item 数が少ない
- stable item difficulty を一般化する対象集団がない

1PL / Rasch はパラメータが少なく、将来 IRT を再検討するときの第一候補ではある。ただし現時点では、上記の識別問題が sample size の大小より先に立つ。

将来、次が揃えば再検討可能である。

- stable な `questionId`
- 同一問題への複数学習者回答
- `learnerId`
- 十分な item / response coverage
- item version 管理
- latent dimension の定義
- calibration dataset（個人学習ログとの区別）

---

## 2PL

評価結果: **現状では採用しない。**

2PL は difficulty `b` に加えて、項目ごとの discrimination `a` を推定する。

```text
P(correct) = logistic(a (θ − b))
```

パラメータ数と必要情報量は 1PL より増える。現在 1PL すら十分な calibration data がないため、2PL を導入する根拠はない。将来 1PL / Rasch が成立した後に、discrimination の必要性を別途確認する。

---

## 3PL

評価結果: **現状では採用しない。**

3PL は difficulty / discrimination に加えて guessing parameter `c` を推定する。

```text
P(correct) = c + (1 − c) · logistic(a (θ − b))
```

ConceptBook の現在の個人ログではさらに識別が難しく、parameter estimation の不安定性も増えるため対象外とする。

四択問題だからという理由だけで guessing parameter を導入しない。BKT の `guessProbability` は Concept 単位の未習得時正答の初期デフォルトであり、項目ごとの IRT guessing とは別物である。

---

## longitudinal / dynamic IRT

同一ユーザーの ability 変化を扱う方法として、longitudinal IRT や dynamic IRT 等が存在する。反復測定の観測時刻が個人ごとに異なる場合に、潜在特性を連続時間の過程として扱う研究もある（Proust-Lima et al., 2022）。

ただしこれは通常の静的 Rasch より大幅に複雑である。

- 現在の ConceptBook の目的（個人の Concept 学習を BKT / PFA / HLR で分解して扱うこと）には過剰
- 個人利用データだけでは、項目側パラメータを安定して校正する根拠も弱い
- BKT / PFA / HLR が既に時間・学習履歴を扱っている

そのため、今回の採用候補にはしない。将来複数学習者データが得られても、最初に検討するのは静的 1PL / Rasch であり、longitudinal / dynamic IRT を先行採用しない。

---

## difficulty の代替方式

現在は IRT difficulty ではなく、次を将来的な候補とする。本 Issue では schema 変更も UI 実装もしない。

### 1. manual difficulty

ユーザーまたは問題作成時に `easy` / `medium` / `hard` 等を指定する方式。作成者の判断であり、統計的な item calibration ではない。

### 2. heuristic difficulty

個人内の相対難易度を、例えば次から算出する方式。

- 正答率
- 初回正答率
- 回答時間
- 必要に応じて回答回数

これは「そのユーザーにとって相対的に難しかったか」の要約になり得る。ただし **正答率が低い = IRT difficulty ではない。** 統計的意味が異なる。heuristic な正答率・反応時間を IRT と呼ばない。

将来 schema へ difficulty を追加するなら、由来を識別できることが望ましい。概念案のみ示す。

```ts
difficultySource:
  | "manual"
  | "heuristic"
  | "irt"
```

Issue #168 では `QuizQuestion` schema 自体を変更しない。IndexedDB / backup / UI にも追加しない。

---

## 将来 IRT を再検討する条件

少なくとも次が揃ってから再評価する。

- 複数学習者の回答を収集する仕組みがある
- learner を匿名 ID 等で区別可能である
- 同一 `questionId` がユーザー間で同じ Item を意味する
- 問題編集時に Item version を区別できる
- 各 item に十分な回答 coverage がある
- ability 範囲が極端に偏らない（複数の能力水準からの正答・誤答が得られる）
- latent dimension / Concept grouping が定義されている
- model fit / local independence 等を検証できる
- calibration data と個人学習ログを区別できる

その段階で最初に 1PL / Rasch を検討する。2PL / 3PL は、1PL では不足する理由が確認されてからとする。

再検討時も、個人の学習履歴（BKT / PFA / HLR の入力）を、item calibration 用の独立標本へ流用しない。

---

## IRT を採用する場合の将来 API 案

本実装はしない。Issue #168 の成果物として概念案のみ残す。現在の schema / IndexedDB へ追加しない。

```ts
type IrtItemParameter = {
  questionId: string;
  difficulty: number;
  source: "irt";
  sampleSize: number;
};

type IrtAbilityEstimate = {
  learnerId: string;
  ability: number;
};
```

入力の最小単位:

- `learnerId`
- `questionId`
- `correct`

出力:

- item difficulty
- learner ability

必要になれば `itemVersion`、`latentDimension` / `conceptId`、standard error、calibration 日時を足す。個人学習用の `QuizAttemptLog` とは別に、calibration 用の応答行列を扱えることが前提である。

#170 の Data Lab には、#168 が採用と判断するまで IRT 指標を組み込まない。本調査の結論は非採用のため、Data Lab の IRT 可視化は後続対象にしない。

---

## 最終判断

```text
Decision: C

現状:
IRT 非採用

現在の difficulty:
manual / heuristic を候補とする

IRT:
将来の複数学習者 calibration 環境まで保留

1PL / Rasch:
将来の第一候補

2PL:
現状不要

3PL:
現状不要

IRT 実装 Issue:
作成しない
```

変更対象は本ドキュメントのみである。`QuizQuestion` / `QuizAttemptLog` / IndexedDB / BKT / PFA / HLR / Data Lab / backup / UI は変更しない。

---

## 現行実装の確認メモ

確認した範囲の要約。

- `src/types/quiz.ts` の `QuizAttemptLog` に `questionId` / `conceptId` / `correct` / `startedAt` / `answeredAt` / `timeMs` / `sessionId` / `deckId` 等はある
- 同型に `userId` / `learnerId` / item difficulty / ability / IRT parameter はない
- `QuizQuestion` にも difficulty はない
- `src/utils/mastery/` は BKT による Concept mastery
- `src/utils/pfa/` は次回正答確率（#166）
- `src/utils/hlr/` は記憶保持推定（#167）
- `resolveConceptIdFromLog()` は `questionConceptId` → `conceptId`
- IndexedDB はローカル個人利用が基本で、複数ユーザー識別を持たない
- #55 は IRT を問題特性として定義しつつ、導入可能性検証を #168 に委譲している
- #170 は #168 の結論が出るまで Data Lab へ IRT を組み込まない

---

## References

絶対的な最小 N を Web 記事の数字から断定しない。以下は、Rasch / IRT の sample size が文脈依存であること、小標本でも 1PL が探索的に使われる例があること、反復測定には縦断モデルが存在すること、を確認するための一次文献である。

- Schroeders, U., & Gnambs, T. (2025). Sample-Size Planning in Item-Response Theory: A Tutorial. *Advances in Methods and Practices in Psychological Science, 8*(1), 1–13. https://doi.org/10.1177/25152459251314798
- Finch, W. H., & French, B. F. (2019). A Comparison of Estimation Techniques for IRT Models With Small Samples. *Applied Measurement in Education, 32*(2), 77–96. https://doi.org/10.1080/08957347.2019.1577243
- Proust-Lima, C., Philipps, V., Perrot, B., Blanchin, M., & Sébille, V. (2022). Modeling repeated self-reported outcome data: A continuous-time longitudinal Item Response Theory model. *Methods, 204*, 386–395. https://doi.org/10.1016/j.ymeth.2022.01.005
- Linacre, J. M. (1994). Sample Size and Item Calibration or Person Measure Stability. *Rasch Measurement Transactions, 7*(4), 328. https://www.rasch.org/rmt/rmt74m.htm （補助資料。30 / 50 / 100 等は targeting と求める精度に依存する目安であり、絶対条件ではない）

---

## Related documents

BKT / PFA / HLR の現行実装と one-step-ahead 評価は [learning-models.md](./learning-models.md) を参照。本調査の結論（IRT は導入しない）は変更しない。
