import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthClient, getCurrentUser, resetAuthClientForTests } from "./getAuthClient";
import { resetSupabaseClientForTests } from "./supabaseClient";

describe("getAuthClient", () => {
  afterEach(() => {
    resetAuthClientForTests();
    resetSupabaseClientForTests();
    vi.unstubAllEnvs();
  });

  it("未設定でも crash せず currentUser は null", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    const client = getAuthClient();
    expect(client.isConfigured()).toBe(false);
    await expect(getCurrentUser()).resolves.toBeNull();
  });
});
