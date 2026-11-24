# ConceptBook 開発エージェント向け手順

この文書は、ConceptBook の開発フロー、実装完了判断、検証の標準手順です。ツール固有の設定（`.cursor/rules` など）へ移す場合も、この内容を正とします。

main は安定ブランチとして維持する。変更は作業ブランチと Pull Request を経由し、GitHub Actions と CodeRabbit のレビューを確認してから main へ入れる。main への直接 push、main へのローカル直接 merge、force push、無断の履歴改変は行わない。

変更リスクに応じて検証の厚みを選びます。全 Issue で巨大なブラウザ検証を要求しません。

## 開発フロー

### 作業開始前

- `git status`、現在のブランチ、HEAD を確認する。
- `origin/main` の最新状態を確認する。
- 対象 Issue の内容、依存関係、既存実装を確認する。
- 重複する Issue や PR がないか確認する。
- 既存の未コミット差分や stash を破棄しない。
- 作業内容に関係しない変更を commit に含めない。

### ブランチ管理

原則として 1 Issue につき 1 作業ブランチを作成する。

命名規則:

- 機能追加: `feature/issue-<番号>-<概要>`
- バグ修正: `fix/issue-<番号>-<概要>`
- リファクタリング: `refactor/issue-<番号>-<概要>`
- ドキュメント: `docs/issue-<番号>-<概要>`
- テスト: `test/issue-<番号>-<概要>`

Issue 番号が存在しない場合は番号部分を省略できる。

禁止事項:

- main への直接 push
- main へのローカル直接 merge
- force push
- 無断での履歴改変
- 無関係な変更の混入

レビュー待ちの PR があっても、依存関係のない Issue は並行して実装してよい。条件は「レビュー運用」の並行開発に従う。競合する変更は原則として並行実装しない。

### 実装

- Issue の要求範囲を超えない。
- 必要最小限の変更を優先する。
- 既存データとの互換性を維持する。
- セキュリティやデータ整合性を損なわない。
- 必要に応じてテストを追加する。
- 未解決の問題を隠すためにテストや検証処理を弱体化しない。

検証の具体的な基準は、この文書の「通常テスト」以降を維持する。

### テストと commit

変更内容に応じて `package.json` と CI 設定を確認し、必要な検証を実施する。対象には Typecheck、Unit Test、Build、Lint、E2E Test、実ブラウザでの動作確認が含まれる。どれを必須とするかは後述のリスク区分に従う。

必要な検証が失敗した場合は、原則として push しない。既存の失敗や環境上の制約で実行できない検証がある場合は、その理由と影響を報告する。

commit には対象作業に関係するファイルのみを含める。

### Pull Request

実装と初期検証のあと、作業ブランチを push し、base を main とする Draft PR を作成する。

PR 本文には次を記載する。

- 対象 Issue
- 変更目的
- 変更内容
- 設計上の判断
- 影響範囲
- テスト結果
- 未実施の検証
- 残存課題
- 互換性・セキュリティへの影響

Issue を完全に解決する場合は `Closes #番号` を記載する。部分実装の場合は `Refs #番号` を使い、Issue を close しない。

レビューを依頼できる状態になり、レート制限の解除待ちでないときは Ready for review に変更する。利用枠が確保できるまでは Draft のままレビュー待ちキューに置ける。Draft の維持は、マージ条件の確認を省略する理由にしない。

### CodeRabbit によるレビュー

CodeRabbit のレビューを確認する。確認の対象は、最新 HEAD（最終レビュー対象 commit）に対するレビュー完了である。CI の成功は CodeRabbit 完了の代替にしない。CodeRabbit のチェック conclusion は `NEUTRAL` になり得る。これは CI ジョブ `unit` / `e2e` の success とは別である。

自動レビューが開始されない場合は、利用枠を確認したうえで PR コメント `@coderabbitai review` により手動レビューを依頼する。リポジトリのスター数が CodeRabbit の所定の閾値に満たないときは、自動レビューがスキップされることがある。閾値、スキップ理由、利用枠、解除条件は、その時点の CodeRabbit の応答を正とする。過去の「1 時間に 1 回」という表示は、恒久的な利用枠の仕様として固定しない。

レート制限中は、同じ HEAD への再依頼を繰り返さない。レビューを起動するためだけの空 commit を禁止する。未レビューの commit をレビュー済みと扱わない。追加 commit のあと、または main の取り込みで HEAD が変わったあとは、その commit に対するレビューが別途必要である。レビュー未実施とレビュー完了を混同しない。

通常レビュー、利用枠、並行作業、例外承認の詳細は「レビュー運用」に従う。

指摘は次のように分類する。

| 分類 | 対応 |
| --- | --- |
| セキュリティ上の問題 | 原則修正必須 |
| データ損失・整合性の問題 | 原則修正必須 |
| バグ・仕様違反 | 原則修正必須 |
| パフォーマンス上の問題 | 影響を調査して判断 |
| 保守性・可読性の問題 | 妥当性を確認して判断 |
| 軽微な提案 | 必要に応じて対応 |
| 誤検知・仕様との不一致 | 根拠を示して対応不要とする |

CodeRabbit の指摘を無条件に正しいものとして扱わない。既存仕様、実装、テスト、公式ドキュメントと照合し、妥当性を判断する。対応不要と判断した場合も、その理由を PR 上に記録する。

### レビュー後の修正

- 同じ作業ブランチ上で修正する。
- 修正箇所に関係するテストを再実行する。
- 必要に応じて回帰テストを追加する。
- 追加 commit を push する。
- CodeRabbit の再レビューを確認する。
- 新たな指摘が発生した場合は同様に検証する。

レビュー指摘が解決していない状態で、解決済みとして扱わない。

### マージ条件

次をすべて満たした場合にマージ可能とする。

- 対象 Issue を `Closes #番号` で完了させる PR の場合、その Issue の完了条件を満たしている。Issue がない PR、または `Refs #番号` の部分実装には、この条件を適用しない。
- 必要なテストが成功している。
- 必須 CI チェックが成功している。
- CodeRabbit のレビュー結果を確認している。
- 重大な未解決指摘がない。
- マージコンフリクトがない。
- 最終レビュー対象の commit が確認できている。
- ユーザーから明示的なマージ許可を得ている。

CodeRabbit のレビュー完了を、人間による最終承認の代替にしない。Cursor はユーザーの許可なく PR をマージしない。

並行開発、レビュー待ちキュー、レート制限中の待機は、このマージ条件を緩和しない。通常時に CodeRabbit 未レビューのままマージしない。長期障害時の例外は「レビュー運用」の例外手順に限り、その場合も未レビューをレビュー完了と記録しない。

### Issue の close

実装が完了し、PR が main へ正常にマージされた後にのみ、対象 Issue を完了扱いとする。

部分実装、検証未完了、残存課題がある場合は Issue を open のまま維持する。その状態でマージするときは、PR 本文の `Closes` などの自動 close キーワードを外し、`Refs #番号` に置き換えてからマージする。残したままマージすると、GitHub が Issue を close する。

`Closes` による自動 close が行われた場合は、重複して close 操作を実施しない。

## レビュー運用

この節は、通常レビュー、レート制限、サービス障害、例外承認、並行開発、レビュー待ちキュー、優先順位、main 更新後の再検証を定める。マージ条件、データ保護、実データ保護の方針は弱めない。

### 通常レビュー

- マージ前に、最新 HEAD に対する CodeRabbit のレビュー完了を確認する。
- 必須 CI の成功、重大な未解決指摘がないこと、ユーザーの明示的なマージ許可は、それぞれ別の条件として残す。
- 指摘の分類と対応は「CodeRabbit によるレビュー」に従う。対応不要と判断した場合は、その根拠を PR に残す。
- 自動レビューがスキップされた場合は、利用枠を確認してから `@coderabbitai review` で手動依頼する。スター数不足によるスキップもこの手順に含める。スキップの有無は CodeRabbit の応答で判断する。
- 利用枠を消費する操作は、後述の優先順位を確認してから行う。

### レート制限と短時間の障害

- PR は Open のまま待つ。実装済みで依頼できない PR は Draft のまま置ける。
- 解除条件（時刻、残回数、プラン上の included review など）を、PR または作業報告に記録する。数値と期限は CodeRabbit の実際の応答を書く。
- レート制限中の繰り返し依頼を禁止する。
- レビュー起動目的の空 commit を禁止する。
- 制限中でも、依存関係のない Issue の実装は止めてよい理由にしない。

### サービス障害と長期障害の例外

短時間の制限や障害では、上記のとおり待つのが通常手順である。通常のレビューが継続的に利用できない場合に限り、代替レビューによる例外マージを検討できる。例外は次をすべて満たすときだけとする。

- 最新 HEAD を確認している。
- 必須 CI（`unit` と `e2e`）が成功している。
- 別のレビュアー、または CodeRabbit 以外の手段で、その commit の差分を独立して確認している。
- 未解決の重大な問題がない。
- CodeRabbit を利用できない理由を記録している。
- 変更のリスクを評価している。
- 対象 commit を特定したユーザーの明示的な例外承認がある。Cursor はこの承認を推測で満たさない。包括的な事前承認は使わない。

次は通常の例外マージの対象外とする。CodeRabbit が復帰するまで待つか、ユーザーがその commit について対象外である旨を別途明示した場合だけ扱う。

- DB migration。
- データ損失の可能性がある処理。
- Import / Export の互換性変更。
- 認証・認可・RLS。
- Private Sync のユーザー分離。
- 学習モデルの数式、または研究結果の算出ロジック。

例外でマージしても、状態は「例外により未レビューのままマージした」と残す。CodeRabbit 未レビューをレビュー完了と書かない。この例外は、データ保護、IndexedDB、import / export の既存方針を緩めない。

### レビュー待ちと並行開発

CodeRabbit のレート制限やレビュー待ちで、開発全体を停止しない。

並行実装は次をすべて満たすときに限る。

- Issue ごとに独立した作業ブランチを使う。
- 必要に応じて git worktree を使う。
- 最新の `origin/main` を基準にする。
- 未マージの別 PR の変更を無断で取り込まない。
- 既存の未コミット差分と stash を破棄しない。
- 依存関係と変更ファイルの重複を事前に確認する。
- 競合する変更は原則として並行実装しない。

### レビュー待ちキュー

PR の状態を次のように区別する。レビュー未実施を、レビュー完了や最終承認待ちと混同しない。

- 実装中
- ローカル検証中
- レビュー依頼待ち
- レート制限解除待ち
- レビュー中
- 指摘対応中
- 再レビュー待ち
- 最終承認待ち
- マージ済み

### レビューの優先順位

利用枠を消費する操作の原則順は次のとおりとする。実際の順は、Issue の重要度と依存関係で決める。

1. 緊急のセキュリティ修正、またはデータ損失対策。
2. 他の Issue をブロックしている PR。
3. 既にレビューを受け、修正後の再レビューを待つ PR。
4. 通常のバグ修正、または機能追加。
5. 独立した軽微な改善、またはドキュメント変更。

### main 更新後の再検証

別の PR が main にマージされたら、後続 PR について次を確認する。

- 最新 main との差分。
- マージコンフリクト。
- 依存関係。
- 仕様や開発ルールの変更。
- 既存レビュー結果への影響。

必要に応じて作業ブランチを最新化し、関係するテストを再実行する。最新化で HEAD が変わった場合は、既存レビューが新しい HEAD に対して有効か確認し、必要な再レビューを行う。利用枠を節約するために、必要な再検証や再レビューを省略しない。

## 特に重要な原則

ユーザーが画面上で直接触る挙動を変更した場合、通常テストだけで完了とせず、原則として実ブラウザで主要ユーザーフローを確認する。

実ブラウザ検証で発見した不具合は、修正後に同じ操作で再検証し、可能なら適切な層へ回帰テストを追加する。

「コード上は正しそう」「テストが通った」だけで、ユーザーが直接操作する主要フローの確認を省略しない。

## Definition of Done

実装完了の判断は次の流れとする。

```text
作業開始前の確認
↓
作業ブランチ作成
↓
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
↓
作業ブランチへ commit / push（必要な検証が失敗している場合は原則 push しない）
↓
base を main とする Draft PR
↓
必須 CI
↓
CodeRabbit レビューと対応（利用枠待ちの間は Draft のまま。依存のない Issue は並行して進めてよい）
↓
Ready for review
↓
ユーザーの明示的なマージ許可
↓
main へマージ
↓
`Closes` の PR だけ Issue を完了扱い（自動 close 済みなら重複 close しない。残作業がある場合はマージ前に `Refs` へ置き換える）
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

ローカル検証の成功だけでは作業完了としない。main へのマージと Issue の完了は、上記のマージ条件と Issue close の規則に従う。

実装検証として、これまでどおり次を含める。

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

各実装作業の終了時には、あわせて次を報告する。未確認の項目は未確認と明記する。

1. 作業開始時の HEAD
2. 既存の未コミット差分
3. 対象 Issue
4. 作業ブランチ
5. 変更ファイル
6. 実装内容
7. テスト結果
8. commit hash
9. PR 番号・URL
10. CI の状態
11. CodeRabbit のレビュー状態
12. レビュー指摘と対応内容
13. 残存課題
14. マージ可能かどうか
15. ユーザーの承認が必要な事項
