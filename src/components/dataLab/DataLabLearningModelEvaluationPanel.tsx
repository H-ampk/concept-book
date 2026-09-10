import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { Concept } from "../../types/concept";
import { DATA_LAB_LEARNING_MODEL_EVALUATION_NOTE } from "../../utils/dataLab/describeDataLabMetricAggregation";
import { formatDataLabEvaluationScore, formatDataLabNullableCount } from "../../utils/dataLab/formatDataLabTable";
import {
  toHistoryCountVsSquaredErrorPoints,
  toPredictedProbabilityVsActualPoints,
  type DataLabEvaluationScatterPoint
} from "../../utils/dataLab/toDataLabLearningModelEvaluationPoints";
import {
  groupLearningModelPredictionMetricsByModel,
  groupLearningModelPredictionMetricsByModelAndConcept
} from "../../utils/learningModelEvaluation/metrics";
import {
  BKT_LEARNING_MODEL_ID,
  PFA_LEARNING_MODEL_ID
} from "../../utils/learningModelEvaluation/predictors";
import type { LearningModelPredictionMetrics, LearningModelPredictionPoint } from "../../utils/learningModelEvaluation/types";

type Props = {
  points: LearningModelPredictionPoint[];
  conceptById: Map<string, Concept>;
};

const AXIS_COLOR = "#5F6D74";
const GRID_COLOR = "rgba(128, 109, 86, 0.16)";
const POINT_COLOR = "#5E7E93";

const EVALUATION_MODELS = [
  { id: BKT_LEARNING_MODEL_ID, label: "BKT" },
  { id: PFA_LEARNING_MODEL_ID, label: "PFA" }
] as const;

const emptyMetrics = (): LearningModelPredictionMetrics => ({
  count: 0,
  brierScore: null,
  logLoss: null
});

const inputClass =
  "w-full rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55";

const conceptLabel = (conceptId: string, conceptById: Map<string, Concept>): string => {
  const title = conceptById.get(conceptId)?.title?.trim();
  if (title) {
    return title;
  }
  return "削除済みConcept";
};

type EvaluationTooltipPayload = {
  payload?: DataLabEvaluationScatterPoint;
};

const EvaluationScatterTooltip = ({
  active,
  payload,
  xLabel,
  yLabel
}: {
  active?: boolean;
  payload?: EvaluationTooltipPayload[];
  xLabel: string;
  yLabel: string;
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
      <p className="mt-2 text-xs text-celestial-textSub">{xLabel}</p>
      <p className="tabular-nums text-celestial-textMain">{point.x}</p>
      <p className="mt-2 text-xs text-celestial-textSub">{yLabel}</p>
      <p className="tabular-nums text-celestial-textMain">{point.y}</p>
    </div>
  );
};

const EvaluationScatter = ({
  points,
  xLabel,
  yLabel,
  xDomain,
  yDomain,
  testId
}: {
  points: DataLabEvaluationScatterPoint[];
  xLabel: string;
  yLabel: string;
  xDomain: [number, number] | [number, "auto"];
  yDomain: [number, number] | [number, "auto"];
  testId: string;
}) => (
  <div className="h-72 w-full min-w-0 sm:h-80" data-testid={testId}>
    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
      <ScatterChart accessibilityLayer margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="x"
          name={xLabel}
          domain={xDomain}
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          tickLine={{ stroke: GRID_COLOR }}
          axisLine={{ stroke: GRID_COLOR }}
          label={{
            value: xLabel,
            position: "insideBottom",
            offset: -18,
            fill: AXIS_COLOR,
            fontSize: 11
          }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yLabel}
          domain={yDomain}
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          tickLine={{ stroke: GRID_COLOR }}
          axisLine={{ stroke: GRID_COLOR }}
          width={72}
          label={{
            value: yLabel,
            angle: -90,
            position: "insideLeft",
            offset: 8,
            fill: AXIS_COLOR,
            fontSize: 11
          }}
        />
        <Tooltip
          content={<EvaluationScatterTooltip xLabel={xLabel} yLabel={yLabel} />}
          cursor={{ stroke: GRID_COLOR }}
        />
        <Scatter data={points} fill={POINT_COLOR} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  </div>
);

export const DataLabLearningModelEvaluationPanel = ({ points, conceptById }: Props) => {
  const [selectedModel, setSelectedModel] = useState<string>(BKT_LEARNING_MODEL_ID);

  const metricsByModel = useMemo(() => groupLearningModelPredictionMetricsByModel(points), [points]);
  const metricsByModelAndConcept = useMemo(
    () => groupLearningModelPredictionMetricsByModelAndConcept(points),
    [points]
  );

  const selectedPoints = useMemo(
    () => points.filter((point) => point.model === selectedModel),
    [points, selectedModel]
  );
  const predictedVsActual = useMemo(
    () => toPredictedProbabilityVsActualPoints(selectedPoints),
    [selectedPoints]
  );
  const historyVsError = useMemo(
    () => toHistoryCountVsSquaredErrorPoints(selectedPoints),
    [selectedPoints]
  );
  const conceptRows = useMemo(() => {
    const byConcept = metricsByModelAndConcept.get(selectedModel) ?? new Map();
    return [...byConcept.entries()]
      .map(([conceptId, metrics]) => ({
        conceptId,
        label: conceptLabel(conceptId, conceptById),
        metrics
      }))
      .sort((a, b) => {
        const byLabel = a.label.localeCompare(b.label, "ja");
        if (byLabel !== 0) {
          return byLabel;
        }
        return a.conceptId.localeCompare(b.conceptId);
      });
  }, [conceptById, metricsByModelAndConcept, selectedModel]);

  return (
    <section
      className="relative min-w-0 max-w-full overflow-hidden rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-8"
      aria-labelledby="data-lab-learning-model-evaluation-title"
      data-testid="data-lab-learning-model-evaluation"
    >
      <div className="relative z-[1] space-y-5">
        <div className="space-y-2">
          <h2 id="data-lab-learning-model-evaluation-title" className="text-sm font-semibold text-celestial-softGold">
            学習モデル評価
          </h2>
          <p className="text-xs leading-relaxed text-celestial-textSub" data-testid="data-lab-learning-model-evaluation-note">
            {DATA_LAB_LEARNING_MODEL_EVALUATION_NOTE}
          </p>
        </div>

        <div className="min-w-0 max-w-xs">
          <label htmlFor="data-lab-evaluation-model" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
            表示モデル
          </label>
          <select
            id="data-lab-evaluation-model"
            className={inputClass}
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value)}
          >
            {EVALUATION_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-celestial-textSub">モデル比較サマリー</h3>
          <div className="w-full min-w-0 overflow-x-auto rounded-xl border border-celestial-border/70 bg-nordic-navy/35">
            <table
              className="w-full min-w-[28rem] border-collapse text-left text-sm"
              data-testid="data-lab-learning-model-summary"
            >
              <thead>
                <tr className="border-b border-celestial-border/50 text-xs tracking-wide text-celestial-textSub">
                  <th className="px-4 py-3 font-medium">モデル</th>
                  <th className="px-4 py-3 font-medium">prediction数</th>
                  <th className="px-4 py-3 font-medium">Brier score</th>
                  <th className="px-4 py-3 font-medium">Log loss</th>
                </tr>
              </thead>
              <tbody>
                {EVALUATION_MODELS.map((model) => {
                  const metrics = metricsByModel.get(model.id) ?? emptyMetrics();
                  return (
                    <tr key={model.id} className="border-b border-celestial-border/30 last:border-0">
                      <th scope="row" className="px-4 py-3 font-normal text-celestial-textMain">
                        {model.label}
                      </th>
                      <td className="px-4 py-3 tabular-nums text-celestial-textMain">{metrics.count}</td>
                      <td className="px-4 py-3 tabular-nums text-celestial-textMain">
                        {formatDataLabEvaluationScore(metrics.brierScore)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-celestial-textMain">
                        {formatDataLabEvaluationScore(metrics.logLoss)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-celestial-textSub">
            予測確率 × 実際の正誤
          </h3>
          {predictedVsActual.length === 0 ? (
            <p className="text-sm text-celestial-textSub" data-testid="data-lab-learning-model-predicted-vs-actual-empty">
              評価対象の予測点がありません。
            </p>
          ) : (
            <EvaluationScatter
              points={predictedVsActual}
              xLabel="予測正答確率"
              yLabel="実際の正誤"
              xDomain={[0, 1]}
              yDomain={[0, 1]}
              testId="data-lab-learning-model-predicted-vs-actual"
            />
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-celestial-textSub">Concept ごとの予測誤差</h3>
          {conceptRows.length === 0 ? (
            <p className="text-sm text-celestial-textSub" data-testid="data-lab-learning-model-concept-empty">
              Concept ごとの評価対象がありません。
            </p>
          ) : (
            <div className="w-full min-w-0 overflow-x-auto rounded-xl border border-celestial-border/70 bg-nordic-navy/35">
              <table
                className="w-full min-w-[32rem] border-collapse text-left text-sm"
                data-testid="data-lab-learning-model-concept-metrics"
              >
                <thead>
                  <tr className="border-b border-celestial-border/50 text-xs tracking-wide text-celestial-textSub">
                    <th className="px-4 py-3 font-medium">Concept</th>
                    <th className="px-4 py-3 font-medium">prediction数</th>
                    <th className="px-4 py-3 font-medium">Brier score</th>
                    <th className="px-4 py-3 font-medium">Log loss</th>
                  </tr>
                </thead>
                <tbody>
                  {conceptRows.map((row) => (
                    <tr key={row.conceptId} className="border-b border-celestial-border/30 last:border-0">
                      <th scope="row" className="px-4 py-3 font-normal text-celestial-softGold">
                        {row.label}
                      </th>
                      <td className="px-4 py-3 tabular-nums text-celestial-textMain">
                        {formatDataLabNullableCount(row.metrics.count)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-celestial-textMain">
                        {formatDataLabEvaluationScore(row.metrics.brierScore)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-celestial-textMain">
                        {formatDataLabEvaluationScore(row.metrics.logLoss)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-celestial-textSub">
            学習回数 × 予測誤差（Brier の点別寄与）
          </h3>
          {historyVsError.length === 0 ? (
            <p className="text-sm text-celestial-textSub" data-testid="data-lab-learning-model-history-error-empty">
              評価対象の予測点がありません。
            </p>
          ) : (
            <EvaluationScatter
              points={historyVsError}
              xLabel="学習回数（historyCount）"
              yLabel="二乗誤差"
              xDomain={[0, "auto"]}
              yDomain={[0, 1]}
              testId="data-lab-learning-model-history-error"
            />
          )}
        </div>
      </div>
    </section>
  );
};
