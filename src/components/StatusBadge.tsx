import type { ConceptStatus } from "../types/concept";

const labelMap: Record<ConceptStatus, string> = {
  active: "稼働中",
  researching: "調査中",
  unclear: "未整理",
  archived: "保管"
};

const colorMap: Record<ConceptStatus, string> = {
  active: "bg-[#C89B5C]/20 text-[#E0C58B] border border-[#C89B5C]/40",
  researching: "bg-[#4A7C92]/20 text-[#B9C7D1] border border-[#4A7C92]/40",
  unclear: "bg-[#C89B5C]/15 text-[#E0C58B] border border-[#C89B5C]/30",
  archived: "bg-[#2D506E]/30 text-[#B9C7D1] border border-[#2D506E]/50"
};

type Props = {
  status: ConceptStatus;
};

export const StatusBadge = ({ status }: Props) => (
  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[status]}`}>
    {labelMap[status]}
  </span>
);
