import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { ConceptMasteryPoint, MasteryConfidence } from "../../utils/mastery/types";
import {
  getConceptMasteryHistoryXTickInterval,
  toConceptMasteryHistoryChartPoints,
  toConceptMasteryHistorySummaryView,
  toConceptMasteryHistoryTooltipView,
  type ConceptMasteryHistoryChartPoint
} from "../../utils/mastery/toConceptMasteryHistoryChartPoints";

type Props = {
  history: ConceptMasteryPoint[];
  confidence?: MasteryConfidence;
};

const AXIS_COLOR = "#5F6D74";
const GRID_COLOR = "rgba(128, 109, 86, 0.16)";
const LINE_COLOR = "#5E7E93";

type TooltipPayloadItem = {
  payload?: ConceptMasteryHistoryChartPoint;
};

const MasteryHistoryTooltip = ({
  active,
  payload
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) => {
  if (!active || !payload?.length) {
    return null;
  }
  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }
  const view = toConceptMasteryHistoryTooltipView(point);
  return (
    <div
      className="rounded-lg border border-nordic-border bg-nordic-card px-3 py-2 text-sm shadow-card"
      role="status"
    >
      <p className="font-medium text-nordic-textPrimary">{view.attemptLabel}</p>
      <p className="mt-1 text-xs text-nordic-textSecondary">{view.answeredAtText}</p>
      <p className="mt-2 text-nordic-textPrimary">{view.resultLabel}</p>
      <p className="mt-2 tabular-nums text-nordic-textPrimary">
        理解度 {view.previousMasteryScore} → {view.masteryScore}
      </p>
      <p className="tabular-nums text-nordic-textSecondary">変化 {view.masteryDeltaText}</p>
      {view.timeText && (
        <p className="mt-2 text-xs text-nordic-textSecondary">回答時間 {view.timeText}</p>
      )}
      {view.questionPrompt && (
        <p className="mt-1 text-xs text-nordic-textSecondary">問題: {view.questionPrompt}</p>
      )}
    </div>
  );
};

const MasteryHistoryDot = ({
  cx,
  cy,
  payload
}: {
  cx?: number;
  cy?: number;
  payload?: ConceptMasteryHistoryChartPoint;
}) => {
  if (cx == null || cy == null || !payload) {
    return null;
  }
  if (payload.resultShape === "circle") {
    return (
      <circle cx={cx} cy={cy} r={5} fill={LINE_COLOR} stroke="none">
        <title>{payload.resultLabel}</title>
      </circle>
    );
  }
  const arm = 5;
  return (
    <g>
      <title>{payload.resultLabel}</title>
      <circle cx={cx} cy={cy} r={8} fill="transparent" />
      <line
        x1={cx - arm}
        y1={cy - arm}
        x2={cx + arm}
        y2={cy + arm}
        stroke={AXIS_COLOR}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <line
        x1={cx + arm}
        y1={cy - arm}
        x2={cx - arm}
        y2={cy + arm}
        stroke={AXIS_COLOR}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </g>
  );
};

export const ConceptMasteryHistoryChart = ({ history, confidence }: Props) => {
  const summary = toConceptMasteryHistorySummaryView(history);
  const points = toConceptMasteryHistoryChartPoints(history);
  const tickInterval = getConceptMasteryHistoryXTickInterval(points.length);

  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">
        理解度の推移
      </h3>
      <p className="text-xs text-nordic-textSecondary">BKT 推定理解度（0〜100）</p>
      {history.length === 0 ? (
        <p className="mt-2 text-sm text-nordic-textSecondary">
          理解度の推移を表示する回答履歴がありません。
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-nordic-textSecondary">
            {summary.attemptCountText}
            {summary.latestMasteryText ? `　${summary.latestMasteryText}` : ""}
          </p>
          {confidence === "low" && (
            <p className="mt-1 text-xs leading-relaxed text-nordic-textMuted">
              回答数が少ないため、この推定値の信頼度は低い状態です。
            </p>
          )}
          <ul className="mt-2 flex flex-wrap gap-3 text-xs text-nordic-textSecondary" aria-label="正誤の凡例">
            <li>○ 正解</li>
            <li>× 誤答</li>
          </ul>
          <div
            className="mt-2 h-56 w-full min-w-0 sm:h-64"
            data-testid="concept-mastery-history-chart"
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <LineChart
                data={points}
                accessibilityLayer
                margin={{ top: 8, right: 12, bottom: 8, left: 4 }}
              >
                <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
                <XAxis
                  dataKey="xLabel"
                  interval={tickInterval}
                  tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                  tickLine={{ stroke: GRID_COLOR }}
                  axisLine={{ stroke: GRID_COLOR }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                  tickLine={{ stroke: GRID_COLOR }}
                  axisLine={{ stroke: GRID_COLOR }}
                  width={40}
                />
                <Tooltip content={<MasteryHistoryTooltip />} cursor={{ stroke: GRID_COLOR }} />
                <Line
                  type="linear"
                  dataKey="masteryScore"
                  name="理解度"
                  stroke={LINE_COLOR}
                  strokeWidth={2}
                  dot={<MasteryHistoryDot />}
                  activeDot={<MasteryHistoryDot />}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};
