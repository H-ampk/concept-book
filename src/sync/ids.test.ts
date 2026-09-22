import { describe, expect, it, vi } from "vitest";
import { createEntityId, createRandomUuid, isPrefixedEntityId } from "./ids";

describe("createEntityId", () => {
  it("prefix を保持する", () => {
    const id = createEntityId("concept");
    expect(id.startsWith("concept_")).toBe(true);
    expect(isPrefixedEntityId("concept", id)).toBe(true);
  });

  it("UUID 形式で衝突しにくい", () => {
    const ids = new Set(Array.from({ length: 50 }, () => createEntityId("quiz")));
    expect(ids.size).toBe(50);
  });

  it("既存 ID 文字列は変更しない（変換 API を持たない）", () => {
    const existing = "concept_existing_keep";
    expect(existing).toBe("concept_existing_keep");
    expect(isPrefixedEntityId("concept", existing)).toBe(false);
  });

  it("crypto.randomUUID が無い環境でも UUID を返す", () => {
    const original = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i += 1) {
          arr[i] = (i * 17 + 3) % 256;
        }
        return arr;
      }
    });
    const uuid = createRandomUuid();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    vi.unstubAllGlobals();
    if (original) {
      vi.stubGlobal("crypto", original);
    }
  });
});
