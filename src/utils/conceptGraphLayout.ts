import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNode
} from "d3-force-3d";
import type { Concept } from "../types/concept";
import { getConceptGraphSimulationConfig } from "./conceptGraphSimulation";
import { createConceptGraphTopologySnapshot } from "./conceptGraphTopology";

/** d3-force-3d 既定 LCG と同じパラメータ。初期 s=1 で毎回同じ乱数列にする。 */
export const CONCEPT_GRAPH_LAYOUT_RANDOM_SEED = 1;

export type ConceptGraphLayoutNode = {
  id: string;
  x: number;
  y: number;
};

const createLcg = (seed: number): (() => number) => {
  const a = 1664525;
  const c = 1013904223;
  const m = 4294967296;
  let s = (seed >>> 0) || 1;
  return () => {
    s = (a * s + c) % m;
    return s / m;
  };
};

/**
 * production と同じ force（link / charge / center）と simulation profile を、
 * タイマーなし・固定 tick・固定乱数源で実行する。
 */
export const layoutConceptGraphDeterministically = (
  concepts: readonly Concept[]
): ConceptGraphLayoutNode[] => {
  const topology = createConceptGraphTopologySnapshot(concepts);
  const config = getConceptGraphSimulationConfig(topology.nodes.length);
  const nodes: SimulationNode[] = topology.nodes.map((node) => ({ id: node.id }));
  const links = topology.links.map((link) => ({
    source: link.source,
    target: link.target
  }));

  const simulation = forceSimulation(nodes, 2)
    .stop()
    .force(
      "link",
      forceLink(links)
        .id((node) => String(node.id))
        .distance(config.linkDistance)
    )
    .force("charge", forceManyBody().strength(config.chargeStrength))
    .force("center", forceCenter())
    .alphaDecay(config.alphaDecay)
    .velocityDecay(config.velocityDecay)
    .randomSource(createLcg(CONCEPT_GRAPH_LAYOUT_RANDOM_SEED));

  simulation.tick(config.cooldownTicks);

  return nodes.map((node) => ({
    id: String(node.id),
    x: node.x ?? 0,
    y: node.y ?? 0
  }));
};
