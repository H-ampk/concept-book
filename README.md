# Concept Book App

自分専用の「概念辞典 / 概念ネットワーク」を作るためのローカルファースト Web アプリです。  
哲学・教育工学・社会科学・シミュレーション領域の概念を、検索・編集・関連付けしながら蓄積できます。

## セットアップ方法

```bash
npm install
```

## 起動方法

```bash
npm run dev
```

本番ビルド:

```bash
npm run build
npm run preview
```

## データ保存方式

- 主要データは IndexedDB に保存されます（ブラウザローカル）。
- UI 層は `ConceptStorage` インターフェース越しにアクセスし、実装詳細に直接依存しません。
- 現在の実装は `IndexedDBStorage` です。

## JSON バックアップ方法

1. 画面上部の「設定」を開く
2. 「JSONを保存」でエクスポート
3. 「JSONインポート」でファイル選択して復元  
   - `merge`: 既存データと統合
   - `replace`: 既存データを置換

## 同期機能の将来拡張方針

- 既存の `src/storage/types.ts` の `ConceptStorage` を維持したまま、
  `SupabaseStorage` / `FirebaseStorage` を追加する構成を想定。
- UI 側は `getStorage()` で受け取る実装を差し替えるだけで移行可能。
- オフライン優先を維持する場合は、ローカルキャッシュ + バックグラウンド同期方式を想定。

## ディレクトリ構成（抜粋）

- `src/app`: アプリ全体の画面構成
- `src/components`: 再利用 UI コンポーネント
- `src/features/concepts`: 概念機能のロジック（hook / filter）
- `src/storage`: ストレージ抽象と IndexedDB 実装
- `src/types`: ドメイン型定義
- `src/utils`: 検索や日付などの補助処理
- `public`: manifest / icon などの公開アセット

## 実装済みフェーズ

- Phase 1: CRUD / 一覧・詳細 / 全文検索 / タグ絞り込み
- Phase 2: お気に入り / status / 関連概念リンク / JSON 入出力 / レスポンシブ UI / PWA
