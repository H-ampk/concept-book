# UI Ornaments Guide

## Overview

このドキュメントは、Concept Book の Harry Potter 風 UI 改修で導入・整理した装飾要素の役割をまとめたものです。  
対象は **見た目の装飾レイヤー** であり、機能ロジック（検索、フィルタ、編集、選択、詳細表示など）は含みません。

## Design Direction

- 一覧カードは簡潔さを優先する
- 主要パネル（フィルター、詳細、設定、グラフ、ツリー）は重厚にする
- 群青＋金の基調は維持し、装飾は情報の邪魔をしない範囲に留める
- 背景画像に依存しすぎず、CSS装飾で世界観を支える

## Components

### `OrnamentLine`

ファイル: `src/components/common/OrnamentLine.tsx`

- 役割: 共通の装飾線（ornament line）を描画する軽量コンポーネント
- 用途: ヘッダーと主要パネルに統一された意匠を適用する
- バリアント:
  - `header`: ヘッダー用の長い装飾線
  - `panel`: パネル用の短い装飾線

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
- `ornament-line-header`
- `ornament-line-panel`
- `ornament-segment*`
- `ornament-glyph*`

役割分担:

- `ornament-line*`: レイアウトとサイズ
- `ornament-segment*`: 線分部分
- `ornament-glyph*`: 中央モチーフ部分

## Background Assets

背景は以下の方針で構成:

- ベース: 群青グラデーション
- 補助: 星粒、天体図風ライン、建築的ライン（CSS）
- 画像は必要最小限で管理し、依存しすぎない

## Current Disabled Assets

ファイル: `src/app/App.tsx`

現在は以下をフラグで OFF:

- `SHOW_MOON_BACKGROUND = false`
- `SHOW_BOTANICAL_BACKGROUND = false`
- `SHOW_CONSTELLATION_BACKGROUND = false`

意図:

- CSS装飾のみで雰囲気を確認・調整するため
- 後で戻す場合はフラグを `true` にするだけで復帰可能

## corner.svg の扱い

- `corner.svg` は背景画像ではなく **カード装飾** として利用
- 疑似要素競合を避けるため、`::before/::after` ではなく `span.card-corner` 方式を採用
- 画像参照は CSS 変数 `--corner-decoration-url`（`App.tsx` で定義）＋fallback で管理

## Future Asset Phase

素材追加が必要になった場合は、**phase_5** で実施する。

- まず OrnamentLine の SVG 差し替えを優先
- 背景素材は主役にせず、控えめな補助として扱う
- 追加後も「一覧カードは簡潔、主要パネルは重厚」のバランスを維持する

## Class / File Index

| Item | File | 用途 |
|---|---|---|
| `OrnamentLine` | `src/components/common/OrnamentLine.tsx` | ヘッダー/主要パネルで共通装飾線を描画するコンポーネント |
| `.ornament-line` | `src/index.css` | OrnamentLine の共通レイアウト（土台） |
| `.ornament-line-header` | `src/index.css` | ヘッダー用の横長装飾線サイズ |
| `.ornament-line-panel` | `src/index.css` | パネル用の短い装飾線サイズ |
| `.ornament-segment` | `src/index.css` | 装飾線の線分部分 |
| `.ornament-glyph` | `src/index.css` | 装飾線中央のモチーフ表示部分 |
| `.ritual-altar` | `src/index.css`（適用: `src/app/App.tsx`） | 主役パネルの重厚化（上下線/光彩/陰影） |
| `.decorated-card` | `src/index.css`（適用: 主要パネル各TSX） | 角装飾・線装飾の基準となる共通土台 |
| `.concept-card-main-button` | `src/index.css` + `src/components/ConceptList.tsx` | 一覧カード内部ボタンの内枠見えを抑制 |
| `.concept-card-selected` | `src/index.css` + `src/components/ConceptList.tsx` | 一覧カード選択時の外側グロー強調 |
| `.tag-chip` | `src/index.css` + `src/components/ConceptList.tsx` | 一覧カード内タグの印章風質感 |
| `.filter-button` | `src/index.css` + `src/components/ConceptList.tsx` | 一覧カード内小ボタンの印章風質感 |
| `SHOW_MOON_BACKGROUND` | `src/app/App.tsx` | `moon.png` 背景レイヤーの表示切替フラグ |
| `SHOW_BOTANICAL_BACKGROUND` | `src/app/App.tsx` | `botanical.png` 背景レイヤーの表示切替フラグ |
| `SHOW_CONSTELLATION_BACKGROUND` | `src/app/App.tsx` | `constellation.png` 背景レイヤーの表示切替フラグ |
| `--corner-decoration-url` | 定義: `src/app/App.tsx` / 使用: `src/index.css` | `corner.svg` の参照先をカード角装飾へ渡す CSS 変数 |

## Do / Don't

### Do

- 主要パネルの装飾は `decorated-card` / `ritual-altar` を起点に調整する
- 一覧カードは `concept-card` 系で微調整し、情報密度を上げすぎない
- 装飾線の統一は `OrnamentLine` で行う

### Don't

- 機能ロジックへ装飾目的で手を入れない
- 一覧カードへ主要パネル級の装飾を横展開しない
- 一時デバッグスタイル（赤枠など）を残したままにしない
