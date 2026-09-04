import type { ReactNode } from "react";

export const CONCEPT_LIST_PAGE_MAIN_CLASS =
  "relative z-10 w-full px-3 py-3 sm:px-6 md:px-8";

type Props = {
  toolbar: ReactNode;
  workspace: ReactNode;
};

export const ConceptListPageLayout = ({ toolbar, workspace }: Props) => (
  <main data-testid="concept-list-page-layout" className={CONCEPT_LIST_PAGE_MAIN_CLASS}>
    <div className="space-y-4">
      {toolbar}
      {workspace}
    </div>
  </main>
);
