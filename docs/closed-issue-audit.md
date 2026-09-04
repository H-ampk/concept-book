# Closed Issue Audit

監査基準: current main  
監査日: 2026-09-04  
対象リポジトリ: `H-ampk/concept-book`  
監査方法: Closed Issue 32件の本文（完了条件・スコープ）を取得し、現在の `main` の実装・テストと照合。コード変更・commit・Issue 操作は行っていない。

## Audit metadata

- Repository: `H-ampk/concept-book`
- Audit target: Closed Issues
- Closed Issues audited: 32
- Baseline branch: `main`
- Baseline commit: `2a4f9fa5bd34950bcc0e5f2e7fd1e21eac40ff93`
- Audit date: `2026-09-04`
- Method: GitHub Issue本文とcurrent main実装の照合
- Source changes during audit: none

## Summary

- Total: 32
- PASS: 17
- PASS_WITH_FOLLOW_UP: 13
- NEEDS_FIX: 0
- OBSOLETE: 1
- NOT_PLANNED_REVIEW: 1

`NOT_PLANNED_REVIEW` は、GitHub上で `not_planned` としてクローズされているが、現在もIssue本文の要求が有効に見え、見送り理由・代替仕様・後続Issueへの移管が十分に記録されていない分類である。実装不具合とは扱わず、仕様判断の再確認が必要な状態とする。

## Issues

### #1 概念グラフのノード・ラベルの重なりを改善する

**Result:** PASS_WITH_FOLLOW_UP

**Completion criteria**
- PASS: グラフを主要領域として大きく表示する（`App.tsx` の graph タブは `flex-1`、固定カード内固定サイズから脱却）
- PASS: 操作を上部ツールバーへ集約（全体/1-hop/2-hop、指標、収める、リセット、さらに表示）
- PASS: 詳細は常時圧迫せず、選択時パネル（#104/#105 後続で横並び+pointer-events分離）
- PASS: Force パラメータ調整（`conceptGraphSimulation.ts` の linkDistance 90 / chargeStrength -160）
- PARTIAL: ノード・ラベル重なりの「最小限」。遠景・大規模では #108 でも残差を認めている

**Current implementation**
- `src/app/App.tsx`
- `src/components/ConceptGraphView.tsx`
- `src/utils/conceptGraphSimulation.ts`
- `src/utils/conceptGraphLod.ts`

**Tests:** PARTIAL（simulation/LOD/topology はあるが、重なりそのものの自動検証はない）

**Notes**
- 後続 #108 / #112 が視認性・描画負荷を継続対応。
- ユーザー調整可能な間隔は #2（`NOT_PLANNED_REVIEW`）。現mainには当該UIはない。

---

### #2 概念グラフのノード間隔をユーザーが調整できるようにする

**Result:** NOT_PLANNED_REVIEW

**GitHub close reason**
- `not_planned`（`completed` ではない）
- Issue本文・コメントに見送り理由、代替仕様、後続Issueへの移管が十分に記録されていない
- 本文の要求（ユーザーによるノード間隔調整）は現在も有効に見えるため、`OBSOLETE` とは断定しない
- 実装不具合としては扱わない。この機能が現在も必要かは改めて判断する必要がある
- 本監査では新規Issueは作成しない

**Completion criteria（現mainの技術確認。実装漏れとは断定しない）**
- 現mainに存在しない: ユーザーによるノード間隔調整
- 現mainに存在しない: 変更の即時反映
- 現mainに存在しない: 初期値への復帰
- 現mainに存在しない: 設定値の保存（Issue が任意想定していたもの）

**Current implementation**
- `src/utils/conceptGraphSimulation.ts` — `linkDistance` / `chargeStrength` は規模別 profile の固定値のみ
- `src/components/ConceptGraphView.tsx` — `d3Force("link").distance` / `charge` を simulation config から設定するだけ。スライダー・リセット UI なし
- #17/#102 の内部力学パラメータ最適化はあるが、ユーザー操作可能な間隔制御としては記録されていない

**Tests:** MISSING（ユーザー間隔調整の専用テストなし）

---

### #3 関連概念の方向性と同期仕様を整理する

**Result:** PASS

**Completion criteria**
- PASS: 無向「関連」として定義（Issue 本文＋実装コメント）
- PASS: 登録/削除時の双方向同期（`indexeddb.ts` の create/update）
- PASS: Concept 削除時の参照除去
- PASS: v7 migration で片方向補完・自己参照/重複/空/欠落 ID 除去（`DB_VERSION = 7`）
- PASS: 読み込み時 `repairUndirectedRelatedIds`
- PASS: import 経路で `normalizeRelatedIdList`
- PASS: ツリーとグラフが `collectUndirectedConceptEdges` を共有
- PASS: 二重リンク防止（canonical 無向辺）
- PASS: 将来の関係タイプは別モデル（open #118 系）

**Current implementation**
- `src/storage/indexeddb.ts`
- `src/utils/conceptRelations.ts`
- `src/utils/conceptGraphTopology.ts`
- `src/components/SkillTreeView.tsx`

**Tests:** PARTIAL（`conceptRelations.selftest.ts`、topology テスト。保存層の専用 vitest は薄い）

**Notes**
- Open の #42/#43 は本 Issue クローズ後も残っている重複チケットの可能性が高い。仕様自体は main で満たしている。

---

### #4 複数分野を持つ概念の色表現を整理する

**Result:** PASS_WITH_FOLLOW_UP

**Completion criteria**
- PASS: 先頭タグ代表色を廃止
- PASS: 主分野を導入しない
- PASS: グラフは外周リング、内部はニュートラル
- PASS: 最大4色、ja ロケール決定的ソート（`getDomainTagColors`）
- PASS: ツリーは小さな色インジケータ + `+N`
- PASS: Concept 型 / IndexedDB 非変更

**Current implementation**
- `src/utils/domainColors.ts`
- `src/components/ConceptGraphView.tsx`
- `src/components/SkillTreeView.tsx`

**Tests:** PARTIAL（`domainColors.test.ts` はバックアップ正規化中心。リング描画の UI テストなし）

**Notes**
- Open #44「先頭タグのみ参照」は本実装と矛盾して残存。後続整理が必要。

---

### #5 ConceptBookにおける理解度指標を整理する

**Result:** PASS_WITH_FOLLOW_UP

**Completion criteria**
- PASS: 理解度＝クイズ履歴からの安定正答の推定（BKT）
- PASS: `masteryScore` 0–100、confidence / freshness 分離
- PASS: 時間減衰でスコアを下げない
- PASS: 回答時間・混同は診断情報
- PASS: Concept 詳細表示（`ConceptDetail.tsx` + `formatConceptMastery.ts`）
- PASS: ユニットテスト `getConceptMastery.test.ts`
- MOVED: 一覧・グラフ・推移・復習候補は #56/#57/#58 等

**Current implementation**
- `src/utils/mastery/bkt.ts`
- `src/utils/mastery/getConceptMastery.ts`
- `src/components/ConceptDetail.tsx`

**Tests:** SUFFICIENT（推定ロジック）

**Notes**
- グラフ上の理解度可視化は未実装（#41/#56）。本 Issue の完了条件は基盤まで。

---

### #6 Data Labの目的と機能範囲を整理する

**Result:** PASS_WITH_FOLLOW_UP

**Completion criteria**
- PASS: 役割・対象データ・フィルタ・集計軸・指標・可視化・エクスポート・スコープ外・子 Issue 分割は Issue 本文で決定済み
- OBSOLETE（実装としては未着手）: Data Lab 画面自体は本 Issue 対象外。`data-lab` は `LabPlaceholderPage`（準備中）

**Current implementation**
- `src/constants/labRoutes.ts`
- `src/components/LabPlaceholderPage.tsx`
- `src/app/App.tsx`（`data-lab` のみプレースホルダ）

**Tests:** NOT_NEEDED（設計 Issue）

**Notes**
- 実装は open #89–#98。クイズ作成/学習/分析などは Lab 配下で実画面化済み。`LAB_MENU_ITEMS.status` が全て `coming_soon` なのは #47/#48 の整理対象。

---

### #7 ConceptBookにおけるAI機能の設計方針を整理する

**Result:** PASS_WITH_FOLLOW_UP

**Completion criteria**
- PASS: 対話的検討支援、正式データを直接変更しない、定義自動生成・LLM 自動登録を主要から除外、Provider/Storage 分離、最小送信、オフライン主要機能、子 Issue 分割が本文で決定
- MOVED: 実装は #64–#68 等

**Current implementation**
- 本 Issue 範囲の AI ランタイムは未導入（設計どおり）

**Tests:** NOT_NEEDED

**Notes**
- ローカル関連候補 `suggestRelatedConcepts.ts` は LLM ではない境界として残存。

---

### #8 クラウド同期・複数端末対応の方針を整理する

**Result:** PASS_WITH_FOLLOW_UP

**Completion criteria**
- PASS: ローカルファースト、Private Sync と公開の分離、対象/非対象、オフライン、競合、削除、学習ログ、メディア、JSON/ZIP 維持、Public Snapshot、閲覧・コピーのみ、独立コピー、認可、分割方針が本文で決定
- MOVED: #69–#82

**Current implementation**
- `src/storage/types.ts` の将来 sync 向けコメントのみ。同期実装なし。

**Tests:** NOT_NEEDED

---

### #9 文脈別定義本文も検索対象にする

**Result:** PASS

**Completion criteria**
- PASS: `contextDefinitions.definition` を検索（`conceptSearch.ts`）
- PASS: 文脈別のみの語句でもヒット、複数文脈のいずれかで可
- PASS: タイトル・定義・解釈・タグ・メモ維持
- PASS: スニペット・ハイライト・文脈名（`conceptFilters.test.ts` / `search.ts`）
- PASS: 空検索は通常一覧
- PARTIAL: 「モバイル仮想スクロールで可変行高」は一覧実装依存。専用テストは未確認だが、検索マッチ型は実装済み

**Current implementation**
- `src/features/concepts/conceptSearch.ts`
- `src/features/concepts/conceptFilters.ts`
- `src/utils/search.ts`

**Tests:** SUFFICIENT（検索ヒットと文脈別定義）

---

### #10 分野カラー設定をバックアップ対象にする

**Result:** PASS

**Completion criteria**
- PASS: JSON/ZIP に `domainColors`
- PASS: import 復元・不正色除外・旧バックアップ互換
- PASS: IndexedDB 層は localStorage を直接触らない分離
- PASS: UI 即時反映（`SettingsPage` が `restoreDomainColorsFromBackup`）

**Current implementation**
- `src/utils/domainColors.ts`
- `src/utils/conceptBookZip.ts`
- `src/components/SettingsPage.tsx`

**Tests:** SUFFICIENT（`domainColors.test.ts`, `conceptBookZip.test.ts`, `conceptImportValidation.backupDomainColors.test.ts`）

---

### #11 学習ログをバックアップ対象にする

**Result:** PASS_WITH_FOLLOW_UP

**Completion criteria**
- PASS: `quizAttemptLogs` を JSON/ZIP バックアップへ
- PASS: merge は id 重複防止、replace は置換
- PASS: 不正ログ個別スキップ、欠落時互換
- PASS: 理解度はログから再計算（派生ストアなし）

**Current implementation**
- `src/storage/types.ts` `BackupExportData`
- `src/storage/indexeddb.ts` import/export
- `src/utils/conceptImportValidation.ts`

**Tests:** SUFFICIENT（`conceptImportValidation.quizAttemptLogs.test.ts`）

**Notes**
- Open #83（JSON 復元時 `QuizQuestion.source` 喪失の調査）はクイズ問題側の互換。学習ログ本体とは別だがバックアップ経路の後続リスク。

---

### #12 学習ログをエクスポートできるようにする

**Result:** PASS

**Completion criteria**
- PASS: Settings から CSV（`buildLearningLogCsv`）
- PASS: 1回答1行、日時・正誤・時間・問題・選択・正解・Concept・Deck
- PASS: 現在の Concept 名補助、削除済みは ID 保持
- PASS: UTF-8 BOM、CSV エスケープ
- PASS: 読み取り専用（データ変更なし）
- PASS: バックアップ JSON/ZIP と役割分離

**Current implementation**
- `src/utils/quiz/learningLogExport.ts`
- `src/components/SettingsPage.tsx`

**Tests:** SUFFICIENT（`learningLogExport.test.ts`）

---

### #13 エクスポート時に学習ログの同梱有無を選択できるようにする

**Result:** PASS

**Completion criteria**
- PASS: チェックボックス「学習ログを含める」初期 ON、非永続
- PASS: JSON/ZIP 共通 `BackupExportOptions.includeQuizAttemptLogs`
- PASS: false で `quizAttemptLogs: []`、他データ維持
- PASS: 省略時は含む
- PASS: CSV 非連動
- PASS: 空配列の import 可能

**Current implementation**
- `src/storage/backupExport.ts`
- `src/components/SettingsPage.tsx`

**Tests:** SUFFICIENT（`backupExport.test.ts`）

---

### #14 クイズを共有できるようにする

**Result:** PASS_WITH_FOLLOW_UP

**Completion criteria**
- PASS: 共有単位・含める/含めない・再リンク・ID 衝突・非上書き import・visibility・バックアップ分離・対象外が本文で決定
- MOVED: 実装チェックリストは未実装のまま #84–#88 へ

**Current implementation**
- `src/types/quiz.ts` の visibility / share コメント
- 共有 JSON export/import UI は未実装。バックアップ ZIP/JSON のみ
- Deck/Question の `visibility` 編集は存在するが「共有パッケージ」ではない

**Tests:** NOT_NEEDED（本 Issue は仕様決定）

**Notes**
- 共有機能そのものは未達だが、完了条件は設計完了。実装未達は後続 Open Issue。

---

### #15 共有用ZIPを生成できるようにする

**Result:** OBSOLETE

**Completion criteria**
- PASS / OBSOLETE: 初期共有は JSON、ZIP は not planned。#14 方針に置換
- MOVED: JSON 実装は #84–#88。将来メディア込み ZIP は別 Issue

**Current implementation**
- 既存 ZIP は自分用バックアップ（`exportConceptBookPackage`）。共有専用 ZIP なし（意図どおり）

**Tests:** NOT_NEEDED

---

### #16 Deckの将来フィールドを整理する

**Result:** PASS

**Completion criteria**
- PASS: 正式フィールド整理、`generationFilters` を正式保存先
- PASS: `sourceDomainTag` は legacy 互換、新規保存しない
- PASS: IndexedDB/backup/import 統一（#99 で実装完了）
- PASS: DB_VERSION 非変更（読み込み時 hydrate）

**Current implementation**
- `src/types/quiz.ts`
- `src/utils/quiz/hydrateLegacyGenerationFilters.ts`
- `src/utils/quiz/buildDomainTagGeneratedDeckFields.ts`
- `src/utils/syncQuizDeckFromFilters.ts`

**Tests:** SUFFICIENT（`generationFiltersNormalize.test.ts`, `conceptImportValidation.quizDecks.test.ts`）

---

### #17 大規模データ時の概念グラフ表示を改善する

**Result:** PASS_WITH_FOLLOW_UP

**Completion criteria**
- PASS: 200件段階表示、フィルタ先行、全件高速描画を目的にしない
- PASS: 全体/1-hop/2-hop
- PASS: ラベル常時表示 + スタイル LOD（#101 で確定）
- PASS: 規模別 simulation、topology 変更時のみ graphData 更新
- PASS: fixture + DEV Performance Harness
- PASS: 永続データ非変更
- MOVED: 個別操作性は #100–#112

**Current implementation**
- `src/components/ConceptGraphView.tsx`
- `src/utils/conceptGraphSimulation.ts`
- `src/utils/conceptGraphTestData.ts`
- `src/dev/ConceptGraphPerformanceHarness.tsx`
- `src/main.tsx`（DEV かつ `?graphPerf`）

**Tests:** SUFFICIENT（topology / simulation / testData / neighborhood / priority / lod）

---

### #18 ツリー表示のレイアウトを改善する

**Result:** PASS_WITH_FOLLOW_UP

**Completion criteria**
- PASS: subtree-aware レイアウトでカード間隔を確保（`skillTreeLayout.ts` の固定ギャップ）
- PASS: キャンバスがデータ量に応じて拡張、スクロール可能
- PASS: ズーム・パン、折りたたみ
- PASS: 少数ノードでも破綻しない決定的レイアウト
- PARTIAL: 「重なりが大幅に減った」は視覚定性。#53 がなお Open

**Current implementation**
- `src/utils/skillTreeLayout.ts`
- `src/components/SkillTreeView.tsx`

**Tests:** PARTIAL（`skillTreeLayout.test.ts`。視覚重なりの E2E なし）

**Notes**
- Open #53「ツリー表示のレイアウト改善」が残っており、追加改善余地あり。

---

### #19 学習回数を概念グラフ上に表示する

**Result:** PASS

**Completion criteria**
- PASS: 通常 / 学習回数モード切替
- PASS: 半径は `log1p` + 上限（破綻防止）
- PASS: 0回は「未学習」ラベル
- PASS: 分野リングと分離（サイズ・サブラベル）
- PASS: 理解度スコアとは別指標

**Current implementation**
- `src/utils/conceptGraphAttemptRadius.ts`
- `src/components/ConceptGraphView.tsx`

**Tests:** SUFFICIENT（`conceptGraphAttemptRadius.test.ts`）

---

### #52 一覧表示を大画面向けワークスペースレイアウトへ改善する

**Result:** PASS

**Completion criteria**
- PASS: 一覧は `max-w-7xl` 中央固定から外れ、`w-full` + 2カラム（一覧 | 詳細）
- PASS: 大画面で横幅を作業領域に使用（`lg:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)]`）
- PASS: 一覧と詳細を同時表示、狭い画面は `mobileDetail` 切替
- PASS: グラフ全面レイアウト維持
- PASS: ツリーも横並び詳細

**Current implementation**
- `src/app/App.tsx`

**Tests:** MISSING（レイアウトの自動テストなし。実装はコードで確認）

**Notes**
- 書き換え後の Issue 本文チェックボックスは未チェックだが、現 main の UI は条件を満たす。

---

### #99 QuizDeckのgenerationFiltersを正規化しsourceDomainTagを互換フィールド化する

**Result:** PASS

**Completion criteria**
- PASS: 正式保存先 `generationFilters`
- PASS: 新規自動生成 Deck に `sourceDomainTag` を載せない
- PASS: 旧データは読み込み時 hydrate、DB_VERSION 非変更
- PASS: 再同期は filters 優先、なければ sourceDomainTag、さらに domainTags 先頭
- PASS: 既存 generationFilters を上書きしない

**Current implementation**
- #16 と同一一式 + `src/storage/indexeddb.ts` の Deck 正規化

**Tests:** SUFFICIENT

---

### #100 概念グラフに選択概念の近傍表示モードを追加する

**Result:** PASS

**Completion criteria**
- PASS: 全体 / 1-hop / 2-hop
- PASS: 無向 BFS、選択自身を含む
- PASS: クリックで中心変更、モード維持
- PASS: フィルタ後集合のみ、フィルタ外経由なし
- PASS: 未選択・フィルタ外の空状態
- PASS: 近傍では 200件制限なし・「さらに表示」非表示
- PASS: 永続形式非変更

**Current implementation**
- `src/utils/collectConceptNeighborhood.ts`
- `src/components/ConceptGraphView.tsx`

**Tests:** SUFFICIENT（`collectConceptNeighborhood.test.ts`）

---

### #101 ズームレベルに応じて概念グラフの表示量を調整する

**Result:** PASS

**Completion criteria**
- PASS: スタイル LOD（far/medium/near）、間引きではない
- PASS: 全表示ノードのラベル常時表示
- PASS: selected / favorite 強調
- PASS: 純粋関数 `getConceptGraphLabelStyle`
- PASS: 1-hop/2-hop 共用、simulation 非変更、永続非変更

**Current implementation**
- `src/utils/conceptGraphLod.ts`
- `src/components/ConceptGraphView.tsx`

**Tests:** SUFFICIENT（`conceptGraphLod.test.ts`）

**Notes**
- #102 本文の「遠景でラベル非表示」は旧 LOD。現仕様は常時表示（#101/#108）。#102 実装（topology/simulation）は残っている。

---

### #102 大規模データ時のForceGraphシミュレーション負荷を制御する

**Result:** PASS

**Completion criteria**
- PASS: graphData は id のみ、描画情報は canvas 側
- PASS: topology signature 変化時のみ graphData 更新
- PASS: 明示 `d3ReheatSimulation` なし
- PASS: small/medium/large profile（200/500 境界）
- PASS: 永続非変更

**Current implementation**
- `src/utils/conceptGraphTopology.ts`（#109 で snapshot に統合）
- `src/utils/conceptGraphSimulation.ts`
- `src/components/ConceptGraphView.tsx`

**Tests:** SUFFICIENT（`conceptGraphTopology.test.ts`, `conceptGraphSimulation.test.ts`）

---

### #103 大規模概念グラフの性能基準とテストデータを整備する

**Result:** PASS

**Completion criteria**
- PASS: 決定的 fixture（件数・relation・seed）
- PASS: 大/小成分、孤立、hub、複数分野、favorite
- PASS: 無向・自己参照なし
- PASS: DEV 専用 Harness、production 非露出
- PASS: IndexedDB 非混入

**Current implementation**
- `src/utils/conceptGraphTestData.ts`
- `src/dev/ConceptGraphPerformanceHarness.tsx`
- `src/main.tsx`

**Tests:** SUFFICIENT（`conceptGraphTestData.test.ts`）

---

### #104 詳細パネル表示中も概念グラフの操作UIを利用できるようにする

**Result:** PASS

**Completion criteria**
- PASS: グラフ背面は操作可能、オーバーレイは `pointer-events-none`
- PASS: 詳細 aside は `pointer-events-auto`
- PASS: ツールバー（モード・収める・リセット・さらに表示）がパネル中もクリック可能
- PASS: グラフロジック非変更、永続非変更

**Current implementation**
- `src/app/App.tsx`（graph タブの overlay / aside）

**Tests:** MISSING（pointer-events の自動テストなし。コード構造で確認）

---

### #105 概念グラフの選択状態と詳細パネル表示状態を分離する

**Result:** PASS

**Completion criteria**
- PASS: `selectedId` と `graphDetailOpen` 分離
- PASS: 閉じても選択・リング・1-hop/2-hop 中心維持
- PASS: 再クリックでパネル再表示、削除時クリア
- PASS: #104 レイアウト維持

**Current implementation**
- `src/app/graphDetailUiState.ts`
- `src/app/App.tsx`

**Tests:** SUFFICIENT（`graphDetailUiState.test.ts`）

---

### #106 概念グラフの初期表示時に表示範囲を自動調整する

**Result:** PASS

**Completion criteria**
- PASS: simulation 停止後に1回 `zoomToFit`（`hasAutoFittedRef`）
- PASS: 固定 setTimeout 非依存、初回非空のみ
- PASS: 選択/favorite/zoom/pan/resize/さらに表示で再 fit しない設計
- PASS: 手動「全体を収める」「表示をリセット」維持

**Current implementation**
- `src/components/ConceptGraphView.tsx`

**Tests:** MISSING（auto-fit フラグのユニットテストなし）

---

### #107 概念グラフでフィルタ解除後に表示件数上限が縮小したまま残る問題を修正する

**Result:** PASS

**Completion criteria**
- PASS: `graphNodeLimit` をフィルタ件数へ clamp する effect は無い
- PASS: window は `slice(0, min(limit, ranked.length))` のため、フィルタ中は見かけ上縮小、解除後は limit が残る
- PASS: 近傍モード切替でも all 用 limit をリセットしない
- PASS: 「さらに表示」は all かつ未全表示のときのみ

**Current implementation**
- `src/components/ConceptGraphView.tsx`

**Tests:** MISSING（回帰の専用テストなし。コードパスで確認）

**Notes**
- 「さらに表示」は `Math.min(n+200, concepts.length)` のため、フィルタ中にボタンが出る状態で押すと limit がフィルタ件数へ上がる/固定されうる。現状 `canShowMoreGraph` が全件表示時は隠すため、#107 の主バグ（解除後に 200 へ戻る）は再発しない。

---

### #108 大規模概念グラフで常時表示ラベルの重なりを軽減する

**Result:** PASS_WITH_FOLLOW_UP

**Completion criteria**
- PASS: far で通常タイトル 12文字+省略、selected/favorite は全文
- PASS: stroke→fill ハロー
- PASS: 常時全ラベル、collision detection なし（Issue どおり）
- PARTIAL: 完全な非重なりは対象外。本文も残差を認める

**Current implementation**
- `src/utils/conceptGraphLod.ts`（`getConceptGraphLabelText`）
- `src/components/ConceptGraphView.tsx`

**Tests:** PARTIAL（省略ロジックは lod テスト。ハロー描画はなし）

**Notes**
- 残差の可読性は #112 等。

---

### #109 大規模概念グラフの描画・simulationを10,000 Concept規模へ最適化する

**Result:** PASS_WITH_FOLLOW_UP

**Completion criteria**
- PASS: topology snapshot で辺収集1回
- PASS: 初期 200 件、10,000 全描画は非目標
- PASS: viewport culling / very-large profile は根拠不足で未追加（本文どおり）
- PASS: 永続非変更
- MOVED: 数千ノード実描画は #112、ヒット領域は #111

**Current implementation**
- `src/utils/conceptGraphTopology.ts` `createConceptGraphTopologySnapshot`
- `src/components/ConceptGraphView.tsx`
- `docs/concept-graph-performance.md`

**Tests:** SUFFICIENT（topology 統合テスト）

---

### #110 概念グラフの表示ノードを関連度・優先度に基づいて選択する

**Result:** PASS_WITH_FOLLOW_UP

**Completion criteria**
- PASS: 全体モードで選択中は priority ranking 上位を段階表示
- PASS: hop → activation → favorite → 元配列順
- PASS: spreading activation、加算せず max、フィルタ外は探索しない
- PASS: 1-hop/2-hop は既存 neighborhood 分岐
- PASS: mastery 等は初期対象外
- MOVED: #113–#119 等

**Current implementation**
- `src/utils/conceptGraphPriority.ts`
- `src/components/ConceptGraphView.tsx`
- `src/dev/ConceptGraphPerformanceHarness.tsx`

**Tests:** SUFFICIENT（`conceptGraphPriority.test.ts`）

---

## 横断メモ

### IndexedDB / import-export / backup

- `DB_VERSION` は 7。relatedIds 修復は upgrade と getAll 時。
- `domainColors` と `quizAttemptLogs` は optional 互換あり。
- Deck は読み込み時 hydrate。一括 migration なし。
- 共有 JSON は未実装（#14/#15 方針）。バックアップ ZIP と混同しないこと。
- Open #83 は QuizQuestion.source 復元の調査として残存。

### テスト不足（仕様保証が弱い Closed Issue）

- #1, #2, #52, #104, #106, #107: UI/操作の自動テストが無い、または足りない
- #4, #18, #108: 視覚表現のテストが部分的
- 設計 Issue（#6–#8, #14–#15）は NOT_NEEDED

### パフォーマンス

- 大規模グラフは段階表示 + ranking + topology snapshot + simulation profile。根拠のない culling は未導入で妥当。
- #2 のユーザー間隔調整 UI は現mainにない。性能問題ではなく、`not_planned` クローズに対する仕様再確認対象（`NOT_PLANNED_REVIEW`）。

### 監査中に行っていないこと

ソース修正、テスト追加、Issue 作成/reopen/close、PR、commit、push、merge、branch 削除は未実施。本ファイルの作成のみ。
