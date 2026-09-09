import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { DataLabAggregateRow } from "../../utils/dataLab/aggregateDataLabLogs";
import {
  DATA_LAB_METRIC_LABELS,
  formatDataLabMetricTooltipValue,
  formatDataLabMetricValue,
  formatDataLabMetricYTick,
  getDataLabMetricYDomain,
  type DataLabMetric
} from "../../utils/dataLab/dataLabChartMetrics";
import {
  getDataLabLineChartXTickInterval,
  toDataLabLineChartPoints,
  type DataLabLineChartPoint,
  type DataLabLineChartTimeGroupBy
} from "../../utils/dataLab/toDataLabLineChartPoints";

type Props = {
  rows: DataLabAggregateRow[];
  groupBy: DataLabLineChartTimeGroupBy;
  metric: DataLabMetric;
};

const AXIS_COLOR = "#5F6D74";
const GRID_COLOR = "rgba(128, 109, 86, 0.16)";
const LINE_COLOR = "#5E7E93";

type TooltipPayloadItem = {
  payload?: DataLabLineChartPoint;
};

const LineChartTooltip = ({
  active,
  payload,
  metric
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  metric: DataLabMetric;
}) => {
  if (!active || !payload?.length) {
    return null;
  }
  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }
  return (
    <div
      className="rounded-lg border border-celestial-border bg-celestial-panel px-3 py-2 text-sm shadow-celestial"
      role="status"
    >
      <p className="font-medium text-celestial-textMain">{point.tooltipPeriod}</p>
      <p className="mt-2 text-xs text-celestial-textSub">{DATA_LAB_METRIC_LABELS[metric]}</p>
      <p className="tabular-nums text-celestial-textMain">
        {point.attemptCount === 0 && point.value == null
          ? "学習なし"
          : formatDataLabMetricTooltipValue(metric, point.value)}
      </p>
      <p className="mt-2 text-xs text-celestial-textSub">回答数</p>
      <p className="tabular-nums text-celestial-textMain">{formatDataLabMetricValue("attemptCount", point.attemptCount)}</p>
    </div>
  );
};

export const DataLabLineChart = ({ rows, groupBy, metric }: Props) => {
  const points = toDataLabLineChartPoints(rows, groupBy, metric);
  const yDomain = getDataLabMetricYDomain(metric);
  const tickInterval = getDataLabLineChartXTickInterval(points.length);

  return (
    <div className="h-72 w-full min-w-0 sm:h-80" data-testid="data-lab-line-chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <LineChart data={points} accessibilityLayer margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
          <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
          <XAxis
            dataKey="xLabel"
            interval={tickInterval}
            tick={{ fill: AXIS_COLOR, fontSize: 12 }}
            tickLine={{ stroke: GRID_COLOR }}
            axisLine={{ stroke: GRID_COLOR }}
          />
          <YAxis
            domain={yDomain}
            tick={{ fill: AXIS_COLOR, fontSize: 12 }}
            tickLine={{ stroke: GRID_COLOR }}
            axisLine={{ stroke: GRID_COLOR }}
            tickFormatter={(value: number) => formatDataLabMetricYTick(metric, value)}
            width={64}
          />
          <Tooltip content={<LineChartTooltip metric={metric} />} cursor={{ stroke: GRID_COLOR }} />
          <Line
            type="monotone"
            dataKey="value"
            name={DATA_LAB_METRIC_LABELS[metric]}
            stroke={LINE_COLOR}
            strokeWidth={2}
            dot={{ r: 3, fill: LINE_COLOR, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: LINE_COLOR }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
