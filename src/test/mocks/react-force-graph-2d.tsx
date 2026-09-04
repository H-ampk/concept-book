import { createElement, forwardRef, useImperativeHandle } from "react";
import { vi } from "vitest";

export const zoomToFit = vi.fn();
export const centerAt = vi.fn();
export const zoom = vi.fn();
export const d3Force = vi.fn(() => ({
  distance: vi.fn(),
  strength: vi.fn()
}));

export type CapturedForceGraphProps = {
  graphData?: { nodes: unknown[]; links: unknown[] };
  onEngineStop?: () => void;
  onNodeClick?: (node: { id: string }) => void;
};

export let lastForceGraphProps: CapturedForceGraphProps = {};

export const resetForceGraphMock = () => {
  zoomToFit.mockClear();
  centerAt.mockClear();
  zoom.mockClear();
  d3Force.mockClear();
  lastForceGraphProps = {};
};

const ForceGraph2D = forwardRef(function ForceGraph2DMock(
  props: CapturedForceGraphProps,
  ref: unknown
) {
  lastForceGraphProps = props;
  useImperativeHandle(ref as never, () => ({
    zoomToFit,
    centerAt,
    zoom,
    d3Force
  }));
  return createElement("canvas", { "data-testid": "force-graph-canvas" });
});

export default ForceGraph2D;
