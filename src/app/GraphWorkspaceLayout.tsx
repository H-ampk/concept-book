import type { ReactNode } from "react";

type Props = {
  detailOpen: boolean;
  graph: ReactNode;
  detail?: ReactNode;
};

export const GraphWorkspaceLayout = ({ detailOpen, graph, detail }: Props) => (
  <section className="relative min-h-0 flex-1">
    <div className="flex h-[calc(100dvh-11.5rem)] min-h-[360px]">
      <div className="relative min-h-0 min-w-0 flex-1">
        {graph}
        {detailOpen ? (
          <div
            aria-hidden="true"
            data-testid="graph-detail-backdrop"
            className="pointer-events-none absolute inset-0 z-10 bg-nordic-navy/25"
          />
        ) : null}
      </div>
      {detailOpen ? (
        <aside
          data-testid="graph-detail-panel"
          className="pointer-events-auto relative z-10 flex h-full w-[min(28rem,50vw)] shrink-0 flex-col overflow-y-auto border-l border-celestial-border bg-celestial-panel p-3 shadow-celestial"
        >
          {detail}
        </aside>
      ) : null}
    </div>
  </section>
);
