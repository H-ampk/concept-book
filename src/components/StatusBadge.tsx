import type { ConceptStatus } from "../types/concept";

const labelMap: Record<ConceptStatus, string> = {
  active: "稼働中",
  researching: "調査中",
  unclear: "未整理",
  archived: "保管"
};

const colorMap: Record<ConceptStatus, string> = {
  active: "bg-nordic-statusGreenBg text-nordic-statusGreenText",
  researching: "bg-nordic-blue text-nordic-surface",
  unclear: "bg-amber-100 text-amber-900",
  archived: "bg-nordic-border text-nordic-textPrimary"
};

type Props = {
  status: ConceptStatus;
};

export const StatusBadge = ({ status }: Props) => (
  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[status]}`}>
    {labelMap[status]}
  </span>
);
