import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  DATA_LAB_METRIC_LABELS,
  formatDataLabMetricTooltipValue,
  formatDataLabMetricValue,
  formatDataLabMetricYTick,
  getDataLabMetricValueAxisDomain,
  type DataLabMetric
} from "../../utils/dataLab/dataLabChartMetrics";
import type { DataLabBarChartRow } from "../../utils/dataLab/toDataLabBarChartRows";

type Props = {
  rows: DataLabBarChartRow[];
  metric: DataLabMetric;
};

const AXIS_COLOR = "#5F6D74";
const GRID_COLOR = "rgba(128, 109, 86, 0.16)";
const BAR_COLOR = "#5E7E93";
const MIN_HEIGHT = 240;
const ROW_HEIGHT = 40;
const Y_AXIS_WIDTH = 112;
const LABEL_MAX_CHARS = 14;

type TooltipPayloadItem = {
  payload?: DataLabBarChartRow;
};

const truncateAxisLabel = (label: string): string => {
  if (label.length <= LABEL_MAX_CHARS) {
    return label;
  }
  return `${label.slice(0, LABEL_MAX_CHARS)}…`;
};

const BarChartTooltip = ({
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
      <p className="font-medium text-celestial-textMain">{point.label}</p>
      <p className="mt-2 text-xs text-celestial-textSub">{DATA_LAB_METRIC_LABELS[metric]}</p>
      <p className="tabular-nums text-celestial-textMain">{formatDataLabMetricTooltipValue(metric, point.value)}</p>
      <p className="mt-2 text-xs text-celestial-textSub">回答数</p>
      <p className="tabular-nums text-celestial-textMain">{formatDataLabMetricValue("attemptCount", point.attemptCount)}</p>
    </div>
  );
};

export const DataLabBarChart = ({ rows, metric }: Props) => {
  const xDomain = getDataLabMetricValueAxisDomain(metric);
  const chartHeight = Math.max(MIN_HEIGHT, rows.length * ROW_HEIGHT);

  return (
    <div className="max-h-[28rem] w-full min-w-0 overflow-y-auto overflow-x-hidden sm:max-h-[36rem]" data-testid="data-lab-bar-chart">
      <div className="w-full min-w-0" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <BarChart
            layout="vertical"
            data={rows}
            accessibilityLayer
            margin={{ top: 8, right: 16, bottom: 8, left: 4 }}
          >
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="value"
              domain={xDomain}
              tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              tickLine={{ stroke: GRID_COLOR }}
              axisLine={{ stroke: GRID_COLOR }}
              tickFormatter={(value: number) => formatDataLabMetricYTick(metric, value)}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={Y_AXIS_WIDTH}
              interval={0}
              tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              tickLine={{ stroke: GRID_COLOR }}
              axisLine={{ stroke: GRID_COLOR }}
              tickFormatter={truncateAxisLabel}
            />
            <Tooltip content={<BarChartTooltip metric={metric} />} cursor={{ fill: "rgba(128, 109, 86, 0.08)" }} />
            <Bar dataKey="value" name={DATA_LAB_METRIC_LABELS[metric]} fill={BAR_COLOR} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
