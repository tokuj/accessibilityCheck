# WCAG準拠基準リファレンス

## 目次

1. [WCAGとは](#wcagとは)
2. [適合レベル](#適合レベル)
3. [主要な基準（Level AA）](#主要な基準level-aa)
4. [よくある違反パターン](#よくある違反パターン)
5. [axe-coreルールID一覧](#axe-coreルールid一覧)

---

## WCAGとは

**WCAG（Web Content Accessibility Guidelines）** は、W3Cが策定したWebコンテンツのアクセシビリティに関する国際標準ガイドラインです。

### バージョン

| バージョン | 公開年 | 状態 |
|-----------|--------|------|
| WCAG 2.0 | 2008年 | ISO標準 |
| WCAG 2.1 | 2018年 | 現行推奨 |
| WCAG 2.2 | 2023年 | 最新版 |

このプロジェクトでは **WCAG 2.1** を基準としています。

---

## 適合レベル

WCAGには3つの適合レベルがあります：

| レベル | 説明 | 対象 |
|--------|------|------|
| **Level A** | 最低限の基準 | すべてのWebサイト |
| **Level AA** | 一般的に推奨される基準 | 公共機関・企業サイト |
| **Level AAA** | 最高レベルの基準 | 特定のコンテンツ |

**このプロジェクトはLevel AAを目標としています。**

---

## 主要な基準（Level AA）

### 1. 知覚可能（Perceivable）

#### 1.1 テキストの代替
- **1.1.1 非テキストコンテンツ (A)**
  - 画像には適切な`alt`属性を設定
  - 装飾画像は`alt=""`または`role="presentation"`

#### 1.4 識別可能
- **1.4.3 コントラスト（最低限）(AA)**
  - 通常テキスト: コントラスト比 4.5:1 以上
  - 大きなテキスト（18pt以上）: コントラスト比 3:1 以上

- **1.4.4 テキストのサイズ変更 (AA)**
  - 200%まで拡大してもコンテンツや機能が失われない

### 2. 操作可能（Operable）

#### 2.1 キーボード操作
- **2.1.1 キーボード (A)**
  - すべての機能がキーボードで操作可能

- **2.1.2 キーボードトラップなし (A)**
  - フォーカスが特定の要素に閉じ込められない

#### 2.4 ナビゲーション可能
- **2.4.1 ブロックスキップ (A)**
  - メインコンテンツへのスキップリンク

- **2.4.3 フォーカス順序 (A)**
  - 論理的なフォーカス順序

- **2.4.6 見出しとラベル (AA)**
  - 明確で説明的な見出しとラベル

- **2.4.7 フォーカスの可視化 (AA)**
  - フォーカス位置が視覚的にわかる

### 3. 理解可能（Understandable）

#### 3.1 読みやすさ
- **3.1.1 ページの言語 (A)**
  - `<html lang="ja">` のように言語を指定

- **3.1.2 部分の言語 (AA)**
  - 異なる言語の箇所には言語を指定

#### 3.3 入力支援
- **3.3.1 エラーの特定 (A)**
  - 入力エラーを明確に特定

- **3.3.2 ラベルまたは説明 (A)**
  - フォームには適切なラベルを設定

### 4. 堅牢（Robust）

#### 4.1 互換性
- **4.1.1 構文解析 (A)**
  - 有効なHTMLマークアップ

- **4.1.2 名前・役割・値 (A)**
  - カスタムコンポーネントに適切なARIA属性

---

## よくある違反パターン

### 1. color-contrast（カラーコントラスト）

**問題**: 前景色と背景色のコントラスト比が不足

**例**:
```html
<!-- NG: コントラスト不足 -->
<p style="color: #999; background: #fff;">読みにくいテキスト</p>

<!-- OK: 十分なコントラスト -->
<p style="color: #333; background: #fff;">読みやすいテキスト</p>
```

**修正方法**:
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) でコントラスト比を確認
- 前景色または背景色を調整

### 2. image-alt（画像の代替テキスト）

**問題**: 画像に`alt`属性がない、または不適切

**例**:
```html
<!-- NG: alt属性なし -->
<img src="logo.png">

<!-- NG: 無意味なalt -->
<img src="logo.png" alt="image">

<!-- OK: 適切なalt -->
<img src="logo.png" alt="インテージ ロゴ">

<!-- OK: 装飾画像 -->
<img src="decoration.png" alt="" role="presentation">
```

### 3. label（フォームラベル）

**問題**: フォーム入力にラベルがない

**例**:
```html
<!-- NG: ラベルなし -->
<input type="text" name="email">

<!-- OK: 明示的なラベル -->
<label for="email">メールアドレス</label>
<input type="text" id="email" name="email">

<!-- OK: aria-label使用 -->
<input type="text" name="email" aria-label="メールアドレス">
```

### 4. link-name（リンク名）

**問題**: リンクに認識可能な名前がない

**例**:
```html
<!-- NG: 空のリンク -->
<a href="/page"><img src="icon.png"></a>

<!-- OK: alt属性で名前を提供 -->
<a href="/page"><img src="icon.png" alt="詳細ページへ"></a>

<!-- OK: aria-label使用 -->
<a href="/page" aria-label="詳細ページへ"><img src="icon.png" alt=""></a>
```

### 5. heading-order（見出しの順序）

**問題**: 見出しレベルがスキップされている

**例**:
```html
<!-- NG: h2をスキップ -->
<h1>ページタイトル</h1>
<h3>セクション</h3>

<!-- OK: 順序通り -->
<h1>ページタイトル</h1>
<h2>セクション</h2>
```

### 6. empty-heading（空の見出し）

**問題**: 見出しタグにテキストがない

**例**:
```html
<!-- NG: 空の見出し -->
<h2></h2>
<h2><span class="icon"></span></h2>

<!-- OK: テキストあり -->
<h2>セクションタイトル</h2>
<h2><span class="icon"></span>セクションタイトル</h2>
```

---

## axe-coreルールID一覧

### 重要度: Critical

| ルールID | 説明 |
|---------|------|
| `aria-required-children` | 必須の子要素がない |
| `aria-required-parent` | 必須の親要素がない |
| `duplicate-id-active` | 重複するID（アクティブ要素） |
| `duplicate-id-aria` | 重複するID（ARIA参照） |

### 重要度: Serious

| ルールID | 説明 |
|---------|------|
| `color-contrast` | カラーコントラスト不足 |
| `image-alt` | 画像の代替テキストなし |
| `label` | フォームラベルなし |
| `link-name` | リンク名なし |
| `button-name` | ボタン名なし |

### 重要度: Moderate

| ルールID | 説明 |
|---------|------|
| `heading-order` | 見出しの順序が不正 |
| `html-has-lang` | html要素にlang属性なし |
| `landmark-one-main` | main要素がない |
| `page-has-heading-one` | h1がない |
| `region` | ランドマークに含まれないコンテンツ |

### 重要度: Minor

| ルールID | 説明 |
|---------|------|
| `bypass` | スキップリンクなし |
| `empty-heading` | 空の見出し |
| `link-in-text-block` | テキストブロック内のリンク識別 |

---

## 参考リンク

- [WCAG 2.1 日本語訳](https://waic.jp/docs/WCAG21/)
- [WCAG 2.1 原文（W3C）](https://www.w3.org/TR/WCAG21/)
- [axe-core ルール一覧](https://dequeuniversity.com/rules/axe/)
- [WebAIM - Web Accessibility In Mind](https://webaim.org/)
