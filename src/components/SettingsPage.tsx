import { useState } from "react";
import { getStorage } from "../storage";
import { getDomainTagColor } from "../utils/domainColors";
import { validateBackupImportPayload } from "../utils/conceptImportValidation";

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

const downloadBlob = (filename: string, blob: Blob): void => {
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
  const [packageMode, setPackageMode] = useState<"replace" | "merge">("merge");

  const handleExport = async () => {
    setBusy(true);
    try {
      const data = await storage.exportBackupData();
      downloadJson(`concept-backup-${new Date().toISOString()}.json`, data);
      setMessage(`${data.concepts.length} 件の概念と ${data.contextCards.length} 件の文脈カードをエクスポートしました。`);
    } catch {
      setMessage("エクスポートに失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const handlePackageExport = async () => {
    setBusy(true);
    try {
      const blob = await storage.exportConceptBookPackage();
      downloadBlob(`concept-book-export-${new Date().toISOString().slice(0, 10)}.zip`, blob);
      setMessage("概念ブック（ZIP・メディア含む）をエクスポートしました。");
    } catch (err) {
      console.error("ZIP export failed:", err);
      setMessage("ZIPエクスポートに失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const handlePackageImport = async (file?: File) => {
    if (!file) {
      return;
    }
    setBusy(true);
    try {
      const result = await storage.importConceptBookPackage(file, packageMode);
      await onImported();
      setMessage(
        `ZIPインポート完了: 概念 ${result.importedConcepts}件（スキップ ${result.skippedConcepts}）、文脈カード ${result.importedContextCards}件（スキップ ${result.skippedContextCards}）、メディア ${result.importedMedia}件。ZIP内に無い参照 ${result.missingMedia}件。`
      );
    } catch (e) {
      setMessage(
        `ZIPインポートに失敗しました。${e instanceof Error ? e.message : "形式を確認してください。"}`
      );
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
      const validationResult = validateBackupImportPayload(parsed);
      if (!validationResult.success) {
        setMessage(`インポートに失敗しました。${validationResult.errorMessage}`);
        return;
      }
      const result = await storage.importBackupData(validationResult, mode);
      await onImported();
      setMessage(`インポート完了: 概念 ${result.importedConcepts}件（スキップ ${result.skippedConcepts}件）、文脈カード ${result.importedContextCards}件（スキップ ${result.skippedContextCards}件）`);
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
    <section className="space-y-5 rounded-2xl border border-celestial-border bg-celestial-panel p-5 shadow-celestial decorated-card">
      <header>
        <h2 className="text-lg font-semibold text-celestial-textMain">設定</h2>
        <p className="text-sm text-celestial-textSub">バックアップ、復元、PWA運用状態を管理します。</p>
      </header>

      <div className="rounded-lg border-2 border-celestial-border bg-celestial-panel/80 p-4">
        <h3 className="mb-2 text-sm font-semibold text-celestial-textMain">パッケージ（ZIP）— 推奨・メディア付き</h3>
        <p className="mb-2 text-xs text-celestial-textSub">
          エクスポートされる ZIP には、定義・メモ・出典・文脈カードなどの平文データと画像・動画のバイナリが含まれます。
          別PCの同アプリでインポートすると画像・動画も再現されます。
        </p>
        <div className="mb-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-md bg-celestial-gold px-3 py-2 text-sm text-celestial-base disabled:opacity-60"
            onClick={() => void handlePackageExport()}
          >
            ZIPを保存
          </button>
        </div>
        <label className="mb-2 block text-sm text-celestial-textMain">
          取り込みモード（ZIP）
          <select
            className="mt-1 w-full rounded-md border border-celestial-border bg-nordic-surface px-3 py-2 text-sm text-celestial-textMain"
            value={packageMode}
            onChange={(e) => setPackageMode(e.target.value as "replace" | "merge")}
          >
            <option value="merge">merge（既存と統合）</option>
            <option value="replace">replace（全置換）</option>
          </select>
        </label>
        <input
          type="file"
          accept=".zip,application/zip"
          disabled={busy}
          onChange={(e) => void handlePackageImport(e.target.files?.[0])}
          className="block w-full text-sm text-celestial-textMain file:mr-3 file:rounded-md file:border file:border-celestial-border file:bg-nordic-surface file:px-3 file:py-1.5"
        />
      </div>

      <div className="rounded-lg bg-nordic-surface p-4">
        <h3 className="mb-2 text-sm font-semibold text-celestial-textMain">JSONエクスポート</h3>
        <p className="mb-2 text-xs text-celestial-textSub">
          エクスポートされる JSON には、定義・メモ・出典などの平文データと文脈カードがそのまま含まれます。
          画像・動画のバイナリは含まれません（メディア付き移行はZIPを利用してください）。
          共有クラウドや公開リポジトリに置かないでください。
        </p>
        <button
          type="button"
          disabled={busy}
          className="rounded-md border border-celestial-border bg-celestial-panel px-3 py-2 text-sm text-celestial-textMain disabled:opacity-60"
          onClick={() => void handleExport()}
        >
          JSONを保存
        </button>
      </div>

      <div className="rounded-lg bg-nordic-surface p-4">
        <h3 className="mb-2 text-sm font-semibold text-celestial-textMain">JSONインポート</h3>
        <p className="mb-2 text-xs text-celestial-textSub">
          信頼できるバックアップファイルのみを取り込んでください。内容検証は最小限です。
        </p>
        <label className="mb-2 block text-sm text-celestial-textMain">
          取り込みモード
          <select
            className="mt-1 w-full rounded-md border border-celestial-border bg-nordic-surface px-3 py-2 text-sm text-celestial-textMain"
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
          className="block w-full text-sm text-celestial-textMain file:mr-3 file:rounded-md file:border file:border-celestial-border file:bg-nordic-surface file:px-3 file:py-1.5"
        />
      </div>

      <div className="rounded-lg bg-nordic-surface p-4">
        <h3 className="mb-2 text-sm font-semibold text-celestial-textMain">保存とPWA</h3>
        <ul className="space-y-1 text-sm text-celestial-textSub">
          <li>・概念データはこのブラウザの IndexedDB に保存されます（同一オリジン内のローカル保存）</li>
          <li>・GitHub Pages 公開版でも端末/ブラウザごとに別保存です（自動クラウド同期なし）</li>
          <li>・別端末へ移す場合は「パッケージ（ZIP）」を推奨（メディア込み）。JSONのみでは添付ファイルは移りません</li>
          <li>・ブラウザデータ削除や PWA 削除でローカルデータが消える場合があります</li>
          <li>・インストール可能（manifest設定済み）</li>
          <li>・Service Worker導入済み</li>
          <li>・オフラインでも保存済みデータを閲覧・編集可能</li>
        </ul>
      </div>

      <div className="rounded-lg bg-nordic-surface p-4">
        <h3 className="mb-2 text-sm font-semibold text-celestial-textMain">分野タグの色設定</h3>
        {domainTags.length === 0 ? (
          <p className="text-sm text-celestial-textSub">分野タグがまだありません。</p>
        ) : (
          <ul className="space-y-2">
            {domainTags.map((tag) => {
              const color = getDomainTagColor(tag, domainColorMap);
              return (
                <li
                  key={tag}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-celestial-border bg-nordic-surface px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-celestial-textMain">{tag}</p>
                    <p className="text-xs text-celestial-textSub">{color}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-celestial-textSub">
                    色
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => onChangeDomainColor(tag, e.target.value)}
                      className="h-8 w-10 cursor-pointer rounded border border-celestial-border bg-nordic-surface p-0.5"
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="rounded-md bg-celestial-base px-3 py-2 text-sm text-celestial-textMain">{message}</p>
    </section>
  );
};
