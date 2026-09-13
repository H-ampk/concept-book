# Authentication

ConceptBook の認証は任意です。IndexedDB を主データストアとするローカルファーストは認証の有無で変わりません。

```text
Authentication is optional.
Local-first remains primary.
Authentication failure must never break ConceptBook.
```

## 分離

```text
                 ConceptBook
                     │
          ┌──────────┴──────────┐
          │                     │
     Local Storage          Authentication
          │                     │
      IndexedDB              Supabase Auth
                                  │
                             currentUser
                                  │
                         future Cloud Sync
```

Concept の保存はこれまでどおり `UI → ConceptStorage → IndexedDB` のみです。`ConceptStorage` からログイン確認や Supabase 通信を行いません。

ログアウトは Supabase session の終了だけです。IndexedDB の Concept / 文脈カード / Quiz / 学習ログ / 設定 / メディアは削除しません。

## currentUser

ログイン済みなら `AuthUser.id` は Supabase Auth の `user.id`（サーバー側では `auth.uid()`）です。同じアカウントなら端末が違っても同一 ID になります。

後続の Private Sync は UI から任意の `userId` を受け取らず、認証済み session の `currentUser` を使います。

```ts
import { getCurrentUser, useAuth } from "../auth";

const { currentUser } = useAuth();
const user = await getCurrentUser();
```

## 認可（後続 Issue）

Cloud 側で Private Data を扱うときは、クライアントが送った `ownerUserId` を信用しません。

```text
NG  client → ownerUserId = "abc" → server がそのまま信用
OK  authenticated request → Supabase Auth JWT → auth.uid() → owner 判定
```

実際の Private Sync テーブル / RLS は #70 / #71 / #82 で実装します。本 Issue では認証基盤と原則のみです。

## トークン

アクセス / refresh token は Supabase SDK の session 管理に任せます。Concept、Backup JSON / ZIP、Quiz、学習ログ、アプリ設定、IndexedDB の Concept store へ保存しません。

フロントエンドに置くのは次だけです。

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

`SUPABASE_SECRET_KEY` / `service_role` / DB password は置きません。

## 未設定環境

環境変数が無い fork / test / ローカルでは認証 UI だけ unavailable になります。アプリ起動やローカル機能は維持します。
