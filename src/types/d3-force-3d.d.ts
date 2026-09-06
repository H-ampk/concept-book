declare module "d3-force-3d" {
  export type SimulationNode = {
    id?: string;
    index?: number;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
  };

  export type SimulationLink = {
    source: string | SimulationNode;
    target: string | SimulationNode;
  };

  export type Force<NodeDatum = SimulationNode> = {
    (alpha: number): void;
    initialize?: (nodes: NodeDatum[], random: () => number, nDim: number) => void;
  };

  export type LinkForce<NodeDatum = SimulationNode> = Force<NodeDatum> & {
    id: (fn: (node: NodeDatum) => string) => LinkForce<NodeDatum>;
    links: (links: SimulationLink[]) => LinkForce<NodeDatum>;
    distance: (distance: number) => LinkForce<NodeDatum>;
  };

  export type ManyBodyForce<NodeDatum = SimulationNode> = Force<NodeDatum> & {
    strength: (strength: number) => ManyBodyForce<NodeDatum>;
  };

  export type CenterForce<NodeDatum = SimulationNode> = Force<NodeDatum>;

  export type Simulation<NodeDatum = SimulationNode> = {
    tick: (iterations?: number) => Simulation<NodeDatum>;
    stop: () => Simulation<NodeDatum>;
    nodes: (nodes: NodeDatum[]) => Simulation<NodeDatum>;
    alphaDecay: (decay: number) => Simulation<NodeDatum>;
    velocityDecay: (decay: number) => Simulation<NodeDatum>;
    randomSource: (source: () => number) => Simulation<NodeDatum>;
    force: (name: string, force: Force<NodeDatum> | null) => Simulation<NodeDatum>;
  };

  export function forceSimulation<NodeDatum = SimulationNode>(
    nodes?: NodeDatum[],
    numDimensions?: number
  ): Simulation<NodeDatum>;

  export function forceLink<NodeDatum = SimulationNode>(
    links?: SimulationLink[]
  ): LinkForce<NodeDatum>;

  export function forceManyBody<NodeDatum = SimulationNode>(): ManyBodyForce<NodeDatum>;

  export function forceCenter<NodeDatum = SimulationNode>(
    x?: number,
    y?: number
  ): CenterForce<NodeDatum>;
}
