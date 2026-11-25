# ContextCard.keyConcepts の表現に関する設計調査

調査基点: `origin/main` `9027b881291943e751a5396ef9a4995c1ce140c2`  
対象 Issue: [#219](https://github.com/H-ampk/concept-book/issues/219)（設計調査のみ。本変更はスキーマも migration も実装しない）

## 1. 調査目的

`ContextCard.keyConcepts` は重要概念を一つの `string` として持つ。UI・自動リンク・索引追加は、その文字列を区切り文字で用語列に戻している。本調査は次を判断するためのものである。

- 配列化が必要か、区切り規則の共通化で足りるか
- 区切り文字のエスケープを導入する価値があるか
- 配列化する場合の IndexedDB、JSON / ZIP、Private Sync、既存データへの影響

実ユーザーの IndexedDB や同期サーバー上のペイロードは見ていない。挙動は `origin/main` のコードから読める範囲に限る。

## 2. 現行データ構造

```9:9:src/types/contextCard.ts
  keyConcepts: string;
```

空の入力は `""` である（`createEmptyContextCardInput`、同ファイル 17–24 行）。

同じカード上の隣接フィールドとの対比:

| フィールド | 型 | 役割 |
| --- | --- | --- |
| `keyConcepts` | `string` | 重要概念の表示文字列。自動生成 Concept の元語句 |
| `domainTags` | `string[]` | 分野タグ。保存時に trim と空除去 |
| `linkedConcepts` | `string[]` | 概念 ID の明示リンク |

`Concept.sourceContextCardTermKey`（`src/types/concept.ts`）は、自動生成時に `normalizeConceptTitle(title)` した語句 identity である。リンクそのものは ID 配列であり、`keyConcepts` は用語のソース文字列である。

IndexedDB の `contextCards` ストアは `keyPath: "id"` と `title` / `domain` / `updatedAt` の index だけを持つ（`src/storage/indexeddb.ts` 85 行 `DB_VERSION = 12`、508–512 行）。`keyConcepts` に index はない。値は構造化クローンで、プロパティ型をスキーマとしては制約しない。

## 3. 全参照箇所と責務

本番の参照は次のとおり。行番号は調査基点のツリーである。

| 箇所 | 責務 | keyConcepts の扱い |
| --- | --- | --- |
| `src/types/contextCard.ts` 9, 23 行 | 型と初期値 | `string`、初期値 `""` |
| `ContextCardFormModal.handleSubmit` 123–128 行 | 保存ペイロード | `title` と `domainTags` だけ加工し、`keyConcepts` は textarea の値をそのまま渡す |
| `createContextCardInStore` / `updateContextCardInStore`（`indexeddb.ts` 1328–1366 行） | 新規・更新 | スプレッドで格納。`domainTags` と `linkedConcepts` は trim・空除去するが、`keyConcepts` はしない |
| `sanitizeContextCard`（690 行） | 読込時の欠損補完 | `card.keyConcepts ?? ""`。文字列の分割・trim はしない。`null` / `undefined` 以外（数値など）はそのまま残る |
| `importContextCardsIntoStore`（793–823 行） | IDB への投入 | `id` と `title` が無ければ skip。通ったレコードは `sanitizeContextCard` |
| `conceptImportValidation.ts` `contextCardSchema` 88–100 行 | JSON / ZIP 検証 | `keyConcepts: z.string()` 必須。配列や欠損はカード検証失敗 |
| `sync/domainPayloads.ts` 60–72, 132–136 行 | Private Sync | 同じ `z.string()`。失敗時は `"contextCard data が不正です"` |
| `parseBulkRelatedConceptTitles`（`bulkRelatedConcepts.ts` 6–21 行） | 共通の分割 | `/[,\n、]+/`。trim、空除去、完全一致の重複除去、出現順維持。全角カンマ `，` は区切らない |
| `extractImportantTerms`（`syncImportantTermsToConcepts.ts` 11–26 行） | 自動リンク用の語句 | 上記のあと `normalizeConceptTitle` で重複排除。残す表記は trim 後の原文 |
| `computeConceptSyncPlan`（122 行以降） | Concept の作成・更新計画 | `extractImportantTerms(contextCard.keyConcepts)` の順 |
| `appendKeyConcepts`（`extractIndexTerms.ts` 169–189 行） | 索引用語の追記 | 既存側の重複判定は `parseBulkRelatedConceptTitles` + `normalizeConceptTitle`。追記の結合は `", "` |
| `ContextCardFormModal` 350–355, 93–103 行 | 入力と索引追加 | textarea は生文字列。追加時だけ `appendKeyConcepts` |
| `ContextCardsScreen` 一覧 122 行 | 一覧プレビュー | 生文字列。空（falsy）なら `"未入力"` |
| `ContextCardDetail` 166–170, 265–287 行 | 詳細チップと関連概念 | `split(",")` のみ。読点・改行では割らない。trim 後に正規化タイトルで Concept を引く。空要素も map する |
| `generateQuizSetFromContextCard.ts` 313 行 | クイズ生成 | `extractImportantTerms` |
| `generateQuizChoicesFromContextCards.ts` 133 行 | 選択肢 | `parseBulkRelatedConceptTitles` |
| `vocabularyBook.ts` `contextSummary` 149–150 行 | 単語帳の要約 | 問い・背景・流れが空のときのフォールバック文字列。分割しない |

`parseBulkRelatedConceptTitles` は関連概念の一括入力（`RelatedConceptPicker.tsx`）でも使う。区切り正規表現を変えると、重要概念以外の一括タイトル入力も変わる。

`normalizeConceptTitle`（`src/utils/normalizeConceptTitle.ts` 2–4 行）は照合専用で、trim、NFKC、英字小文字化をする。分割の前には適用されない。NFKC では全角カンマ `，` が ASCII カンマになるが、それは分割後の照合キーの中の文字であり、区切りには使われない。

テスト（実装の仕様アンカー）:

- `src/utils/extractIndexTerms.test.ts` の `appendKeyConcepts`（重複、NFKC 相当の表記ゆれ、空文字への追記）
- `src/utils/syncImportantTermsToConcepts.test.ts`（空白付き `" ai "`、`"AI, ML"`、語句変更は付け替えない）
- `src/components/ContextCardFormModal.indexExtract.test.tsx`（手入力と索引追記後の textarea 値）
- `src/storage/indexeddb.contextCardConceptSyncAtomicity.test.ts`
- `src/utils/generateQuizSetFromContextCard.test.ts`
- `src/components/ContextCardsScreen.atomicSave.test.tsx`
- `src/sync/fixtures.ts`（`"エントロピー"` の同期フィクスチャ）
- `e2e/learning-materials-provenance.spec.ts`、`e2e/vocabulary-book.spec.ts`（入力または空文字）

## 4. 現行構造の制約

保存（フォーム submit と `createContextCardInStore` / `updateContextCardInStore`）は、区切りを解釈せず文字列を保持する。欠損読込だけ `?? ""` で空文字にする。解釈が分かれるのは表示・索引追記・自動リンクである。

区切りの実装差:

| 処理 | 区切り | 空要素 | 重複 |
| --- | --- | --- | --- |
| 保存 | 解釈しない | 保持 | 保持 |
| 詳細チップ・詳細からのタイトル照合（`split(",")`） | ASCII カンマのみ | 空チップになり得る | そのまま複数チップ |
| `parseBulkRelatedConceptTitles` | ASCII カンマ、LF、読点 `、` | 捨てる | trim 後の完全一致で先頭だけ |
| `extractImportantTerms` | 同上に加え正規化キー | 同上 | `AI` と `ai` は一つ |
| `appendKeyConcepts` の結合 | 追記分は `", "` | 空の追加語は捨てる | 正規化キーで既存を飛ばす |

ケースごとの解釈（保存形は、特別な記が無い限り入力文字列と一致する）:

| ケース | 保存 | 詳細チップ | 自動リンク（`extractImportantTerms`） |
| --- | --- | --- | --- |
| カンマを含む用語 `Smith, John` | `Smith, John` のまま | `Smith` と `John` | 同じ二語。一語としての境界は残らない |
| 読点 `機械学習、深層学習` | そのまま | 一チップ（`split(",")` は読点を割らない） | 二語 |
| 改行 `A\nB` | そのまま（textarea は改行を受け付ける） | 一チップ（ボタン内の改行は CSS 依存。コードは分割しない） | 二語 |
| 全角カンマ `A，B` | そのまま | 一チップ | 一語。照合キーは NFKC 後に ASCII カンマを含む |
| 重複 `AI, AI` | そのまま | 二チップ | 一語 |
| 正規化で衝突する重複 `AI, ai` | そのまま | 二チップ | 一語（先の `AI`） |
| 空要素 `A,,B` や `A, ,B` | そのまま | 空ラベルのチップを含む | `A`, `B` |
| 前後空白 ` ai ` | そのまま（保存経路は trim しない） | チップ表示は trim 後の `ai` | `ai`。テストがこの空白を照合に使う |
| 日英混在 `機械学習 (ML)` | 一文字列 | カンマが無ければ一チップ | 一語 |
| 順序 `B, A` | 文字列順を保持 | チップ順はカンマ分割順 | `parseBulk` の出現順。重複時は先勝ち |
| 未設定 | 新規は `""`。読込でプロパティ欠損は `""` | falsy なら「未入力」。空白のみは truthy なので空チップ | `parseBulk` は trim 後が空なら `[]` |
| JSON 上の欠損・非文字列 | 検証スキーマが拒否 | 検証を通ったデータには現れない | 同左 |

これは「カンマ区切り文字列という表現の制約」と「画面と自動リンクで区切り集合が違う」という二点である。保存がカンマ含有文字を捨てる欠陥、という証拠はコード上にない。索引抽出（`extractIndexTerms`）はページ参照のカンマを用語本体から分けており、本調査ではパーサーを拡張しない。

`getAllContextCards` は `sanitizeContextCard` の結果をメモリで返すだけで、欠損補完を書き戻す処理は無い（3090–3096 行）。Concept 側にある migrated 書き戻しとは異なる。

## 5. 設計案の比較

### 案A: `string` を維持し、正規化を共通化する

区切り契約を `parseBulkRelatedConceptTitles` に寄せ、詳細チップとタイトル照合も同じ関数を使う。追記形式は既に `", "` なので、契約は「ASCII カンマ、LF、読点で区切り、用語内にはこれらを含めない。全角カンマは区切らない」。UI の説明文でその契約を示す。

### 案B: `string` を維持し、エスケープを導入する

用語内の区切りを `\,` や CSV 引用で保持する。保存は文字列のまま。

既存データにエスケープ規約は無い。`Smith, John` が「一語」だったのか「二語」だったのかは、導入後も復元できない。古いクライアントはエスケープ文字を用語の一部として表示・分割する。`parseBulkRelatedConceptTitles` は関連概念の一括入力と共有のため、エスケープ対応はそちらの入力意味も変える。

### 案C: `string[]` へ移行する

保存形を用語配列にし、textarea やチップは入出力の表現として分離する。`domainTags` や `linkedConcepts` と同じ「要素が一つ」のモデルになる。`sourceContextCardTermKey` も要素ごとに対応させやすい。

既存文字列からの移行は、選んだ分割規則の結果であり、区切りを含む一語は復元できない。同期と import の Zod は `z.string()` のため、配列だけを送ると現行クライアントは contextCard を不正とする。移行期間は `string | string[]` の受理が必要になる。

### 比較

| 観点 | 案A | 案B | 案C |
| --- | --- | --- | --- |
| 表現能力 | 区切り文字を含まない用語の列。契約を文書化できる | 新規データに限り区切り含有語を表現可能 | 要素ごとに任意の用語。区切り文字を用語に含められる |
| 実装コスト | 詳細表示の分割を共通関数へ置換し、説明を足す程度 | エスケープの仕様、共有パーサー、旧データ、表示の三面 | 型、UI、同期、import、読込互換、テスト一式 |
| 保守性 | 区切りが一つに揃う。文字列である限界は残る | エスケープ漏れが欠落や二重分割になる | 分割の重複実装を減らせる。移行期間は二形式 |
| 後方互換 | 保存形は不変。挙動が変わるのは、読点・改行を詳細が新たに割る点 | 旧クライアントが新エスケープを誤解する | 旧クライアントは配列ペイロードを拒否する。読込側の union が必要 |
| データ損失 | 保存文字列は維持。解釈の変更で「一チップだった読点文字列」が二語表示になる | 既存の曖昧文字列はエスケープでは回復しない。誤ってエスケープすると表示が変わる | 移行分割を誤ると一語が割れた配列で上書きされ、元文字列は失われる |
| IndexedDB | ストア定義の変更不要。`DB_VERSION` 不要 | 同左 | index を増やさなければバージョン必須ではない。値の形は構造化クローンに載る。一括書き換えを upgrade でやるならバージョンを上げる選択はある |
| import / export | `z.string()` のまま。旧 ZIP をそのまま読める | 文字列のままならスキーマは維持。中身の意味は変わる | 現行スキーマは配列を拒否。旧 ZIP の文字列は読めるが、新 ZIP は現行アプリでは失敗する |
| Private Sync | ペイロード変更不要 | 文字列のまま。意味の不一致がピア間で起き得る | `parseDomainPayload` の変更が必要。混在期間を置かないと同期が落ちる |
| 性能 | カード件数規模では分割コストは無視できる | 同左 | 配列の方が分割は減るが、体感差を示す測定はしていない |
| 概念間リンク | リンクは既に `linkedConcepts: string[]`（ID）。用語ソースは文字列のまま | 同左 | 用語境界と `sourceContextCardTermKey` が要素単位で一致する。ID リンクの置換にはならない |

案Cは、区切りを含む用語を失わずに保存したい、という要件が製品としてあるときのモデルである。現行の索引追加と自動リンクは、区切りを含まない語の列で動作している（Issue の優先度は P3）。

## 6. Migration と後方互換性

### 案A・案Bを採る場合

- `DB_VERSION` の変更は不要である。object store も index も変わらない。
- レコード migration は不要である。
- 旧バックアップの `keyConcepts` は `z.string()` のまま読める。
- 同期ペイロードの型は変わらない。
- 順序は元文字列の出現順のままである。
- カンマを含んだ既存用語の曖昧性は解消できない。文字列に境界情報が無い。
- 案Aで詳細表示の分割を変えると、読点・改行を含む既存文字列の見た目とタイトル照合が変わる。保存値は書き換えないので、表示を戻すコード変更で以前のチップ分割には戻せる。

### 案Cを採る場合

- `DB_VERSION` は、ストアや index を変えないなら必須ではない。upgrade トランザクションで全カードを書き換える実装を選ぶときだけ上げる。
- 読込時変換は必要である。`string` を選んだ規則で `string[]` にし、既に配列ならそのまま使う。
- 旧形式は、その規則で分割できる範囲で読める。
- 旧 ZIP / JSON は `z.string()` を配列スキーマだけに変えると拒否される。受理は `z.union([z.string(), z.array(z.string())])` のように両方必要である。書き出しを配列にすると、そのファイルは現行リリースでは `contextCard` 検証に失敗する。
- 同期も同じ union が必要である。配列だけを送るピアと、`z.string()` のピアは contextCard を適用できない。
- 順序は分割結果の順で維持できる。`parseBulk` は出現順を守る。
- カンマ・読点・改行を含んだ一語は、元境界を復元できない。どの規則で割っても、保存時点の「ユーザーが意図した語」は文字列だけでは決まらない。
- 失敗時の保護: 変換結果で即上書きしない。元の `keyConcepts` 文字列が残っている間は再変換できる。上書きするなら、変換不能（非文字列など）のカードはスキップして元レコードを残す。`sanitizeContextCard` は現在、欠損以外を書き戻さない。

この限界は案Cを採っても消えない。配列化が救うのは、移行後にユーザーが編集し直した用語である。

## 7. 推奨する設計と判断根拠

現時点の採用は案Aとする。

根拠:

- 保存形は複数語を既に表現でき、索引追記と自動リンクは共有パーサーで動いている。Issue 本文も、現行形式で索引抽出は動作し、カンマ含有語は将来課題だとしている。
- コード上の具体的な不整合は、詳細画面だけ `split(",")` であり、読点と改行を自動リンクと違う境界で見せている点である。これはスキーマを変えずに揃えられる。
- 案Cにしても、既存のカンマ含有文字列から元の語境界は復元できない。配列化の主目的が「過去データの曖昧性の解消」なら、移行では達成できない。
- 案Bは、その復元不能な過去データのために、旧クライアントが誤解する新しい文字列規約を足す。共有パーサーの影響範囲も広い。
- 案Cは Private Sync と import の互換窓が必要で、P3 の将来課題に対する現時点のコストとして大きい。用語内区切りを製品要件にする段階で、`domainTags` と同様の配列にするのが整合する。

案Aの実施時に維持する契約:

- 既存カードを読めなくしない（フィールド型は `string` のまま）
- 自動リンクの語順は `extractImportantTerms` の出現順を維持する
- 空要素を保存文字列へ増やさない（表示側が空を出さない、で足りる）

## 8. 実装する場合の Issue 分割案

1. 区切り解釈の単一化。詳細チップと詳細からのタイトル照合を `parseBulkRelatedConceptTitles` に合わせる。保存形式、`DB_VERSION`、同期、import スキーマ、索引パーサーは変えない。回帰は詳細表示と、読点・改行・空要素の unit または component test。
2. 入力欄に区切り契約を短く書く（ASCII カンマ、改行、読点。用語内には含めない）。任意。
3. 案Cは別 Issue に分ける。開始条件は「区切りを含む一語を保存する製品要件が明示されたとき」。内容は union 読込、書き込み形式、同期、ZIP の新旧、非文字列レコードを上書きしないこと。索引パーサー拡張とは混ぜない。
4. 案Bは、案Cの要件が無い限り起票しない。

本調査の PR は `Refs #219` とし、Issue は開いたままにする。

## 9. 未検証事項と残存リスク

- 実ユーザーの IndexedDB、書き出し ZIP、同期サーバーに、カンマや読点を含む `keyConcepts` がどの程度あるかは未計測である。
- `sanitizeContextCard` が通す非文字列値が、開発用以外の DB に存在するかどうかは未確認である。import と同期の Zod はその値を拒否する。
- 詳細チップの改行が画面上でどう折れるかは、CSS とブラウザ依存であり、今回ブラウザでは確認していない。
- 案Aで詳細の分割を変えたときの既存カードの見た目の差分は、実データが無いため一覧化していない。
- 性能差は測定していない。カード規模では支配的でない、という判断はコード形状からの推定である。
- Private Sync の複数クライアントが異なるリリースを同時に使う運用がどの程度あるかは、このリポジトリだけでは確定できない。案Cを実装する前に確認する。
