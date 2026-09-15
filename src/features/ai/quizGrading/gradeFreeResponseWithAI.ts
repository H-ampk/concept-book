import type { AITextProvider } from "../types";
import { buildFreeResponseGradingMessages } from "./buildFreeResponseGradingPrompt";
import { parseFreeResponseGrading } from "./parseFreeResponseGrading";
import type { FreeResponseAIGrade, GradeFreeResponseWithAIInput } from "./types";

export type GradeFreeResponseWithAIOptions = GradeFreeResponseWithAIInput & {
  provider: AITextProvider;
};

export const gradeFreeResponseWithAI = async (
  options: GradeFreeResponseWithAIOptions
): Promise<FreeResponseAIGrade> => {
  const messages = buildFreeResponseGradingMessages({
    questionPrompt: options.questionPrompt,
    userAnswer: options.userAnswer,
    referenceAnswer: options.referenceAnswer
  });
  const { text } = await options.provider.generate({ messages });
  return parseFreeResponseGrading(text);
};
