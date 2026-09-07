import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  DATA_LAB_METRIC_LABELS,
  formatDataLabMetricTooltipValue,
  formatDataLabMetricValue,
  formatDataLabMetricYTick,
  getDataLabMetricAxisDomain,
  getDataLabMetricAxisLabel,
  type DataLabMetric
} from "../../utils/dataLab/dataLabChartMetrics";
import type { DataLabScatterPoint } from "../../utils/dataLab/toDataLabScatterPoints";

type Props = {
  points: DataLabScatterPoint[];
  xMetric: DataLabMetric;
  yMetric: DataLabMetric;
};

const AXIS_COLOR = "#5F6D74";
const GRID_COLOR = "rgba(128, 109, 86, 0.16)";
const POINT_COLOR = "#5E7E93";

type TooltipPayloadItem = {
  payload?: DataLabScatterPoint;
};

const ScatterTooltip = ({
  active,
  payload,
  xMetric,
  yMetric
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  xMetric: DataLabMetric;
  yMetric: DataLabMetric;
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
      <p className="mt-2 text-xs text-celestial-textSub">{DATA_LAB_METRIC_LABELS[xMetric]}</p>
      <p className="tabular-nums text-celestial-textMain">{formatDataLabMetricTooltipValue(xMetric, point.x)}</p>
      <p className="mt-2 text-xs text-celestial-textSub">{DATA_LAB_METRIC_LABELS[yMetric]}</p>
      <p className="tabular-nums text-celestial-textMain">{formatDataLabMetricTooltipValue(yMetric, point.y)}</p>
      <p className="mt-2 text-xs text-celestial-textSub">回答数</p>
      <p className="tabular-nums text-celestial-textMain">{formatDataLabMetricValue("attemptCount", point.attemptCount)}</p>
      <p className="mt-2 text-xs text-celestial-textSub">正答数</p>
      <p className="tabular-nums text-celestial-textMain">{formatDataLabMetricValue("correctCount", point.correctCount)}</p>
      <p className="mt-2 text-xs text-celestial-textSub">誤答数</p>
      <p className="tabular-nums text-celestial-textMain">
        {formatDataLabMetricValue("incorrectCount", point.incorrectCount)}
      </p>
    </div>
  );
};

export const DataLabScatterPlot = ({ points, xMetric, yMetric }: Props) => {
  const xDomain = getDataLabMetricAxisDomain(xMetric);
  const yDomain = getDataLabMetricAxisDomain(yMetric);
  const xAxisLabel = `X: ${getDataLabMetricAxisLabel(xMetric)}`;
  const yAxisLabel = `Y: ${getDataLabMetricAxisLabel(yMetric)}`;

  return (
    <div className="space-y-2">
      <p className="text-xs text-celestial-textSub sm:hidden">
        {xAxisLabel}　{yAxisLabel}
      </p>
      <div className="h-72 w-full min-w-0 sm:h-80" data-testid="data-lab-scatter-plot">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <ScatterChart accessibilityLayer margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name={DATA_LAB_METRIC_LABELS[xMetric]}
              domain={xDomain}
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              tickLine={{ stroke: GRID_COLOR }}
              axisLine={{ stroke: GRID_COLOR }}
              tickFormatter={(value: number) => formatDataLabMetricYTick(xMetric, value)}
              label={{
                value: xAxisLabel,
                position: "insideBottom",
                offset: -18,
                fill: AXIS_COLOR,
                fontSize: 11
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={DATA_LAB_METRIC_LABELS[yMetric]}
              domain={yDomain}
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              tickLine={{ stroke: GRID_COLOR }}
              axisLine={{ stroke: GRID_COLOR }}
              tickFormatter={(value: number) => formatDataLabMetricYTick(yMetric, value)}
              width={72}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: "insideLeft",
                offset: 8,
                fill: AXIS_COLOR,
                fontSize: 11
              }}
            />
            <Tooltip
              content={<ScatterTooltip xMetric={xMetric} yMetric={yMetric} />}
              cursor={{ stroke: GRID_COLOR }}
            />
            <Scatter data={points} fill={POINT_COLOR} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
