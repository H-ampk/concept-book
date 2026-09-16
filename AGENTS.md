# ConceptBook 開発エージェント向け手順

この文書は、ConceptBook の実装完了判断と検証の標準手順です。ツール固有の設定（`.cursor/rules` など）へ移す場合も、この内容を正とします。

変更リスクに応じて検証の厚みを選びます。全 Issue で巨大なブラウザ検証を要求しません。

## 特に重要な原則

ユーザーが画面上で直接触る挙動を変更した場合、通常テストだけで完了とせず、原則として実ブラウザで主要ユーザーフローを確認する。

実ブラウザ検証で発見した不具合は、修正後に同じ操作で再検証し、可能なら適切な層へ回帰テストを追加する。

「コード上は正しそう」「テストが通った」だけで、ユーザーが直接操作する主要フローの確認を省略しない。

## Definition of Done

実装完了の判断は次の流れとする。

```text
実装
↓
unit / component test
↓
typecheck
↓
build
↓
E2E
↓
必要な場合は実ブラウザ検証
↓
不具合修正
↓
回帰テスト追加
↓
最終回帰
```

リスクに応じた目安:

```text
pure function 変更
→ unit test 中心

単純な button 追加
→ component + 短い browser 確認

新しいユーザーフロー
→ component + E2E + browser

PDF / file / IndexedDB / import-export
→ unit + E2E + browser で一連の flow
```

## 通常テスト

実装完了後、原則として次を実行する。

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
```

既存テストを削除・skip して成功扱いにしない。今回の変更と無関係な既知の失敗がある場合は、報告で明示する。

## 実ブラウザ検証を必須とする変更

次のいずれかに該当する場合、原則として実ブラウザ検証を行う。Cursor Browser または Playwright Chromium 等を使い、実際のユーザー操作として確認する。

- 新規画面
- 既存画面の主要 UI 変更
- modal / dialog
- drag & drop
- text selection
- file upload
- PDF
- Canvas
- SVG
- connector / overlay
- responsive layout
- mobile UI
- scroll 連動 UI
- resize 連動 UI
- IndexedDB を伴う複数ステップ操作
- import / export
- ZIP
- backup / restore
- navigation
- reload 後の永続化
- 非同期レンダリングが絡む UI
- 複数コンポーネントをまたぐユーザーフロー

判断はファイル種類ではなく、**変更によるユーザー体験への影響**で行う。内部ロジックでも操作結果が変わるなら実ブラウザ対象とする。

## 実ブラウザ検証を省略できる変更

十分な unit test 等がある場合、次のような変更は実ブラウザを必須にしない。

- pure utility
- 型定義のみ
- 学習モデルの数式処理
- データ集計ロジック
- 時刻正規化
- validation
- parser
- serializer
- UI に影響しない内部 refactor

省略した場合は、完了報告で「なぜ不要と判断したか」を一言書く。

## 実ブラウザで最低限確認すること

対象機能に応じて必要な項目を選ぶ。全部を毎回やる必要はない。

**Happy path**  
ユーザーが通常行う主要操作を最初から最後まで通す。

**Persistence**  
必要な場合: reload、画面再訪、IndexedDB 再読込のあとも状態が残ること。

**Resize / Responsive**  
レイアウト変更では Desktop、narrow desktop / tablet、mobile。最低限 desktop と mobile で主要操作が成立すること。tablet 固有 layout がある場合は tablet も対象。

**Scroll**  
追従 UI がある場合: window scroll と nested scroll container。

**Runtime error**  
uncaught exception、React error、IndexedDB error、browser console error、worker error、network failure。

**Visual state**  
位置・重なり・描画順が重要な場合は代表スクリーンショットを残す（responsive、connector、overlay、PDF、graph、modal、複雑な layout、import 後の復元画面）。軽微な変更で大量の画像を commit する必要はない。artifact の一時保存でよい。

## 不具合を見つけたとき

場当たり修正の前に整理する。

```text
再現手順
期待結果
実際の結果
原因
影響範囲
```

その後:

- current architecture を維持する
- 最小限の修正にする
- 無関係な refactor を混ぜない

## 修正後の再検証

実ブラウザで見つけた不具合を直したら、**同じ操作をもう一度実行し、実ブラウザ上で解消したことを確認する。** コードを読んで「直ったはず」で終了しない。

実ブラウザ検証・修正のあと、もう一度通常テスト（上記 4 コマンド）を実行し、別機能を壊していないことを確認する。

## 回帰テストの層

すべてを E2E に押し込まない。

```text
pure logic
→ unit test

component interaction
→ component test

複数画面・永続化・ファイル操作
→ Playwright E2E

視覚座標・ブラウザ依存
→ utility test + 必要最小限の E2E
```

E2E の本数を増やすこと自体を目的にしない。避けるもの:

- timing 依存
- animation 依存
- 座標の過剰な pixel 完全一致
- 不安定な任意 sleep
- 不安定な manual mouse movement

可能なら deterministic fixture、semantic locator、observable な UI 状態、pure utility へ分解する。

## Fixture

PDF、ZIP、import data 等が必要な場合は再現可能な fixture を使う。生成 script を置く場合:

- production dependency を無駄に増やさない
- deterministic に生成できる
- サイズを必要以上に大きくしない

## 実データ保護

ユーザーが通常利用している local データを破壊しない。replace import、DB clear、destructive migration、ZIP restore はテスト用 browser context / test DB / Playwright context で行う。通常利用している dev server の IndexedDB を不用意に replace しない。

## IndexedDB

schema 変更時は version upgrade、migration、既存 store 保持、old data preservation を確認する。可能なら migration test を追加する。実ブラウザで確認できる変更では、upgrade 後の主要フローも確認する。

## import / export

backup / ZIP / JSON 等を変えた場合、ファイル生成成功だけでは足りない。

```text
export
↓
import
↓
実際に復元データを開く
```

metadata だけ復元されている状態を成功扱いにしない。

## Accessibility

modal / dialog / button / interactive UI を変える場合、semantic element、accessible name、keyboard、Escape、focus、dialog semantics など、既存方針を壊していないか確認する。可能ならテストも追加する。

## 完了報告に含めること

```text
変更ファイル
新規ファイル

実装内容

追加・変更したテスト

npm test
npm run typecheck
npm run build
npm run test:e2e

実ブラウザ検証
- 実施した / 不要と判断した
- 確認した主要フロー
- 発見した不具合
- 修正後の再検証

残っている既知の制約
```
