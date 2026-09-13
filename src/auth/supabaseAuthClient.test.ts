import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAuthClient, type SupabaseAuthApi } from "./supabaseAuthClient";
import { USER_FACING_AUTH_ERROR } from "./userFacingAuthError";

const user = {
  id: "user-stable-id",
  email: "reader@example.com",
  created_at: "2026-01-01T00:00:00.000Z",
  user_metadata: {}
};

const createAuthApi = (): SupabaseAuthApi & {
  unsubscribe: ReturnType<typeof vi.fn>;
} => {
  const unsubscribe = vi.fn();
  return {
    getSession: vi.fn(async () => ({
      data: { session: { user } },
      error: null
    })),
    signInWithOtp: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe } }
    })),
    unsubscribe
  };
};

describe("createSupabaseAuthClient", () => {
  let api: ReturnType<typeof createAuthApi>;

  beforeEach(() => {
    api = createAuthApi();
  });

  it("currentUser を取得でき、id は Provider user.id のまま", async () => {
    const client = createSupabaseAuthClient({
      supabaseAuth: api,
      getEmailRedirectTo: () => "http://localhost:5173/"
    });
    const current = await client.getCurrentUser();
    expect(current?.id).toBe("user-stable-id");
    expect(current?.email).toBe("reader@example.com");
  });

  it("signInWithEmail が email と app base の redirect URL を渡す", async () => {
    const client = createSupabaseAuthClient({
      supabaseAuth: api,
      getEmailRedirectTo: () => "https://h-ampk.github.io/concept-book/"
    });
    await client.signInWithEmail("  reader@example.com ");
    expect(api.signInWithOtp).toHaveBeenCalledWith({
      email: "reader@example.com",
      options: { emailRedirectTo: "https://h-ampk.github.io/concept-book/" }
    });
  });

  it("signOut は Provider の logout だけを呼ぶ", async () => {
    const client = createSupabaseAuthClient({
      supabaseAuth: api,
      getEmailRedirectTo: () => "http://localhost:5173/"
    });
    await client.signOut();
    expect(api.signOut).toHaveBeenCalledTimes(1);
  });

  it("auth state change を購読し、unsubscribe できる", async () => {
    const client = createSupabaseAuthClient({
      supabaseAuth: api,
      getEmailRedirectTo: () => "http://localhost:5173/"
    });
    const listener = vi.fn();
    const unsubscribe = client.subscribe(listener);

    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalled();
    });
    expect(listener.mock.calls[0]?.[0]).toMatchObject({
      status: "authenticated",
      user: { id: "user-stable-id" },
      configured: true
    });

    unsubscribe();
    expect(api.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe 後の getSession 完了では listener を呼ばない", async () => {
    let resolveSession: (value: {
      data: { session: { user: typeof user } | null };
      error: null;
    }) => void = () => undefined;
    api.getSession = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        })
    );

    const client = createSupabaseAuthClient({
      supabaseAuth: api,
      getEmailRedirectTo: () => "http://localhost:5173/"
    });
    const listener = vi.fn();
    const unsubscribe = client.subscribe(listener);
    unsubscribe();
    resolveSession({ data: { session: { user } }, error: null });
    await Promise.resolve();
    expect(listener).not.toHaveBeenCalled();
  });

  it("signIn 失敗時はユーザー列挙に使える詳細を投げない", async () => {
    api.signInWithOtp = vi.fn(async () => ({ error: { message: "User not found" } }));
    const client = createSupabaseAuthClient({
      supabaseAuth: api,
      getEmailRedirectTo: () => "http://localhost:5173/"
    });
    await expect(client.signInWithEmail("missing@example.com")).rejects.toThrow(USER_FACING_AUTH_ERROR);
  });
});
