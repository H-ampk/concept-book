import { useState } from "react";
import { getStorage } from "../storage";
import type { Concept } from "../types/concept";

const storage = getStorage();

type Props = {
  onImported: () => Promise<void>;
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

export const SettingsPage = ({ onImported }: Props) => {
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
      const parsed = JSON.parse(text) as Concept[];
      if (!Array.isArray(parsed)) {
        throw new Error("invalid format");
      }
      const result = await storage.importConcepts(parsed, mode);
      await onImported();
      setMessage(`インポート完了: ${result.imported}件、スキップ: ${result.skipped}件`);
    } catch {
      setMessage("インポートに失敗しました。JSON形式を確認してください。");
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
        <h3 className="mb-2 text-sm font-semibold text-slate-800">PWA</h3>
        <ul className="space-y-1 text-sm text-slate-700">
          <li>・インストール可能（manifest設定済み）</li>
          <li>・Service Worker導入済み</li>
          <li>・オフラインでも保存済みデータを閲覧・編集可能</li>
        </ul>
      </div>

      <p className="rounded-md bg-slate-900 px-3 py-2 text-sm text-slate-100">{message}</p>
    </section>
  );
};
