import type { ReactNode } from "react";

type Props = {
  list: ReactNode;
  detail: ReactNode;
  mobileDetail: boolean;
};

export const ConceptListWorkspaceLayout = ({ list, detail, mobileDetail }: Props) => (
  <section
    data-testid="concept-list-workspace"
    className="grid gap-4 lg:gap-6 lg:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)]"
  >
    <div
      data-testid="concept-list-pane"
      className={`${mobileDetail ? "hidden" : "block"} min-w-0 lg:block max-lg:overflow-hidden lg:max-h-screen lg:overflow-y-auto scrollbar-none`}
    >
      {list}
    </div>
    <div
      data-testid="concept-detail-pane"
      className={`${mobileDetail ? "block" : "hidden"} min-w-0 lg:block max-h-screen overflow-y-auto scrollbar-none`}
    >
      {detail}
    </div>
  </section>
);
