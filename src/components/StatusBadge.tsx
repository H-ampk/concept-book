import type { ConceptStatus } from "../types/concept";

const labelMap: Record<ConceptStatus, string> = {
  active: "稼働中",
  researching: "調査中",
  unclear: "未整理",
  archived: "保管"
};

/** 淡い氷色ガラス（濃色選択カード上は index.css で上書き） */
const colorMap: Record<ConceptStatus, string> = {
  active: "border border-[rgba(92,126,145,0.28)] bg-white/80 text-nordic-textPrimary",
  researching: "border border-[rgba(92,126,145,0.24)] bg-[#eef5f8]/90 text-nordic-textPrimary",
  unclear: "border border-[rgba(92,126,145,0.2)] bg-white/65 text-nordic-textSecondary",
  archived: "border border-[rgba(92,126,145,0.16)] bg-slate-100/75 text-nordic-textMuted"
};

type Props = {
  status: ConceptStatus;
};

export const StatusBadge = ({ status }: Props) => (
  <span
    className={`hud-terminal-badge inline-flex rounded-[10px] px-2 py-0.5 text-xs font-medium ${colorMap[status]}`}
  >
    {labelMap[status]}
  </span>
);
