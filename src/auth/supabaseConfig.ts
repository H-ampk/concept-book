export type SupabaseBrowserConfig = {
  url: string;
  publishableKey: string;
};

type EnvLike = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

const PLACEHOLDER_URLS = ["https://your-project.supabase.co"];
const PLACEHOLDER_KEYS = ["sb_publishable_xxx"];

const looksLikeSecretKey = (key: string): boolean => {
  const normalized = key.toLowerCase();
  return (
    normalized.includes("service_role") ||
    normalized.startsWith("sb_secret_") ||
    normalized.includes("supabase_secret_key")
  );
};

/**
 * ブラウザへ露出してよい publishable 設定のみを読む。
 * 未設定・placeholder・secret 相当は null（アプリは落とさない）。
 */
export const readSupabaseBrowserConfig = (env: EnvLike = import.meta.env): SupabaseBrowserConfig | null => {
  const url = env.VITE_SUPABASE_URL?.trim() ?? "";
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

  if (!url || !publishableKey) {
    return null;
  }

  if (PLACEHOLDER_URLS.includes(url) || PLACEHOLDER_KEYS.includes(publishableKey)) {
    return null;
  }

  if (looksLikeSecretKey(publishableKey)) {
    return null;
  }

  return { url, publishableKey };
};

export const isSupabaseConfigured = (env: EnvLike = import.meta.env): boolean =>
  readSupabaseBrowserConfig(env) !== null;
