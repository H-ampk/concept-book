import { useEffect, useState } from "react";
import type { Concept } from "../types/concept";
import type { QuizCreateSourceType, QuizQuestion } from "../types/quiz";
import { QuizCreateSourceStep } from "./QuizCreateSourceStep";
import { QuizSetFromContextCardPanel } from "./QuizSetFromContextCardPanel";
import { QuizSetFromDomainTagPanel } from "./QuizSetFromDomainTagPanel";

export type QuizCreateInitialState = {
  sourceType: QuizCreateSourceType;
  selectedContextCardId?: string;
  selectedContextualCardId?: string;
};

type Step = "source" | "contextual" | "contextCard";

type Props = {
  open: boolean;
  concepts: Concept[];
  allQuestions: QuizQuestion[];
  initialState?: QuizCreateInitialState | null;
  onClose: () => void;
  onSaved: () => void;
};

function resolveInitialStep(initialState?: QuizCreateInitialState | null): Step {
  if (!initialState) {
    return "source";
  }
  if (initialState.sourceType === "contextCard") {
    return "contextCard";
  }
  return "contextual";
}

export const QuizCreateModal = ({
  open,
  concepts,
  allQuestions,
  initialState,
  onClose,
  onSaved
}: Props) => {
  const [step, setStep] = useState<Step>(() => resolveInitialStep(initialState));

  useEffect(() => {
    if (open) {
      setStep(resolveInitialStep(initialState));
    }
  }, [open, initialState]);

  if (!open) {
    return null;
  }

  const handleClose = () => {
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-nordic-overlay px-3 py-6 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-create-title"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto scrollbar-none rounded-2xl border border-celestial-border bg-celestial-panel p-4 shadow-xl sm:p-5">
        {step === "source" ? (
          <div>
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
                onClick={handleClose}
              >
                閉じる
              </button>
            </div>
            <QuizCreateSourceStep
              onSelect={(sourceType) => {
                setStep(sourceType === "contextCard" ? "contextCard" : "contextual");
              }}
            />
          </div>
        ) : null}

        {step === "contextual" ? (
          <QuizSetFromDomainTagPanel
            concepts={concepts}
            allQuestions={allQuestions}
            initialContextualCardId={initialState?.selectedContextualCardId}
            onBack={initialState?.selectedContextualCardId ? undefined : () => setStep("source")}
            onClose={handleClose}
            onSaved={onSaved}
          />
        ) : null}

        {step === "contextCard" ? (
          <QuizSetFromContextCardPanel
            concepts={concepts}
            allQuestions={allQuestions}
            initialContextCardId={initialState?.selectedContextCardId}
            onBack={initialState?.selectedContextCardId ? undefined : () => setStep("source")}
            onClose={handleClose}
            onSaved={onSaved}
          />
        ) : null}
      </div>
    </div>
  );
};
