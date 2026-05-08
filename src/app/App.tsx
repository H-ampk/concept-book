import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ConceptDetail } from "../components/ConceptDetail";
import { ConceptFormModal } from "../components/ConceptFormModal";
import { ConceptGraphView } from "../components/ConceptGraphView";
import { SkillTreeView } from "../components/SkillTreeView";
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

type Screen = "concepts" | "contexts" | "settings";
type ConceptMainTab = "list" | "graph" | "tree";

const statusLabelMap: Record<ConceptStatus, string> = {
  active: "稼働中",
  researching: "調査中",
  unclear: "未整理",
  archived: "保管"
};

const assetUrl = (path: string): string =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

// Temporary visual toggles for background image layers.
const SHOW_MOON_BACKGROUND = false;
const SHOW_BOTANICAL_BACKGROUND = false;
const SHOW_CONSTELLATION_BACKGROUND = false;

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
    <div className="absolute inset-0 bg-gradient-radial from-celestial-deepBlue via-celestial-base to-celestial-base opacity-85"></div>
    <div className="star-field absolute inset-0 opacity-28"></div>
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
    {SHOW_MOON_BACKGROUND && (
      <img
        src={assetUrl("decorations/moon.png")}
        alt=""
        aria-hidden="true"
        className="fixed top-20 right-20 w-44 opacity-18 moon-core"
      />
    )}
    {SHOW_BOTANICAL_BACKGROUND && (
      <img
        src={assetUrl("decorations/botanical.png")}
        alt=""
        aria-hidden="true"
        className="fixed left-[-24px] bottom-0 h-[92vh] opacity-05 blur-[1px]"
      />
    )}
    {SHOW_CONSTELLATION_BACKGROUND && (
      <img
        src={assetUrl("decorations/constellation.png")}
        alt=""
        aria-hidden="true"
        className="fixed right-[-120px] top-32 w-[760px] opacity-08 blur-[1px]"
      />
    )}
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

  const cardRefs = useRef<Map<string, HTMLLIElement>>(new Map());
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
      <DecorativeBackground />

      <header className="border-b border-celestial-border bg-celestial-panel/50 backdrop-blur-sm relative z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="header-insignia">
            <h1 className="text-xl font-semibold text-celestial-gold tracking-wider ritual-title">Concept Book App</h1>
            <p className="text-xs text-celestial-softGold ritual-subtitle">Et sted for tanker</p>
          </div>
          <nav className="flex gap-2 text-sm">
            <button
              className={`rounded-md px-3 py-1.5 border border-celestial-gold/50 bg-transparent text-celestial-softGold hover:bg-celestial-gold/10 ${
                screen === "concepts" ? "bg-celestial-gold/20" : ""
              }`}
              onClick={() => setScreen("concepts")}
              type="button"
            >
              概念
            </button>
            <button
              className={`rounded-md px-3 py-1.5 border border-celestial-gold/50 bg-transparent text-celestial-softGold hover:bg-celestial-gold/10 ${
                screen === "contexts" ? "bg-celestial-gold/20" : ""
              }`}
              onClick={() => setScreen("contexts")}
              type="button"
            >
              文脈
            </button>
            <button
              className={`rounded-md px-3 py-1.5 border border-celestial-gold/50 bg-transparent text-celestial-softGold hover:bg-celestial-gold/10 ${
                screen === "settings" ? "bg-celestial-gold/20" : ""
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
        ) : (
          <div className="space-y-4">
            <section className="rounded-3xl border border-celestial-border bg-celestial-panel p-6 shadow-celestial backdrop-blur-sm relative z-10 decorated-card ritual-altar">
              <span className="card-corner card-corner-top-left" aria-hidden="true" />
              <span className="card-corner card-corner-top-right" aria-hidden="true" />
              <span className="card-corner card-corner-bottom-left" aria-hidden="true" />
              <span className="card-corner card-corner-bottom-right" aria-hidden="true" />
              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <input
                  className="rounded-lg border border-celestial-gold/30 bg-celestial-deepBlue px-4 py-3 text-sm text-celestial-textMain placeholder:text-celestial-textSub"
                  placeholder="タイトル・定義・解釈・分野タグ・研究テーマタグ・メモを検索"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button
                  className="rounded-lg border border-celestial-gold/30 bg-celestial-panel px-4 py-3 text-sm text-celestial-softGold hover:bg-celestial-panelHover"
                  type="button"
                  onClick={() => setOnlyFavorite((prev) => !prev)}
                >
                  {onlyFavorite ? "お気に入りのみ: ON" : "お気に入りのみ: OFF"}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-celestial-gold px-4 py-3 text-sm text-celestial-base hover:bg-celestial-softGold"
                  onClick={openCreate}
                >
                  概念を追加
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-celestial-softGold">表示:</span>
                <button
                  type="button"
                  onClick={() => setConceptMainTab("list")}
                  className={`rounded-lg px-3 py-1.5 text-sm border border-celestial-gold/30 bg-celestial-panel text-celestial-softGold hover:bg-celestial-panelHover ${
                    conceptMainTab === "list" ? "bg-celestial-gold/20 border-celestial-gold" : ""
                  }`}
                >
                  一覧表示
                </button>
                <button
                  type="button"
                  onClick={() => setConceptMainTab("graph")}
                  className={`rounded-lg px-3 py-1.5 text-sm border border-celestial-gold/30 bg-celestial-panel text-celestial-softGold hover:bg-celestial-panelHover ${
                    conceptMainTab === "graph" ? "bg-celestial-gold/20 border-celestial-gold" : ""
                  }`}
                >
                  グラフ表示
                </button>
                <button
                  type="button"
                  onClick={() => setConceptMainTab("tree")}
                  className={`rounded-lg px-3 py-1.5 text-sm border border-celestial-gold/30 bg-celestial-panel text-celestial-softGold hover:bg-celestial-panelHover ${
                    conceptMainTab === "tree" ? "bg-celestial-gold/20 border-celestial-gold" : ""
                  }`}
                >
                  ツリー表示
                </button>
              </div>
              {conceptMainTab === "list" && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-celestial-softGold">表示モード:</span>
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
                      ? "bg-celestial-gold text-celestial-base"
                          : "border border-celestial-gold/30 bg-celestial-panel text-celestial-softGold"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-celestial-softGold">分野タグ:</span>
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
                            className="rounded-full px-2.5 py-1 text-xs bg-celestial-gold text-celestial-base"
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
                    className="rounded-full px-2.5 py-1 text-xs border border-celestial-gold/30 bg-celestial-panel text-celestial-softGold hover:bg-celestial-panelHover"
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
                            className={`rounded-full px-2.5 py-1 text-xs ${
                        active ? "bg-celestial-gold text-celestial-base" : "bg-celestial-panel text-celestial-softGold"
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
                  <span className="text-xs font-medium text-celestial-softGold">研究テーマタグ:</span>
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
                          className={`rounded-full px-2.5 py-1 text-xs ${
                      active ? "bg-celestial-gold text-celestial-base" : "bg-celestial-panel text-celestial-softGold"
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-celestial-softGold">状態:</span>
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
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          active ? "bg-celestial-gold text-celestial-base" : "bg-celestial-panel text-celestial-softGold"
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
              <p className="text-sm text-nordic-textOnDark">読み込み中...</p>
            ) : conceptMainTab === "graph" ? (
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
            ) : conceptMainTab === "tree" ? (
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
            ) : (
              <section className="grid gap-4 lg:grid-cols-[minmax(360px,420px)_1fr]">
                <div className={`${mobileDetail ? "hidden" : "block"} lg:block max-h-screen overflow-y-auto hide-scrollbar`}>
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

                <div className={`${mobileDetail ? "block" : "hidden"} lg:block max-h-screen overflow-y-auto hide-scrollbar`}>
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
        <div className="fixed bottom-4 right-4 z-40 rounded-md bg-nordic-primary px-3 py-2 text-sm text-nordic-surface shadow-quiet">
          <div className="flex items-center gap-2">
            <span>{feedback}</span>
            <button
              type="button"
              className="rounded px-1 py-0.5 text-xs text-nordic-surface hover:bg-nordic-accent"
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
