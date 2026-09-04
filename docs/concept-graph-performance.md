# Concept グラフ性能確認

ConceptBook の概念グラフについて、200 / 500 / 1000 Concept 程度の疑似データを **再現可能な条件** で生成し、既存の `ConceptGraphView` で手動確認するための手順です。

性能検証用 Concept は **メモリ上のみ** で扱い、IndexedDB には保存しません。本番ビルドではこの画面は起動できません。

## 起動

```bash
npm run dev
```

開発サーバー起動後、次の URL を開きます。

## Fixtures

| 規模 | URL |
| --- | --- |
| 200 Concept | http://localhost:5173/?graphPerf=200 |
| 500 Concept | http://localhost:5173/?graphPerf=500 |
| 1000 Concept | http://localhost:5173/?graphPerf=1000 |

任意パラメータ:

- `relations` — 平均次数の目標（省略時 4）
- `seed` — 決定的生成の種（省略時 103）

例: `http://localhost:5173/?graphPerf=1000&relations=4&seed=103`

### 任意の大規模 fixture

必要なら `?graphPerf=2000` や `?graphPerf=5000` も同じ生成器で確認できます。件数を増やしたときの体感は端末依存です。CI の合否には使いません。

## 手動チェックリスト

### 初期描画

- [ ] グラフを開ける
- [ ] ブラウザ全体が長時間操作不能にならない
- [ ] ノード・エッジが描画される
- [ ] UI 操作を継続できる

### 段階表示（1000 Concept）

`?graphPerf=1000` で開き、「さらに表示（+200）」を使って次の件数まで進める。

- 200 → 400 → 600 → 800 → 1000

確認:

- [ ] さらに表示でノードが追加される
- [ ] UI が操作可能
- [ ] simulation が無期限に動き続けない

### zoom

- [ ] zoom in が利用できる
- [ ] zoom out が利用できる
- [ ] 操作不能にならない

### pan

- [ ] グラフを移動できる
- [ ] 極端な入力遅延が起きない

### drag

- [ ] ノードをドラッグできる

### Concept 選択

- [ ] node click が反応する
- [ ] 選択リングが表示される

### 1-hop

- [ ] Concept を選択する
- [ ] 1-hop へ変更する
- [ ] 描画対象が縮小される
- [ ] 操作可能

### 2-hop

- [ ] 2-hop へ変更する
- [ ] 正常に描画される

### LOD / ラベル（Issue #108）

ラベルは間引かず、表示中の全 Concept に何らかのラベル文字列を描画する。遠景の通常タイトルだけ先頭 12 文字 + `…` に省略し、`strokeText` ハローで関連線と文字を分ける。ラベル背景矩形・位置分散・collision detection・leader line は使わない。

#### far (`globalScale < 0.8`)

- [ ] 全 Concept のラベルが存在する
- [ ] 通常 Concept の長いタイトルは省略表示される
- [ ] 短いタイトルはそのまま表示される
- [ ] selected は全文表示される
- [ ] favorite は全文表示される
- [ ] ハローが描画され、関連線と文字を区別しやすい
- [ ] 文字は小さく・薄く表示される（selected / favorite は強調）

#### medium (`0.8 <= globalScale < 1.5`)

- [ ] 全ラベルを維持する
- [ ] タイトルは全文表示
- [ ] ハローを維持する
- [ ] 遠景より読みやすくなる

#### near (`globalScale >= 1.5`)

- [ ] タイトル全文を確認できる
- [ ] ハローによって背景・関連線から文字を識別できる
- [ ] 通常サイズでタイトルを確認できる

#### 優先表示

- [ ] 選択中・favorite は通常ノードより強調されるが、他のラベルは消えない
- [ ] far でも selected / favorite の名前は省略されない

### タイトル filter

- [ ] 絞り込みが完了する
- [ ] グラフが更新される
- [ ] filter 解除後に正常に戻る

### 分野タグ filter

- [ ] 絞り込みが完了する
- [ ] グラフが更新される
- [ ] filter 解除後に正常に戻る

## 性能基準

CI で FPS や描画ミリ秒の固定閾値は使いません。

最低目標（1000 Concept）:

- ブラウザが操作不能にならない
- zoom / pan / drag / node selection が利用できる
- filter が完了する
- 1-hop / 2-hop が利用できる
- simulation が無期限に継続しない

### 1000 Concept（手動確認）

完全な collision avoidance は求めない。far 通常タイトルの短縮とハローで、全長タイトル × 1000 と線・文字の直接重なりより密集感と混線が軽減されているかを見る。

- [ ] far の文字密集感が以前より軽減されている
- [ ] 長いタイトルが画面を横方向へ過剰に占有しにくい
- [ ] selected / favorite を読み取れる
- [ ] zoom / pan / drag / node selection が利用可能
- [ ] 1-hop / 2-hop が利用可能
- [ ] ブラウザが長時間操作不能にならない

Performance API の値は参考情報として使ってよいですが、テスト失敗条件にはしません。
