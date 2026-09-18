import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";

const {
  getAllConcepts,
  createConcept,
  updateConcept,
  deleteConcept,
  saveConceptWithMediaDraft
} = vi.hoisted(() => ({
  getAllConcepts: vi.fn(),
  createConcept: vi.fn(),
  updateConcept: vi.fn(),
  deleteConcept: vi.fn(),
  saveConceptWithMediaDraft: vi.fn()
}));

vi.mock("../../storage", () => ({
  getStorage: () => ({
    getAllConcepts,
    createConcept,
    updateConcept,
    deleteConcept,
    saveConceptWithMediaDraft
  })
}));

import { useConcepts } from "./useConcepts";

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "concept-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "概念A",
  definition: "定義A",
  status: "active",
  ...overrides
});

const waitSettled = async (result: { current: ReturnType<typeof useConcepts> }) => {
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });
};

describe("useConcepts reload failure (#201)", () => {
  beforeEach(() => {
    getAllConcepts.mockReset();
    createConcept.mockReset();
    updateConcept.mockReset();
    deleteConcept.mockReset();
    saveConceptWithMediaDraft.mockReset();
    delete (window as Window & { __CONCEPTBOOK_FAIL_CONCEPT_RELOAD?: boolean })
      .__CONCEPTBOOK_FAIL_CONCEPT_RELOAD;
  });

  it("正常 load 後の reload failure で旧 snapshot を stale として残す", async () => {
    const snapshotA = [concept()];
    getAllConcepts
      .mockResolvedValueOnce(snapshotA)
      .mockRejectedValueOnce(new Error("read fail"));

    const { result } = renderHook(() => useConcepts());
    await waitSettled(result);
    expect(result.current.concepts).toEqual(snapshotA);
    expect(result.current.canMutateConcepts).toBe(true);

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.concepts).toEqual(snapshotA);
    expect(result.current.reloadError).toBe("read fail");
    expect(result.current.isStale).toBe(true);
    expect(result.current.canMutateConcepts).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("stale 中は create/update/remove/saveWithMediaDraft/toggleFavorite を禁止する", async () => {
    getAllConcepts
      .mockResolvedValueOnce([concept()])
      .mockRejectedValueOnce(new Error("read fail"));

    const { result } = renderHook(() => useConcepts());
    await waitSettled(result);
    await act(async () => {
      await result.current.reload();
    });

    await expect(result.current.create(createEmptyConceptInput())).rejects.toThrow(
      "概念データが最新状態ではないため、再読み込みに成功するまで変更できません。"
    );
    await expect(result.current.update("concept-a", { title: "更新" })).rejects.toThrow(
      "概念データが最新状態ではないため、再読み込みに成功するまで変更できません。"
    );
    await expect(result.current.remove("concept-a")).rejects.toThrow(
      "概念データが最新状態ではないため、再読み込みに成功するまで変更できません。"
    );
    await expect(
      result.current.saveWithMediaDraft({
        mode: "create",
        input: createEmptyConceptInput(),
        media: []
      })
    ).rejects.toThrow("概念データが最新状態ではないため、再読み込みに成功するまで変更できません。");
    await expect(result.current.toggleFavorite(concept())).rejects.toThrow(
      "概念データが最新状態ではないため、再読み込みに成功するまで変更できません。"
    );

    expect(createConcept).not.toHaveBeenCalled();
    expect(updateConcept).not.toHaveBeenCalled();
    expect(deleteConcept).not.toHaveBeenCalled();
    expect(saveConceptWithMediaDraft).not.toHaveBeenCalled();
  });

  it("retry 成功で stale を解除し新しい snapshot を採用する", async () => {
    const snapshotA = [concept()];
    const snapshotB = [concept({ id: "concept-b", title: "概念B" })];
    getAllConcepts
      .mockResolvedValueOnce(snapshotA)
      .mockRejectedValueOnce(new Error("read fail"))
      .mockResolvedValueOnce(snapshotB);

    const { result } = renderHook(() => useConcepts());
    await waitSettled(result);
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.isStale).toBe(true);

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.concepts).toEqual(snapshotB);
    expect(result.current.reloadError).toBeNull();
    expect(result.current.isStale).toBe(false);
    expect(result.current.canMutateConcepts).toBe(true);
  });

  it("mount 時の read failure を error state にし unhandled rejection にしない", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (event: PromiseRejectionEvent) => {
      unhandled.push(event.reason);
    };
    window.addEventListener("unhandledrejection", onUnhandled);
    getAllConcepts.mockRejectedValue(new Error("indexeddb read failure"));

    const { result } = renderHook(() => useConcepts());
    await waitSettled(result);

    expect(result.current.concepts).toEqual([]);
    expect(result.current.reloadError).toBe("indexeddb read failure");
    expect(result.current.isStale).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.canMutateConcepts).toBe(false);
    expect(unhandled).toEqual([]);
    window.removeEventListener("unhandledrejection", onUnhandled);
  });

  it("create 成功後の reload failure でも create 自体は resolve する", async () => {
    const snapshotA = [concept()];
    const created = concept({ id: "concept-created", title: "新規" });
    getAllConcepts
      .mockResolvedValueOnce(snapshotA)
      .mockRejectedValueOnce(new Error("reload after write"));
    createConcept.mockResolvedValue(created);

    const { result } = renderHook(() => useConcepts());
    await waitSettled(result);

    let returned: Concept | undefined;
    await act(async () => {
      returned = await result.current.create({
        ...createEmptyConceptInput(),
        title: "新規",
        definition: "定義"
      });
    });

    expect(returned).toEqual(created);
    expect(createConcept).toHaveBeenCalled();
    expect(result.current.reloadError).toBe("reload after write");
    expect(result.current.isStale).toBe(true);
    expect(result.current.canMutateConcepts).toBe(false);
  });

  it("update 成功後の reload failure でも update 自体は resolve する", async () => {
    const snapshotA = [concept()];
    const updated = concept({ title: "更新後" });
    getAllConcepts
      .mockResolvedValueOnce(snapshotA)
      .mockRejectedValueOnce(new Error("reload after write"));
    updateConcept.mockResolvedValue(updated);

    const { result } = renderHook(() => useConcepts());
    await waitSettled(result);

    let returned: Concept | undefined;
    await act(async () => {
      returned = await result.current.update("concept-a", { title: "更新後" });
    });

    expect(returned).toEqual(updated);
    expect(updateConcept).toHaveBeenCalled();
    expect(result.current.reloadError).toBe("reload after write");
    expect(result.current.isStale).toBe(true);
  });

  it("remove / saveWithMediaDraft も write 成功後 reload failure で reject しない", async () => {
    const snapshotA = [concept()];
    const saved = concept({ id: "concept-media", title: "メディア" });
    getAllConcepts
      .mockResolvedValueOnce(snapshotA)
      .mockRejectedValueOnce(new Error("reload after remove"))
      .mockResolvedValueOnce(snapshotA)
      .mockRejectedValueOnce(new Error("reload after media"));
    deleteConcept.mockResolvedValue(undefined);
    saveConceptWithMediaDraft.mockResolvedValue(saved);

    const { result } = renderHook(() => useConcepts());
    await waitSettled(result);

    await act(async () => {
      await result.current.remove("concept-a");
    });
    expect(deleteConcept).toHaveBeenCalledWith("concept-a");
    expect(result.current.reloadError).toBe("reload after remove");
    expect(result.current.isStale).toBe(true);

    getAllConcepts.mockResolvedValueOnce(snapshotA);
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.reloadError).toBeNull();

    let returned: Concept | undefined;
    await act(async () => {
      returned = await result.current.saveWithMediaDraft({
        mode: "create",
        input: { ...createEmptyConceptInput(), title: "メディア", definition: "定義" },
        media: []
      });
    });
    expect(returned).toEqual(saved);
    expect(result.current.reloadError).toBe("reload after media");
    expect(result.current.isStale).toBe(true);
  });

  it("遅れて完了した古い reload が新しい snapshot を上書きしない", async () => {
    const snapshotA = [concept({ id: "A", title: "A" })];
    const snapshotB = [concept({ id: "B", title: "B" })];
    const resolvers: Array<(value: Concept[]) => void> = [];
    getAllConcepts.mockImplementation(
      () =>
        new Promise<Concept[]>((resolve) => {
          resolvers.push(resolve);
        })
    );

    const { result } = renderHook(() => useConcepts());
    await waitFor(() => {
      expect(getAllConcepts).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      void result.current.reload();
    });
    await waitFor(() => {
      expect(getAllConcepts).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      resolvers[1]?.(snapshotB);
    });
    await waitFor(() => {
      expect(result.current.concepts.map((item) => item.id)).toEqual(["B"]);
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      resolvers[0]?.(snapshotA);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.concepts.map((item) => item.id)).toEqual(["B"]);
    expect(result.current.reloadError).toBeNull();
    expect(result.current.isStale).toBe(false);
  });
});
