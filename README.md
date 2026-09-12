# ConceptBook

ConceptBook は、Concept の記録・整理から、関連概念、Concept Graph、Skill Tree、Context Card、Quiz、学習ログ、理解度推定、学習モデル、Data Lab、Research Report、ローカル AI 補助までを一つのブラウザアプリにまとめた、**ローカルファーストの概念学習・分析アプリ**です。

データは端末内の IndexedDB を source of truth とします。GitHub Pages はアプリ配信のみで、自動クラウド同期はありません。

## 主な機能

### Concept 管理

Concept の登録・編集ができます。現行の主なフィールドは次のとおりです。

- タイトル
- 定義
- 自分の解釈（`myInterpretation`）
- メモ
- 出典（書籍名・ページ・著者）
- 分野タグ（`domainTags`）
- 研究タグ（`researchTags`）
- 関連 Concept（無向の `relatedIds`）
- 文脈別定義（`contextDefinitions`）
- ステータス（稼働中 / 調査中 / 未整理 / 下書き / 保管）
- お気に入り
- 画像・動画メディア（本体は IndexedDB の `media` ストア。Concept 側は参照のみ）

一覧では検索、分野タグ、研究タグ、ステータス、お気に入り、BKT 理解度の概観フィルタが使えます。関連 Concept はルールベースの候補提示に加え、AI を有効にした場合はローカル Ollama による候補提示もできます（後述）。

### 可視化

**Concept Graph**

- 表示モード: 全体 / 1-hop / 2-hop
- 初期表示は 200 件。さらに表示で +200 ずつ追加
- selected がある全体表示では priority ranking（hop 距離と activation）
- LOD: 遠景では通常タイトルを先頭 12 文字に省略。selected / favorite は全文
- 分野タグごとの色（ノード外周。最大 4 色）
- 学習回数 / 正答率 / BKT 理解度によるノード表示切替
- 誤答混同の補助表示（direct / k-NN）

**Skill Tree**

関連 Concept を無向グラフとして扱い、選択した Concept を根にした BFS ツリーを描画します。分野色の表示と段階表示があります。前提スキルの固定階層ではありません。

詳細な性能検証手順と 2026-09-04 時点の実測は [docs/concept-graph-performance.md](docs/concept-graph-performance.md) を参照してください。

### Context Card

文脈カードは、授業ノートや資料まとめのような「場面」を残すための記録です。現行フィールドは次のとおりです。

- タイトル
- 分野タグ
- 中心的な問い
- 背景
- 流れ
- 重要概念
- リンク済み Concept

重要概念から Concept を同期生成することもできます。Quiz の生成元にもなります。

### Quiz

- **Quiz Question**: 四択問題。プロンプト、選択肢、正解、解説、visibility（`private` / `shareable`）
- **Quiz Deck**: 問題 ID の集まり。タイトル、説明、`deckKey`、分野タグ、自動生成メタデータを持てる
- 生成元:
  - Concept の文脈別定義
  - Context Card
  - 分野タグ（デッキの自動生成・再同期）
  - 手動作成
- 学習: 自由学習、または Deck 単位
- 回答は `QuizAttemptLog` として保存（正誤、反応時間、スナップショットなど）
- 学習ログ画面、分析ダッシュボード（正答率、反応時間、概念別集計、混同ペアなど）

選択肢の distractor は同一文脈・関連文脈・同一分野・ランダムなどから集めます。生成品質が低い場合は警告が出ます。

`shareable` は問題・デッキの分類フラグです。current main に、共有用だけを書き出す専用 export はありません。自分用バックアップは JSON / ZIP です。

### 学習モデル

学習状態を単一の「総合理解度」には合成しません。役割の異なる指標を別々に扱います。

| モデル | 役割 | IndexedDB 保存 |
| --- | --- | --- |
| BKT | Concept の習得状態推定 | しない（ログから再計算） |
| PFA | 次回正答確率 | しない |
| HLR | 記憶保持（半減期・保持確率） | しない |
| IRT | 未導入 | — |

詳細は [docs/learning-models.md](docs/learning-models.md)、IRT 不採用判断は [docs/irt-feasibility.md](docs/irt-feasibility.md) を参照してください。

### Data Lab

学習ログまたは Concept データを条件指定して探索します。

学習ログ分析:

- フィルタ（期間、Concept、分野タグ、Deck、正誤）
- 集計軸（Concept / 分野 / Deck / 日 / 週 / 月）
- 表示: テーブル、折れ線、棒グラフ、散布図、ヒストグラム
- 指標例: 回答数、正答率、平均回答時間、BKT 理解度、PFA 次回正答確率、HLR 記憶保持率 / 半減期 / 経過日数
- CSV export（フィルタ済みログ、集計結果、予測評価データ）
- 学習モデル評価（BKT と PFA の one-step-ahead。Brier score / Log loss）

Concept データ分析では、充足状況・関係数・文脈別定義の有無などを集計します。

### Research Report

2 系統あります。

1. **ルールベースの Markdown レポート**  
   学習ログと混同集計から文章を生成し、クリップボードへコピーします。LLM は使いません。
2. **保存済み研究レポート**  
   Data Lab の分析結果をスナップショットとして IndexedDB に保存します。新規レポート、または既存レポートへの追記ができます。コメント編集とブロック削除ができます。

保存済みレポートは **JSON / ZIP バックアップ対象外** です。

### AI（ローカル Ollama）

設定の「ローカルAIを有効にする」がオフのときは、ConceptBook 本体はそのまま使えます。有効化してもクラウドへ自動送信はしません。通信先は設定した Ollama endpoint（既定 `http://localhost:11434`）だけです。

実装されている範囲:

- Provider: Ollama のみ
- text provider（生成）
- embedding provider
- 関連 Concept 候補（Embedding で近傍を取り、生成モデルで理由付き候補を返す）
- 設定画面からの接続確認・モデル一覧取得（ボタン操作時のみ）

AI は Concept / Quiz などの正式データを自動変更しません。関連候補の追加はユーザー操作です。Embedding キャッシュは本体 DB とは別の IndexedDB（`concept-book-ai-cache`）に置き、バックアップには含めません。

## データ保存

**IndexedDB（`concept-book-db`）が source of truth** です。同一オリジン内のローカル保存で、端末・ブラウザごとに分離されます。

| 保存先 | 内容 |
| --- | --- |
| `concepts` | Concept |
| `media` | 画像・動画本体 |
| `contextCards` | Context Card |
| `quizQuestions` | Quiz Question |
| `quizDecks` | Quiz Deck |
| `quizAttemptLogs` | 学習ログ |
| `researchReports` | 保存済み研究レポート |

学習モデルの推定値（BKT / PFA / HLR）と one-step-ahead 評価は derived data であり、保存しません。

localStorage に置く設定:

- テーマ（`concept-book-theme-settings`）
- AI 設定（`concept-book-ai-settings`）
- 分野タグ色（`concept-book-domain-colors`。バックアップ JSON にも含められる）

ブラウザデータ削除や PWA 削除でローカルデータが失われる場合があります。

## Backup / Import / Export

設定画面から操作します。

### ZIP パッケージ（推奨・メディア付き）

`concepts.json` と `media/{mediaId}` を含む ZIP です。

含めるもの:

- Concept（定義・メモ・出典などを平文で）
- Context Card
- Quiz Question / Quiz Deck
- 学習ログ（オプション。既定は含める）
- メディア本体
- 分野タグ色（JSON 側）

含まないもの:

- 保存済み Research Report
- AI Embedding キャッシュ
- テーマ設定 / AI 設定

取り込みモードは `merge`（既存と統合）と `replace`（全置換）です。

### JSON バックアップ

ZIP と同じメタデータ（Concept、Context Card、Quiz、任意の学習ログ、分野タグ色）を JSON ファイルとして保存します。**画像・動画のバイナリは含みません。** メディア込みの移行には ZIP を使ってください。

### その他の書き出し

- 設定画面: 学習ログ CSV
- Data Lab: フィルタ済みログ / 集計 / 予測評価の CSV

バックアップには平文の研究メモが含まれます。クラウド共有や公開リポジトリに置かないでください。インポートは信頼できるファイルのみ使ってください。

## 通信・プライバシー

- 通常データは IndexedDB にローカル保存します。自動クラウド同期はありません。
- GitHub Pages はアプリ配信です。公開 URL 上でもデータは閲覧者の端末内に残ります。
- アプリ本体の `src` で `fetch()` を使うのは、Ollama client（`src/features/ai/providers/ollamaClient.ts`）です。axios / WebSocket による外部送信はありません。
- AI が無効のときは、text / embedding provider は通信せずエラーを返します。接続確認もユーザー操作時のみです。
- AI を有効にした場合、設定したローカル Ollama endpoint とだけ通信します。送信内容は関連候補用の Concept スナップショット（タイトル・定義・自分の解釈など）に限定し、メモ・出典・メディアは含めません。
- PWA の Service Worker はキャッシュ目的です。同期 API ではありません。

## セットアップ

```bash
npm install
npm run dev
```

その他の script（`package.json`）:

```bash
npm run build
npm test
npm run typecheck
npm run preview
npm run test:e2e
```

Node.js の必須バージョンは repository の `package.json` には固定していません。CI（`.github/workflows/`）は Node.js 20 で実行しています。

## GitHub Pages 公開

このリポジトリ（`concept-book`）は GitHub Pages で公開できます。

- 公開URL形式: `https://<username>.github.io/concept-book/`
- デプロイは `.github/workflows/deploy.yml` で `main` ブランチ push をトリガーに自動実行されます

### 公開手順

1. GitHub の `Settings > Pages` で **Source = GitHub Actions** を選択
2. `main` ブランチへ push
3. GitHub の `Actions` タブで `Deploy to GitHub Pages` が成功したことを確認
4. 上記 URL を開いてアプリ表示を確認

### ローカルビルド確認

```bash
npm run build
```

`dist/` が Pages 公開対象になります。

## 技術構成

- React 18
- TypeScript
- Vite
- Tailwind CSS
- IndexedDB
- PWA（`vite-plugin-pwa`）
- Vitest
- Playwright
- `react-force-graph-2d`（Concept Graph）
- Recharts（Data Lab）
- fflate（ZIP）
- Zod（入力検証）

## Documentation

機能仕様・研究メモ:

- [学習モデル（BKT / PFA / HLR / 評価）](docs/learning-models.md)
- [IRT 導入可能性調査](docs/irt-feasibility.md)
- [Concept Graph 性能確認](docs/concept-graph-performance.md)
- [テーマシステム](docs/theme-system.md)
- [UI 装飾（Ornaments）](docs/ui-ornaments.md)

開発履歴:

- [Closed issue audit（2026-09-04 時点の snapshot）](docs/closed-issue-audit.md)
