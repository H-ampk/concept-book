import { describe, expect, it, vi } from "vitest";
import { noteQuizLearningRevision, subscribeQuizLearningRevision } from "./quizLearningRevision";

describe("quizLearningRevision", () => {
  it("購読者へ変更種別を渡し、解除後は呼ばない", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeQuizLearningRevision(listener);
    noteQuizLearningRevision("logs");
    noteQuizLearningRevision("both");
    unsubscribe();
    noteQuizLearningRevision("questions");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, { logs: true, questions: false });
    expect(listener).toHaveBeenNthCalledWith(2, { logs: true, questions: true });
  });
});