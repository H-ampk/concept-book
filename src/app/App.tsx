import { useMemo, useState } from "react";
import { ConceptDetail } from "../components/ConceptDetail";
import { ConceptFormModal } from "../components/ConceptFormModal";
import { ConceptList } from "../components/ConceptList";
import { SettingsPage } from "../components/SettingsPage";
import { useConcepts } from "../features/concepts/useConcepts";
import type { Concept } from "../types/concept";
import type { ConceptInput } from "../types/concept";

type Screen = "concepts" | "settings";

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

  const conceptMap = useMemo(() => new Map(concepts.map((concept) => [concept.id, concept])), [concepts]);
  const selectedConcept = selectedId ? conceptMap.get(selectedId) : undefined;

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
      await update(editingConcept.id, payload);
      setSelectedId(editingConcept.id);
      return;
    }
    await create(payload);
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMobileDetail(true);
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm("この概念を削除しますか？");
    if (!ok) {
      return;
    }
    await remove(id);
    if (selectedId === id) {
      setSelectedId(undefined);
      setMobileDetail(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Concept Book App</h1>
            <p className="text-xs text-slate-500">研究者のための静かな概念辞典</p>
          </div>
          <nav className="flex gap-2 text-sm">
            <button
              className={`rounded-md px-3 py-1.5 ${screen === "concepts" ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-700"}`}
              onClick={() => setScreen("concepts")}
              type="button"
            >
              概念
            </button>
            <button
              className={`rounded-md px-3 py-1.5 ${screen === "settings" ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-700"}`}
              onClick={() => setScreen("settings")}
              type="button"
            >
              設定
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4">
        {screen === "settings" ? (
          <SettingsPage onImported={reload} />
        ) : (
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-quiet">
              <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                <input
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="タイトル・定義・解釈・分野タグ・研究テーマタグ・メモを検索"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
                  type="button"
                  onClick={() => setOnlyFavorite((prev) => !prev)}
                >
                  {onlyFavorite ? "お気に入りのみ: ON" : "お気に入りのみ: OFF"}
                </button>
                <button
                  type="button"
                  className="rounded-md bg-slate-800 px-3 py-2 text-sm text-white"
                  onClick={openCreate}
                >
                  概念を追加
                </button>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">分野タグ:</span>
                  {allDomainTags.length === 0 ? (
                    <span className="text-xs text-slate-500">未登録</span>
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
                            active ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">研究テーマタグ:</span>
                  {allResearchTags.length === 0 ? (
                    <span className="text-xs text-slate-500">未登録</span>
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
                            active ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700"
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            {loading ? (
              <p className="text-sm text-slate-500">読み込み中...</p>
            ) : (
              <section className="grid gap-4 lg:grid-cols-[minmax(360px,420px)_1fr]">
                <div className={`${mobileDetail ? "hidden" : "block"} lg:block`}>
                  <ConceptList
                    concepts={visibleConcepts}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                    onEdit={openEdit}
                    onDelete={(id) => void handleDelete(id)}
                    onToggleFavorite={(concept) => void toggleFavorite(concept)}
                  />
                </div>

                <div className={`${mobileDetail ? "block" : "hidden"} lg:block`}>
                  <div className="mb-2 block lg:hidden">
                    <button
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                      type="button"
                      onClick={() => setMobileDetail(false)}
                    >
                      一覧に戻る
                    </button>
                  </div>
                  <ConceptDetail
                    concept={selectedConcept}
                    conceptMap={conceptMap}
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
      />
    </div>
  );
};
