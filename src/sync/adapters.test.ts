import { describe, expect, it } from "vitest";
import type { Concept } from "../types/concept";
import {
  toConceptSyncRecord,
  toContextCardSyncRecord,
  toPrivateSyncRecord,
  toQuizAttemptLogSyncRecord,
  toQuizDeckSyncRecord,
  toQuizQuestionSyncRecord,
  toSettingSyncRecord
} from "./adapters";
import { getSyncStrategy } from "./entityConfig";
import {
  ISO,
  OWNER,
  sampleConcept,
  sampleContextCard,
  sampleQuizAttemptLog,
  sampleQuizDeck,
  sampleQuizQuestion
} from "./fixtures";
import { PRIVATE_SYNC_INITIAL_VERSION, PRIVATE_SYNC_SCHEMA_VERSION } from "./types";

describe("toPrivateSyncRecord", () => {
  it("Concept を versioned PrivateSyncRecord にする", () => {
    const concept = sampleConcept();
    const record = toConceptSyncRecord({ data: concept, ownerUserId: OWNER, deviceId: "dev-1" });
    expect(record.entityType).toBe("concept");
    expect(record.data).toEqual(concept);
    expect(record.data.id).toBe(concept.id);
    expect(record.strategy).toBe("versioned");
    expect(record.schemaVersion).toBe(PRIVATE_SYNC_SCHEMA_VERSION);
    expect(record.metadata.ownerUserId).toBe(OWNER);
    expect(record.metadata.version).toBe(PRIVATE_SYNC_INITIAL_VERSION);
    expect(record.metadata.updatedAt).toBe(ISO);
    expect(record.metadata.deviceId).toBe("dev-1");
    expect(record.metadata.deletedAt).toBeUndefined();
    const data: Concept = record.data;
    expect(data.title).toBe(concept.title);
  });

  it("ContextCard / QuizQuestion / QuizDeck を変換する", () => {
    const card = toContextCardSyncRecord({ data: sampleContextCard(), ownerUserId: OWNER });
    const question = toQuizQuestionSyncRecord({ data: sampleQuizQuestion(), ownerUserId: OWNER });
    const deck = toQuizDeckSyncRecord({ data: sampleQuizDeck(), ownerUserId: OWNER });
    expect(card.entityType).toBe("contextCard");
    expect(card.data.title).toBe("通信路");
    expect(question.entityType).toBe("quizQuestion");
    expect(question.data.prompt).toBe("エントロピーとは");
    expect(deck.entityType).toBe("quizDeck");
    expect(deck.strategy).toBe("versioned");
  });

  it("QuizAttemptLog は append-only", () => {
    const log = sampleQuizAttemptLog();
    const record = toQuizAttemptLogSyncRecord({ data: log, ownerUserId: OWNER });
    expect(record.entityType).toBe("quizAttemptLog");
    expect(record.strategy).toBe("append-only");
    expect(getSyncStrategy("quizAttemptLog")).toBe("append-only");
    expect(record.metadata.updatedAt).toBe(log.answeredAt);
    expect(record.data.id).toBe(log.id);
  });

  it("deletedAt 付き tombstone を表現できる", () => {
    const record = toConceptSyncRecord({
      data: sampleConcept(),
      ownerUserId: OWNER,
      deletedAt: ISO,
      version: 4
    });
    expect(record.metadata.deletedAt).toBe(ISO);
    expect(record.metadata.version).toBe(4);
  });

  it("deviceId は optional", () => {
    const record = toPrivateSyncRecord({
      entityType: "concept",
      data: sampleConcept(),
      ownerUserId: OWNER
    });
    expect(record.metadata.deviceId).toBeUndefined();
  });

  it("allowlist 設定のみ setting レコードにできる", () => {
    const record = toSettingSyncRecord({
      data: { key: "domainColors", value: { 情報理論: "#2d6b52" } },
      ownerUserId: OWNER,
      updatedAt: ISO
    });
    expect(record.id).toBe("domainColors");
    expect(record.entityType).toBe("setting");
    expect(record.data.key).toBe("domainColors");
  });
});
