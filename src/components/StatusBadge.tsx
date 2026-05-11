import type { ConceptStatus } from "../types/concept";

const labelMap: Record<ConceptStatus, string> = {
  active: "稼働中",
  researching: "調査中",
  unclear: "未整理",
  archived: "保管"
};

const colorMap: Record<ConceptStatus, string> = {
  active: "border border-emerald-100/45 bg-white/16 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]",
  researching: "border border-white/28 bg-white/10 text-white/90",
  unclear: "border border-white/22 bg-white/8 text-white/82",
  archived: "border border-white/18 bg-black/15 text-white/72"
};

type Props = {
  status: ConceptStatus;
};

export const StatusBadge = ({ status }: Props) => (
  <span className={`hud-terminal-badge inline-flex rounded-[10px] px-2 py-0.5 text-xs font-medium backdrop-blur-sm ${colorMap[status]}`}>
    {labelMap[status]}
  </span>
);
