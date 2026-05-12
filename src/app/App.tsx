import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ConceptDetail } from "../components/ConceptDetail";
import { ConceptFormModal } from "../components/ConceptFormModal";

const ConceptGraphView = lazy(() =>
  import("../components/ConceptGraphView").then((m) => ({ default: m.ConceptGraphView }))
);
const SkillTreeView = lazy(() =>
  import("../components/SkillTreeView").then((m) => ({ default: m.SkillTreeView }))
);
import {
  ConceptGroupSections,
  type ConceptGroupSection,
  type ListViewMode
} from "../components/ConceptGroupSections";
import { SettingsPage } from "../components/SettingsPage";
import { useConcepts } from "../features/concepts/useConcepts";
import { conceptStatusList, type Concept, type ConceptInput, type ConceptStatus } from "../types/concept";
import { loadDomainColorMap, saveDomainColorMap } from "../utils/domainColors";
import { ContextCardsScreen } from "../components/ContextCardsScreen";
import { OrnamentLine } from "../components/common/OrnamentLine";
import { LabNavDropdown } from "../components/LabNavDropdown";
import { LabPlaceholderPage } from "../components/LabPlaceholderPage";
import { ConceptGraphAnalysisPage } from "../components/ConceptGraphAnalysisPage";
import { ResearchReportPage } from "../components/ResearchReportPage";
import { QuizAnalysisDashboardPage } from "../components/QuizAnalysisDashboardPage";
import { QuizBuilderPage } from "../components/QuizBuilderPage";
import { QuizLearningLogsPage } from "../components/QuizLearningLogsPage";
import { QuizPlayPage } from "../components/QuizPlayPage";
import { type LabRoute, isLabRoute } from "../constants/labRoutes";

type Screen = "concepts" | "contexts" | "settings" | LabRoute;
type ConceptMainTab = "list" | "graph" | "tree";

const statusLabelMap: Record<ConceptStatus, string> = {
  active: "稼働中",
  researching: "調査中",
  unclear: "未整理",
  archived: "保管"
};

const assetUrl = (path: string): string =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

const buildTagSections = (
  concepts: Concept[],
  type: "domain" | "research"
): ConceptGroupSection[] => {
  const bucket = new Map<string, Concept[]>();
  let unclassified: Concept[] = [];

  concepts.forEach((concept) => {
    const tags = type === "domain" ? concept.domainTags : concept.researchTags;
    if (tags.length === 0) {
      unclassified = [...unclassified, concept];
      return;
    }
    tags.forEach((tag) => {
      const current = bucket.get(tag) ?? [];
      bucket.set(tag, [...current, concept]);
    });
  });

  const sections: ConceptGroupSection[] = [...bucket.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ja"))
    .map(([tag, groupedConcepts]) => ({
      key: `${type}-${tag}`,
      label: tag,
      concepts: groupedConcepts
    }));

  if (unclassified.length > 0) {
    sections.push({
      key: "unclassified",
      label: "未分類",
      concepts: unclassified
    });
  }

  return sections;
};

const DecorativeBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
    <div className="hud-global-ring" aria-hidden="true" />
    <div className="absolute inset-0 bg-gradient-radial from-nordic-bgAlt via-nordic-bg to-nordic-muted opacity-80"></div>
    <div className="star-field absolute inset-0 opacity-30"></div>
    <div className="astral-chart absolute inset-0"></div>
    <div className="cathedral-frame cathedral-frame-left"></div>
    <div className="cathedral-frame cathedral-frame-right"></div>
    <div className="moon-emblem" aria-hidden="true">
      <div className="moon-ring moon-ring-outer"></div>
      <div className="moon-ring moon-ring-middle"></div>
      <div className="moon-ring moon-ring-inner"></div>
      <div className="moon-axis moon-axis-1"></div>
      <div className="moon-axis moon-axis-2"></div>
      <div className="moon-axis moon-axis-3"></div>
    </div>
  </div>
);

export const App = () => {
  const {
    concepts,
    visibleConcepts,
    allDomainTags,
    allResearchTags,
    loading,
    query,
    setQuery,
    selectedDomainTags,
    setSelectedDomainTags,
    selectedResearchTags,
    setSelectedResearchTags,
    selectedStatuses,
    setSelectedStatuses,
    onlyFavorite,
    setOnlyFavorite,
    create,
    update,
    remove,
    reload,
    toggleFavorite
  } = useConcepts();

  const [screen, setScreen] = useState<Screen>("concepts");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConcept, setEditingConcept] = useState<Concept | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Concept | undefined>(undefined);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [conceptMainTab, setConceptMainTab] = useState<ConceptMainTab>("list");
  const [listViewMode, setListViewMode] = useState<ListViewMode>("all");
  const [domainColorMap, setDomainColorMap] = useState<Record<string, string>>({});
  const [isFieldTagsExpanded, setIsFieldTagsExpanded] = useState(false);
  const appShellStyle = useMemo(
    () =>
      ({
        "--corner-decoration-url": `url(${assetUrl("decorations/corner.svg")})`
      }) as CSSProperties,
    []
  );

  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const detailContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDomainColorMap(loadDomainColorMap());
  }, []);

  const conceptMap = useMemo(() => new Map(concepts.map((concept) => [concept.id, concept])), [concepts]);
  const selectedConcept = selectedId ? conceptMap.get(selectedId) : undefined;
  const groupedSections = useMemo(() => {
    if (listViewMode === "all") {
      return [{ key: "all", label: "全体", concepts: visibleConcepts }];
    }
    if (listViewMode === "domain") {
      return buildTagSections(visibleConcepts, "domain");
    }
    return buildTagSections(visibleConcepts, "research");
  }, [listViewMode, visibleConcepts]);

  const openCreate = () => {
    setEditingConcept(undefined);
    setModalOpen(true);
  };

  const openEdit = (concept: Concept) => {
    setEditingConcept(concept);
    setModalOpen(true);
  };

  const handleSubmit = async (payload: ConceptInput) => {
    if (editingConcept) {
      const updated = await update(editingConcept.id, payload);
      setSelectedId(editingConcept.id);
      return updated ?? undefined;
    }
    return await create(payload);
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMobileDetail(true);

    requestAnimationFrame(() => {
      const selectedCard = cardRefs.current.get(id);
      const detailContainer = detailContainerRef.current;
      if (!selectedCard || !detailContainer) return;

      selectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

      const cardRect = selectedCard.getBoundingClientRect();
      const detailRect = detailContainer.getBoundingClientRect();
      const relativeTop = cardRect.top - detailRect.top + detailContainer.scrollTop - 40;
      detailContainer.scrollTo({ top: Math.max(relativeTop, 0), behavior: 'smooth' });
    });
  };
  const handleGraphSelect = (id: string) => {
    setSelectedId(id);
  };

  const handleRequestDelete = (concept: Concept) => {
    setDeleteTarget(concept);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) {
      return;
    }
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      if (selectedId === deleteTarget.id) {
        setSelectedId(undefined);
        setMobileDetail(false);
      }
      setDeleteTarget(undefined);
      setFeedback("概念を削除しました。");
    } catch {
      setFeedback("削除に失敗しました。時間をおいて再試行してください。");
    } finally {
      setDeleting(false);
    }
  };

  const handleChangeDomainColor = (tag: string, color: string) => {
    setDomainColorMap((prev) => {
      const next = { ...prev, [tag]: color };
      saveDomainColorMap(next);
      return next;
    });
  };

  return (
    <div className="app-background relative min-h-screen bg-nordic-bg text-celestial-textMain overflow-hidden" style={appShellStyle}>
      <div className="cyber-ambient" aria-hidden="true" />
      <DecorativeBackground />

      <header className="app-header-shell app-header relative z-30 overflow-visible">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2">
          <div className="header-insignia hud-header-cluster min-w-0">
            <h1 className="text-xl font-semibold tracking-wider ritual-title">Concept Book App</h1>
            <p className="text-xs text-celestial-softGold ritual-subtitle">Et sted for tanker</p>
            <OrnamentLine variant="header" />
          </div>
          <nav className="header-nav-button-group shrink-0">
            <button
              className={`header-nav-button rounded-md ${
                screen === "concepts" ? "header-nav-button--active" : ""
              }`}
              onClick={() => setScreen("concepts")}
              type="button"
            >
              概念
            </button>
            <button
              className={`header-nav-button rounded-md ${
                screen === "contexts" ? "header-nav-button--active" : ""
              }`}
              onClick={() => setScreen("contexts")}
              type="button"
            >
              文脈
            </button>
            <LabNavDropdown
              screen={screen}
              isLabActive={isLabRoute(screen)}
              onNavigate={(route) => setScreen(route)}
            />
            <button
              className={`header-nav-button rounded-md ${
                screen === "settings" ? "header-nav-button--active" : ""
              }`}
              onClick={() => setScreen("settings")}
              type="button"
            >
              設定
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 relative z-10">
        {screen === "settings" ? (
          <SettingsPage
            onImported={reload}
            domainTags={allDomainTags}
            domainColorMap={domainColorMap}
            onChangeDomainColor={handleChangeDomainColor}
          />
        ) : screen === "contexts" ? (
          <ContextCardsScreen onNavigateToConcept={(id) => {
            setScreen("concepts");
            setSelectedId(id);
            setMobileDetail(true);
          }} />
        ) : isLabRoute(screen) ? (
          screen === "quiz-builder" ? (
            <QuizBuilderPage onBack={() => setScreen("concepts")} />
          ) : screen === "quiz-play" ? (
            <QuizPlayPage
              onBack={() => setScreen("concepts")}
              onNavigateToConcept={(id) => {
                setScreen("concepts");
                setSelectedId(id);
                setMobileDetail(true);
              }}
              onGoToQuizBuilder={() => setScreen("quiz-builder")}
            />
          ) : screen === "analysis-dashboard" ? (
            <QuizAnalysisDashboardPage
              onBack={() => setScreen("concepts")}
              onGoToQuizPlay={() => setScreen("quiz-play")}
              onGoToLearningLogs={() => setScreen("learning-logs")}
            />
          ) : screen === "learning-logs" ? (
            <QuizLearningLogsPage
              onBack={() => setScreen("concepts")}
              onGoToQuizPlay={() => setScreen("quiz-play")}
              onGoToAnalysisDashboard={() => setScreen("analysis-dashboard")}
            />
          ) : screen === "concept-graph-analysis" ? (
            <ConceptGraphAnalysisPage onBack={() => setScreen("concepts")} />
          ) : screen === "research-report" ? (
            <ResearchReportPage
              onBack={() => setScreen("concepts")}
              onGoToQuizPlay={() => setScreen("quiz-play")}
            />
          ) : (
            <LabPlaceholderPage route={screen} onBack={() => setScreen("concepts")} />
          )
        ) : (
          <div className="space-y-4">
            <section className="relative z-10 rounded-3xl border border-[rgba(110,140,155,0.26)] bg-[rgba(248,251,252,0.92)] p-6 shadow-[0_10px_28px_rgba(70,95,110,0.08)] decorated-card ritual-altar">
              <span className="card-corner card-corner-top-left" aria-hidden="true" />
              <span className="card-corner card-corner-top-right" aria-hidden="true" />
              <span className="card-corner card-corner-bottom-left" aria-hidden="true" />
              <span className="card-corner card-corner-bottom-right" aria-hidden="true" />
              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <div className="hud-search-wrap min-w-0">
                  <input
                    className="w-full rounded-xl border border-[rgba(110,140,155,0.28)] bg-[rgba(255,255,255,0.9)] px-4 py-3 text-sm text-nordic-textPrimary shadow-[0_10px_28px_rgba(70,95,110,0.08)] placeholder:text-[rgba(31,45,52,0.62)]"
                    placeholder="タイトル・定義・解釈・分野タグ・研究テーマタグ・メモを検索"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <button
                  className="rounded-xl border border-[rgba(110,140,155,0.28)] bg-[rgba(255,255,255,0.85)] px-4 py-3 text-sm text-nordic-textPrimary shadow-[0_10px_28px_rgba(70,95,110,0.08)] hover:border-[rgba(110,140,155,0.36)] hover:bg-white"
                  type="button"
                  onClick={() => setOnlyFavorite((prev) => !prev)}
                >
                  {onlyFavorite ? "お気に入りのみ: ON" : "お気に入りのみ: OFF"}
                </button>
                <button
                  type="button"
                  className="action-button rounded-lg px-4 py-3 text-sm"
                  onClick={openCreate}
                >
                  概念を追加
                </button>
              </div>
              <div className="hud-mode-strip mt-4 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-nordic-textSecondary">表示:</span>
                <button
                  type="button"
                  onClick={() => setConceptMainTab("list")}
                  className={`rounded-lg border border-[rgba(110,140,155,0.24)] px-3 py-1.5 text-sm text-nordic-textSecondary shadow-[0_8px_20px_rgba(70,95,110,0.07)] hover:bg-white ${
                    conceptMainTab === "list"
                      ? "border-[rgba(110,140,155,0.32)] bg-white text-nordic-textPrimary"
                      : "bg-[rgba(255,255,255,0.72)]"
                  }`}
                >
                  一覧表示
                </button>
                <button
                  type="button"
                  onClick={() => setConceptMainTab("graph")}
                  className={`rounded-lg border border-[rgba(110,140,155,0.24)] px-3 py-1.5 text-sm text-nordic-textSecondary shadow-[0_8px_20px_rgba(70,95,110,0.07)] hover:bg-white ${
                    conceptMainTab === "graph"
                      ? "border-[rgba(110,140,155,0.32)] bg-white text-nordic-textPrimary"
                      : "bg-[rgba(255,255,255,0.72)]"
                  }`}
                >
                  グラフ表示
                </button>
                <button
                  type="button"
                  onClick={() => setConceptMainTab("tree")}
                  className={`rounded-lg border border-[rgba(110,140,155,0.24)] px-3 py-1.5 text-sm text-nordic-textSecondary shadow-[0_8px_20px_rgba(70,95,110,0.07)] hover:bg-white ${
                    conceptMainTab === "tree"
                      ? "border-[rgba(110,140,155,0.32)] bg-white text-nordic-textPrimary"
                      : "bg-[rgba(255,255,255,0.72)]"
                  }`}
                >
                  ツリー表示
                </button>
              </div>
              {conceptMainTab === "list" && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-nordic-textSecondary">表示モード:</span>
                  {([
                    ["all", "全体"],
                    ["domain", "分野別"],
                    ["research", "研究テーマ別"]
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setListViewMode(mode)}
                      className={`rounded-md px-2.5 py-1 text-xs ${
                        listViewMode === mode
                      ? "border-[rgba(82,125,144,0.32)] bg-celestial-gold text-celestial-onCard shadow-[0_8px_24px_rgba(73,101,114,0.12),inset_0_1px_0_rgba(255,255,255,0.35)]"
                          : "border border-[rgba(110,140,155,0.24)] bg-[rgba(255,255,255,0.78)] text-nordic-textSecondary hover:bg-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <div className="hud-filter-stack mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-nordic-textSecondary">分野タグ:</span>
                  {!isFieldTagsExpanded && (
                    <>
                      {selectedDomainTags.length > 0 ? (
                        selectedDomainTags.map((tag) => (
                          <button
                            key={`domain-selected-${tag}`}
                            type="button"
                            onClick={() =>
                              setSelectedDomainTags((prev) =>
                                prev.includes(tag)
                                  ? prev.filter((item) => item !== tag)
                                  : [...prev, tag]
                              )
                            }
                            className="rounded-[10px] border border-[rgba(82,125,144,0.32)] bg-celestial-gold px-2.5 py-1 text-xs text-celestial-onCard shadow-[0_6px_18px_rgba(73,101,114,0.12),inset_0_1px_0_rgba(255,255,255,0.35)]"
                          >
                            {tag}
                          </button>
                        ))
                      ) : (
                        <span className="text-xs text-celestial-textSub">全体</span>
                      )}
                      {allDomainTags.length > selectedDomainTags.length && (
                        <span className="text-xs text-celestial-textSub">
                          ほか {allDomainTags.length - selectedDomainTags.length} 件
                        </span>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsFieldTagsExpanded((prev) => !prev)}
                    className="rounded-[10px] border border-[rgba(110,140,155,0.24)] bg-[rgba(255,255,255,0.8)] px-2.5 py-1 text-xs text-nordic-textSecondary hover:bg-white"
                  >
                    {isFieldTagsExpanded ? "畳む" : "展開"}
                  </button>
                </div>
                {isFieldTagsExpanded && (
                  <div className="flex flex-wrap items-center gap-2">
                    {allDomainTags.length === 0 ? (
                      <span className="text-xs text-celestial-textSub">未登録</span>
                    ) : (
                      allDomainTags.map((tag) => {
                        const active = selectedDomainTags.includes(tag);
                        return (
                          <button
                            key={`domain-${tag}`}
                            type="button"
                            onClick={() =>
                              setSelectedDomainTags((prev) =>
                                prev.includes(tag)
                                  ? prev.filter((item) => item !== tag)
                                  : [...prev, tag]
                              )
                            }
                        className={`rounded-[10px] px-2.5 py-1 text-xs ${
                        active ? "border border-[rgba(82,125,144,0.32)] bg-celestial-gold text-celestial-onCard shadow-[0_6px_18px_rgba(73,101,114,0.12),inset_0_1px_0_rgba(255,255,255,0.35)]" : "border border-[rgba(110,140,155,0.24)] bg-[rgba(255,255,255,0.8)] text-nordic-textSecondary hover:bg-white"
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-nordic-textSecondary">研究テーマタグ:</span>
                  {allResearchTags.length === 0 ? (
                    <span className="text-xs text-celestial-textSub">未登録</span>
                  ) : (
                    allResearchTags.map((tag) => {
                      const active = selectedResearchTags.includes(tag);
                      return (
                        <button
                          key={`research-${tag}`}
                          type="button"
                          onClick={() =>
                            setSelectedResearchTags((prev) =>
                              prev.includes(tag)
                                ? prev.filter((item) => item !== tag)
                                : [...prev, tag]
                            )
                          }
                          className={`rounded-[10px] px-2.5 py-1 text-xs ${
                      active ? "border border-[rgba(82,125,144,0.32)] bg-celestial-gold text-celestial-onCard shadow-[0_6px_18px_rgba(73,101,114,0.12),inset_0_1px_0_rgba(255,255,255,0.35)]" : "border border-[rgba(110,140,155,0.24)] bg-[rgba(255,255,255,0.8)] text-nordic-textSecondary hover:bg-white"
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-nordic-textSecondary">状態:</span>
                  {conceptStatusList.map((status) => {
                    const active = selectedStatuses.includes(status);
                    return (
                      <button
                        key={`status-${status}`}
                        type="button"
                        onClick={() =>
                          setSelectedStatuses((prev) =>
                            prev.includes(status)
                              ? prev.filter((item) => item !== status)
                              : [...prev, status]
                          )
                        }
                        className={`rounded-[10px] px-2.5 py-1 text-xs ${
                          active ? "border border-[rgba(82,125,144,0.32)] bg-celestial-gold text-celestial-onCard shadow-[0_6px_18px_rgba(73,101,114,0.12),inset_0_1px_0_rgba(255,255,255,0.35)]" : "border border-[rgba(110,140,155,0.24)] bg-[rgba(255,255,255,0.8)] text-nordic-textSecondary hover:bg-white"
                        }`}
                      >
                        {statusLabelMap[status]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {loading ? (
              <p className="text-sm text-celestial-textSub">読み込み中...</p>
            ) : conceptMainTab === "graph" || conceptMainTab === "tree" ? (
              <Suspense
                fallback={<p className="text-sm text-celestial-textSub">表示を読み込み中...</p>}
              >
                {conceptMainTab === "graph" ? (
                  <section className="grid gap-4 lg:grid-cols-[minmax(520px,1fr)_420px]">
                    <div>
                      <ConceptGraphView
                        concepts={visibleConcepts}
                        domainColorMap={domainColorMap}
                        selectedId={selectedId}
                        onSelectConcept={handleGraphSelect}
                      />
                    </div>
                    <div>
                      <ConceptDetail
                        concept={selectedConcept}
                        conceptMap={conceptMap}
                        domainColorMap={domainColorMap}
                        onRequestDelete={handleRequestDelete}
                        deleting={deleting}
                        onSelectRelated={(id) => {
                          setSelectedId(id);
                        }}
                      />
                    </div>
                  </section>
                ) : (
                  <section className="grid gap-4 lg:grid-cols-[minmax(520px,1fr)_420px]">
                    <div>
                      <SkillTreeView
                        concepts={visibleConcepts}
                        domainColorMap={domainColorMap}
                        selectedId={selectedId}
                        onSelectConcept={handleGraphSelect}
                      />
                    </div>
                    <div>
                      <ConceptDetail
                        concept={selectedConcept}
                        conceptMap={conceptMap}
                        domainColorMap={domainColorMap}
                        onRequestDelete={handleRequestDelete}
                        deleting={deleting}
                        onSelectRelated={(id) => {
                          setSelectedId(id);
                        }}
                      />
                    </div>
                  </section>
                )}
              </Suspense>
            ) : (
              <section className="grid gap-4 lg:grid-cols-[minmax(360px,420px)_1fr]">
                <div
                  className={`${mobileDetail ? "hidden" : "block"} lg:block max-lg:overflow-hidden lg:max-h-screen lg:overflow-y-auto scrollbar-none`}
                >
                  <ConceptGroupSections
                    mode={listViewMode}
                    sections={groupedSections}
                    selectedId={selectedId}
                    domainColorMap={domainColorMap}
                    onSelect={handleSelect}
                    onEdit={openEdit}
                    onToggleFavorite={(concept) => void toggleFavorite(concept)}
                    cardRefs={cardRefs}
                  />
                </div>

                <div className={`${mobileDetail ? "block" : "hidden"} lg:block max-h-screen overflow-y-auto scrollbar-none`}>
                  <div className="mb-2 block lg:hidden">
                    <button
                      className="rounded-md border border-nordic-border bg-nordic-surface px-3 py-1.5 text-sm text-nordic-textPrimary"
                      type="button"
                      onClick={() => setMobileDetail(false)}
                    >
                      一覧に戻る
                    </button>
                  </div>
                  <ConceptDetail
                    ref={detailContainerRef}
                    concept={selectedConcept}
                    conceptMap={conceptMap}
                    domainColorMap={domainColorMap}
                    onRequestDelete={handleRequestDelete}
                    deleting={deleting}
                    onSelectRelated={(id) => {
                      setSelectedId(id);
                      setMobileDetail(true);
                    }}
                  />
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <ConceptFormModal
        open={modalOpen}
        mode={editingConcept ? "edit" : "create"}
        baseConcept={editingConcept}
        allConcepts={concepts}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        reloadConcepts={reload}
      />

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-nordic-navy/20 px-4">
          <div className="w-full max-w-md rounded-2xl border border-nordic-border bg-nordic-surface p-5 shadow-xl">
            <h3 className="text-base font-semibold text-nordic-textPrimary">この概念を削除しますか？</h3>
            <p className="mt-2 text-sm text-nordic-textSecondary">
              この操作は元に戻せません。
              <br />
              必要なら先に JSON エクスポートでバックアップしてください。
            </p>
            <p className="mt-2 rounded-md bg-nordic-section px-3 py-2 text-sm text-nordic-textPrimary">
              対象: {deleteTarget.title}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                className="rounded-md border border-nordic-border px-3 py-1.5 text-sm text-nordic-textPrimary disabled:opacity-60"
                onClick={() => setDeleteTarget(undefined)}
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={deleting}
                className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 disabled:opacity-60"
                onClick={() => void handleConfirmDelete()}
              >
                {deleting ? "削除中..." : "削除"}
              </button>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div className="fixed bottom-4 right-4 z-40 rounded-md border border-celestial-border bg-nordic-primary px-3 py-2 text-sm text-nordic-textPrimary shadow-quiet">
          <div className="flex items-center gap-2">
            <span>{feedback}</span>
            <button
              type="button"
              className="rounded px-1 py-0.5 text-xs text-nordic-textSecondary hover:bg-white/50"
              onClick={() => setFeedback(null)}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
