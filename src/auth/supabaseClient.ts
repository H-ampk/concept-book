import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseBrowserConfig } from "./supabaseConfig";

let client: SupabaseClient | null | undefined;

/**
 * Supabase JS client の単一インスタンス。
 * コンポーネントから createClient() しない。
 *
 * session / token の保存は SDK に任せる（IndexedDB の Concept store には書かない）。
 */
export const getSupabaseClient = (): SupabaseClient | null => {
  if (client !== undefined) {
    return client;
  }

  const config = readSupabaseBrowserConfig();
  if (!config) {
    client = null;
    return null;
  }

  client = createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce"
    }
  });
  return client;
};

export const resetSupabaseClientForTests = (): void => {
  client = undefined;
};
