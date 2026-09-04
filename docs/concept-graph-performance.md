# Concept グラフ性能確認

ConceptBook が約 10,000 Concept を保持することを前提に、疑似データを **再現可能な条件** で生成し、既存の `ConceptGraphView` で手動確認するための手順です。

性能検証用 Concept は **メモリ上のみ** で扱い、IndexedDB には保存しません。本番ビルドではこの画面は起動できません。

今回の目的は 10,000 Concept を常に全部描画することではありません。基本構造は次のままです。

```text
10,000 Concept を保持
↓
既存フィルタ
↓
全体 + selected あり → priority ranking → 200件段階表示
全体 + selected なし → 既存順 → 200件段階表示
1-hop / 2-hop → 近傍抽出
↓
displayedConcepts
↓
ForceGraph2D
```

## 起動

```bash
npm run dev
```

開発サーバー起動後、次の URL を開きます。Harness 上部の `200` / `1k` / `2k` / `5k` / `10k` preset からも同じ条件へ切り替えられます。

## Fixtures

| 規模 | URL |
| --- | --- |
| 200 Concept | http://localhost:5173/?graphPerf=200 |
| 1,000 Concept | http://localhost:5173/?graphPerf=1000 |
| 2,000 Concept | http://localhost:5173/?graphPerf=2000 |
| 5,000 Concept | http://localhost:5173/?graphPerf=5000 |
| 10,000 Concept | http://localhost:5173/?graphPerf=10000 |
| 10,000（推奨再現） | http://localhost:5173/?graphPerf=10000&relations=4&seed=103 |

任意パラメータ:

- `relations` — 平均次数の目標（省略時 4）
- `seed` — 決定的生成の種（省略時 103）

Harness には生成 Concept 数、filter 後 Concept 数、edge 数、seed、averageRelations を表示します。DEV 専用の参考値として fixture 生成 / filter / edge 生成 / relation index / priority 計算の `performance.now()` も出します。selected がないときは priority 計算は `未選択`（既存順 fallback）です。固定ミリ秒・固定 FPS は CI の合否にしません。

計測用に `先頭を選択` / `選択解除` があります。グラフ上のノード click でも同じ selected を渡せます。

## 手動チェックリスト

### 初期描画（全規模共通）

- [ ] グラフを開ける
- [ ] 10,000 Concept 保持時も **初期表示は 200 件**
- [ ] ブラウザ全体が長時間操作不能にならない
- [ ] ノード・エッジが描画される
- [ ] UI 操作を継続できる

### 段階表示

「さらに表示（+200）」で次の件数まで進める。

- 200 → 400 → 600 → …

確認:

- [ ] さらに表示でノードが追加される
- [ ] UI が操作可能
- [ ] simulation が無期限に動き続けない
- [ ] 10,000 件全部を描画しなくても完了してよい

### zoom / pan / drag / 選択

- [ ] zoom in / zoom out
- [ ] グラフを移動できる
- [ ] ノードをドラッグできる
- [ ] node click が反応する
- [ ] 選択リングが表示される

### 1-hop / 2-hop

処理順は **既存フィルタ → 近傍抽出**。フィルタ外 Concept は経由しない。

- [ ] Concept を選択する
- [ ] 1-hop へ変更する
- [ ] 描画対象が縮小される
- [ ] 別 Concept を選んでも 1-hop を再計算できる
- [ ] 2-hop へ変更する
- [ ] 操作可能

### LOD / ラベル（Issue #108）

ラベルは間引かず、**表示中の全 Concept** に何らかのラベル文字列を描画する。遠景の通常タイトルだけ先頭 12 文字 + `…` に省略し、`strokeText` ハローで関連線と文字を分ける。ラベル背景矩形・位置分散・collision detection・leader line は使わない。

#### far (`globalScale < 0.8`)

- [ ] 全 Concept のラベルが存在する
- [ ] 通常 Concept の長いタイトルは省略表示される
- [ ] selected / favorite は全文表示される
- [ ] ハローが描画される

#### medium / near

- [ ] タイトルは全文表示
- [ ] ハローを維持する

### タイトル / 分野タグ filter

- [ ] 絞り込みが完了する
- [ ] グラフが更新される
- [ ] filter 解除後に正常に戻る

## 実測メモ（2026-09-04、DEV Harness、seed=103、relations=4）

端末差があるため比較用です。描画対象はいずれも **初期 200 件**（10,000 件同時描画は未実施）。

| 規模 | 生成 | filter後 | 全edge（filter後母集団） | fixture生成 | filter | 母集団edge生成 | 初期表示 | フリーズ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 200 | できた | 200 | 400 | 約 1.7 ms | 約 0.0 ms | 約 1.2 ms | 200 / 400 | なし |
| 1,000 | できた | 1,000 | 2,000 | 約 4.6 ms | 約 0.1 ms | 約 1.4 ms | 200 / 336。選択後 200 / 328 | なし |
| 2,000 | できた | 2,000 | 4,000 | 約 16.9 ms | 約 0.2 ms | 約 8.4 ms | 200 / 279 | なし |
| 5,000 | できた | 5,000 | 10,000 | 約 14.8 ms | 約 0.3 ms | 約 8.8 ms | 200 / 230。選択後 200 / 212 | なし |
| 10,000 | できた | 10,000 | 20,000 | 約 23.0 ms | 約 0.5 ms | 約 25.7 ms | 200 / 207（対象 10000 件中）。選択後 200 / 213 | なし |

### priority ranking（#110、2026-09-04、先頭 Concept を選択）

`rankConceptsForGraphFromIndex` のみの計測。index 構築は別表示。`graphNodeLimit` 変更では ranking をやり直さない。

| 規模 | selected | relation 数 | relation index | priority計算 | 表示件数 | フリーズ |
| --- | --- | --- | --- | --- | --- | --- |
| 1,000 | graph-test-00001 | 2,000 | 約 1.9 ms | 約 3.3 ms | 200（全体）。+200 で 400 | なし |
| 5,000 | graph-test-00001 | 10,000 | 約 18.0 ms | 約 9.4 ms | 200（全体） | なし |
| 10,000 | graph-test-00001 | 20,000 | 約 27.8 ms | 約 17.7 ms | 200（全体）。1-hop は 41 / 40 | なし |

### 主要ボトルネック（今回の実測範囲）

初期表示が 200 件のため、10,000 保持そのものは **Canvas 全件描画や Force simulation 全件実行にはなっていない**。

| 経路 | 今回の判断 |
| --- | --- |
| fixture 生成 | 10,000 件でも数十 ms。起動時の一回コスト。主要ではない |
| filter | 10,000 件でも 1 ms 未満。主要ではない |
| 母集団の edge 生成（Harness 表示用） | 10,000 件で約 30 ms。Harness の参考表示コスト。本番描画経路では **displayedConcepts に対する 1 回の topology snapshot** にまとめた |
| graph topology 準備 | 以前は signature 用と graphData 用で辺収集が二重だった。これを 1 回に削減した。表示 200 件では milliseond 以下 |
| Force simulation | 初期 200 件は既存 `small` profile。2000 / 5000 / 10000 **件を全部表示した状態** では測定していない。現状の主要ボトルネックとは判断せず、`very-large` は追加していない |
| Canvas node 描画 / `strokeText` / `fillText` | `react-force-graph-2d`（内部 `force-graph`）は **viewport 外でも** `graphData.nodes` 全件に対して `nodeCanvasObject` を呼ぶ。ただし描画対象は displayedConcepts（初期 200）なので、10,000 保持だけでは milliseond 級の描画ボトルネックにはなっていない |
| 近傍抽出 | 以前は selected 変更のたびに全 Concept から adjacency を再構築していた。同一 `concepts` なら relation index を再利用する。全体モードでも selected があるときだけ同じ index で priority ranking する |
| priority ranking | 10,000 件で十数 ms。O(V+E) の層単位 BFS + 1 回の sort。Canvas / zoom / pan では走らない |

## viewport culling

**実装しなかった。**

`force-graph` の `paintNodes()` は `graphData.nodes` を `nodeVisibility` で絞ったあと、各ノードで `nodeCanvasObject` を呼ぶ。画面外スキップはライブラリ既定ではない。

それでも今回は、10,000 保持時の描画集合が初期 200 件であり、画面外の大量 `strokeText` / `fillText` が主要ボトルネックだと確認できなかった。表示集合を増やさずに custom culling を足すと、余白・click / drag を壊すリスクだけが増えるため追加しない。

表示件数を数千まで上げたあとに Canvas が支配的になった場合の候補であり、そのときは #111 の hit area 変更と混ぜないこと。

## simulation profile

**`very-large` は追加しなかった。**

初期 200 件は `small`（〜200）、段階表示で 201〜500 が `medium`、501 以上が既存 `large`。2000 / 5000 / 10000 件を実際に表示し切った状態で simulation が明確な主要ボトルネックだとは確認していない。小〜中規模の操作感を変えないため、閾値を推測で切らない。

## 性能基準

CI で FPS や描画ミリ秒の固定閾値は使いません。

最低目標:

- 10,000 Concept を生成・保持できる
- 初期 200 件表示で画面を利用できる
- zoom / pan / drag / node selection が利用できる
- filter が完了する
- 1-hop / 2-hop が利用できる
- simulation が無期限に継続しない
- 10,000 件全部描画は完了条件ではない
