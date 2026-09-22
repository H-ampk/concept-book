# Private Sync データモデル

Issue #70 の対象は、クラウド push / pull ではなく **Private Sync 用の共通データモデル・validation・adapter** です。

```text
Domain Data
  → Sync Adapter
  → Private Sync Record
  → (将来) Cloud
```

逆方向も Cloud の unknown を無検証で IndexedDB へ書きません。

```text
Cloud unknown
  → Validation（レコード単位）
  → Sync Adapter / Domain Data
  → (将来) IndexedDB
```

IndexedDB の主データは引き続き Domain 型（Concept 等）です。既存レコードを PrivateSyncRecord へ置き換える migration は行いません。

## 認可

`metadata.ownerUserId` はクライアントが保持する所有者の記録です。**クライアントから送られた ownerUserId をクラウド側の認可根拠にしてはなりません。**

```text
NG  client → ownerUserId = "abc" → server がそのまま信用
OK  authenticated session → JWT → auth.uid() → owner 判定
```

deviceId もアクセス許可の認証情報ではありません。

## Private Sync ≠ Public Snapshot

`PrivateSyncRecord` に `visibility: "public"` のような公開制御は載せません。

```text
Private Sync Record
≠ Public Concept Snapshot
≠ Public Context Card Snapshot
```

QuizQuestion / QuizDeck の Domain `visibility`（private / shareable）は共有用 export 用であり、Private Sync の RLS / ACL ではありません。将来の公開機能は #78 / #79 側の別モデルです。

## Blob

`media` と `learningMaterial` はメタデータ・参照のみです。画像 / 動画 Blob および PDF Blob のアップロードは #76 等の対象外です。

## 設定の allowlist

同期するのは明示したキーだけです。未知の設定はデフォルトで localOnly です。

同期対象:

- `domainColors`
- `themeSettings`

localOnly の例:

- `aiSettings`（端末ローカルの Ollama URL 等）
- API key / access token / refresh token / Supabase session / secret / credential

## 同期戦略

- 編集可能データ: `versioned`（競合検出は将来 version を使う。updatedAt のみの Last Write Wins は標準にしない）
- `quizAttemptLog`: `append-only`（作成後に編集しない。同一 ID は重複保存しない。端末間では ID 単位で統合）

## tombstone

`metadata.deletedAt` があれば削除済みとして表現できます。保持期間・GC・クラウド delete・IndexedDB との実同期は未実装です（#74）。

## ID

新規生成用に `createEntityId("concept")` → `concept_<uuid>` を用意しています。**既存 ID の一括変換は禁止**です（relatedIds 等の参照が壊れるため）。current main の既存ジェネレータ置換は後続候補です。
