export const SMALL_GRAPH_MAX_NODES = 200;
export const MEDIUM_GRAPH_MAX_NODES = 500;

export type ConceptGraphSimulationProfile = "small" | "medium" | "large";

export type ConceptGraphSimulationConfig = {
  cooldownTicks: number;
  cooldownTime: number;
  alphaDecay: number;
  velocityDecay: number;
  linkDistance: number;
  chargeStrength: number;
};

const SHARED_FORCE = {
  velocityDecay: 0.4,
  linkDistance: 90,
  chargeStrength: -160
} as const;

const SIMULATION_PROFILES: Record<ConceptGraphSimulationProfile, ConceptGraphSimulationConfig> = {
  small: {
    cooldownTicks: 120,
    cooldownTime: 15000,
    alphaDecay: 0.0228,
    ...SHARED_FORCE
  },
  medium: {
    cooldownTicks: 90,
    cooldownTime: 10000,
    alphaDecay: 0.0303,
    ...SHARED_FORCE
  },
  large: {
    cooldownTicks: 60,
    cooldownTime: 6000,
    alphaDecay: 0.0451,
    ...SHARED_FORCE
  }
};

export const getConceptGraphSimulationProfile = (
  nodeCount: number
): ConceptGraphSimulationProfile => {
  if (nodeCount <= SMALL_GRAPH_MAX_NODES) {
    return "small";
  }
  if (nodeCount <= MEDIUM_GRAPH_MAX_NODES) {
    return "medium";
  }
  return "large";
};

export const getConceptGraphSimulationConfig = (
  nodeCount: number
): ConceptGraphSimulationConfig => SIMULATION_PROFILES[getConceptGraphSimulationProfile(nodeCount)];
