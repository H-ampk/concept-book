# UI Ornaments Guide

## Overview

このドキュメントは、Concept Book の Harry Potter 風 UI 改修で導入・整理した装飾要素の役割をまとめたものです。  
対象は **見た目の装飾レイヤー** であり、機能ロジック（検索、フィルタ、編集、選択、詳細表示など）は含みません。

## Design Direction

- 一覧カードは簡潔さを優先する
- 主要パネル（フィルター、詳細、設定、グラフ、ツリー）は重厚にする
- 群青＋金の基調は維持し、装飾は情報の邪魔をしない範囲に留める
- 背景画像に依存しすぎず、CSS装飾で世界観を支える

## Active ornaments

ランタイムで **実際に参照されている** 装飾素材と役割:

### Header ornament line

- **画像:** `public/decorations/serpent-line.svg`
- **実装:** `src/components/common/OrnamentLine.tsx` の `<img>`（`variant="header"`）
- **利用箇所:** `src/app/App.tsx` のヘッダー（題字・ナビの装飾線として表示）

### Card corner decoration

- **画像:** `public/decorations/corner.svg`
- **実装:** ルート要素のインラインスタイル `--corner-decoration-url`（`src/app/App.tsx`）と、`src/index.css` の `.card-corner` の `background-image`
- **用途:** 主要パネル・カード四隅の角モチーフ（`<span class="card-corner" />`）

### CSS-only moon emblem

- **実装:** `src/app/App.tsx` の `DecorativeBackground` 内 `.moon-emblem` と、`src/index.css` の `.moon-ring` / `.moon-axis` など
- **用途:** 固定的な月環モチーフ（画像ファイルではなく CSS の線・円で描画）

## Inactive / archived assets

次の PNG は **`public/decorations/` にファイルとして残しているが、現時点ではランタイムから参照されていない**（`<img>` や CSS `url()` の対象になっていない）:

- `moon.png`
- `botanical.png`
- `constellation.png`

以前は `src/app/App.tsx` で背景用 PNG をフラグ付き `<img>` として差し込む案があったが、**未使用の隠れ参照を避けるためそのフラグと JSX は削除済み**である。素材ファイル自体はリポジトリに残してあり、アーカイブ扱いとする。

## Background composition（CSS レイヤー）

アプリ全体の背景は主に CSS で構成される:

- ベース: 群青グラデーション（`DecorativeBackground` 内のレイヤー）
- 補助: 星粒（`.star-field`）、天体図風ライン（`.astral-chart`）、左右フレーム（`.cathedral-frame`）、環境 HUD（`.cyber-ambient` / `.hud-global-ring`）など

画像ファイルへの依存は **Active ornaments** に記載したものと、アーカイブ PNG を除き最小限とする。

## Maintenance note

- **コードに存在しない「無効化フラグ」だけをドキュメントに書かない。** 装飾の ON/OFF は実装側にソースオブジェクトがあるべきである。
- **アーカイブ PNG を再度画面に出す場合は、`DecorativeBackground`（または該当コンポーネント）側に明示的に `<img>` / `background-image` を追加する。** その変更と同じ PR で本ドキュメントの **Active ornaments / Inactive** も更新する。
- 一覧カードや IndexedDB・ZIP などの機能レイヤーへ、装飾目的だけの変更を混ぜない。

## Components

### `OrnamentLine`

ファイル: `src/components/common/OrnamentLine.tsx`

- 役割: 共通の装飾線（蛇・棘モチーフの横長 SVG）を描画するコンポーネント
- 用途: ヘッダーと主要パネルに統一された意匠を適用する
- バリアント:
  - `header`: ヘッダー用の長い装飾線（`decorations/serpent-line.svg`）
  - `panel`: パネル用の短い装飾線（同一 SVG、幅クラスが異なる）

### バリアント使い分け

- `header`
  - 画面の顔となる領域に使用
  - もっとも装飾強度を高く見せる場所
- `panel`
  - 主要パネル上部の統一アクセントとして使用
  - 一覧カードには原則使わない（過装飾防止）

## CSS Classes

ファイル: `src/index.css`

### パネル系

- `decorated-card`
  - 主要パネル共通の装飾土台
  - `position: relative` と `overflow: visible` を持ち、角装飾や線装飾の基準になる

- `ritual-altar`
  - フィルターパネルなど「主役パネル」の重厚化クラス
  - 上下の細い金線、内側光彩、陰影強化を担当

### カード系（一覧）

- `concept-card`
  - 一覧カードの基本質感（外枠1本＋ごく弱い光彩）
  - 二重枠に見えないことを優先

- `concept-card-selected`
  - 選択状態の強調
  - 追加枠ではなく外側グロー・影中心で差分を作る

- `concept-card-main-button`
  - カード内部の全幅ボタンに適用
  - グローバル `button` 装飾による内枠見えを無効化

### タグ・小ボタン系

- `tag-chip`
- `filter-button`
  - 役割: 軽い「印章・銘板」感を追加
  - 方針: 押しやすさ・可読性を優先し、過剰な立体演出は避ける

### OrnamentLine 関連クラス

- `ornament-line`
- `ornament-line-image`
- `ornament-line-header`
- `ornament-line-panel`

役割分担:

- `ornament-line`: フレックスレイアウトの土台
- `ornament-line-header` / `ornament-line-panel`: 横幅・マージン・見出し周りの補助線（`::after` のグラデ線を含む）
- `ornament-line-image`: SVG 画像のサイズ・ドロップシャドウ・アニメーション

## corner.svg の扱い

- `corner.svg` は背景フルスクリーン画像ではなく **カード／パネル角の装飾** として利用する
- 疑似要素競合を避けるため、`::before/::after` ではなく `span.card-corner` 方式を採用
- 画像参照は CSS 変数 `--corner-decoration-url`（`App.tsx` で定義）＋ `src/index.css` の fallback で管理

## Future Asset Phase

素材追加が必要になった場合は、フェーズを切って実施する。

- まず OrnamentLine の SVG 差し替えを優先
- アーカイブ PNG を復活させる場合は **実装を追加したうえで** 本書の Active / Inactive を更新する（上記 Maintenance note を参照）
- 追加後も「一覧カードは簡潔、主要パネルは重厚」のバランスを維持する

## Class / File Index

| Item | File | 用途 |
|---|---|---|
| `OrnamentLine` | `src/components/common/OrnamentLine.tsx` | ヘッダー/主要パネルで共通装飾線（serpent-line.svg）を描画 |
| `serpent-line.svg` | `public/decorations/` | OrnamentLine が参照するヘッダー／パネル装飾線 |
| `.ornament-line` | `src/index.css` | OrnamentLine の共通レイアウト（土台） |
| `.ornament-line-header` | `src/index.css` | ヘッダー用の横長装飾線サイズと補助線 |
| `.ornament-line-panel` | `src/index.css` | パネル用の短い装飾線サイズと補助線 |
| `.ritual-altar` | `src/index.css`（適用: `src/app/App.tsx`） | 主役パネルの重厚化（上下線/光彩/陰影） |
| `.decorated-card` | `src/index.css`（適用: 主要パネル各TSX） | 角装飾・線装飾の基準となる共通土台 |
| `.concept-card-main-button` | `src/index.css` + `src/components/ConceptList.tsx` | 一覧カード内部ボタンの内枠見えを抑制 |
| `.concept-card-selected` | `src/index.css` + `src/components/ConceptList.tsx` | 一覧カード選択時の外側グロー強調 |
| `.tag-chip` | `src/index.css` + `src/components/ConceptList.tsx` | 一覧カード内タグの印章風質感 |
| `.filter-button` | `src/index.css` + `src/components/ConceptList.tsx` | 一覧カード内小ボタンの印章風質感 |
| `.moon-emblem` ほか | `src/index.css` / `DecorativeBackground`（`App.tsx`） | CSS のみの月環モチーフ |
| `moon.png` / `botanical.png` / `constellation.png` | `public/decorations/` | **現状ランタイム未参照**（アーカイブ素材） |
| `--corner-decoration-url` | 定義: `src/app/App.tsx` / 使用: `src/index.css` | `corner.svg` をカード角装飾へ渡す CSS 変数 |

## Do / Don't

### Do

- 主要パネルの装飾は `decorated-card` / `ritual-altar` を起点に調整する
- 一覧カードは `concept-card` 系で微調整し、情報密度を上げすぎない
- 装飾線の統一は `OrnamentLine` で行う

### Don't

- 機能ロジックへ装飾目的で手を入れない
- 一覧カードへ主要パネル級の装飾を横展開しない
- 一時デバッグスタイル（赤枠など）を残したままにしない
- **無効化だけのフラグをコードに残さず、ドキュメントだけで「将来 ON にする」と書かない**
