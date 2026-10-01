import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GettingStartedGuidePage } from "./GettingStartedGuidePage";

describe("GettingStartedGuidePage", () => {
  it("基本フローと各画面への導線を表示する", async () => {
    const user = userEvent.setup();
    const onCreateConcept = vi.fn();
    const onOpenConceptList = vi.fn();
    const onOpenQuizBuilder = vi.fn();
    const onOpenQuizPlay = vi.fn();
    const onOpenLearningLogs = vi.fn();
    const onOpenDataLab = vi.fn();

    render(
      <GettingStartedGuidePage
        onCreateConcept={onCreateConcept}
        onOpenConceptList={onOpenConceptList}
        onOpenQuizBuilder={onOpenQuizBuilder}
        onOpenQuizPlay={onOpenQuizPlay}
        onOpenLearningLogs={onOpenLearningLogs}
        onOpenDataLab={onOpenDataLab}
        onOpenSkillTree={vi.fn()}
        onOpenResearchReport={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "ConceptBook の使い方" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Concept を登録する/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Concept に情報を足す/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /クイズで学習する/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /学習結果を見る/ })).toBeInTheDocument();
    expect(screen.getAllByText(/勾配降下法/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("heading", { name: "もっと詳しく分析したいとき" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Concept を追加する" }));
    await user.click(screen.getByRole("button", { name: "Concept 一覧を見る" }));
    await user.click(screen.getByRole("button", { name: "クイズを作る" }));
    await user.click(screen.getByRole("button", { name: "クイズで学習する" }));
    await user.click(screen.getByRole("button", { name: "学習ログを見る" }));
    await user.click(screen.getByRole("button", { name: "Data Lab を見る" }));

    expect(onCreateConcept).toHaveBeenCalledTimes(1);
    expect(onOpenConceptList).toHaveBeenCalledTimes(1);
    expect(onOpenQuizBuilder).toHaveBeenCalledTimes(1);
    expect(onOpenQuizPlay).toHaveBeenCalledTimes(1);
    expect(onOpenLearningLogs).toHaveBeenCalledTimes(1);
    expect(onOpenDataLab).toHaveBeenCalledTimes(1);
  });
});
