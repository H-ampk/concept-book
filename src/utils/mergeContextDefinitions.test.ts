import { describe, expect, it } from "vitest";
import type { ContextDefinition } from "../types/concept";
import { mergeContextDefinitions } from "./mergeContextDefinitions";

const def = (id: string, extras: Partial<ContextDefinition> = {}): ContextDefinition => ({
  id,
  context: extras.context ?? `${id}-context`,
  definition: extras.definition ?? `${id}-definition`
});

describe("mergeContextDefinitions", () => {
  it("preferred に無い fallback ID を末尾へ追加する", () => {
    const preferred = [def("D1", { context: "preferred", definition: "preferred" })];
    const fallback = [
      def("D1", { context: "fallback", definition: "fallback" }),
      def("D2")
    ];
    expect(mergeContextDefinitions(preferred, fallback)).toEqual([
      def("D1", { context: "preferred", definition: "preferred" }),
      def("D2")
    ]);
  });

  it("preferred 順のあと fallback 専用 ID を fallback 順で並べる", () => {
    const preferred = [def("D1"), def("D3")];
    const fallback = [def("D1"), def("D2")];
    expect(mergeContextDefinitions(preferred, fallback).map((item) => item.id)).toEqual([
      "D1",
      "D3",
      "D2"
    ]);
  });

  it("同一 ID の内容衝突では preferred を採用する", () => {
    const preferred = [def("D1", { context: "preferred", definition: "preferred" })];
    const fallback = [def("D1", { context: "fallback", definition: "fallback" })];
    expect(mergeContextDefinitions(preferred, fallback)).toEqual([
      def("D1", { context: "preferred", definition: "preferred" })
    ]);
  });

  it("preferred が空なら fallback をすべて残す", () => {
    const fallback = [def("D1"), def("D2")];
    expect(mergeContextDefinitions([], fallback)).toEqual(fallback);
  });

  it("fallback が空なら preferred を維持する", () => {
    const preferred = [def("D1"), def("D2")];
    expect(mergeContextDefinitions(preferred, [])).toEqual(preferred);
  });

  it("undefined は空配列として扱う", () => {
    expect(mergeContextDefinitions(undefined, undefined)).toEqual([]);
    expect(mergeContextDefinitions(undefined, [def("D1")])).toEqual([def("D1")]);
  });
});
