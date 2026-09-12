# Theme system

ユーザーが設定できる **テーマ（ライト / ダーク / システム）と 4 色** の runtime 基盤です。

装飾素材（OrnamentLine、月環、カード枠など）は対象外です。装飾レイヤーは [ui-ornaments.md](./ui-ornaments.md) を参照してください。

実装:

- `src/theme/`
- `src/components/AppearanceSettingsSection.tsx`
- `src/main.tsx`
- `src/index.css`
- `tailwind.config.cjs`

## 目的

Danish Study Library を基調にした既定色を保ちつつ、端末ごとに背景・ヘッダー・ボタン色を変えられるようにします。変更はすぐに画面へ反映し、この端末の localStorage に保存します。IndexedDB の Concept データとは独立です。JSON / ZIP バックアップには含めません。

## ThemeProvider

`src/main.tsx` で、描画前に `hydrateTheme()` を呼び、`<ThemeProvider>` でアプリを包みます。FOUC を抑えるため、React の初回描画より先に CSS 変数を載せます。

`ThemeProvider` が持つ操作:

- `settings` / `resolvedMode`
- `setMode(mode)`
- `setColor(key, value)`
- `resetColors()`

`mode === "system"` のときは `prefers-color-scheme` を購読し、OS の変更に追従します。

## Theme defaults

`src/theme/types.ts` の設定値だけがユーザー設定対象です。

```ts
type ThemeMode = "light" | "dark" | "system";

type ThemeColors = {
  background: string;
  header: string;
  button: string;
  selectedButton: string;
};

type ThemeSettings = {
  mode: ThemeMode;
  colors: ThemeColors;
};
```

既定モードは `light` です。

| 項目 | Light | Dark |
| --- | --- | --- |
| background | `#F5F0E8` | `#182028` |
| header | `#587487` | `#3A5060` |
| button | `#5E7E93` | `#5E7E93` |
| selectedButton | `#8CA9BA` | `#8CA9BA` |

色が light / dark の標準値と一致しているときは、モード切替に合わせて標準パレットへ戻します。どれか 1 色でもカスタムすると、モード切替後もその 4 色を維持します。

各項目にはプリセット色があり、カラーピッカーで任意の `#RRGGBB` も指定できます。不正な値は無視します。

## Theme storage

- キー: `concept-book-theme-settings`
- 場所: `localStorage`
- 読み書き: `loadThemeSettings` / `saveThemeSettings`（`src/theme/storage.ts`）

壊れた JSON や欠落フィールドは既定値へ正規化します。Storage 失敗でもアプリは止めません。

## Color handling

ユーザーが直接持つのは上記 4 色だけです。適用時に派生色を計算します（`src/theme/color.ts`、`applyTheme.ts`）。

| CSS 変数 | 由来 |
| --- | --- |
| `--theme-background` | `colors.background` |
| `--theme-header` | `colors.header` |
| `--theme-header-deep` | header を暗くした派生 |
| `--theme-header-text` | header に対するコントラスト文字色 |
| `--theme-button` | `colors.button` |
| `--theme-button-hover` / `--theme-button-active` | button の派生 |
| `--theme-button-text` | button に対するコントラスト文字色 |
| `--theme-button-selected` | `colors.selectedButton` |
| `--theme-button-selected-hover` | selectedButton の派生 |
| `--theme-button-selected-text` | selectedButton に対するコントラスト文字色 |

コントラスト文字色は相対輝度が 0.45 を超えると暗色（`#24313A`）、それ以外は明色（`#F9FBFC`）です。

`document.documentElement.dataset.theme` に `light` または `dark` を載せ、`color-scheme` も合わせます。`meta[name="theme-color"]` は header 色に更新します。

`src/index.css` の `:root` と `[data-theme="dark"]` に同じ変数のフォールバックがあり、Tailwind の `nordic.*` / `celestial.*` / `action.*` はこれらの CSS 変数を参照します。

## Appearance Settings

設定画面の「外観」（`AppearanceSettingsSection`）:

- テーマ: ライト / ダーク / システム
- 背景色 / ヘッダー色 / ボタン色 / 選択中のボタン色（プリセット + カラーピッカー）
- 「テーマカラーを初期値に戻す」（現在の解決モードの標準 4 色へ戻す）

分野タグ色はグラフ・カード用の別設定（`concept-book-domain-colors`）であり、このテーマ 4 色には含まれません。

## 保存と runtime 適用の流れ

1. `hydrateTheme()` が localStorage を読み、CSS 変数を document へ書く
2. `ThemeProvider` が同じ設定を state として保持する
3. 設定変更は localStorage へ保存し、`applyThemeSettings` で CSS 変数を更新する
4. コンポーネントは Tailwind / CSS 変数経由で色を受け取る。テーマ色をハードコードで増やさない
