import type { ConceptStatus } from "../types/concept";

const labelMap: Record<ConceptStatus, string> = {
  active: "稼働中",
  researching: "調査中",
  unclear: "未整理",
  archived: "保管"
};

const colorMap: Record<ConceptStatus, string> = {
  active: "border border-celestial-gold/35 bg-celestial-gold/15 text-celestial-textMain",
  researching: "border border-celestial-emerald/35 bg-celestial-emerald/12 text-celestial-softGold",
  unclear: "border border-celestial-gold/25 bg-celestial-gold/10 text-celestial-softGold",
  archived: "border border-celestial-border/80 bg-celestial-deepBlue/80 text-celestial-textSub"
};

type Props = {
  status: ConceptStatus;
};

export const StatusBadge = ({ status }: Props) => (
  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[status]}`}>
    {labelMap[status]}
  </span>
);
