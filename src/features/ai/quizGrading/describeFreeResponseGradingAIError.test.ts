import { describe, expect, it } from "vitest";
import { AIError } from "../errors";
import { describeFreeResponseGradingAIError } from "./describeFreeResponseGradingAIError";

describe("describeFreeResponseGradingAIError", () => {
  it("既存 AIError message を併記する", () => {
    const message = describeFreeResponseGradingAIError(
      new AIError("connection-failed", "Ollamaに接続できませんでした。")
    );
    expect(message).toContain("AI採点補助を利用できませんでした。");
    expect(message).toContain("自己評価はそのまま続けられます。");
    expect(message).toContain("Ollamaに接続できませんでした。");
  });
});
