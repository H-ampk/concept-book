import { describe, expect, it } from "vitest";
import { toConceptSyncRecord, toQuizAttemptLogSyncRecord, toQuizQuestionSyncRecord } from "./adapters";
import { getSettingSyncPolicy, isSyncableSettingKey, NEVER_SYNC_SETTING_KEYS } from "./entityConfig";
import { ISO, OWNER, sampleConcept, sampleQuizAttemptLog, sampleQuizQuestion } from "./fixtures";
import { PRIVATE_SYNC_SCHEMA_VERSION } from "./types";
import { parsePrivateSyncRecord, partitionPrivateSyncRecords } from "./validation";

describe("parsePrivateSyncRecord", () => {
  it("正常レコードを受理する", () => {
    const raw = toConceptSyncRecord({ data: sampleConcept(), ownerUserId: OWNER });
    const result = parsePrivateSyncRecord(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.entityType).toBe("concept");
    expect(result.value.data.title).toBe("エントロピー");
  });

  it("object でない値を拒否する", () => {
    expect(parsePrivateSyncRecord(null).ok).toBe(false);
    expect(parsePrivateSyncRecord("x").ok).toBe(false);
    expect(parsePrivateSyncRecord(1).ok).toBe(false);
  });

  it("schemaVersion 不正を拒否する", () => {
    const raw = { ...toConceptSyncRecord({ data: sampleConcept(), ownerUserId: OWNER }), schemaVersion: 99 };
    const result = parsePrivateSyncRecord(raw);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("schema_version_unsupported");
  });

  it("entityType 不正を拒否する", () => {
    const raw = {
      ...toConceptSyncRecord({ data: sampleConcept(), ownerUserId: OWNER }),
      entityType: "publicSnapshot"
    };
    const result = parsePrivateSyncRecord(raw);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("entity_type_invalid");
  });

  it("version 不正を拒否する", () => {
    const base = toConceptSyncRecord({ data: sampleConcept(), ownerUserId: OWNER });
    const result = parsePrivateSyncRecord({
      ...base,
      metadata: { ...base.metadata, version: 0 }
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("version_invalid");
  });

  it("ownerUserId 欠落を拒否する", () => {
    const base = toConceptSyncRecord({ data: sampleConcept(), ownerUserId: OWNER });
    const result = parsePrivateSyncRecord({
      ...base,
      metadata: { version: 1, updatedAt: ISO }
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("owner_user_id_missing");
  });

  it("id 欠落を拒否する", () => {
    const base = toConceptSyncRecord({ data: sampleConcept(), ownerUserId: OWNER });
    const result = parsePrivateSyncRecord({ ...base, id: "" });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("id_missing");
  });

  it("updatedAt 不正を拒否する", () => {
    const base = toConceptSyncRecord({ data: sampleConcept(), ownerUserId: OWNER });
    const result = parsePrivateSyncRecord({
      ...base,
      metadata: { ...base.metadata, updatedAt: "not-a-date" }
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("updated_at_invalid");
  });

  it("data 不正を拒否する", () => {
    const base = toConceptSyncRecord({ data: sampleConcept(), ownerUserId: OWNER });
    const result = parsePrivateSyncRecord({ ...base, data: { id: "x" } });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("data_invalid");
  });

  it("entityType と data の型不一致を拒否する", () => {
    const conceptRecord = toConceptSyncRecord({ data: sampleConcept(), ownerUserId: OWNER });
    const question = sampleQuizQuestion();
    const result = parsePrivateSyncRecord({
      ...conceptRecord,
      entityType: "quizQuestion",
      strategy: "versioned",
      data: question
    });
    expect(result.ok).toBe(true);

    const mismatch = parsePrivateSyncRecord({
      ...toQuizQuestionSyncRecord({ data: question, ownerUserId: OWNER }),
      entityType: "quizQuestion",
      data: sampleConcept()
    });
    expect(mismatch.ok).toBe(false);
    if (mismatch.ok) {
      return;
    }
    expect(mismatch.error.code).toBe("data_invalid");
  });

  it("tombstone record を扱える", () => {
    const raw = toConceptSyncRecord({
      data: sampleConcept(),
      ownerUserId: OWNER,
      deletedAt: ISO
    });
    const result = parsePrivateSyncRecord(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.metadata.deletedAt).toBe(ISO);
  });

  it("不正1件でも他 record の validation を妨げない", () => {
    const ok = toQuizAttemptLogSyncRecord({ data: sampleQuizAttemptLog(), ownerUserId: OWNER });
    const { accepted, rejected } = partitionPrivateSyncRecords([
      ok,
      { schemaVersion: PRIVATE_SYNC_SCHEMA_VERSION },
      "corrupt"
    ]);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]?.entityType).toBe("quizAttemptLog");
    expect(rejected).toHaveLength(2);
  });
});

describe("settings allowlist", () => {
  it("allowlist にある設定のみ同期可能", () => {
    expect(isSyncableSettingKey("domainColors")).toBe(true);
    expect(isSyncableSettingKey("themeSettings")).toBe(true);
    expect(isSyncableSettingKey("unknownSetting")).toBe(false);
    expect(getSettingSyncPolicy("unknownSetting")).toBe("localOnly");
    expect(getSettingSyncPolicy("aiSettings")).toBe("localOnly");
  });

  it("secret / auth 系は同期対象にならない", () => {
    for (const key of NEVER_SYNC_SETTING_KEYS) {
      expect(isSyncableSettingKey(key)).toBe(false);
      expect(getSettingSyncPolicy(key)).toBe("localOnly");
    }
    const result = parsePrivateSyncRecord({
      schemaVersion: PRIVATE_SYNC_SCHEMA_VERSION,
      id: "apiKey",
      entityType: "setting",
      strategy: "versioned",
      metadata: { ownerUserId: OWNER, version: 1, updatedAt: ISO },
      data: { key: "apiKey", value: "sk-secret" }
    });
    expect(result.ok).toBe(false);
  });
});
