import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  DATA_LAB_METRIC_LABELS,
  getDataLabMetricAxisLabel,
  type DataLabMetric
} from "../../utils/dataLab/dataLabChartMetrics";
import { DATA_LAB_GROUP_BY_CONTROL_LABELS } from "../../utils/dataLab/dataLabGroupByLabels";
import type { DataLabHistogramBin, DataLabHistogramGroupBy } from "../../utils/dataLab/toDataLabHistogramBins";

type Props = {
  bins: DataLabHistogramBin[];
  metric: DataLabMetric;
  groupBy: DataLabHistogramGroupBy;
};

const AXIS_COLOR = "#5F6D74";
const GRID_COLOR = "rgba(128, 109, 86, 0.16)";
const BAR_COLOR = "#5E7E93";

type TooltipPayloadItem = {
  payload?: DataLabHistogramBin;
};

const HistogramTooltip = ({
  active,
  payload,
  metric,
  groupBy
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  metric: DataLabMetric;
  groupBy: DataLabHistogramGroupBy;
}) => {
  if (!active || !payload?.length) {
    return null;
  }
  const bin = payload[0]?.payload;
  if (!bin) {
    return null;
  }
  return (
    <div
      className="rounded-lg border border-celestial-border bg-celestial-panel px-3 py-2 text-sm shadow-celestial"
      role="status"
    >
      <p className="font-medium text-celestial-textMain">
        {DATA_LAB_METRIC_LABELS[metric]}: {bin.label}
      </p>
      <p className="mt-2 tabular-nums text-celestial-textMain">
        該当 {DATA_LAB_GROUP_BY_CONTROL_LABELS[groupBy]}: {bin.count}件
      </p>
    </div>
  );
};

export const DataLabHistogram = ({ bins, metric, groupBy }: Props) => {
  const xAxisLabel = getDataLabMetricAxisLabel(metric);

  return (
    <div className="space-y-2">
      <p className="text-xs text-celestial-textSub sm:hidden">{xAxisLabel}　件数</p>
      <div className="h-72 w-full min-w-0 sm:h-80" data-testid="data-lab-histogram">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <BarChart data={bins} accessibilityLayer margin={{ top: 8, right: 16, bottom: 36, left: 8 }}>
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              interval={0}
              angle={-35}
              textAnchor="end"
              height={56}
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              tickLine={{ stroke: GRID_COLOR }}
              axisLine={{ stroke: GRID_COLOR }}
              label={{
                value: xAxisLabel,
                position: "insideBottom",
                offset: -22,
                fill: AXIS_COLOR,
                fontSize: 11
              }}
            />
            <YAxis
              dataKey="count"
              allowDecimals={false}
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              tickLine={{ stroke: GRID_COLOR }}
              axisLine={{ stroke: GRID_COLOR }}
              width={48}
              label={{
                value: "件数",
                angle: -90,
                position: "insideLeft",
                offset: 8,
                fill: AXIS_COLOR,
                fontSize: 11
              }}
            />
            <Tooltip
              content={<HistogramTooltip metric={metric} groupBy={groupBy} />}
              cursor={{ fill: "rgba(128, 109, 86, 0.08)" }}
            />
            <Bar dataKey="count" name="件数" fill={BAR_COLOR} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
