# WCAG網羅性と改善戦略

## 目次

1. [現在の網羅性](#現在の網羅性)
2. [自動テスト可能な基準](#自動テスト可能な基準)
3. [自動テスト不可能な基準](#自動テスト不可能な基準)
4. [網羅性を上げる施策](#網羅性を上げる施策)
5. [推奨ロードマップ](#推奨ロードマップ)
6. [手動テストチェックリスト](#手動テストチェックリスト)

---

## 現在の網羅性

### axe-coreのカバレッジ

| 指標 | 値 | 説明 |
|------|-----|------|
| **基準カバー率** | 約20-30% | WCAG 2.1 Level A+AAの50基準中、約16基準のみ自動化可能 |
| **問題検出率** | 約57% | 実際のアクセシビリティ問題の約57%を検出 |
| **検証レベル** | Level AA | wcag2a, wcag2aa, wcag21a, wcag21aa |

### なぜ検出率が高いのか

基準カバー率は低いものの、問題検出率が57%と高い理由：

- コントラスト違反（1.4.3）や代替テキスト欠落（1.1.1）など、**頻出する問題**を自動検出できる
- これらの問題は1ページで複数回発生するため、実際の問題数では大きな割合を占める

### 限界

- **約40-80%の基準**は人間の判断が必要
- メディアコンテンツ、ユーザーインタラクション、文脈理解が必要な基準は自動化困難

---

## 自動テスト可能な基準

axe-coreで完全に自動テスト可能なWCAG基準：

| 項番 | 基準名 | 説明 |
|------|--------|------|
| 1.1.1 | 非テキストコンテンツ | 画像のalt属性チェック |
| 1.3.1 | 情報及び関係性 | 見出し構造、リスト構造 |
| 1.4.3 | コントラスト（最低限） | 色のコントラスト比 |
| 1.4.4 | テキストのサイズ変更 | viewport設定 |
| 2.4.1 | ブロックスキップ | スキップリンクの存在 |
| 2.4.2 | ページタイトル | title要素の存在 |
| 2.4.4 | リンクの目的 | リンクテキストの明確さ |
| 3.1.1 | ページの言語 | lang属性の存在 |
| 3.1.2 | 一部分の言語 | 部分的なlang属性 |
| 3.3.2 | ラベル又は説明 | フォームラベル |
| 4.1.1 | 構文解析 | HTML構文エラー |
| 4.1.2 | 名前、役割、値 | ARIA属性の正確性 |

---

## 自動テスト不可能な基準

以下の基準は自動テストが困難または不可能：

### 人間の判断が必要

| 項番 | 基準名 | 理由 |
|------|--------|------|
| 1.2.1-1.2.5 | 時間依存メディア | 動画/音声の内容確認が必要 |
| 1.3.3 | 感覚的な特徴 | 指示の文脈理解が必要 |
| 1.4.1 | 色の使用 | 色だけで情報を伝えていないか判断が必要 |
| 1.4.5 | 文字画像 | テキストが画像化されているか判断が必要 |
| 2.1.1 | キーボード | 全機能のキーボード操作テストが必要 |
| 2.4.3 | フォーカス順序 | 論理的な順序の判断が必要 |
| 2.4.5 | 複数の手段 | ナビゲーション手段の多様性判断 |
| 2.4.6 | 見出し及びラベル | 内容の適切さ判断が必要 |
| 3.2.1-3.2.4 | 一貫性 | サイト全体のパターン理解が必要 |
| 3.3.1 | エラーの特定 | エラーメッセージの適切さ判断 |
| 3.3.3 | エラー修正の提案 | 提案内容の適切さ判断 |

### デバイス/環境依存

| 項番 | 基準名 | 理由 |
|------|--------|------|
| 1.3.4 | 表示の向き | 画面回転テストが必要 |
| 2.5.1-2.5.4 | ポインタ操作 | タッチデバイスでのテストが必要 |

---

## 網羅性を上げる施策

### A. 追加ツールの導入

#### 1. Pa11y（推奨度: 高）

**特徴**: HTML_CodeSnifferベースで、axe-coreとは異なるルールセット

```bash
npm install pa11y
```

```typescript
import pa11y from 'pa11y';

const results = await pa11y('https://www.intage.co.jp/', {
  standard: 'WCAG2AA',
  runners: ['htmlcs'] // または 'axe'
});
```

**メリット**:
- axe-coreが見逃す問題を検出可能
- 導入が容易

---

#### 2. Lighthouse（推奨度: 高）

**特徴**: Googleのアクセシビリティスコア、CI連携が容易

```bash
npm install playwright-lighthouse
```

```typescript
import { playAudit } from 'playwright-lighthouse';

const result = await playAudit({
  page,
  thresholds: { accessibility: 90 },
  port: 9222
});
```

**メリット**:
- 0-100のスコアで進捗を可視化
- パフォーマンス・SEOも同時にチェック可能

---

#### 3. Playwright ARIA Snapshot（推奨度: 高）

**特徴**: アクセシビリティツリーのスナップショット比較

```typescript
// アクセシビリティツリーを取得
const snapshot = await page.accessibility.snapshot();

// 期待する構造と比較
expect(snapshot).toMatchSnapshot('homepage-a11y-tree.json');
```

**メリット**:
- 見出し構造やランドマークの回帰テスト
- 追加パッケージ不要

---

#### 4. Guidepup（推奨度: 中）

**特徴**: 実際のスクリーンリーダー（VoiceOver/NVDA）を自動操作

```bash
npm install @guidepup/playwright
```

```typescript
import { voiceOverTest as test } from '@guidepup/playwright';

test('スクリーンリーダーテスト', async ({ page, voiceOver }) => {
  await page.goto('https://www.intage.co.jp/');
  await voiceOver.navigateToWebContent();

  const spokenText = await voiceOver.spokenPhraseLog();
  expect(spokenText).toContain('インテージ');
});
```

**メリット**:
- 実際のユーザー体験に最も近いテスト
- 読み上げ順序の検証が可能

**デメリット**:
- macOS（VoiceOver）またはWindows（NVDA）が必要
- セットアップが複雑

---

### B. テスト手法の拡張

#### 1. キーボードナビゲーションテスト

```typescript
test('キーボードでメインコンテンツに到達できる', async ({ page }) => {
  await page.goto('https://www.intage.co.jp/');

  // Tabキーを10回以内で主要コンテンツに到達
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.locator(':focus');
    if (await focused.getAttribute('href') === '#main') {
      return; // スキップリンクに到達
    }
  }

  throw new Error('10回のTabで主要コンテンツに到達できませんでした');
});
```

#### 2. 動的状態のスキャン

```typescript
test('モーダル表示後のアクセシビリティ', async ({ page }) => {
  await page.goto('https://www.intage.co.jp/');

  // モーダルを開く
  await page.click('[data-modal-trigger]');
  await page.waitForSelector('[role="dialog"]');

  // モーダル内をスキャン
  const results = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();

  expect(results.violations).toEqual([]);
});
```

#### 3. フォーカス管理テスト

```typescript
test('モーダルを閉じた後フォーカスが戻る', async ({ page }) => {
  await page.goto('https://www.intage.co.jp/');

  const trigger = page.locator('[data-modal-trigger]');
  await trigger.click();

  // モーダルを閉じる
  await page.keyboard.press('Escape');

  // フォーカスがトリガーに戻っている
  await expect(trigger).toBeFocused();
});
```

---

### C. ツール比較表

| ツール | WCAG基準カバー | 導入難易度 | 実行速度 | CI適性 |
|--------|---------------|-----------|---------|--------|
| axe-core（現在） | 約20-30% | 低 | 高速 | 高 |
| Pa11y | 約25-35% | 低 | 高速 | 高 |
| Lighthouse | 約20-30% | 低 | 中速 | 高 |
| ARIA Snapshot | 構造検証 | 低 | 高速 | 高 |
| Guidepup | 読み上げ検証 | 中 | 低速 | 中 |
| 手動テスト | 100% | - | - | 低 |

**複数ツール併用時の期待カバレッジ**: 約60-70%

---

## 推奨ロードマップ

### Phase 1: 基盤強化（即時）

1. **Lighthouse統合**
   - アクセシビリティスコアの継続的モニタリング
   - 閾値: 90点以上

2. **キーボードテスト追加**
   - Tab順序テスト
   - スキップリンクテスト

### Phase 2: カバレッジ拡大（1-2週間）

1. **Pa11y統合**
   - axe-coreと並行実行
   - 異なるルールセットで補完

2. **ARIA Snapshotテスト**
   - 見出し構造のスナップショット
   - ランドマーク構造のスナップショット

### Phase 3: 高度なテスト（1-2ヶ月）

1. **Guidepup導入**（オプション）
   - VoiceOverテスト
   - 読み上げ順序検証

2. **動的コンテンツテスト**
   - モーダル、ドロップダウン
   - フォームバリデーション

### Phase 4: プロセス確立

1. **手動テストチェックリスト運用**
2. **定期監査サイクル確立**

---

## 手動テストチェックリスト

自動テストでカバーできない項目の手動確認リスト：

### 知覚可能（Perceivable）

- [ ] **1.2.1-1.2.5**: 動画にキャプション・音声解説があるか
- [ ] **1.3.3**: 形や位置だけで情報を伝えていないか
- [ ] **1.4.1**: 色だけで情報を伝えていないか
- [ ] **1.4.5**: テキストが不必要に画像化されていないか

### 操作可能（Operable）

- [ ] **2.1.1**: すべての機能がキーボードで操作可能か
- [ ] **2.1.2**: キーボードフォーカスがトラップされないか
- [ ] **2.2.1**: 時間制限がある場合、延長可能か
- [ ] **2.4.3**: フォーカス順序が論理的か
- [ ] **2.4.5**: コンテンツへの複数のアクセス手段があるか
- [ ] **2.4.6**: 見出しとラベルが内容を適切に説明しているか
- [ ] **2.4.7**: フォーカスが視覚的に明確か

### 理解可能（Understandable）

- [ ] **3.2.1**: フォーカス時に予期しない変化がないか
- [ ] **3.2.2**: 入力時に予期しない変化がないか
- [ ] **3.2.3**: ナビゲーションが一貫しているか
- [ ] **3.2.4**: 同じ機能が一貫した識別性を持つか
- [ ] **3.3.1**: エラーが特定され説明されているか
- [ ] **3.3.3**: エラー修正の提案があるか

### 堅牢（Robust）

- [ ] **4.1.3**: ステータスメッセージがスクリーンリーダーに通知されるか

---

## 参考リンク

- [Deque axe-core カバレッジ調査](https://www.deque.com/automated-accessibility-testing-coverage/)
- [axe-core GitHub](https://github.com/dequelabs/axe-core)
- [Pa11y](https://pa11y.org/)
- [Lighthouse](https://developer.chrome.com/docs/lighthouse/)
- [Guidepup](https://github.com/guidepup/guidepup-playwright)
- [WCAG 2.1 日本語訳](https://waic.jp/docs/WCAG21/)
