# Accessibility Check Project - Claude Code Instructions

## プロジェクト概要

Playwrightとaxe-coreを使用したWebアクセシビリティ自動テストプロジェクト

## 技術スタック

- **テストフレームワーク**: Playwright
- **アクセシビリティエンジン**: axe-core (@axe-core/playwright)
- **言語**: TypeScript
- **パッケージマネージャー**: npm

## プロジェクト構造

```
accessibilityCheck/
├── tests/                    # テストファイル
│   └── accessibility.spec.ts # アクセシビリティテスト
├── playwright.config.ts      # Playwright設定
├── package.json
├── TODO/                     # 作業管理
│   ├── WORKLOG/             # 作業ログ
│   └── PLAN_*.md            # 計画ファイル
├── README.md
├── Claude.md
└── .gitignore
```

## 開発ガイドライン

### テストファイルの作成

1. `tests/`ディレクトリにテストファイルを配置
2. ファイル名は `*.spec.ts` の形式
3. axe-coreのインポートを忘れずに

### テスト実装のテンプレート

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('アクセシビリティテスト', () => {
  test('ページ名 - アクセシビリティ検証', async ({ page }) => {
    await page.goto('URL');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
```

### WCAG準拠レベル

- `wcag2a`: WCAG 2.0 レベルA
- `wcag2aa`: WCAG 2.0 レベルAA
- `wcag21a`: WCAG 2.1 レベルA
- `wcag21aa`: WCAG 2.1 レベルAA

## コマンド一覧

```bash
# テスト実行
npx playwright test

# UIモードで実行
npx playwright test --ui

# 特定のブラウザで実行
npx playwright test --project=chromium

# レポート表示
npx playwright show-report
```

## 注意事項

- 自動テストはWCAG違反のすべてを検出できるわけではない
- 手動テストと併用することを推奨
- 検出された違反は`violations`配列で確認可能
- `incomplete`配列には手動確認が必要な項目が含まれる

## 作業時の必須事項

1. 作業開始時は`TODO/WORKLOG/`に記録
2. 新機能実装前は`TODO/PLAN_*.md`を作成
3. テストコードは必ずレビューを受ける
4. コミット前にテストを実行
