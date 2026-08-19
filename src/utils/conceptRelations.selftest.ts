import type { Concept } from "../types/concept";
import {
  buildUndirectedAdjacency,
  collectUndirectedConceptEdges,
  diffRelatedIds,
  normalizeRelatedIdList,
  repairUndirectedRelatedIds
} from "./conceptRelations";

const stub = (id: string, relatedIds: string[]): Concept => ({
  id,
  title: id,
  definition: "",
  myInterpretation: "",
  domainTags: [],
  researchTags: [],
  relatedIds,
  source: { book: "", page: "", author: null },
  notes: "",
  status: "draft",
  favorite: false,
  createdAt: "t",
  updatedAt: "t"
});

const assert = (cond: boolean, message: string) => {
  if (!cond) {
    throw new Error(message);
  }
};

const sameSet = (a: string[], b: string[]) => {
  if (a.length !== b.length) {
    return false;
  }
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
};

const run = () => {
  assert(
    sameSet(normalizeRelatedIdList([" B ", "B", "A", ""], { selfId: "A" }), ["B"]),
    "self/dup/empty"
  );
  assert(
    normalizeRelatedIdList(["missing", "B"], {
      selfId: "A",
      existingIds: new Set(["A", "B"])
    }).join(",") === "B",
    "missing id"
  );

  const repairedAsym = repairUndirectedRelatedIds([
    stub("A", ["B"]),
    stub("B", [])
  ]);
  assert(
    sameSet(repairedAsym.concepts.find((c) => c.id === "A")!.relatedIds, ["B"]) &&
      sameSet(repairedAsym.concepts.find((c) => c.id === "B")!.relatedIds, ["A"]),
    "legacy asymmetric"
  );

  const repairedInvalid = repairUndirectedRelatedIds([
    stub("A", ["A", "B", "B", "missing-id"]),
    stub("B", [])
  ]);
  assert(
    sameSet(repairedInvalid.concepts.find((c) => c.id === "A")!.relatedIds, ["B"]),
    "invalid cleanup"
  );

  const edges = collectUndirectedConceptEdges([stub("A", ["B"]), stub("B", ["A"])]);
  assert(edges.length === 1, "graph link count 1");

  const graph = buildUndirectedAdjacency([stub("A", ["B"]), stub("B", ["A"])]);
  assert(graph.get("A")?.length === 1 && graph.get("B")?.length === 1, "tree undirected edge");

  const diff = diffRelatedIds(["B", "C"], ["B", "D"]);
  assert(diff.added.join(",") === "D" && diff.removed.join(",") === "C", "update diff");

  // validation 相当: universe なしでは payload 外 ID を落とさない
  assert(
    normalizeRelatedIdList(["imp-A", "imp-A", "imp-C", ""], { selfId: "imp-C" }).join(",") ===
      "imp-A",
    "import sanitize keeps out-of-payload refs, drops self/dup/empty"
  );

  // storage 相当: 既存+import 全体で repair
  const mergeRepair = repairUndirectedRelatedIds([
    stub("imp-A", ["imp-B"]),
    stub("imp-B", ["imp-A"]),
    stub("imp-C", ["imp-A"])
  ]);
  assert(
    sameSet(mergeRepair.concepts.find((c) => c.id === "imp-C")!.relatedIds, ["imp-A"]) &&
      sameSet(mergeRepair.concepts.find((c) => c.id === "imp-A")!.relatedIds, ["imp-B", "imp-C"]),
    "merge existing reference"
  );
  assert(
    sameSet(
      repairUndirectedRelatedIds([stub("imp-C", ["really-missing"])]).concepts[0].relatedIds,
      []
    ),
    "merge missing reference"
  );

  assert(
    sameSet(
      repairUndirectedRelatedIds([
        stub("imp-A", ["imp-B", "imp-A", "imp-B", "missing-id"]),
        stub("imp-B", [])
      ]).concepts.find((c) => c.id === "imp-A")!.relatedIds,
      ["imp-B"]
    ) &&
      repairUndirectedRelatedIds([
        stub("imp-A", ["imp-B", "missing-id"]),
        stub("imp-B", [])
      ]).changedIds.includes("imp-A"),
    "replace payload missing-id is persisted as removed"
  );

  console.log("conceptRelations selftest: ok");
};

run();
