export type QuizLearningRevisionKind = "logs" | "questions";

export type QuizLearningRevisionChange = {
  logs: boolean;
  questions: boolean;
};

type RevisionListener = (change: QuizLearningRevisionChange) => void;

const CHANNEL_NAME = "concept-book-quiz-learning";

const tabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const listeners = new Set<RevisionListener>();

let channel: BroadcastChannel | null = null;

const ensureChannel = (): BroadcastChannel | null => {
  if (channel || typeof BroadcastChannel === "undefined") {
    return channel;
  }
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<QuizLearningRevisionMessage>) => {
      const data = event.data;
      if (!data || data.source === tabId) {
        return;
      }
      if (data.kind !== "logs" && data.kind !== "questions" && data.kind !== "both") {
        return;
      }
      emit(data.kind, false);
    };
  } catch {
    channel = null;
  }
  return channel;
};

type QuizLearningRevisionMessage = {
  source: string;
  kind: QuizLearningRevisionKind | "both";
};

const emit = (kind: QuizLearningRevisionKind | "both", broadcast: boolean): void => {
  const change: QuizLearningRevisionChange = {
    logs: kind === "logs" || kind === "both",
    questions: kind === "questions" || kind === "both"
  };
  for (const listener of listeners) {
    listener(change);
  }
  if (!broadcast) {
    return;
  }
  const active = ensureChannel();
  try {
    active?.postMessage({ source: tabId, kind } satisfies QuizLearningRevisionMessage);
  } catch {
    // 他タブへの通知に失敗しても、このタブの無効化は維持する。
  }
};

/** 保存成功後に呼ぶ。失敗した書き込みでは呼ばない。 */
export const noteQuizLearningRevision = (kind: QuizLearningRevisionKind | "both"): void => {
  emit(kind, true);
};

export const subscribeQuizLearningRevision = (listener: RevisionListener): (() => void) => {
  ensureChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
