import { useState } from "react";
import { getStorage } from "../storage";
import { getDomainTagColor } from "../utils/domainColors";
import { validateConceptImportPayload } from "../utils/conceptImportValidation";

const storage = getStorage();

type Props = {
  onImported: () => Promise<void>;
  domainTags: string[];
  domainColorMap: Record<string, string>;
  onChangeDomainColor: (tag: string, color: string) => void;
};

const downloadJson = (filename: string, payload: unknown): void => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const SettingsPage = ({
  onImported,
  domainTags,
  domainColorMap,
  onChangeDomainColor
}: Props) => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>("JSONバックアップを作成できます。");
  const [mode, setMode] = useState<"replace" | "merge">("merge");

  const handleExport = async () => {
    setBusy(true);
    try {
      const concepts = await storage.exportConcepts();
      downloadJson(`concept-backup-${new Date().toISOString()}.json`, concepts);
      setMessage(`${concepts.length} 件の概念をエクスポートしました。`);
    } catch {
      setMessage("エクスポートに失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (file?: File) => {
    if (!file) {
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const validationResult = validateConceptImportPayload(parsed);
      if (!validationResult.success) {
        setMessage(`インポートに失敗しました。${validationResult.errorMessage}`);
        return;
      }
      const result = await storage.importConcepts(validationResult.concepts, mode);
      await onImported();
      setMessage(`インポート完了: ${result.imported}件、スキップ: ${result.skipped}件`);
    } catch (error) {
      if (error instanceof SyntaxError) {
        setMessage("インポートに失敗しました。JSONの構文が不正です。");
      } else {
        setMessage("インポートに失敗しました。JSON形式を確認してください。");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-quiet">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">設定</h2>
        <p className="text-sm text-slate-600">バックアップ、復元、PWA運用状態を管理します。</p>
      </header>

      <div className="rounded-lg bg-slate-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">JSONエクスポート</h3>
        <p className="mb-2 text-xs text-slate-600">
          エクスポートされる JSON には、定義・メモ・出典などの平文データがそのまま含まれます。
          共有クラウドや公開リポジトリに置かないでください。
        </p>
        <button
          type="button"
          disabled={busy}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-60"
          onClick={() => void handleExport()}
        >
          JSONを保存
        </button>
      </div>

      <div className="rounded-lg bg-slate-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">JSONインポート</h3>
        <p className="mb-2 text-xs text-slate-600">
          信頼できるバックアップファイルのみを取り込んでください。内容検証は最小限です。
        </p>
        <label className="mb-2 block text-sm text-slate-700">
          取り込みモード
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={mode}
            onChange={(e) => setMode(e.target.value as "replace" | "merge")}
          >
            <option value="merge">merge（既存と統合）</option>
            <option value="replace">replace（全置換）</option>
          </select>
        </label>
        <input
          type="file"
          accept="application/json"
          disabled={busy}
          onChange={(e) => void handleImport(e.target.files?.[0])}
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5"
        />
      </div>

      <div className="rounded-lg bg-slate-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">保存とPWA</h3>
        <ul className="space-y-1 text-sm text-slate-700">
          <li>・概念データはこのブラウザの IndexedDB に保存されます（同一オリジン内のローカル保存）</li>
          <li>・インストール可能（manifest設定済み）</li>
          <li>・Service Worker導入済み</li>
          <li>・オフラインでも保存済みデータを閲覧・編集可能</li>
        </ul>
      </div>

      <div className="rounded-lg bg-slate-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">分野タグの色設定</h3>
        {domainTags.length === 0 ? (
          <p className="text-sm text-slate-500">分野タグがまだありません。</p>
        ) : (
          <ul className="space-y-2">
            {domainTags.map((tag) => {
              const color = getDomainTagColor(tag, domainColorMap);
              return (
                <li
                  key={tag}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{tag}</p>
                    <p className="text-xs text-slate-500">{color}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    色
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => onChangeDomainColor(tag, e.target.value)}
                      className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="rounded-md bg-slate-900 px-3 py-2 text-sm text-slate-100">{message}</p>
    </section>
  );
};
