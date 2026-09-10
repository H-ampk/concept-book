type QuizChoiceAppearanceArgs = {
  answered: boolean;
  isSelected: boolean;
  isCorrectChoice: boolean;
};

/** 回答確定前の選択状態。正解/不正解の意味色とは分離する。 */
export const QUIZ_PLAY_SELECTED_CHOICE_CLASS = "theme-selected";

export const quizPlayChoiceButtonClass = ({
  answered,
  isSelected,
  isCorrectChoice
}: QuizChoiceAppearanceArgs): string => {
  if (answered) {
    if (isCorrectChoice) {
      return "border-celestial-gold/60 bg-celestial-gold/10";
    }
    if (isSelected) {
      return "border-celestial-danger/45 bg-celestial-danger/5";
    }
    return "border-celestial-border/50 opacity-70";
  }
  if (isSelected) {
    return QUIZ_PLAY_SELECTED_CHOICE_CLASS;
  }
  return "border-celestial-border/80 hover:border-celestial-gold/35";
};

export const quizPlayChoiceRadioClass = ({
  answered,
  isSelected,
  isCorrectChoice
}: QuizChoiceAppearanceArgs): string => {
  if (!answered && isSelected) {
    return "border-current bg-[color-mix(in_srgb,var(--theme-button-selected-text)_22%,transparent)]";
  }
  if (answered && isCorrectChoice) {
    return "border-celestial-gold bg-celestial-gold/20";
  }
  if (answered && isSelected) {
    return "border-celestial-danger bg-celestial-danger/20";
  }
  return "border-celestial-border";
};

export const quizPlayChoiceUsesSelectedTheme = (args: QuizChoiceAppearanceArgs): boolean =>
  !args.answered && args.isSelected;
