import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseClient, resetSupabaseClientForTests } from "./supabaseClient";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { signOut: vi.fn() } }))
}));

describe("getSupabaseClient", () => {
  afterEach(() => {
    resetSupabaseClientForTests();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("環境変数が無いとき createClient せず null を返す", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    expect(getSupabaseClient()).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("設定があるとき createClient は一度だけ呼ばれる", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://abcd.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_live_example");
    const first = getSupabaseClient();
    const second = getSupabaseClient();
    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      "https://abcd.supabase.co",
      "sb_publishable_live_example",
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce"
        }
      }
    );
  });
});
