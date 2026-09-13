import { useState, type FormEvent } from "react";
import { useAuth } from "../auth";
import { USER_FACING_AUTH_ERROR, USER_FACING_AUTH_ERROR_LOCAL_NOTE } from "../auth/userFacingAuthError";

const LOCAL_FIRST_NOTE = "ログインしなくても ConceptBook のローカル機能は利用できます。";
const FUTURE_CLOUD_NOTE = "ログインすると、今後クラウド同期や公開機能を利用できます。";

export const AccountSettingsSection = () => {
  const {
    status,
    user,
    error,
    configured,
    sendingMagicLink,
    magicLinkSent,
    signInWithEmail,
    signOut
  } = useAuth();
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);

  const initializing = status === "loading";
  const authenticated = status === "authenticated" && user;
  const formBusy = initializing || sendingMagicLink;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formBusy) {
      return;
    }
    void signInWithEmail(email);
  };

  const handleCopyUserId = async () => {
    if (!user?.id || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(user.id);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-celestial-textMain">アカウント / クラウド</h3>
      <p className="text-xs text-celestial-textSub">
        {LOCAL_FIRST_NOTE}
        <span className="mt-1 block">{FUTURE_CLOUD_NOTE}</span>
      </p>

      <div className="space-y-3 rounded-lg bg-nordic-surface p-4">
        {!configured ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-celestial-textMain">アカウント</p>
            <p className="text-sm text-celestial-textSub">未ログイン</p>
            <p className="text-xs text-celestial-textSub">
              クラウド認証はこの環境では設定されていません。ローカル機能はそのまま利用できます。
            </p>
          </div>
        ) : initializing ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-celestial-textMain">アカウント</p>
            <p className="text-sm text-celestial-textSub">認証状態を確認しています。</p>
          </div>
        ) : authenticated ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-celestial-textMain">ログイン済み</p>
              {user?.email ? (
                <p className="mt-1 text-sm text-celestial-textMain">
                  メールアドレス
                  <span className="mt-0.5 block text-celestial-textSub">{user.email}</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-celestial-textSub">メールアドレスは表示できません。</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-celestial-border bg-nordic-surface px-3 py-2 text-sm text-celestial-textMain hover:bg-celestial-gold/10"
                onClick={() => void signOut()}
              >
                ログアウト
              </button>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs text-celestial-textSub underline-offset-2 hover:underline"
                onClick={() => void handleCopyUserId()}
              >
                {copied ? "ユーザーIDをコピーしました" : "ユーザーIDをコピー"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-celestial-textMain">アカウント</p>
              <p className="text-sm text-celestial-textSub">未ログイン</p>
            </div>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <label className="block text-sm text-celestial-textMain">
                メールアドレス
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  disabled={formBusy}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1 w-full rounded-md border border-celestial-border bg-nordic-surface px-3 py-2 text-sm text-celestial-textMain disabled:opacity-60"
                />
              </label>
              <button
                type="submit"
                disabled={formBusy}
                className="action-button rounded-md px-3 py-2 text-sm disabled:opacity-60"
              >
                {sendingMagicLink ? "ログインリンクを送信中" : "ログインリンクを送信"}
              </button>
            </form>
            {magicLinkSent ? (
              <p className="text-sm text-celestial-textMain">
                ログイン用メールを送信しました。
                <span className="mt-1 block text-xs text-celestial-textSub">
                  メール内のリンクから ConceptBook に戻ってください。
                </span>
              </p>
            ) : null}
          </div>
        )}

        {error ? (
          <p className="text-sm text-celestial-textMain" role="alert">
            {USER_FACING_AUTH_ERROR}
            <span className="mt-1 block text-xs text-celestial-textSub">
              {USER_FACING_AUTH_ERROR_LOCAL_NOTE}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
};
