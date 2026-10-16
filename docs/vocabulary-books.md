# 単語帳設定のデータモデルと永続化

Issue [#224](https://github.com/H-ampk/concept-book/issues/224) の Small Slice 1。単語帳の作成 UI、IndexedDB のバージョン変更、CRUD、Private Sync の実装は含まない。

前提は #223（`1caf574`）の閲覧 MVP。内容は Concept と文脈カードの派生であり、複製しない。

## 1. 目的・対象範囲

ユーザーが単語帳を作り、対象分野タグに一致する既存 Concept と文脈カードを動的に表示できるようにする。この文書が決めるのは次だけである。

- ローカルに保存する設定レコードの形
- タグ一致の規則と、タグ 0 件・分野未設定・タグ名変更・単語帳削除
- 次スライスで使う IndexedDB の置き場所
- JSON / ZIP バックアップでの任意フィールドと、replace / merge の扱い
- 将来 Private Sync に載せるときの境界（今回は送らない）

画面の置き換え、クイズ、学習モデルは範囲外。

## 2. 現在の実装

- `src/utils/vocabularyBook.ts` が分野一覧と統合エントリを純関数で作る。専用ストアは無い。
- Concept の分野は `domainTags`。空なら表示専用ラベル `UNASSIGNED_DOMAIN_LABEL`（`"未設定"`）。この文字列は保存値ではない。
- 文脈カードは有効な `domainTags` があればそれ、無ければレガシー `domain`、どちらも無ければ同じ表示ラベル。
- 正規化 `uniqueTags` は、非文字列を捨て、trim し、空を捨て、同一レコード内の重複を先勝ちで捨てる。大文字小文字や表記ゆれは同一視しない。
- `buildVocabularyEntries` は 1 分野・種別フィルタごとに ID で重複を除く。複数分野の OR はまだ無い。
- `VocabularyBookScreen` は分野サマリをトップにし、詳細で種別・スクロール・戻る状態を持つ。
- IndexedDB は `concept-book` version 11。ストアは concepts、media、contextCards、quizQuestions、quizAttemptLogs、quizDecks、researchReports、learningMaterials、learningMaterialBlobs、conceptSourceAnchors、syncQueue、syncState。設定の汎用ストアは無い。`domainColors` と `themeSettings` は localStorage 側で、Private Sync の setting allowlist にだけ載る。
- バックアップ `BackupExportData` はエンティティ配列の集合で、ファイル全体の schemaVersion は無い。欠ける配列は import 検証側の既存規則に従う。ZIP は `concepts.json` を入口にする（`src/utils/conceptBookZip.ts`）。
- ID の新規推奨は `src/sync/ids.ts` の `prefix_<uuid>`。既存の多くは `prefix_${Date.now()...}` のまま。
- 日時は Concept と同じ ISO 文字列 `createdAt` / `updatedAt`。

## 3. データモデル（採用）

```ts
/** 表示ラベル「未設定」とは別。分野タグが一つも無いレコードを選ぶ印。文字列タグとしては保存しない。 */
type VocabularyBook = {
  id: string;
  name: string;
  /** 実在しうる分野タグ。trim 済み・空なし・重複なし。表示順を保持する。 */
  domainTags: string[];
  /**
   * true のとき、conceptDomainKeys / contextCardDomainKeys が
   * 表示専用「未設定」だけになるレコードも一致させる。
   * domainTags に文字列「未設定」が入っていても、このフラグとは独立。
   */
  includeUnassigned: boolean;
  createdAt: string;
  updatedAt: string;
};
```

フィールドを足した理由は「未設定」の区別だけである。ユーザー向けタグ文字列 `"未設定"` と、タグが無いレコードは別物にしないと、既存データに同名タグがあっても衝突する。`includeUnassigned` を boolean にし、sentinel 文字列を `domainTags` に混ぜない。

採用しないフィールド:

- Concept ID / 文脈カード ID の固定リスト。所属の主判定にしない（#224）。
- 単語帳専用の Concept 複製。
- レコード内 `schemaVersion`。Concept に無く、バックアップも配列追加で足りる。
- `ownerUserId` / `deletedAt` / `version`。これらは Private Sync メタデータであり、Domain レコードには Concept と同様に載せない（`docs/private-sync.md`）。

ID は新規作成時 `vocab_<uuid>`（`createEntityId` と同じ形）。既存 ID は import 時に書き換えない。`vocab` は現在の `ENTITY_ID_PREFIXES` に無い。同期エンティティ化するスライスで prefix 一覧へ足す。それまではローカル ID の規約として使う。

名前は trim 後 1 文字以上、200 文字以下。前後空白だけの名前は不正。タグは `uniqueTags` と同じ規則で正規化し、単語帳内の重複を除く。件数の上限は置かない。0 件は正当。

## 4. 不採用の保存方式

| 方式 | 理由 |
| --- | --- |
| localStorage の設定オブジェクトに単語帳配列を入れる | 設定 allowlist は `domainColors` と `themeSettings` のキー単位。コレクションの CRUD、件別の updatedAt、将来の tombstone と合わない。AI 設定と同じく「設定だから localStorage」にはしない。 |
| `concepts` ストアに種別フィールドで混在させる | Concept の key とバリデーションを汚染する。バックアップと同期の entity 境界が崩れる。 |
| 同期キューや syncState に置く | キューは未送信操作、syncState は owner ごとのカーソルであり、Domain データの置き場ではない。 |

専用 Object Store `vocabularyBooks`（keyPath `id`）を Slice 2 で足す。IndexedDB version は 12。ストアが無ければ作る。既存ストアの削除・クリアはしない。インデックスは MVP では不要（件数はユーザーの冊数で、全件読みで足りる）。

全要素が不正な `vocabularyBooks` 配列は、正当な空配列と区別する。この場合は単語帳ストアを置換せず、ローカルの冊を残す。空配列の replace だけが 0 件への置き換えである。キーが配列でないときも、バックアップ全体は失敗させず、単語帳ストアは触らない。

比較の要約:

- 整合性: 1 レコード 1 冊。Concept 削除と独立。
- CRUD: 既存ストアと同じ getAll / get / put / delete。
- マイグレーション: 空ストア追加のみ。旧データはそのまま。
- バックアップ: 配列を 1 本足すだけ。
- Private Sync: 後から `SyncEntityType` に `"vocabularyBook"` を足せる。今回は足さない。
- 拡張: 手動ピン留めが必要になっても別フィールドを足せる。主判定はタグのまま。
- コスト: ストア 1 つと import の任意配列。共通設定袋より境界が明確。

Slice 1 の文書化時点では `DB_VERSION` を変えていない。Slice 2 で version 12 と CRUD、バックアップの任意配列を実装する。Private Sync と UI はまだ変えない。

## 5. Concept・文脈カードとの関連

単語帳レコードはタグ条件だけを持つ。表示時にメモリ上の Concept と文脈カードへ `vocabularyBook.ts` のキー関数を適用する。

一致:

- Concept: `uniqueTags(concept.domainTags)` のいずれかが `book.domainTags` に含まれる、または（実タグが 0 件かつ `book.includeUnassigned`）。
- 文脈カード: `contextCardDomainKeys` から表示専用「未設定」を除いた実キーのいずれかが `book.domainTags` に含まれる、または（実キーが 0 で `includeUnassigned`）。
- 複数タグは OR。
- 同一 Concept ID は 1 件。同一文脈カード ID は 1 件。種別をまたいだ ID 衝突は、既存どおり kind が別なら別行。

`buildVocabularyEntries` は単一 domain 文字列の包含なので、そのまま複数タグ OR には使えない。キー関数と重複排除は再利用し、複数タグ用のフィルタは次スライスで純関数として足す。単語帳トップの分野自動一覧 `buildVocabularyDomainSummaries` は、作成済み冊の一覧へ UI を替えるスライスまで残す。

追従は再計算だけである。Concept の追加・タグ変更・削除、文脈カードのタグ変更、単語帳の `domainTags` 変更は、保存済みの相手側レコードを書き換えない。

タグ名の変更（文字列の置換）は MVP では単語帳側へ伝播しない。ユーザーが冊の対象タグを編集する。安定タグ ID は導入しない。導入するなら `domainTags: string[]` を ID 参照へ移行する別 Issue とする。

## 6. 特殊ケース

- 対象タグ 0 件かつ `includeUnassigned === false`: 保存可。表示は空。全件表示にはしない。
- `includeUnassigned === true` かつ `domainTags` が空: 分野が無いレコードだけ。タグ付きは出さない。
- 文字列タグ `"未設定"` は通常タグ。分野が空のレコードとは一致しない。既存の表示ラベルと同じ文字でも、保存された `domainTags` の要素として扱う。
- 単語帳 delete は当該ストアの 1 件削除。concepts、contextCards、quiz、attempt log は触らない。
- 不正レコード（id 空、name 空、domainTags が配列でない、タグが文字列でない、日時が解釈不能）は読込時に除外し、画面には出さない。黙って Concept 側へ書き戻さない。

## 7. Import / Export

`BackupExportData` に任意プロパティを足す。

```ts
vocabularyBooks?: VocabularyBook[];
```

- 新規エクスポートはキーを常に含める。0 件は `[]`。
- 旧バックアップにキーが無い: import 成功。ローカルの単語帳は削除も上書きもしない。
- `replace` かつキーがある: 単語帳ストアをその配列で置き換える（検証済みのものだけ）。他エンティティの replace 規則は変えない。
- `merge` かつキーがある: 同一 `id` はバックアップ側で上書き、ローカルにしか無い冊は残す。ID が衝突したら新規採番しない（バックアップの ID を正とする）。これは他エンティティの merge と同じ「同じ ID は incoming」に揃える。
- 検証に落ちた要素は、その要素だけスキップする。ファイル全体は、既存 import が致命とする欠陥が無ければ続行する。単語帳配列の不正だけで Concept の復元を失敗させない。
- ZIP は既存の JSON パッケージに同じフィールドを載せる。`concepts.json` だけを必須にする規則は維持する。

メディアや学習ログの除外オプションには単語帳を含めない。設定は小さいメタデータなので、ログ除外時も残す。

## 8. Private Sync

#71（push / pull）、#72（同期の製品範囲）、#82（RLS）の現行契約は `docs/private-sync.md` のとおり。単語帳はまだ `SYNC_ENTITY_TYPES` に無い。したがってクラウドへは送らない。

将来載せるときの境界だけ書く。

- Domain は上記 `VocabularyBook`。所有者は Sync メタデータの `ownerUserId` であり、レコード本体には置かない。
- 認可はクライアントの所有者比較では行わない。既存どおり authenticated session と RLS（`auth.uid()` と `owner_user_id`）が境界。
- 戦略は `versioned`。削除の伝播が必要になったときは既存の tombstone（`deletedAt`）をメタデータ側に使う。ローカルの現時点の削除は物理削除のままでよい。
- 競合は `updatedAt` の新しい方を暫定の last-write-wins とする。フィールド単位マージはしない。#73 の本実装までは同期スライスで再確認する。
- 今回 `SYNC_ENTITY_TYPES` や allowlist は増やさない。同期のためのポートや抽象は足さない。

## 9. Invariants とテスト

実装スライスで、次を純関数または storage テストにする。この文書の追加だけではテストを足さない。

| 条件 | 確認 |
| --- | --- |
| ID 一意 | 同一 ID の put は 1 件。merge で二重にならない |
| 名前 | `""` と空白のみを拒否。trim して保存 |
| タグ正規化 | 空白・空・非文字列を捨て、重複を 1 つにする。大小文字は別タグ |
| タグ 0 件 | 保存でき、一致件数が 0。全 Concept 件数と一致しない |
| 複製しない | ストアに Concept 本体が無い |
| 削除の隔離 | 冊削除のあと Concept 件数と文脈カード件数が不変 |
| 未設定の区別 | タグ `"未設定"` の Concept は `includeUnassigned` だけでは出ない。タグ無し Concept は文字列 `"未設定"` だけでは出ない |
| OR と重複 | 複数タグに当たる Concept が 1 行 |
| 旧バックアップ | `vocabularyBooks` 無しの JSON を import しても既存冊が残る |
| 不正データ | 壊れた要素をスキップし、正常な冊と Concept は読める |
| 再起動 | put した冊が DB を開き直したあと getAll に含まれる |

## 10. 次の実装スライス

1 スライスに UI まで含めない。

1. version 12 で `vocabularyBooks` を追加。get / create / update / delete。バリデーションは上記。バックアップの任意配列、旧ファイル無変更、replace / merge。単体テスト。
2. `vocabularyBook.ts` に複数タグ OR と `includeUnassigned` の一致関数。既存の単一分野関数は残す。
3. 作成・編集・削除 UI と、トップを作成済み冊一覧へ替える。#223 の詳細（種別、戻る、スクロール、空とエラー）は維持。

## 11. 未解決

- 単語帳名の一意制約は掛けない（同名を許す）。必要なら UI スライスで警告に留める。
- タグの大文字小文字を同一視しない既存仕様を、単語帳でも維持する。変えるなら検索スライスの分野分類整理と同時。
- 自動生成の分野一覧を、冊一覧の横に残すかは UI スライス。データモデルは冊が無くても Concept を消さないので、どちらも選べる。
- 既存ユーザー向けの冊の自動生成（タグごとに 1 冊を種まきするか）はしない。するなら別スライスで、このストアへ insert するだけで足りる。
- production への Private Sync migration 適用状況は `docs/private-sync.md` のとおり未確認。単語帳の同期着手条件にはしない。
