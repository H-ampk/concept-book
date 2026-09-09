import type { ReactNode } from "react";
import type { ConceptStatus } from "../../types/concept";
import type { DataLabConceptAggregate } from "../../utils/dataLab/aggregateDataLabConcepts";

type Props = {
  totalConcepts: number;
  displayedConcepts: number;
  aggregate: DataLabConceptAggregate;
};

const STATUS_LABEL: Record<ConceptStatus, string> = {
  active: "稼働中",
  researching: "調査中",
  unclear: "未整理",
  draft: "下書き",
  archived: "保管"
};

const formatCount = (value: number): string => `${value}`;

const formatAverage = (value: number | null): string => {
  if (value === null) {
    return "—";
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

const StatCard = ({ label, value, testId }: { label: string; value: string; testId?: string }) => (
  <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 px-4 py-3">
    <p className="text-xs font-medium tracking-wide text-celestial-textSub">{label}</p>
    <p
      className="mt-1 text-xl font-semibold tabular-nums text-celestial-textMain"
      data-testid={testId}
    >
      {value}
    </p>
  </div>
);

const Section = ({
  title,
  children,
  testId,
  note
}: {
  title: string;
  children: ReactNode;
  testId?: string;
  note?: string;
}) => (
  <section
    className="space-y-3 rounded-2xl border border-celestial-border/50 bg-nordic-navy/30 p-4"
    data-testid={testId}
  >
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-celestial-softGold">{title}</h3>
      {note ? <p className="text-xs leading-relaxed text-celestial-textSub">{note}</p> : null}
    </div>
    {children}
  </section>
);

const tableClass = "w-full min-w-0 border-collapse text-left text-sm text-celestial-textMain";
const thClass = "border-b border-celestial-border/50 px-2 py-2 text-xs font-medium text-celestial-textSub";
const tdClass = "border-b border-celestial-border/30 px-2 py-2 tabular-nums";

export const DataLabConceptResultsPanel = ({
  totalConcepts,
  displayedConcepts,
  aggregate
}: Props) => {
  if (totalConcepts === 0) {
    return (
      <section
        className="relative min-w-0 max-w-full rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-6"
        aria-labelledby="data-lab-concept-results-title"
        data-testid="data-lab-concept-results"
      >
        <div className="relative z-[1] space-y-3">
          <h2 id="data-lab-concept-results-title" className="text-sm font-semibold text-celestial-softGold">
            概念データ集計
          </h2>
          <p className="text-sm text-celestial-textSub" data-testid="data-lab-concept-empty-all">
            まだ集計できる Concept がありません。
          </p>
        </div>
      </section>
    );
  }

  if (displayedConcepts === 0) {
    return (
      <section
        className="relative min-w-0 max-w-full rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-6"
        aria-labelledby="data-lab-concept-results-title"
        data-testid="data-lab-concept-results"
      >
        <div className="relative z-[1] space-y-3">
          <h2 id="data-lab-concept-results-title" className="text-sm font-semibold text-celestial-softGold">
            概念データ集計
          </h2>
          <p className="text-sm text-celestial-textSub" data-testid="data-lab-concept-empty-filtered">
            条件に一致する Concept がありません。
          </p>
          <p className="text-xs text-celestial-textSub">フィルタ条件を変更してください。</p>
        </div>
      </section>
    );
  }

  const { relationSummary, contextSummary, completeness } = aggregate;
  const topRelations = aggregate.conceptRows.slice(0, 10);
  const statusRowsWithCount = aggregate.statusRows.filter((row) => row.conceptCount > 0);

  return (
    <section
      className="relative min-w-0 max-w-full rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-6"
      aria-labelledby="data-lab-concept-results-title"
      data-testid="data-lab-concept-results"
    >
      <div className="relative z-[1] space-y-5">
        <div className="space-y-2">
          <h2 id="data-lab-concept-results-title" className="text-sm font-semibold text-celestial-softGold">
            概念データ集計
          </h2>
          <p
            className="max-w-3xl text-xs leading-relaxed text-celestial-textSub"
            data-testid="data-lab-concept-disclaimer"
          >
            Concept
            数や関連数はデータ構造上の指標であり、Concept の重要度や理解度を直接表すものではありません。
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="data-lab-concept-overview">
          <StatCard
            label="対象Concept"
            value={formatCount(aggregate.totalConceptCount)}
            testId="data-lab-concept-stat-total"
          />
          <StatCard
            label="お気に入り"
            value={formatCount(aggregate.favoriteCount)}
            testId="data-lab-concept-stat-favorite"
          />
          <StatCard
            label="平均関連数"
            value={formatAverage(relationSummary.average)}
            testId="data-lab-concept-stat-avg-relation"
          />
          <StatCard
            label="文脈別定義"
            value={formatCount(contextSummary.totalContextDefinitionCount)}
            testId="data-lab-concept-stat-context-total"
          />
        </div>

        <Section title="status 別" testId="data-lab-concept-status">
          {statusRowsWithCount.length === 0 ? (
            <p className="text-xs text-celestial-textSub">表示できる status がありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>status</th>
                    <th className={thClass}>Concept数</th>
                  </tr>
                </thead>
                <tbody>
                  {statusRowsWithCount.map((row) => (
                    <tr key={row.status}>
                      <td className={tdClass}>{STATUS_LABEL[row.status]}</td>
                      <td className={tdClass}>{row.conceptCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section
          title="分野別"
          testId="data-lab-concept-domains"
          note="※ 複数分野を持つ Concept は各分野に重複して集計されます。"
        >
          {aggregate.domainRows.length === 0 ? (
            <p className="text-xs text-celestial-textSub">表示できる分野がありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>分野</th>
                    <th className={thClass}>Concept数</th>
                    <th className={thClass}>文脈数</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregate.domainRows.map((row) => (
                    <tr key={row.key}>
                      <td className={tdClass}>{row.domainTag ?? "分野なし"}</td>
                      <td className={tdClass}>{row.conceptCount}</td>
                      <td className={tdClass}>{row.contextDefinitionCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="関連" testId="data-lab-concept-relations">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="平均関連数" value={formatAverage(relationSummary.average)} />
            <StatCard
              label="最大関連数"
              value={relationSummary.maximum === null ? "—" : formatCount(relationSummary.maximum)}
            />
            <StatCard
              label="最小関連数"
              value={relationSummary.minimum === null ? "—" : formatCount(relationSummary.minimum)}
            />
            <StatCard
              label="関連なし Concept"
              value={formatCount(relationSummary.zeroRelationConceptCount)}
              testId="data-lab-concept-zero-relations"
            />
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-celestial-textSub">関連数が多い Concept</h4>
            {topRelations.length === 0 ? (
              <p className="text-xs text-celestial-textSub">表示できる Concept がありません。</p>
            ) : (
              <ol className="space-y-1" data-testid="data-lab-concept-relation-ranking">
                {topRelations.map((row, index) => (
                  <li
                    key={row.conceptId}
                    className="flex items-baseline justify-between gap-3 text-sm text-celestial-textMain"
                  >
                    <span className="min-w-0 truncate">
                      <span className="tabular-nums text-celestial-textSub">{index + 1}. </span>
                      {row.title.trim() || row.conceptId}
                    </span>
                    <span className="shrink-0 tabular-nums text-celestial-softGold">{row.relationCount}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Section>

        <Section title="文脈別定義" testId="data-lab-concept-contexts">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="文脈別定義の総数"
              value={formatCount(contextSummary.totalContextDefinitionCount)}
            />
            <StatCard
              label="文脈あり Concept"
              value={formatCount(contextSummary.conceptsWithContextDefinitions)}
            />
            <StatCard
              label="文脈なし Concept"
              value={formatCount(contextSummary.conceptsWithoutContextDefinitions)}
            />
            <StatCard
              label="平均文脈数"
              value={formatAverage(contextSummary.averageContextDefinitionCount)}
            />
          </div>
        </Section>

        <Section title="データ充足状況" testId="data-lab-concept-completeness">
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <tbody>
                <tr>
                  <td className={tdClass}>定義未入力</td>
                  <td className={tdClass}>{completeness.missingDefinitionCount}</td>
                </tr>
                <tr>
                  <td className={tdClass}>出典未登録</td>
                  <td className={tdClass}>{completeness.missingSourceCount}</td>
                </tr>
                <tr>
                  <td className={tdClass}>関連Conceptなし</td>
                  <td className={tdClass}>{completeness.missingRelationCount}</td>
                </tr>
                <tr>
                  <td className={tdClass}>文脈別定義なし</td>
                  <td className={tdClass}>{completeness.missingContextDefinitionCount}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </section>
  );
};
