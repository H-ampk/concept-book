import { describe, expect, it } from "vitest";
import { attachDomainColorsToBackup } from "./domainColors";
import { buildConceptBookZip, parseConceptBookZip } from "./conceptBookZip";
import { validateBackupImportPayload } from "./conceptImportValidation";

describe("conceptBookZip domainColors", () => {
  it("ZIP内 concepts.json にdomainColorsが含まれる", () => {
    const json = JSON.stringify(
      attachDomainColorsToBackup(
        { concepts: [], contextCards: [], quizQuestions: [], quizDecks: [] },
        { 人工知能: "#2563EB" }
      )
    );
    const zipped = buildConceptBookZip(json, []);
    const parsed = parseConceptBookZip(
      zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength)
    );
    const concepts = JSON.parse(parsed.conceptsText) as { domainColors?: Record<string, string> };
    expect(concepts.domainColors).toEqual({ 人工知能: "#2563EB" });
  });

  it("ZIP内 concepts.json のdomainColorsをJSON importと同じルールで扱う", () => {
    const json = JSON.stringify({
      concepts: [],
      contextCards: [],
      quizQuestions: [],
      quizDecks: [],
      domainColors: { 人工知能: "#2563EB", bad: "nope" }
    });
    const zipped = buildConceptBookZip(json, []);
    const parsed = parseConceptBookZip(
      zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength)
    );
    const result = validateBackupImportPayload(JSON.parse(parsed.conceptsText));
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.domainColors).toEqual({ 人工知能: "#2563EB" });
  });
});

describe("conceptBookZip quizAttemptLogs", () => {
  it("ON の ZIP には学習ログが入る", () => {
    const json = JSON.stringify({
      concepts: [{ id: "c1" }],
      contextCards: [{ id: "cc1" }],
      quizQuestions: [{ id: "q1" }],
      quizDecks: [{ id: "d1" }],
      quizAttemptLogs: [{ id: "log1" }]
    });
    const zipped = buildConceptBookZip(json, [{ id: "m1", data: new Uint8Array([1, 2, 3]) }]);
    const parsed = parseConceptBookZip(
      zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength)
    );
    const backup = JSON.parse(parsed.conceptsText) as {
      quizAttemptLogs: { id: string }[];
    };
    expect(backup.quizAttemptLogs).toEqual([{ id: "log1" }]);
    expect(parsed.mediaEntries.get("m1")).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("OFF の ZIP では quizAttemptLogs が [] でもメディアとその他データは維持される", () => {
    const json = JSON.stringify({
      concepts: [{ id: "c1", title: "概念" }],
      contextCards: [{ id: "cc1" }],
      quizQuestions: [{ id: "q1" }],
      quizDecks: [{ id: "d1" }],
      quizAttemptLogs: []
    });
    const zipped = buildConceptBookZip(json, [{ id: "m1", data: new Uint8Array([9, 8, 7]) }]);
    const parsed = parseConceptBookZip(
      zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength)
    );
    const backup = JSON.parse(parsed.conceptsText) as {
      concepts: unknown[];
      contextCards: unknown[];
      quizQuestions: unknown[];
      quizDecks: unknown[];
      quizAttemptLogs: unknown[];
    };
    expect(backup.quizAttemptLogs).toEqual([]);
    expect(backup.concepts).toEqual([{ id: "c1", title: "概念" }]);
    expect(backup.contextCards).toEqual([{ id: "cc1" }]);
    expect(backup.quizQuestions).toEqual([{ id: "q1" }]);
    expect(backup.quizDecks).toEqual([{ id: "d1" }]);
    expect(parsed.mediaEntries.get("m1")).toEqual(new Uint8Array([9, 8, 7]));
  });
});

describe("conceptBookZip QuizQuestion.source round-trip", () => {
  it("ZIP export → parse → validate で source が保持される", () => {
    const source = {
      type: "contextualConceptCard" as const,
      sourceId: "ccc_zip",
      sourceTitle: "ZIP出典",
      fieldName: "心理学"
    };
    const json = JSON.stringify({
      concepts: [],
      contextCards: [],
      quizQuestions: [
        {
          id: "question_1",
          prompt: "問い",
          choices: [
            { id: "a", text: "A" },
            { id: "b", text: "B" }
          ],
          correctChoiceId: "a",
          visibility: "private",
          schemaVersion: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          source
        }
      ],
      quizDecks: []
    });
    const zipped = buildConceptBookZip(json, []);
    const parsed = parseConceptBookZip(
      zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength)
    );
    const result = validateBackupImportPayload(JSON.parse(parsed.conceptsText));
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.quizQuestions[0]?.source).toEqual(source);
  });
});

describe("conceptBookZip QuizChoice metadata round-trip", () => {
  it("ZIP export → parse → validate で Choice metadata が保持される", () => {
    const choice = {
      id: "a",
      text: "オペラント条件づけ",
      displayText: "○○条件づけ",
      linkedConceptId: "c_operant",
      sourceConceptId: "c_source",
      contextDefinitionId: "ctx_1",
      sourceStrategy: "same-context" as const
    };
    const json = JSON.stringify({
      concepts: [],
      contextCards: [],
      quizQuestions: [
        {
          id: "question_1",
          prompt: "問い",
          choices: [choice, { id: "b", text: "古典的条件づけ" }],
          correctChoiceId: "a",
          visibility: "private",
          schemaVersion: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      ],
      quizDecks: []
    });
    const zipped = buildConceptBookZip(json, []);
    const parsed = parseConceptBookZip(
      zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength)
    );
    const result = validateBackupImportPayload(JSON.parse(parsed.conceptsText));
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.quizQuestions[0]?.choices.find((c) => c.id === "a")).toEqual(choice);
  });
});

describe("conceptBookZip free-response round-trip", () => {
  it("ZIP export → parse → validate で入力式 Question / Log の新フィールドが保持される", () => {
    const json = JSON.stringify({
      concepts: [],
      contextCards: [],
      quizQuestions: [
        {
          id: "q_fr",
          questionType: "free-response",
          prompt: "教師あり学習とは？",
          choices: [],
          correctChoiceId: "",
          referenceAnswer: "ラベル付きデータで学習する",
          visibility: "private",
          schemaVersion: 2,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      ],
      quizDecks: [],
      quizAttemptLogs: [
        {
          id: "log_fr",
          questionId: "q_fr",
          questionType: "free-response",
          questionPromptSnapshot: "教師あり学習とは？",
          selectedChoiceId: "",
          selectedChoiceTextSnapshot: "",
          correctChoiceId: "",
          correctChoiceTextSnapshot: "",
          userAnswerTextSnapshot: "自分の答え",
          referenceAnswerSnapshot: "ラベル付きデータで学習する",
          selfEvaluation: "incorrect",
          correct: false,
          startedAt: "2026-01-01T00:00:00.000Z",
          answeredAt: "2026-01-01T00:00:01.000Z",
          timeMs: 12,
          schemaVersion: 2
        }
      ]
    });
    const zipped = buildConceptBookZip(json, []);
    const parsed = parseConceptBookZip(
      zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength)
    );
    const result = validateBackupImportPayload(JSON.parse(parsed.conceptsText));
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.quizQuestions[0]?.questionType).toBe("free-response");
    expect(result.quizQuestions[0]?.referenceAnswer).toBe("ラベル付きデータで学習する");
    expect(result.quizAttemptLogs[0]?.selfEvaluation).toBe("incorrect");
    expect(result.quizAttemptLogs[0]?.userAnswerTextSnapshot).toBe("自分の答え");
    expect(result.quizAttemptLogs[0]?.referenceAnswerSnapshot).toBe("ラベル付きデータで学習する");
  });
});

