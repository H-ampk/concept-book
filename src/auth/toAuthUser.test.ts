import { describe, expect, it } from "vitest";
import { toAuthUser } from "./toAuthUser";

describe("toAuthUser", () => {
  it("Supabase user.id をそのまま stable ID にする", () => {
    const user = toAuthUser({
      id: "11111111-2222-3333-4444-555555555555",
      email: "reader@example.com",
      created_at: "2026-01-02T03:04:05.000Z",
      user_metadata: { full_name: "Reader" }
    });

    expect(user).toEqual({
      id: "11111111-2222-3333-4444-555555555555",
      email: "reader@example.com",
      displayName: "Reader",
      createdAt: "2026-01-02T03:04:05.000Z"
    });
  });

  it("email / displayName が無くても id と createdAt を返す", () => {
    const user = toAuthUser({
      id: "stable-id",
      created_at: "2026-03-01T00:00:00.000Z"
    });
    expect(user.id).toBe("stable-id");
    expect(user.email).toBeUndefined();
    expect(user.displayName).toBeUndefined();
    expect(user.createdAt).toBe("2026-03-01T00:00:00.000Z");
  });
});
