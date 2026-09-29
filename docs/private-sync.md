# Private Sync データモデル

Issue #70 の対象は、クラウド push / pull ではなく **Private Sync 用の共通データモデル・validation・adapter** です。サーバー側認可の契約（#82）もこの文書にあります。push / pull 自体は #71 です。

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

`metadata.ownerUserId` は、クライアントが「このレコードの所有者は誰か」を覚えておくための記録です。クラウド側の認可根拠ではありません。

```text
NG  client → ownerUserId = "abc" → server がそのまま信用
OK  authenticated session → JWT → auth.uid() → owner 判定
```

deviceId もアクセス許可の認証情報ではありません。

認証（誰であるか）と認可（そのレコードを読めるか）は別です。ログイン済みであるだけでは、任意の Private Sync レコードへアクセスできません。

### 現時点で実装できない理由

#69 で入っているのは Supabase Auth のクライアントです。`AuthUser.id` は Supabase Auth の `user.id`（サーバーでは `auth.uid()`）です。

Private Sync のデータを置く backend は、まだリポジトリにも GitHub Pages にもありません。

- SQL / migration / RLS / Storage policy はない
- serverless function / 自前 API はない
- Cloud Adapter の push / pull はない（#71）
- デプロイは静的 SPA（GitHub Pages）と、任意の Supabase Auth 設定だけ

そのため、この節は **サーバーが後から満たす契約** です。ブラウザ上の `ownerUserId === currentUser.id` は認可ではありません。その比較を足して「サーバー側認可を実装した」とは扱いません。実テーブルを publishable key で読み書きできるようにするのは、下の security test が Provider 上で通ってからです。追跡は #82 のままです。

### Authorization model

```text
Private Sync resource
→ owner = authenticated identity（auth.uid()）
→ authenticatedUser == owner のときだけ read / create / update / delete
```

対象は `SYNC_ENTITY_TYPES` の全レコードです。Concept、文脈カード、QuizQuestion、QuizDeck、QuizAttemptLog、researchReport、learningMaterial、conceptSourceAnchor、同期対象 setting、media メタデータ。同期メタデータ（`version` / `updatedAt` / `deletedAt` / `deviceId`）は同じ行にあり、同じ所有者境界です。「本体ではないから認可不要」にはしません。

将来クラウドに置く Sync Queue や Conflict も、中身が Private Data なので同じ所有者境界です。競合解決そのもの（#73）と削除の伝播（#74）はここでは実装しません。削除してよいかの境界だけを決めます。

学習ログはユーザーの履歴なので Concept と同じ Private Data です。append-only は同期戦略であり、他ユーザーから読める理由にはなりません。

### Operations

| operation | policy |
|---|---|
| create | 認証済み identity 自身を owner とする行だけ。payload の owner が identity と違う作成は拒否 |
| read（1件・一覧・ID 指定・owner 指定の query） | その identity が owner の行だけ |
| update | 既存行の owner が identity と一致するときだけ。owner 列は変更不可 |
| delete / tombstone（`deletedAt` の設定を含む） | 既存行の owner が identity と一致するときだけ |
| owner の変更・譲渡 | 通常更新では不可。必要になったら別機能 |

他ユーザーの ID を知っている、URL を知っている、リクエストを書き換えた、DevTools や Cloud SDK から直接呼んだ、という理由では取得も変更も削除もできません。

### Trust boundary

```text
Client
  → 認証 credential（Supabase session の JWT）だけを送る
Server / Cloud Provider
  → JWT から authenticated identity を導出する
  → その identity で認可する
  → user-owned records だけを返す / 書く
```

クライアントが自由に決められる値は認可根拠にしません。

| 値 | 誰が決めるか |
|---|---|
| 認証済み identity | Provider。JWT の `auth.uid()`。リクエスト JSON からは取らない |
| 行の owner | サーバー。create 時に identity と一致することを強制し、以後 immutable |
| `metadata.ownerUserId` | クライアントの控え。サーバーは「identity と一致するか」の検査にだけ使い、一致しなければ拒否する。別ユーザーの領域を指定する鍵にはしない |
| `userId` / `ownerId` / `accountId` を API 引数で渡すこと | Cloud Adapter の契約に含めない |
| `deviceId` | 補助情報。アクセス許可には使わない |
| record id | 識別子。存在しても所有者でなければ見えない |
| `version` | 競合検出（#73）。アクセス許可には使わない |

create では、クライアントが送った owner をそのまま保存しません。保存される owner は認証済み identity です。payload に owner が必要でも、`payload.ownerUserId == auth.uid()` をサーバー側で強制します。欠落、空、別ユーザー、どちらの場合も拒否します。別ユーザー指定を「今のユーザーの行として書き換えて保存」もしません。別アカウントのローカルデータを、ログイン中ユーザーの領域へ黙って取り込む経路になるためです。

update では既存行の owner を見ます。payload の owner を書き換えて所有権を移すことはできません。owner 列は通常更新で immutable です。

delete と tombstone も既存行の owner を見ます。他ユーザーの record id を指定して行を消す、`deletedAt` を立てる、ことはできません。削除を他端末へ広げる処理は #74 です。

参照先（`relatedIds` 等）が他ユーザーの id でも、その id を読める権限は増えません。

失敗時の見え方は、存在を教えない方向にします。他ユーザーの id への read / update / delete は、行が無いのと同じ結果（0 件、または Not Found 相当）にします。「存在するが権限がない」とは返しません。

### Cloud Adapter 契約

Sync Service は認可をしません。認可は authenticated backend の責務です。

```text
UI
→ Sync Service
→ Cloud Adapter
→ authenticated backend / provider
→ server-side authorization
```

#71 のポートは、認証済み session の現在ユーザーだけを対象にします。呼び出し側が userId を渡して対象を選ぶ形にはしません。

```ts
type PrivateSyncCloudPort = {
  pullCurrentUserChanges(cursor: SyncCursor | null): Promise<PullPage>;
  pushCurrentUserChanges(changes: PrivateSyncRecord[]): Promise<PushResult>;
};
```

`cloud.pull(userId)` や `cloud.push(userId, changes)` は契約に入れません。identity は Adapter が持つ Supabase session から取ります。session が無い、無効、期限切れ、ユーザー取得に失敗、のときはネットワークへ「空の成功」を返しません。認可失敗として Sync Service に返します。

`toPrivateSyncRecord({ ownerUserId })` はローカルの記録を組み立てる関数です。クラウドの認可 API ではありません。

### Fail closed

次のときは Private Sync データへのクラウドアクセスを拒否します。空の pull 成功や、検査スキップによる許可にはしません。

- token なし / anonymous
- token が invalid または expired
- identity を JWT から取れない
- owner が欠落、空、認証済み identity と不一致
- レコードが malformed で owner を判定できない
- 認可ルールの評価に失敗した

認証に成功した query が 0 件なのは「そのユーザーの行が無い」です。未認証で 0 件に見えるのは失敗です。Sync Service はこの二つを混ぜません。

### ローカルデータ

認可失敗で IndexedDB を壊しません。

```text
Cloud authorization failed
→ sync failed
→ local IndexedDB remains intact
```

未認証の pull を「クラウドは空」と解釈してローカルを消す、巻き戻す、別アカウントへ送る、ことはしません。これは #71 の「Cloud 失敗でローカル変更を巻き戻さない」と同じ境界です。セッション切れは同期を止め、再ログインを求めるだけです。

### Private Sync と Public Share

```text
Private Sync
≠
Public Share
≠
Public Snapshot
```

Private Sync の方針は owner only です。`PrivateSyncRecord` に公開用の `visibility` は載せません。Quiz の Domain `visibility`（private / shareable）は共有 export 用であり、この認可政策ではありません。

Public Snapshot / 公開 API / 公開メディアは別の authorization policy を後から定義します（#78 / #79）。Private テーブルを読んでレスポンスからフィールドを削る、という公開経路にはしません。今回の契約は公開側の policy を定義しません。

### 設定と秘密情報

同期対象 setting は allowlist（`domainColors`、`themeSettings`）だけで、その行にも owner 境界をかけます。

次は Private Sync へ送りません。認可の実装を理由に追加しません。

- API key
- access token / refresh token
- Supabase session / authentication credential
- `aiSettings` を含む localOnly
- `NEVER_SYNC_SETTING_KEYS` にあるキー

### Provider requirements

データを置き始める backend は、少なくとも次をサーバー側で提供します。認証は既に Supabase Auth なので、同じプロジェクトの Postgres RLS（`auth.uid()`）が、この契約を満たす既存の仕組みです。別の DB を選ぶ場合でも、同等のサーバー側強制が必要です。ブラウザに `service_role` / secret key は置きません。

- 認証済み identity を、クライアント申告の userId ではなく credential から取る
- deny-by-default（RLS 無効のテーブルを publishable key に開かない）
- owner-scoped の select / insert / update / delete。ID 指定も同じ
- insert 時、owner は `auth.uid()` と一致するときだけ受理。不一致は拒否
- owner 列は通常の update で変更できない
- 未認証・不正 JWT は行に届かない
- 認可ルールを、クライアントの mock ではなく Provider のテスト（local emulator または同等の DB ロールテスト）で実行できる
- 通信は HTTPS。Private API に `Access-Control-Allow-Origin: *` を付けない
- 行の認可のあとでも、#70 の schema validation は残す。validation は認可の代わりにならない

メディア本体（Blob）は #76 です。メタデータ行は上の policy に従います。オブジェクトを置くときは、パスをクライアントに自由指定させず、Storage policy で同じ owner 境界にします。公開オブジェクトとはバケットまたは policy を分けます。URL を知っているだけでは Private Media を取れないようにします。

`version` の compare-and-swap は #73 です。version を書き換えても RLS は迂回できません。version 検査は認可の前段でも代替でもありません。

### Security test specification

次は、Cloud Adapter の mock や React テストだけでは完了にしません。RLS（または選んだ Provider のルール）に対して、ユーザー A とユーザー B の credential で確認します。

| id | 条件 | 期待 |
|---|---|---|
| A | User A が自分の行を read | allowed |
| B | User A が User B の行を、id 指定または `owner = B` の query で read | denied（0 件 / Not Found 相当） |
| C | User A が User B の行を update | denied。行は変わらない |
| D | User A が User B の行を delete、または `deletedAt` を設定 | denied |
| E | 認証は User A、payload の owner は User B | User B 所有の行はできず、A の領域へ黙って書き換えて保存もしない |
| F | User A の行を update し owner を User B にする | owner は A のまま。譲渡されない |
| G | anonymous で Private Sync を read / write | denied。空の成功 pull ではない |
| H | invalid / expired token、identity 取得失敗、owner 欠落 | fail closed |

加えて、QuizAttemptLog・同期対象 setting・同期メタデータ列が同じ境界であること、secret が同期 payload に含まれないこと、認可失敗のあともローカル IndexedDB が残ること、を見ます。Public Snapshot の取得条件は #78 / #79 側のテストです。

### #71 との境界

#71 は、この契約に合う Sync Service と Cloud Adapter の形（現在ユーザー固定、失敗でローカルを巻き戻さない、未認証を空成功にしない）まで進められます。

publishable key で到達できる実テーブルや Storage へユーザーデータを書き始めるのは、上の security test が Provider 上で通ったあとです。その強制は schema を入れる変更と同時に行い、#82 で確認します。

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
