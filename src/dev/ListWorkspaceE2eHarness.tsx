import { useState } from "react";
import { ConceptListPageLayout } from "../app/ConceptListPageLayout";
import { ConceptListWorkspaceLayout } from "../app/ConceptListWorkspaceLayout";

const sampleConcepts = [
  { id: "concept-a", title: "Concept A", definition: "定義 A" },
  { id: "concept-b", title: "Concept B", definition: "定義 B" }
] as const;

export const ListWorkspaceE2eHarness = () => {
  const [selectedId, setSelectedId] = useState<string>(sampleConcepts[0].id);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [query, setQuery] = useState("");
  const selected = sampleConcepts.find((item) => item.id === selectedId) ?? sampleConcepts[0];

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMobileDetail(true);
  };

  return (
    <div className="app-background relative flex min-h-screen flex-col bg-nordic-bg text-celestial-textMain overflow-hidden">
      <header className="relative z-30 shrink-0 border-b border-celestial-border px-3 py-2">
        <p className="text-xs text-celestial-textSub">list workspace e2e harness (DEV)</p>
      </header>
      <ConceptListPageLayout
        toolbar={
          <section
            data-testid="concept-list-toolbar"
            className="relative z-10 rounded-xl border border-[rgba(110,140,155,0.2)] bg-[rgba(248,251,252,0.92)] ritual-altar p-5"
          >
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <div className="hud-search-wrap min-w-0">
                <input
                  className="search-input"
                  placeholder="タイトル・定義・解釈・分野タグ・研究テーマタグ・メモを検索"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <button className="index-filter-toggle" type="button">
                すべて
              </button>
              <button type="button" className="action-button px-4 py-3 text-sm">
                概念を追加
              </button>
            </div>
            <div className="hud-mode-strip mt-4 flex flex-wrap items-center gap-1">
              <span className="index-filter-label">表示:</span>
              <button type="button" className="index-filter-tab index-filter-tab--active">
                一覧表示
              </button>
              <button type="button" className="index-filter-tab">
                グラフ表示
              </button>
              <button type="button" className="index-filter-tab">
                ツリー表示
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span className="index-filter-label">表示モード:</span>
              <button type="button" className="index-filter-tab index-filter-tab--compact">
                全体
              </button>
              <button type="button" className="index-filter-tab index-filter-tab--compact">
                分野別
              </button>
              <button type="button" className="index-filter-tab index-filter-tab--compact">
                研究テーマ別
              </button>
            </div>
            <div className="hud-filter-stack mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-1">
                <span className="index-filter-label">分野タグ:</span>
                <span className="index-filter-hint">全体</span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <span className="index-filter-label">研究テーマタグ:</span>
                <span className="index-filter-hint">未登録</span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <span className="index-filter-label">状態:</span>
                <button type="button" className="index-filter-chip">
                  稼働中
                </button>
              </div>
            </div>
          </section>
        }
        workspace={
          <ConceptListWorkspaceLayout
            mobileDetail={mobileDetail}
            list={
              <ul>
                {sampleConcepts
                  .filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
                  .map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        data-testid={`concept-list-item-${item.id}`}
                        className="index-text-button w-full text-left"
                        onClick={() => handleSelect(item.id)}
                      >
                        {item.title}
                      </button>
                    </li>
                  ))}
              </ul>
            }
            detail={
              <>
                <div className="mb-2 block lg:hidden">
                  <button
                    className="index-text-button"
                    type="button"
                    onClick={() => setMobileDetail(false)}
                  >
                    一覧に戻る
                  </button>
                </div>
                <div data-testid="concept-detail-content">
                  <h2>{selected.title}</h2>
                  <p>{selected.definition}</p>
                </div>
              </>
            }
          />
        }
      />
    </div>
  );
};
