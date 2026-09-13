export type AuthStatus = "loading" | "anonymous" | "authenticated" | "error";

/**
 * Cloud 上の安定したユーザー識別子。Issue #69 の UserAccount に対応する。
 * id は認証 Provider の user.id（Supabase Auth では auth.uid()）と同一。
 */
export type UserAccount = {
  id: string;
  displayName?: string;
  createdAt: string;
};

/**
 * アプリ内で扱う認証ユーザー。
 * email は設定画面の表示用であり、Concept / Quiz / 学習ログへコピーしない。
 */
export type AuthUser = UserAccount & {
  email?: string;
};

export type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  configured: boolean;
};

export type AuthUnsubscribe = () => void;

export type AuthClient = {
  isConfigured(): boolean;
  getCurrentUser(): Promise<AuthUser | null>;
  signInWithEmail(email: string): Promise<void>;
  signOut(): Promise<void>;
  subscribe(listener: (state: AuthState) => void): AuthUnsubscribe;
};
