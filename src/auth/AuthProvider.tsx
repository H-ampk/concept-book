import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { getAuthClient } from "./getAuthClient";
import type { AuthClient, AuthState, AuthUser } from "./types";
import { USER_FACING_AUTH_ERROR } from "./userFacingAuthError";

export type AuthContextValue = AuthState & {
  currentUser: AuthUser | null;
  sendingMagicLink: boolean;
  magicLinkSent: boolean;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const UNAVAILABLE_AUTH_VALUE: AuthContextValue = {
  status: "anonymous",
  user: null,
  currentUser: null,
  error: null,
  configured: false,
  sendingMagicLink: false,
  magicLinkSent: false,
  signInWithEmail: async () => undefined,
  signOut: async () => undefined
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
  client?: AuthClient;
};

/**
 * 認証状態を提供する。ログイン必須のゲートではない。
 * 初期化中でも children は描画し、アプリ全体を loading screen で塞がない。
 */
export const AuthProvider = ({ children, client }: AuthProviderProps) => {
  const authClient = useMemo(() => client ?? getAuthClient(), [client]);
  const [state, setState] = useState<AuthState>(() => ({
    status: authClient.isConfigured() ? "loading" : "anonymous",
    user: null,
    error: null,
    configured: authClient.isConfigured()
  }));
  const [sendingMagicLink, setSendingMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = authClient.subscribe((next) => {
      setState(next);
    });
    return unsubscribe;
  }, [authClient]);

  const signInWithEmail = useCallback(
    async (email: string) => {
      setSendingMagicLink(true);
      setActionError(null);
      setMagicLinkSent(false);
      try {
        await authClient.signInWithEmail(email);
        setMagicLinkSent(true);
      } catch {
        setActionError(USER_FACING_AUTH_ERROR);
      } finally {
        setSendingMagicLink(false);
      }
    },
    [authClient]
  );

  const signOut = useCallback(async () => {
    setActionError(null);
    setMagicLinkSent(false);
    try {
      await authClient.signOut();
    } catch {
      setActionError(USER_FACING_AUTH_ERROR);
    }
  }, [authClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      currentUser: state.user,
      error: actionError ?? state.error,
      sendingMagicLink,
      magicLinkSent,
      signInWithEmail,
      signOut
    }),
    [actionError, magicLinkSent, sendingMagicLink, signInWithEmail, signOut, state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Provider 未設置時は unconfigured / anonymous 相当を返し、既存テストや局所 render を落とさない。
 */
export const useAuth = (): AuthContextValue => useContext(AuthContext) ?? UNAVAILABLE_AUTH_VALUE;
