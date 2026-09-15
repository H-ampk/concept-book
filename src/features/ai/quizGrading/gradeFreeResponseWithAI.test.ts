import { describe, expect, it, vi } from "vitest";
import { AIError } from "../errors";
import type { AITextProvider } from "../types";
import { gradeFreeResponseWithAI } from "./gradeFreeResponseWithAI";

const textProvider = (generate: AITextProvider["generate"]): AITextProvider => ({ generate });

describe("gradeFreeResponseWithAI", () => {
  it("generate を1回呼び、parse 結果を返す", async () => {
    const generate = vi.fn(async () => ({
      text: JSON.stringify({
        evaluation: "partial",
        reason: "中心的な説明はできていますが、正解ラベルへの言及が不足しています。"
      })
    }));

    const result = await gradeFreeResponseWithAI({
      questionPrompt: "教師あり学習とは何ですか？",
      userAnswer: "ラベル付きデータを使う方法",
      referenceAnswer: "入力データと正解ラベルの組を用いて学習する手法",
      provider: textProvider(generate)
    });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      evaluation: "partial",
      reason: "中心的な説明はできていますが、正解ラベルへの言及が不足しています。"
    });
  });

  it("Provider error を握りつぶさず reject する", async () => {
    const generate = vi.fn(async () => {
      throw new AIError("timeout", "AI応答がタイムアウトしました。");
    });

    await expect(
      gradeFreeResponseWithAI({
        questionPrompt: "q",
        userAnswer: "a",
        referenceAnswer: "r",
        provider: textProvider(generate)
      })
    ).rejects.toMatchObject({ code: "timeout" });
  });
});
