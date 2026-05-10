import type { QuizAttemptLog } from "../types/quiz";
import {
  computeConceptConfusionNodeStats,
  computeConfusionEdges,
  CONCEPT_GRAPH_UNCLASSIFIED_KEY,
  formatConceptGraphNodeLabel
} from "./quizConceptGraphStats";
import {
  QUIZ_DECK_BUCKET_FREE,
  computeConceptStats,
  computeDeckStats,
  computeOverallSummary,
  formatConceptRef,
  formatSecondsFromMs,
  type DeckLearningStat
} from "./quizStats";

const SMALL_SAMPLE_THRESHOLD = 15;

const pct = (rate: number): string => `${(rate * 100).toFixed(1)}%`;

const caveatSmall = (n: number): string =>
  n < SMALL_SAMPLE_THRESHOLD
    ? "（この期間のログ件数が少ないため、以下は参考程度の観察にとどまります。）"
    : "";

export type ResearchReportInput = {
  logs: QuizAttemptLog[];
  titleById: Map<string, string>;
  /** 画面表示用（例: 全期間、または日付レンジ） */
  periodLabel: string;
  /** 読み込んだ問題数（文脈用。0 でも可） */
  quizQuestionCount: number;
};

/**
 * ルールベースの研究・振り返り用レポート（Markdown）。
 * LLM は使用しない。
 */
export const generateResearchReportMarkdown = (input: ResearchReportInput): string => {
  const { logs, titleById, periodLabel, quizQuestionCount } = input;
  const n = logs.length;
  const caveat = caveatSmall(n);

  const overall = computeOverallSummary(logs);
  const deckStats = computeDeckStats(logs);
  const deckOnly = deckStats.filter((d) => d.bucketKey !== QUIZ_DECK_BUCKET_FREE);
  const conceptStats = computeConceptStats(logs);
  const confusionEdges = computeConfusionEdges(logs);
  const nodeStats = computeConceptConfusionNodeStats(logs, confusionEdges);

  const lines: string[] = [];

  lines.push(`# 研究レポート（観察サマリ）`);
  lines.push(``);
  lines.push(`> 本レポートは端末に保存されたクイズ回答ログから機械的に要約したものであり、**能力や人格の評価ではありません**。解釈は控えめに行ってください。`);
  lines.push(``);

  lines.push(`## 概要`);
  lines.push(``);
  lines.push(`- **対象期間**: ${periodLabel}`);
  lines.push(`- **総回答数**: ${overall.totalAttempts} 件 ${caveat}`);
  lines.push(
    `- **正答率**: ${overall.totalAttempts > 0 ? pct(overall.accuracy) : "—"}（正解 ${overall.correctCount} / ${overall.totalAttempts} 件）`
  );
  lines.push(
    `- **平均反応時間**: ${overall.avgReactionTimeMs != null ? formatSecondsFromMs(overall.avgReactionTimeMs) : "—"}（timeMs が 0 または計測対象外のログは平均から除外）`
  );
  lines.push(`- **登録済みクイズ問題数（参考）**: ${quizQuestionCount} 問`);
  lines.push(``);

  lines.push(`この期間において、ログ上では${overall.totalAttempts > 0 ? `正答率は ${pct(overall.accuracy)} 付近で推移しています。` : "回答ログがありません。"}${overall.totalAttempts > 0 ? " 正答率は問題の難易度・出題形式・疲労など様々な要因の影響を受け得ます。" : ""}`);
  if (overall.avgReactionTimeMs != null && overall.totalAttempts > 0) {
    lines.push(
      `平均反応時間はおおよそ ${formatSecondsFromMs(overall.avgReactionTimeMs)} でした（反応時間は問題文の長さや操作環境の影響も受けます）。`
    );
  }
  lines.push(``);

  lines.push(`## クイズ集別傾向`);
  lines.push(``);
  if (deckOnly.length === 0) {
    lines.push(
      `- **クイズ集（deck）に紐づく回答**: この期間のログでは検出されませんでした（自由学習のみ、または Deck 情報のないログのみの可能性があります）。`
    );
  } else {
    const byAnswers = [...deckOnly].sort((a, b) => b.answerCount - a.answerCount);
    const byAccuracyAsc = [...deckOnly]
      .filter((d) => d.answerCount >= 2)
      .sort((a, b) => a.accuracy - b.accuracy);
    const byTimeDesc = [...deckOnly]
      .filter((d) => d.averageTimeMs != null && d.answerCount >= 1)
      .sort((a, b) => (b.averageTimeMs ?? 0) - (a.averageTimeMs ?? 0));

    lines.push(`| 観点 | 観察（ログに基づく） |`);
    lines.push(`| --- | --- |`);
    lines.push(
      `| 回答数が多いクイズ集 | ${formatDeckTopN(byAnswers.slice(0, 3), "answerCount")} |`
    );
    lines.push(
      `| 正答率が低めに出ているクイズ集（回答2件以上のもの） | ${formatDeckTopN(byAccuracyAsc.slice(0, 3), "lowAccuracy")} |`
    );
    lines.push(
      `| 平均反応時間が長めに出ているクイズ集 | ${formatDeckTopN(byTimeDesc.slice(0, 3), "slow")} |`
    );
    lines.push(``);
    lines.push(
      `※ 「低め」「長め」は**この期間・この端末のログ内での相対的な比較**であり、一般的な基準を示すものではありません。`
    );
  }
  lines.push(``);

  lines.push(`## Concept 別傾向`);
  lines.push(``);
  const nullBucket = conceptStats.find((c) => c.bucketId == null);
  if (nullBucket && nullBucket.attemptCount > 0) {
    lines.push(
      `- **未分類バケット**（正解リンク Concept・問題の conceptId が特定できないログ）に該当する回答が **${nullBucket.attemptCount}** 件みられます。`
    );
  } else {
    lines.push(`- 未分類バケットに該当する回答は、この集計上は目立ちませんでした。`);
  }
  lines.push(``);

  const conceptNamed = conceptStats.filter((c) => c.bucketId != null);
  const lowAccConcepts = [...conceptNamed]
    .filter((c) => c.attemptCount >= 2)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);
  const slowConcepts = [...conceptNamed]
    .filter((c) => c.attemptCount >= 2 && c.avgReactionTimeMs != null)
    .sort((a, b) => (b.avgReactionTimeMs ?? 0) - (a.avgReactionTimeMs ?? 0))
    .slice(0, 5);

  lines.push(`| 観点 | 観察（ログに基づく） |`);
  lines.push(`| --- | --- |`);
  lines.push(
    `| 正答率が低めに見える Concept（同一バケットで回答2件以上） | ${formatConceptList(lowAccConcepts, titleById, "accuracy")} |`
  );
  lines.push(
    `| 平均反応時間が長めに見える Concept（同一バケットで回答2件以上） | ${formatConceptList(slowConcepts, titleById, "time")} |`
  );
  lines.push(``);
  lines.push(
    `Concept の集計は、ダッシュボードと同様に「正解選択肢の linkedConceptId」を優先し、なければ問題の conceptId を用いています。`
  );
  lines.push(``);

  lines.push(`## Concept 混同傾向`);
  lines.push(``);
  const incorrectN = logs.filter((l) => !l.correct).length;
  if (incorrectN === 0) {
    lines.push(`- この期間では**不正解ログが無い**ため、混同ペアの観察は行えません。`);
  } else if (confusionEdges.length === 0) {
    lines.push(`- 不正解ログはありますが、リンク情報から混同ペアを構成できるケースは集計上ほとんどありませんでした。`);
  } else {
    lines.push(`- **混同ペアの種類数**: ${confusionEdges.length} 種（不正解かつ選んだ／正解の Concept キー組み合わせ）`);
    lines.push(`- **取り違え件数が多いペア（上位）**:`);
    confusionEdges.slice(0, 5).forEach((e, i) => {
      const a = formatConceptGraphNodeLabel(e.selectedKey, titleById);
      const b = formatConceptGraphNodeLabel(e.correctKey, titleById);
      lines.push(`  ${i + 1}. 「${a}」→ 正解は「${b}」 … ${e.count} 件`);
    });
    lines.push(``);

    const misleading = nodeStats
      .filter((s) => s.conceptKey !== CONCEPT_GRAPH_UNCLASSIFIED_KEY)
      .sort((a, b) => b.chosenAsWrongCount - a.chosenAsWrongCount)
      .slice(0, 3);
    const correctSide = nodeStats
      .filter((s) => s.conceptKey !== CONCEPT_GRAPH_UNCLASSIFIED_KEY)
      .sort((a, b) => b.asCorrectInWrongCount - a.asCorrectInWrongCount)
      .slice(0, 3);

    lines.push(`- **誤答時に選ばれやすい Concept（ログ上の件数）**: ${formatNodeStatNames(misleading, titleById, "chosen")}`);
    lines.push(
      `- **不正解ログのなかで「正解 Concept 側」として現れた回数が多い Concept**: ${formatNodeStatNames(correctSide, titleById, "correct")}`
    );
    lines.push(
      `※ いずれも**誤答が記録された場合に限定した頻度**であり、習熟度を断定するものではありません。`
    );
  }
  lines.push(``);

  lines.push(`## 観察メモ`);
  lines.push(``);
  lines.push(`- 本レポートは **IndexedDB に保存された回答ログ** に基づく観察です。`);
  lines.push(`- ログ件数が少ない場合、偶然のばらつきの影響が大きくなります。`);
  lines.push(`- 医学的・診断的な解釈には用いないでください。`);
  lines.push(``);
  lines.push(`---`);
  lines.push(`*Generated by Concept Book（ルールベース要約）*`);

  return lines.join("\n");
};

function formatDeckTopN(rows: DeckLearningStat[], mode: "answerCount" | "lowAccuracy" | "slow"): string {
  if (rows.length === 0) {
    return "該当するデータが十分ではありませんでした。";
  }
  return rows
    .map((d) => {
      const base = `「${d.displayName}」`;
      if (mode === "answerCount") {
        return `${base}（回答 ${d.answerCount} 件、正答率 ${pct(d.accuracy)}）`;
      }
      if (mode === "lowAccuracy") {
        return `${base}（正答率 ${pct(d.accuracy)}、回答 ${d.answerCount} 件）`;
      }
      return `${base}（平均 ${d.averageTimeMs != null ? formatSecondsFromMs(d.averageTimeMs) : "—"}、回答 ${d.answerCount} 件）`;
    })
    .join(" / ");
}

function formatConceptList(
  rows: { bucketId: string | null; attemptCount: number; accuracy: number; avgReactionTimeMs: number | null }[],
  titleById: Map<string, string>,
  kind: "accuracy" | "time"
): string {
  if (rows.length === 0) {
    return "該当するデータが十分ではありませんでした（回答件数の条件を満たす場合のみ抽出）。";
  }
  return rows
    .map((c) => {
      const name = formatConceptRef(c.bucketId, titleById);
      if (kind === "accuracy") {
        return `「${name}」（正答率 ${pct(c.accuracy)}、${c.attemptCount} 件）`;
      }
      return `「${name}」（平均 ${c.avgReactionTimeMs != null ? formatSecondsFromMs(c.avgReactionTimeMs) : "—"}、${c.attemptCount} 件）`;
    })
    .join(" / ");
}

function formatNodeStatNames(
  rows: { conceptKey: string; chosenAsWrongCount: number; asCorrectInWrongCount: number }[],
  titleById: Map<string, string>,
  kind: "chosen" | "correct"
): string {
  if (rows.length === 0) {
    return "該当が十分ではありませんでした。";
  }
  return rows
    .map((r) => {
      const name = formatConceptGraphNodeLabel(r.conceptKey, titleById);
      const v = kind === "chosen" ? r.chosenAsWrongCount : r.asCorrectInWrongCount;
      return `「${name}」（${v} 件）`;
    })
    .join("、");
}
