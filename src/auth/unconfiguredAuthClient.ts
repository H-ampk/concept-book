import type { AuthClient, AuthState, AuthUnsubscribe, AuthUser } from "./types";

const UNCONFIGURED_STATE: AuthState = {
  status: "anonymous",
  user: null,
  error: null,
  configured: false
};

/**
 * Supabase 環境変数が無いときの AuthClient。
 * 認証だけ unavailable にし、アプリ本体は起動したままにする。
 */
export const createUnconfiguredAuthClient = (): AuthClient => ({
  isConfigured: () => false,
  getCurrentUser: async (): Promise<AuthUser | null> => null,
  signInWithEmail: async () => {
    throw new Error("supabase-unconfigured");
  },
  signOut: async () => undefined,
  subscribe: (listener: (state: AuthState) => void): AuthUnsubscribe => {
    listener(UNCONFIGURED_STATE);
    return () => undefined;
  }
});
