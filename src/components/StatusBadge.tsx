import type { ConceptStatus } from "../types/concept";

const labelMap: Record<ConceptStatus, string> = {
  active: "稼働中",
  researching: "調査中",
  unclear: "未整理",
  archived: "保管"
};

type Props = {
  status: ConceptStatus;
};

export const StatusBadge = ({ status }: Props) => (
  <span className="study-status-badge" data-status={status}>
    <span className="study-status-dot" aria-hidden />
    <span>{labelMap[status]}</span>
  </span>
);
