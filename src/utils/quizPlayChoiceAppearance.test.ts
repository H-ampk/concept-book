import { describe, expect, it } from "vitest";
import {
  QUIZ_PLAY_SELECTED_CHOICE_CLASS,
  quizPlayChoiceButtonClass,
  quizPlayChoiceRadioClass,
  quizPlayChoiceUsesSelectedTheme
} from "./quizPlayChoiceAppearance";

describe("quizPlayChoiceAppearance", () => {
  it("回答前の選択中は selectedButton 系 token を使う", () => {
    const args = { answered: false, isSelected: true, isCorrectChoice: false };
    expect(quizPlayChoiceButtonClass(args)).toBe(QUIZ_PLAY_SELECTED_CHOICE_CLASS);
    expect(quizPlayChoiceButtonClass(args)).toContain("theme-selected");
    expect(quizPlayChoiceButtonClass(args)).not.toContain("celestial-gold");
    expect(quizPlayChoiceRadioClass(args)).toContain("--theme-button-selected-text");
    expect(quizPlayChoiceUsesSelectedTheme(args)).toBe(true);
  });

  it("未選択の選択肢は selected token を使わない", () => {
    const args = { answered: false, isSelected: false, isCorrectChoice: false };
    expect(quizPlayChoiceButtonClass(args)).not.toContain("theme-selected");
    expect(quizPlayChoiceUsesSelectedTheme(args)).toBe(false);
  });

  it("正解表示は gold 系のまま（selectedButton に置き換えない）", () => {
    const args = { answered: true, isSelected: true, isCorrectChoice: true };
    const button = quizPlayChoiceButtonClass(args);
    expect(button).toContain("celestial-gold");
    expect(button).not.toContain("theme-selected");
    expect(quizPlayChoiceRadioClass(args)).toContain("celestial-gold");
    expect(quizPlayChoiceUsesSelectedTheme(args)).toBe(false);
  });

  it("不正解表示は danger 系のまま", () => {
    const args = { answered: true, isSelected: true, isCorrectChoice: false };
    const button = quizPlayChoiceButtonClass(args);
    expect(button).toContain("celestial-danger");
    expect(button).not.toContain("theme-selected");
    expect(quizPlayChoiceRadioClass(args)).toContain("celestial-danger");
  });
});
