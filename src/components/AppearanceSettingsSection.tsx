import { THEME_COLOR_PRESETS } from "../theme/defaults";
import { useTheme, type ThemeColors, type ThemeMode } from "../theme";

const MODE_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: "light", label: "ライト" },
  { mode: "dark", label: "ダーク" },
  { mode: "system", label: "システム" }
];

const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: "background", label: "背景色" },
  { key: "header", label: "ヘッダー色" },
  { key: "button", label: "ボタン色" },
  { key: "selectedButton", label: "選択中のボタン色" }
];

export const AppearanceSettingsSection = () => {
  const { settings, setMode, setColor, resetColors } = useTheme();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-celestial-textMain">外観</h3>
      <p className="text-xs text-celestial-textSub">
        ライト / ダーク / システムの切り替えと、背景・ヘッダー・ボタン色をこの端末に保存します。変更はすぐに反映されます。
      </p>
      <div className="space-y-4 rounded-lg bg-nordic-surface p-4">
        <div>
          <p className="mb-2 text-sm font-medium text-celestial-textMain" id="theme-mode-label">
            テーマ
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="theme-mode-label">
            {MODE_OPTIONS.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                aria-pressed={settings.mode === mode}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55 ${
                  settings.mode === mode
                    ? "theme-selected"
                    : "border-celestial-border text-celestial-textMain hover:bg-celestial-gold/10"
                }`}
                onClick={() => setMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {COLOR_FIELDS.map(({ key, label }) => (
          <div key={key}>
            <p className="mb-2 text-sm font-medium text-celestial-textMain" id={`theme-color-${key}-label`}>
              {label}
            </p>
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-labelledby={`theme-color-${key}-label`}
            >
              {THEME_COLOR_PRESETS[key].map((preset) => {
                const selected = settings.colors[key].toUpperCase() === preset.toUpperCase();
                return (
                  <button
                    key={preset}
                    type="button"
                    aria-label={`${label} ${preset}`}
                    aria-pressed={selected}
                    className={`h-7 w-7 rounded-full border ${
                      selected ? "border-celestial-textMain ring-2 ring-celestial-gold/50" : "border-celestial-border"
                    }`}
                    style={{ backgroundColor: preset }}
                    onClick={() => setColor(key, preset)}
                  />
                );
              })}
              <label className="ml-1 inline-flex cursor-pointer items-center gap-1 text-xs text-celestial-textSub">
                <span className="sr-only">{label}を自由に指定</span>
                <input
                  type="color"
                  value={settings.colors[key]}
                  aria-labelledby={`theme-color-${key}-label`}
                  onChange={(e) => setColor(key, e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-celestial-border bg-nordic-surface p-0.5"
                />
              </label>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="rounded-md border border-celestial-border px-3 py-2 text-sm text-celestial-textMain hover:bg-celestial-gold/10"
          onClick={resetColors}
        >
          テーマカラーを初期値に戻す
        </button>
      </div>
    </div>
  );
};
