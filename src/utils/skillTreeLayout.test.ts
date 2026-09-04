import { describe, expect, it } from "vitest";
import {
  SKILL_TREE_CARD_HEIGHT,
  SKILL_TREE_VERTICAL_GAP,
  computeSkillTreeLayout,
  getSkillTreeLeafSlotY,
} from "./skillTreeLayout";

const treeFrom = (entries: Array<[string, string[]]>): Map<string, string[]> =>
  new Map(entries);

const leafStep = SKILL_TREE_CARD_HEIGHT + SKILL_TREE_VERTICAL_GAP;

describe("computeSkillTreeLayout", () => {
  it("1ノード: 正の canvas サイズで巨大にならない", () => {
    const result = computeSkillTreeLayout(treeFrom([["root", []]]), "root");
    const pos = result.positions.get("root");
    expect(pos?.id).toBe("root");
    expect(pos?.depth).toBe(0);
    expect(pos?.x).toBeGreaterThan(0);
    expect(pos?.y).toBe(getSkillTreeLeafSlotY(0));
    expect(result.canvasWidth).toBeGreaterThan(0);
    expect(result.canvasHeight).toBeGreaterThan(0);
    expect(result.canvasHeight).toBeLessThan(300);
    expect(result.canvasWidth).toBeLessThan(400);
  });

  it("2ノード: 親子が同じ Y", () => {
    const result = computeSkillTreeLayout(
      treeFrom([
        ["root", ["a"]],
        ["a", []],
      ]),
      "root"
    );
    expect(result.positions.get("root")?.y).toBe(result.positions.get("a")?.y);
  });

  it("chain: 全ノードが同じ Y", () => {
    const result = computeSkillTreeLayout(
      treeFrom([
        ["root", ["a"]],
        ["a", ["b"]],
        ["b", ["c"]],
        ["c", []],
      ]),
      "root"
    );
    const y = result.positions.get("root")?.y;
    expect(result.positions.get("a")?.y).toBe(y);
    expect(result.positions.get("b")?.y).toBe(y);
    expect(result.positions.get("c")?.y).toBe(y);
  });

  it("star: 葉が重ならず順序通り、root が中央", () => {
    const result = computeSkillTreeLayout(
      treeFrom([
        ["root", ["a", "b", "c", "d"]],
        ["a", []],
        ["b", []],
        ["c", []],
        ["d", []],
      ]),
      "root"
    );
    const ys = ["a", "b", "c", "d"].map((id) => result.positions.get(id)!.y);
    for (let i = 1; i < ys.length; i += 1) {
      expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(leafStep);
    }
    expect(ys[0]).toBe(getSkillTreeLeafSlotY(0));
    expect(ys[1]).toBe(getSkillTreeLeafSlotY(1));
    expect(ys[2]).toBe(getSkillTreeLeafSlotY(2));
    expect(ys[3]).toBe(getSkillTreeLeafSlotY(3));
    expect(result.positions.get("root")?.y).toBe((ys[0] + ys[3]) / 2);
  });

  it("不均衡ツリー: サブツリーが連続し、子が交互にならない", () => {
    const result = computeSkillTreeLayout(
      treeFrom([
        ["root", ["a", "b"]],
        ["a", ["a1", "a2", "a3", "a4"]],
        ["a1", []],
        ["a2", []],
        ["a3", []],
        ["a4", []],
        ["b", ["b1"]],
        ["b1", []],
      ]),
      "root"
    );
    const aChildren = ["a1", "a2", "a3", "a4"].map((id) => result.positions.get(id)!.y);
    const b1 = result.positions.get("b1")!.y;
    expect(Math.max(...aChildren)).toBeLessThan(b1);
    expect(result.positions.get("a")?.y).toBe((aChildren[0] + aChildren[3]) / 2);
    expect(result.positions.get("b")?.y).toBe(b1);
    expect(result.positions.get("root")?.y).toBe(
      (result.positions.get("a")!.y + result.positions.get("b")!.y) / 2
    );
  });

  it("多段階ツリー: 各親が子サブツリーの中央", () => {
    const result = computeSkillTreeLayout(
      treeFrom([
        ["root", ["a", "b"]],
        ["a", ["a1", "a2"]],
        ["a1", ["a11", "a12"]],
        ["a11", []],
        ["a12", []],
        ["a2", []],
        ["b", ["b1", "b2"]],
        ["b1", []],
        ["b2", []],
      ]),
      "root"
    );
    const a11 = result.positions.get("a11")!.y;
    const a12 = result.positions.get("a12")!.y;
    const a2 = result.positions.get("a2")!.y;
    const b1 = result.positions.get("b1")!.y;
    const b2 = result.positions.get("b2")!.y;
    expect(result.positions.get("a1")?.y).toBe((a11 + a12) / 2);
    expect(result.positions.get("a")?.y).toBe((result.positions.get("a1")!.y + a2) / 2);
    expect(result.positions.get("b")?.y).toBe((b1 + b2) / 2);
    expect(result.positions.get("root")?.y).toBe(
      (result.positions.get("a")!.y + result.positions.get("b")!.y) / 2
    );
  });

  it("visibleTree（折りたたみ後の2子）をレイアウトできる", () => {
    const result = computeSkillTreeLayout(
      treeFrom([
        ["root", ["a", "b"]],
        ["a", []],
        ["b", []],
      ]),
      "root"
    );
    expect(result.positions.size).toBe(3);
    expect(result.positions.get("a")?.y).toBe(getSkillTreeLeafSlotY(0));
    expect(result.positions.get("b")?.y).toBe(getSkillTreeLeafSlotY(1));
    expect(result.positions.get("root")?.y).toBe(
      (result.positions.get("a")!.y + result.positions.get("b")!.y) / 2
    );
  });

  it("葉が増えると canvasHeight が増える", () => {
    const one = computeSkillTreeLayout(treeFrom([["root", []]]), "root");
    const two = computeSkillTreeLayout(
      treeFrom([
        ["root", ["a", "b"]],
        ["a", []],
        ["b", []],
      ]),
      "root"
    );
    const tenChildren = Array.from({ length: 10 }, (_, i) => `c${i}`);
    const ten = computeSkillTreeLayout(
      treeFrom([["root", tenChildren], ...tenChildren.map((id) => [id, []] as [string, string[]])]),
      "root"
    );
    expect(one.canvasHeight).toBeLessThan(two.canvasHeight);
    expect(two.canvasHeight).toBeLessThan(ten.canvasHeight);
  });

  it("隣接 leaf の Y 差は CARD_HEIGHT + VERTICAL_GAP 以上", () => {
    const result = computeSkillTreeLayout(
      treeFrom([
        ["root", ["a", "b", "c"]],
        ["a", []],
        ["b", []],
        ["c", []],
      ]),
      "root"
    );
    const ys = ["a", "b", "c"].map((id) => result.positions.get(id)!.y);
    for (let i = 1; i < ys.length; i += 1) {
      expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(leafStep);
    }
  });

  it("canvasWidth は depth に応じて広がる", () => {
    const shallow = computeSkillTreeLayout(
      treeFrom([
        ["root", ["a"]],
        ["a", []],
      ]),
      "root"
    );
    const deep = computeSkillTreeLayout(
      treeFrom([
        ["root", ["a"]],
        ["a", ["b"]],
        ["b", ["c"]],
        ["c", []],
      ]),
      "root"
    );
    expect(deep.canvasWidth).toBeGreaterThan(shallow.canvasWidth);
  });
});
