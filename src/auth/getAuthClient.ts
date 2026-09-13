import type { AuthClient, AuthUser } from "./types";
import { getSupabaseClient } from "./supabaseClient";
import { createSupabaseAuthClient } from "./supabaseAuthClient";
import { createUnconfiguredAuthClient } from "./unconfiguredAuthClient";

let authClient: AuthClient | undefined;

const createDefaultAuthClient = (): AuthClient => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return createUnconfiguredAuthClient();
  }
  return createSupabaseAuthClient({ supabaseAuth: supabase.auth });
};

/**
 * アプリ全体で共有する AuthClient。
 * 後続の Sync Service は UI から任意の userId を受け取らず、ここから currentUser を取得する。
 */
export const getAuthClient = (): AuthClient => {
  if (!authClient) {
    authClient = createDefaultAuthClient();
  }
  return authClient;
};

export const getCurrentUser = async (): Promise<AuthUser | null> => getAuthClient().getCurrentUser();

export const resetAuthClientForTests = (): void => {
  authClient = undefined;
};
