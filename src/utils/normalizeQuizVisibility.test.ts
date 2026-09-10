import { describe, expect, it } from "vitest";
import { normalizeQuizVisibility } from "./normalizeQuizVisibility";

describe("normalizeQuizVisibility", () => {
  it("private はそのまま残す", () => {
    expect(normalizeQuizVisibility("private")).toBe("private");
  });

  it("shareable はそのまま残す", () => {
    expect(normalizeQuizVisibility("shareable")).toBe("shareable");
  });

  it("legacy public を shareable へ正規化する", () => {
    expect(normalizeQuizVisibility("public")).toBe("shareable");
  });

  it("undefined は private にする", () => {
    expect(normalizeQuizVisibility(undefined)).toBe("private");
  });

  it("unknown は private にする", () => {
    expect(normalizeQuizVisibility("unknown")).toBe("private");
    expect(normalizeQuizVisibility(1)).toBe("private");
    expect(normalizeQuizVisibility(null)).toBe("private");
    expect(normalizeQuizVisibility("")).toBe("private");
  });
});
