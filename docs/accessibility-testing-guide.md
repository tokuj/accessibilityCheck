# アクセシビリティテスト実行ガイド

## 目次

1. [セットアップ](#セットアップ)
2. [テスト実行方法](#テスト実行方法)
3. [結果の読み方](#結果の読み方)
4. [HTMLレポートの確認](#htmlレポートの確認)
5. [カスタマイズ方法](#カスタマイズ方法)
6. [トラブルシューティング](#トラブルシューティング)

---

## セットアップ

### 前提条件

- Node.js 18以上
- npm または yarn

### 依存関係のインストール

```bash
# プロジェクトディレクトリで実行
npm install
```

### ブラウザのインストール

```bash
npx playwright install
```

---

## テスト実行方法

### 基本的なコマンド

| コマンド | 説明 |
|---------|------|
| `npm run test:a11y` | アクセシビリティテストを実行 |
| `npm run test:a11y:headed` | ブラウザを表示して実行 |
| `npm run test:a11y:ui` | UIモードで対話的に実行 |
| `npm run test:report` | HTMLレポートを表示 |

### 特定のブラウザで実行

```bash
# Chromiumのみ
npx playwright test tests/accessibility.spec.ts --project=chromium

# Firefoxのみ
npx playwright test tests/accessibility.spec.ts --project=firefox

# WebKit（Safari）のみ
npx playwright test tests/accessibility.spec.ts --project=webkit
```

### 特定のテストのみ実行

```bash
# トップページのテストのみ
npx playwright test tests/accessibility.spec.ts -g "トップページ"

# 会社情報ページのテストのみ
npx playwright test tests/accessibility.spec.ts -g "会社情報"
```

---

## 結果の読み方

### コンソール出力の例

```
[会社情報] アクセシビリティ違反検出
URL: https://www.intage.co.jp/company/
========================================

1. color-contrast
   説明: Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds
   影響度: serious
   対象要素数: 2
   ヘルプ: https://dequeuniversity.com/rules/axe/4.11/color-contrast
```

### 影響度（Impact）の意味

| 影響度 | 説明 |
|--------|------|
| `critical` | 致命的。一部のユーザーがコンテンツにアクセスできない |
| `serious` | 深刻。多くのユーザーに影響を与える |
| `moderate` | 中程度。一部のユーザーに影響を与える |
| `minor` | 軽微。ユーザー体験に若干の影響 |

### 違反の詳細情報

各違反には以下の情報が含まれます：

- **id**: 違反ルールの識別子（例: `color-contrast`）
- **description**: 問題の説明
- **impact**: 影響度
- **nodes**: 該当する要素の一覧
- **helpUrl**: 詳細な修正方法へのリンク

---

## HTMLレポートの確認

### レポートを開く

```bash
npm run test:report
```

### レポートの構成

1. **Summary**: テスト結果の概要
2. **Tests**: 各テストケースの詳細
3. **Attachments**: スクリーンショットやトレース

### レポートの場所

```
playwright-report/
└── index.html
```

---

## カスタマイズ方法

### テスト対象ページの追加

`tests/accessibility.spec.ts` の `TEST_PAGES` 配列に追加：

```typescript
const TEST_PAGES = [
  { name: 'トップページ', url: 'https://www.intage.co.jp/' },
  // 新しいページを追加
  { name: '採用情報', url: 'https://www.intage.co.jp/recruit/' },
];
```

### 特定のルールを除外

```typescript
const accessibilityScanResults = await new AxeBuilder({ page })
  .withTags(WCAG_TAGS)
  .disableRules(['color-contrast']) // このルールを除外
  .analyze();
```

### 特定の要素を除外

```typescript
const accessibilityScanResults = await new AxeBuilder({ page })
  .withTags(WCAG_TAGS)
  .exclude('iframe')              // iframeを除外
  .exclude('.third-party-widget') // 特定のクラスを除外
  .analyze();
```

### WCAG準拠レベルの変更

```typescript
// Level A のみ
const WCAG_TAGS = ['wcag2a', 'wcag21a'];

// Level AAA を含める
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa'];
```

---

## トラブルシューティング

### タイムアウトエラー

**症状**: `Timeout 30000ms exceeded` エラー

**対策**: `playwright.config.ts` でタイムアウトを延長

```typescript
export default defineConfig({
  timeout: 60000, // 60秒に延長
});
```

### ネットワークエラー

**症状**: `net::ERR_NAME_NOT_RESOLVED` エラー

**対策**:
1. インターネット接続を確認
2. 対象サイトがアクセス可能か確認
3. プロキシ設定が必要な場合は環境変数を設定

### ブラウザが見つからない

**症状**: `Executable doesn't exist` エラー

**対策**:
```bash
npx playwright install
```

### テストが不安定

**症状**: 同じテストが成功/失敗を繰り返す

**対策**:
1. `waitUntil: 'networkidle'` オプションを確認
2. 動的コンテンツのロード待ちを追加

```typescript
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000); // 追加の待機
```

### 違反が多すぎる

**症状**: 大量の違反が検出され対応が困難

**対策**:
1. 影響度でフィルタリング（criticalとseriousを優先）
2. サードパーティ要素を除外
3. ページごとに段階的に修正

---

## 参考リンク

- [Playwright公式ドキュメント](https://playwright.dev/)
- [axe-core GitHub](https://github.com/dequelabs/axe-core)
- [axe-core/playwright](https://www.npmjs.com/package/@axe-core/playwright)
- [Deque University - axe Rules](https://dequeuniversity.com/rules/axe/)
