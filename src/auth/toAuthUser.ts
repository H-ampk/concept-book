import type { AuthUser } from "./types";

/**
 * 認証 Provider の user 表現。Supabase の User をアプリ全体へばら撒かないための最小形。
 */
export type AuthProviderUser = {
  id: string;
  email?: string | null;
  created_at?: string;
  user_metadata?: Record<string, unknown> | null;
};

const metadataDisplayName = (metadata: Record<string, unknown> | null | undefined): string | undefined => {
  if (!metadata) {
    return undefined;
  }
  const candidates = [metadata.display_name, metadata.full_name, metadata.name];
  const found = candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return found?.trim();
};

export const toAuthUser = (user: AuthProviderUser): AuthUser => {
  const displayName = metadataDisplayName(user.user_metadata);
  const email = user.email?.trim() ? user.email.trim() : undefined;

  return {
    id: user.id,
    ...(email ? { email } : {}),
    ...(displayName ? { displayName } : {}),
    createdAt: user.created_at ?? "1970-01-01T00:00:00.000Z"
  };
};
