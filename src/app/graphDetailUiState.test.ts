import { describe, expect, it } from "vitest";
import {
  clearGraphSelectionIfDeleted,
  closeGraphDetail,
  isGraphDetailPanelVisible,
  selectGraphConcept,
  type GraphDetailUiState
} from "./graphDetailUiState";

const empty: GraphDetailUiState = { selectedId: undefined, graphDetailOpen: false };

describe("graphDetailUiState", () => {
  it("Concept クリックで選択し、詳細パネルを開く", () => {
    const next = selectGraphConcept(empty, "A");
    expect(next.selectedId).toBe("A");
    expect(next.graphDetailOpen).toBe(true);
    expect(isGraphDetailPanelVisible(true, next.graphDetailOpen)).toBe(true);
  });

  it("詳細パネルを閉じても selectedId を維持する", () => {
    const open = selectGraphConcept(empty, "A");
    const closed = closeGraphDetail(open);
    expect(closed.selectedId).toBe("A");
    expect(closed.graphDetailOpen).toBe(false);
    expect(isGraphDetailPanelVisible(true, closed.graphDetailOpen)).toBe(false);
  });

  it("パネル閉でも selectedId が残るため 1-hop / 2-hop の中心として使える", () => {
    const closed = closeGraphDetail(selectGraphConcept(empty, "A"));
    expect(closed.selectedId).toBe("A");
  });

  it("同じ Concept を再クリックすると詳細パネルを再表示する", () => {
    const closed = closeGraphDetail(selectGraphConcept(empty, "A"));
    const reopened = selectGraphConcept(closed, "A");
    expect(reopened.selectedId).toBe("A");
    expect(reopened.graphDetailOpen).toBe(true);
  });

  it("別 Concept クリックで選択と詳細内容を切り替え、パネルは開いたままにする", () => {
    const onA = selectGraphConcept(empty, "A");
    const onB = selectGraphConcept(onA, "B");
    expect(onB.selectedId).toBe("B");
    expect(onB.graphDetailOpen).toBe(true);
  });

  it("選択 Concept 削除時は選択とパネルを解除する", () => {
    const open = selectGraphConcept(empty, "A");
    const afterDelete = clearGraphSelectionIfDeleted(open, "A");
    expect(afterDelete.selectedId).toBeUndefined();
    expect(afterDelete.graphDetailOpen).toBe(false);
  });

  it("別 Concept を削除しても選択状態は変えない", () => {
    const open = selectGraphConcept(empty, "A");
    expect(clearGraphSelectionIfDeleted(open, "B")).toEqual(open);
  });
});
