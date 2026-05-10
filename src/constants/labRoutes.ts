export type LabRoute =
  | "quiz-builder"
  | "quiz-play"
  | "analysis-dashboard"
  | "learning-logs"
  | "concept-graph-analysis"
  | "research-report"
  | "data-lab";

export type LabMenuItem = {
  label: string;
  route: LabRoute;
  description: string;
  status: "coming_soon";
};

export const LAB_MENU_ITEMS: LabMenuItem[] = [
  {
    label: "クイズ作成",
    route: "quiz-builder",
    description: "Conceptに紐づく問い・選択肢・正解・解説を作成する画面。",
    status: "coming_soon"
  },
  {
    label: "クイズで学習",
    route: "quiz-play",
    description: "作成した問いを使って、概念ごとにクイズ形式で学習する画面。",
    status: "coming_soon"
  },
  {
    label: "分析ダッシュボード",
    route: "analysis-dashboard",
    description: "回答ログをもとに、正答率・反応時間・概念別理解度などを可視化する画面。",
    status: "coming_soon"
  },
  {
    label: "学習ログ",
    route: "learning-logs",
    description: "回答履歴・学習日時・正誤・反応時間などのログを確認する画面。",
    status: "coming_soon"
  },
  {
    label: "概念グラフ分析",
    route: "concept-graph-analysis",
    description: "概念同士の関係や、誤答が多い概念のつながりを分析する画面。",
    status: "coming_soon"
  },
  {
    label: "研究レポート",
    route: "research-report",
    description: "学習ログや分析結果をもとに、研究用・振り返り用のレポートを生成する画面。",
    status: "coming_soon"
  },
  {
    label: "データ実験",
    route: "data-lab",
    description: "保存データ、ログ、分析用データを確認・実験するためのラボ画面。",
    status: "coming_soon"
  }
];

const LAB_ROUTE_SET = new Set<string>(LAB_MENU_ITEMS.map((item) => item.route));

export const isLabRoute = (screen: string): screen is LabRoute => LAB_ROUTE_SET.has(screen);
