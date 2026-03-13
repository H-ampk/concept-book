## Concept Book App

個人研究向けのローカルファースト概念辞典アプリです。

## セットアップ

```bash
npm install
npm run dev
```

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

## データ保存仕様

- 概念データはブラウザの `IndexedDB` に保存されます（同一オリジン内ローカル保存）。
- GitHub Pages 公開版でも、データは端末/ブラウザごとに分離されます。
- 既定では外部サーバーへ自動送信せず、自動クラウド同期もしません。
- JSONエクスポートはローカルファイルとして保存されます。
- 端末間で移行したい場合のみ JSON export / import を使用してください。
- ブラウザデータ削除や PWA 削除でローカルデータが失われる場合があります。

## セキュリティ注意（個人利用向け）

- JSONバックアップには、定義・メモ・出典などの**平文データ**が含まれます。
- バックアップファイルをクラウド共有や公開リポジトリに置かないでください。
- インポートは信頼できるファイルのみ利用してください（不正データ耐性は限定的です）。

## 現在の実装における通信

- アプリ本体（`src`）には `fetch` / `axios` / `WebSocket` などの外部送信処理はありません。
- PWA用の Service Worker はキャッシュ目的で動作しますが、同期API連携は未実装です。

## 将来同期機能を追加する場合の注意

- 認証・認可を先に設計し、匿名書き込みを防止する。
- 通信は HTTPS/TLS を前提にし、アクセストークンの保管場所を厳格化する。
- 競合解決ルール（`updatedAt` 優先など）を定義し、意図しない上書きを防ぐ。
- 研究メモを同期する場合は、必要に応じて暗号化（保存時/転送時）を検討する。
