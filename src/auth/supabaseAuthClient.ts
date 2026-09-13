import type { AuthClient, AuthState, AuthUnsubscribe, AuthUser } from "./types";
import { resolveAppBaseUrl } from "./resolveAppBaseUrl";
import { stripAuthCallbackFromLocation } from "./stripAuthCallbackUrl";
import { toAuthUser, type AuthProviderUser } from "./toAuthUser";
import { USER_FACING_AUTH_ERROR } from "./userFacingAuthError";

type AuthSessionLike = {
  user: AuthProviderUser;
} | null;

export type SupabaseAuthApi = {
  getSession: () => Promise<{
    data: { session: AuthSessionLike };
    error: { message: string } | null;
  }>;
  signInWithOtp: (credentials: {
    email: string;
    options?: { emailRedirectTo?: string };
  }) => Promise<{ error: { message: string } | null }>;
  /**
   * Supabase session を終了するだけ。IndexedDB の Concept データは削除しない。
   */
  signOut: () => Promise<{ error: { message: string } | null }>;
  onAuthStateChange: (
    callback: (event: string, session: AuthSessionLike) => void
  ) => {
    data: { subscription: { unsubscribe: () => void } };
  };
};

export type CreateSupabaseAuthClientOptions = {
  supabaseAuth: SupabaseAuthApi;
  getEmailRedirectTo?: () => string;
};

const toState = (session: AuthSessionLike, errorMessage?: string | null): AuthState => {
  if (errorMessage) {
    return {
      status: "error",
      user: null,
      error: USER_FACING_AUTH_ERROR,
      configured: true
    };
  }
  const user = session?.user ? toAuthUser(session.user) : null;
  return {
    status: user ? "authenticated" : "anonymous",
    user,
    error: null,
    configured: true
  };
};

export const createSupabaseAuthClient = ({
  supabaseAuth,
  getEmailRedirectTo = resolveAppBaseUrl
}: CreateSupabaseAuthClientOptions): AuthClient => {
  const getCurrentUser = async (): Promise<AuthUser | null> => {
    try {
      const { data, error } = await supabaseAuth.getSession();
      if (error || !data.session?.user) {
        return null;
      }
      return toAuthUser(data.session.user);
    } catch {
      return null;
    }
  };

  return {
    isConfigured: () => true,
    getCurrentUser,
    signInWithEmail: async (email: string) => {
      const trimmed = email.trim();
      const { error } = await supabaseAuth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: getEmailRedirectTo()
        }
      });
      if (error) {
        throw new Error(USER_FACING_AUTH_ERROR);
      }
    },
    signOut: async () => {
      const { error } = await supabaseAuth.signOut();
      if (error) {
        throw new Error(USER_FACING_AUTH_ERROR);
      }
    },
    subscribe: (listener: (state: AuthState) => void): AuthUnsubscribe => {
      let active = true;

      const emit = (session: AuthSessionLike, errorMessage?: string | null) => {
        if (!active) {
          return;
        }
        listener(toState(session, errorMessage));
      };

      void supabaseAuth
        .getSession()
        .then(({ data, error }) => {
          emit(data.session, error?.message);
          stripAuthCallbackFromLocation();
        })
        .catch(() => {
          emit(null, USER_FACING_AUTH_ERROR);
        });

      const {
        data: { subscription }
      } = supabaseAuth.onAuthStateChange((_event, session) => {
        emit(session);
      });

      return () => {
        active = false;
        subscription.unsubscribe();
      };
    }
  };
};
