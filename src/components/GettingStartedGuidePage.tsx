type Props = {
  onCreateConcept: () => void;
  onOpenConceptList: () => void;
  onOpenQuizBuilder: () => void;
  onOpenQuizPlay: () => void;
  onOpenLearningLogs: () => void;
  onOpenDataLab: () => void;
  onOpenSkillTree: () => void;
  onOpenResearchReport: () => void;
};

const steps = [
  {
    title: "Concept を登録する",
    body: "まず、いま勉強している用語を1つ Concept として登録します。Concept は学習内容の基本単位です。最初から大量に登録する必要はなく、1つあれば始められます。",
    example: "例: 「勾配降下法」"
  },
  {
    title: "Concept に情報を足す",
    body: "登録した Concept を中心に、知識を構造化します。定義、利用目的や説明、関連 Concept を書き、必要なら文脈カードや PDF 教材・出典を足します。",
    example: "例: 「勾配降下法」の定義を書き、「損失関数」「学習率」などの関連 Concept をつなげる。"
  },
  {
    title: "クイズで学習する",
    body: "Concept の内容を登録したら、クイズを作成して実際に思い出す練習をします。",
    example: "例: 「勾配降下法は何を小さくするためにパラメータを更新するか」を問題にする。"
  },
  {
    title: "学習結果を見る",
    body: "クイズへの回答は学習ログとして蓄積され、あとから学習状況を確認できます。学習ログは回答の記録、Data Lab はその記録を使った分析画面です。",
    example: "例: 「勾配降下法」を何度か解いたあと、正誤の履歴と理解の様子を見返す。"
  }
] as const;

export const GettingStartedGuidePage = ({
  onCreateConcept,
  onOpenConceptList,
  onOpenQuizBuilder,
  onOpenQuizPlay,
  onOpenLearningLogs,
  onOpenDataLab,
  onOpenSkillTree,
  onOpenResearchReport
}: Props) => {
  return (
    <article className="ritual-altar space-y-6 rounded-xl border border-[rgba(110,140,155,0.2)] bg-[rgba(248,251,252,0.92)] p-5 sm:p-8">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-wide text-celestial-textMain sm:text-2xl">
          ConceptBook の使い方
        </h1>
        <p className="text-sm leading-relaxed text-nordic-textSecondary">
          ConceptBook は、勉強している用語を Concept として残し、クイズで思い出し、その結果をあとから見るためのアプリです。最初は次の4段階だけで十分です。
        </p>
      </header>

      <ol className="space-y-4">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="rounded-lg border border-[rgba(110,140,155,0.22)] bg-white/70 p-4"
          >
            <h2 className="text-base font-semibold text-celestial-textMain">
              <span className="mr-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-[rgba(110,140,155,0.45)] px-2 text-sm">
                {index + 1}
              </span>
              {step.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-celestial-textMain">{step.body}</p>
            <p className="mt-2 text-sm leading-relaxed text-nordic-textSecondary">{step.example}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {index === 0 && (
                <button type="button" className="action-button px-4 py-2 text-sm" onClick={onCreateConcept}>
                  Concept を追加する
                </button>
              )}
              {index === 1 && (
                <button type="button" className="index-text-button" onClick={onOpenConceptList}>
                  Concept 一覧を見る
                </button>
              )}
              {index === 2 && (
                <>
                  <button type="button" className="action-button px-4 py-2 text-sm" onClick={onOpenQuizBuilder}>
                    クイズを作る
                  </button>
                  <button type="button" className="index-text-button" onClick={onOpenQuizPlay}>
                    クイズで学習する
                  </button>
                </>
              )}
              {index === 3 && (
                <>
                  <button type="button" className="action-button px-4 py-2 text-sm" onClick={onOpenLearningLogs}>
                    学習ログを見る
                  </button>
                  <button type="button" className="index-text-button" onClick={onOpenDataLab}>
                    Data Lab を見る
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>

      <section className="space-y-3 border-t border-[rgba(110,140,155,0.22)] pt-5">
        <h2 className="text-base font-semibold text-celestial-textMain">もっと詳しく分析したいとき</h2>
        <p className="text-sm leading-relaxed text-nordic-textSecondary">
          Concept を登録してクイズで学習するだけなら、最初から次の機能を全部理解する必要はありません。学習が進んでから使います。
        </p>
        <ul className="space-y-2 text-sm leading-relaxed text-celestial-textMain">
          <li>
            <strong>Data Lab</strong>
            ：回答ログを使って、Concept ごとの学習状況やモデルによる推定を見る分析画面です。
          </li>
          <li>
            <strong>BKT</strong>
            ：Concept をどの程度習得しているかという確率を見るモデルです。
          </li>
          <li>
            <strong>PFA</strong>
            ：これまでの成功・失敗などから、次の学習状態を推定するモデルです。
          </li>
          <li>
            <strong>HLR</strong>
            ：記憶がどの程度保持されているかを見るモデルです。
          </li>
          <li>
            <strong>Research Report</strong>
            ：Data Lab などの分析結果を研究用に保存・整理する機能です。
          </li>
          <li>
            <strong>SkillTree</strong>
            ：Concept 間の前提関係をツリーとして見る表示です。
          </li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="index-text-button" onClick={onOpenResearchReport}>
            Research Report を見る
          </button>
          <button type="button" className="index-text-button" onClick={onOpenSkillTree}>
            SkillTree を見る
          </button>
        </div>
      </section>
    </article>
  );
};
