import { describe, expect, it } from "vitest";
import { isSupabaseConfigured, readSupabaseBrowserConfig } from "./supabaseConfig";

describe("readSupabaseBrowserConfig", () => {
  it("未設定なら null を返し throw しない", () => {
    expect(readSupabaseBrowserConfig({})).toBeNull();
    expect(isSupabaseConfigured({})).toBe(false);
  });

  it("placeholder は未設定として扱う", () => {
    expect(
      readSupabaseBrowserConfig({
        VITE_SUPABASE_URL: "https://your-project.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xxx"
      })
    ).toBeNull();
  });

  it("secret 相当のキーは拒否する", () => {
    expect(
      readSupabaseBrowserConfig({
        VITE_SUPABASE_URL: "https://abcd.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "service_role_secret"
      })
    ).toBeNull();
  });

  it("publishable key を受け入れる", () => {
    expect(
      readSupabaseBrowserConfig({
        VITE_SUPABASE_URL: "https://abcd.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_live_example"
      })
    ).toEqual({
      url: "https://abcd.supabase.co",
      publishableKey: "sb_publishable_live_example"
    });
  });
});
