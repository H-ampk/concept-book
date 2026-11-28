import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_AI_SETTINGS,
  assessOllamaBaseUrl,
  checkOllamaConnection,
  getExternalSendConsentUrl,
  grantExternalSendConsent,
  isOllamaModelInstalled,
  listOllamaModels,
  loadAISettings,
  revokeExternalSendConsent,
  saveAISettings,
  type AISettings
} from "../features/ai";

type ConnectionView =
  | { status: "idle" }
  | { status: "checking" }
  | {
      status: "success";
      version?: string;
      models: string[];
      modelsError?: string;
      missingTextModel: boolean;
      missingEmbeddingModel: boolean;
    }
  | { status: "error"; message: string };

const persist = (next: AISettings): AISettings => {
  saveAISettings(next);
  return next;
};

export const AISettingsSection = () => {
  const [settings, setSettings] = useState<AISettings>(() => loadAISettings());
  const [connection, setConnection] = useState<ConnectionView>({ status: "idle" });
  const [consentUrl, setConsentUrl] = useState<string | null>(() => getExternalSendConsentUrl());
  const endpoint = useMemo(() => assessOllamaBaseUrl(settings.baseUrl), [settings.baseUrl]);
  const externalConsentGranted =
    endpoint.ok && endpoint.scope === "external" && consentUrl === endpoint.normalizedUrl;

  useEffect(() => {
    setConsentUrl(getExternalSendConsentUrl());
  }, [settings.baseUrl]);

  const update = (patch: Partial<AISettings>) => {
    setSettings((current) => persist({ ...current, ...patch }));
  };

  const pullHints = useMemo(
    () => ({
      text: `ollama pull ${settings.textModel}`,
      embedding: `ollama pull ${settings.embeddingModel.replace(/:latest$/, "")}`
    }),
    [settings.embeddingModel, settings.textModel]
  );

  const handleCheckConnection = async () => {
    if (!endpoint.ok) {
      setConnection({ status: "error", message: "Ollamaの接続先URLが不正なため、通信を中止しました。" });
      return;
    }
    if (endpoint.scope === "external" && !externalConsentGranted) {
      setConnection({
        status: "error",
        message: "外部の接続先への送信は、設定画面で許可してから利用できます。"
      });
      return;
    }
    setConnection({ status: "checking" });
    const result = await checkOllamaConnection(settings.baseUrl);
    if (!result.connected) {
      setConnection({ status: "error", message: result.error.message });
      return;
    }
    try {
      const models = await listOllamaModels(settings.baseUrl);
      setConnection({
        status: "success",
        version: result.version,
        models,
        missingTextModel: !isOllamaModelInstalled(models, settings.textModel),
        missingEmbeddingModel: !isOllamaModelInstalled(models, settings.embeddingModel)
      });
    } catch {
      setConnection({
        status: "success",
        version: result.version,
        models: [],
        modelsError: "モデル一覧を取得できませんでした。",
        missingTextModel: false,
        missingEmbeddingModel: false
      });
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-celestial-textMain">AI機能</h3>
      <p className="text-xs text-celestial-textSub">
        ローカルの Ollama を利用します。ConceptBook の正式データは AI から変更されません。接続確認はボタン操作時のみ行います。
      </p>
      <div className="rounded-lg bg-nordic-surface p-4">
        <label className="flex items-start gap-2 text-sm text-celestial-textMain">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={settings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          <span>
            ローカルAIを有効にする
            <span className="mt-0.5 block text-xs text-celestial-textSub">
              未設定でも ConceptBook 本体は利用できます。有効化後も、ユーザーが明示した操作でのみ通信します。
            </span>
          </span>
        </label>

        <dl className="mt-4 space-y-3">
          <div>
            <dt className="text-xs text-celestial-textSub">Provider</dt>
            <dd className="mt-1 text-sm text-celestial-textMain">Ollama（ローカル）</dd>
          </div>
          <div>
            <dt className="text-xs text-celestial-textSub">
              <label htmlFor="ai-base-url">Ollama URL</label>
            </dt>
            <dd className="mt-1">
              <input
                id="ai-base-url"
                type="text"
                value={settings.baseUrl}
                onChange={(e) => update({ baseUrl: e.target.value })}
                placeholder={DEFAULT_AI_SETTINGS.baseUrl}
                className="w-full rounded-md border border-celestial-border bg-nordic-surface px-3 py-2 text-sm text-celestial-textMain"
              />
              {!endpoint.ok ? (
                <p className="mt-1 text-xs text-celestial-textMain">
                  接続先URLが不正です。http または https の絶対URLを、認証情報・クエリ・フラグメントなしで指定してください。
                </p>
              ) : null}
              {endpoint.ok && endpoint.scope === "external" ? (
                <div className="mt-2 space-y-2 rounded-md bg-celestial-base px-3 py-2 text-xs text-celestial-textMain">
                  <p>この接続先は、この端末上のローカルOllamaではありません。</p>
                  <p>
                    AI機能を使用すると、概念の定義や学習データが以下の接続先に送信される場合があります。
                  </p>
                  <p>接続先：{endpoint.normalizedUrl}</p>
                  <p>接続先の管理者によるデータの保存・利用について確認したうえで、接続を許可してください。</p>
                  {endpoint.protocol === "http:" ? (
                    <p>HTTP接続のため、通信は暗号化されません。</p>
                  ) : null}
                  <label className="flex items-start gap-2 pt-1">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={externalConsentGranted}
                      onChange={(e) => {
                        if (e.target.checked) {
                          grantExternalSendConsent(settings.baseUrl);
                        } else {
                          revokeExternalSendConsent();
                        }
                        setConsentUrl(getExternalSendConsentUrl());
                      }}
                    />
                    <span>
                      この接続先への学習データ送信を許可する
                      <span className="mt-0.5 block text-celestial-textSub">
                        許可はいつでも外せます。接続先を変えると、再度許可が必要です。
                      </span>
                    </span>
                  </label>
                </div>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-celestial-textSub">
              <label htmlFor="ai-text-model">生成モデル</label>
            </dt>
            <dd className="mt-1">
              <input
                id="ai-text-model"
                type="text"
                value={settings.textModel}
                onChange={(e) => update({ textModel: e.target.value })}
                placeholder={DEFAULT_AI_SETTINGS.textModel}
                className="w-full rounded-md border border-celestial-border bg-nordic-surface px-3 py-2 text-sm text-celestial-textMain"
              />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-celestial-textSub">
              <label htmlFor="ai-embedding-model">Embeddingモデル</label>
            </dt>
            <dd className="mt-1">
              <input
                id="ai-embedding-model"
                type="text"
                value={settings.embeddingModel}
                onChange={(e) => update({ embeddingModel: e.target.value })}
                placeholder={DEFAULT_AI_SETTINGS.embeddingModel}
                className="w-full rounded-md border border-celestial-border bg-nordic-surface px-3 py-2 text-sm text-celestial-textMain"
              />
            </dd>
          </div>
        </dl>

        <button
          type="button"
          className="action-button mt-4 rounded-md px-3 py-2 text-sm disabled:opacity-60"
          disabled={connection.status === "checking"}
          onClick={() => void handleCheckConnection()}
        >
          {connection.status === "checking" ? "確認中..." : "接続確認"}
        </button>

        <div className="mt-3 space-y-2 text-sm text-celestial-textMain" data-testid="ai-connection-status">
          {connection.status === "idle" ? (
            <p className="text-celestial-textSub">接続状態: 未確認</p>
          ) : null}
          {connection.status === "checking" ? <p>接続状態: 確認中...</p> : null}
          {connection.status === "success" ? (
            <div className="space-y-2">
              <p>
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                Ollamaに接続できました。
                {connection.version ? `（Version ${connection.version}）` : null}
              </p>
              <div>
                <p className="text-xs text-celestial-textSub">利用可能なモデル:</p>
                {connection.modelsError ? (
                  <p className="text-xs text-celestial-textSub">{connection.modelsError}</p>
                ) : connection.models.length === 0 ? (
                  <p className="text-xs text-celestial-textSub">インストール済みモデルはありません。</p>
                ) : (
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    {connection.models.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                )}
              </div>
              {connection.missingTextModel ? (
                <div className="rounded-md bg-celestial-base px-3 py-2 text-xs text-celestial-textMain">
                  <p>設定された生成モデル「{settings.textModel}」が見つかりません。</p>
                  <p>Ollamaでモデルをインストールしてください。</p>
                  <pre className="mt-1 overflow-x-auto text-xs text-celestial-textSub">{pullHints.text}</pre>
                </div>
              ) : null}
              {connection.missingEmbeddingModel ? (
                <div className="rounded-md bg-celestial-base px-3 py-2 text-xs text-celestial-textMain">
                  <p>設定されたEmbeddingモデル「{settings.embeddingModel}」が見つかりません。</p>
                  <p>Ollamaでモデルをインストールしてください。</p>
                  <pre className="mt-1 overflow-x-auto text-xs text-celestial-textSub">{pullHints.embedding}</pre>
                </div>
              ) : null}
            </div>
          ) : null}
          {connection.status === "error" ? (
            <p>
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
              {connection.message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};
