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

## Cloud Run URL形式（重要）

**必ず決定論的URL（Deterministic URL）を使用すること。**

Cloud Runは2つのURL形式を自動生成するが、**決定論的URLのみを使用する**：

| URL形式 | 例 | 使用可否 |
|---------|-----|----------|
| 決定論的（Deterministic） | `SERVICE-PROJECT_NUMBER.REGION.run.app` | **使用する** |
| 非決定論的（Non-deterministic） | `SERVICE-RANDOMHASH-REGION.a.run.app` | **使用禁止** |

### 本プロジェクトのURL

- フロントエンド: `https://a11y-check-frontend-783872951114.asia-northeast1.run.app`
- バックエンド: `https://a11y-check-api-783872951114.asia-northeast1.run.app`

### 理由

- 決定論的URLはデプロイ前に予測可能
- `gcloud run services describe`の出力は非決定論的URLを返すため、**絶対に使用しない**
- デプロイスクリプト（`scripts/deploy.sh`, `scripts/deploy-frontend.sh`）は決定論的URLを表示するように設定済み


# AI-DLC and Spec-Driven Development

Kiro-style Spec Driven Development implementation on AI-DLC (AI Development Life Cycle)

## Project Context

### Paths
- Steering: `.kiro/steering/`
- Specs: `.kiro/specs/`

### Steering vs Specification

**Steering** (`.kiro/steering/`) - Guide AI with project-wide rules and context
**Specs** (`.kiro/specs/`) - Formalize development process for individual features

### Active Specifications
- Check `.kiro/specs/` for active specifications
- Use `/kiro:spec-status [feature-name]` to check progress

## Development Guidelines
- Think in English, generate responses in Japanese. All Markdown content written to project files (e.g., requirements.md, design.md, tasks.md, research.md, validation reports) MUST be written in the target language configured for this specification (see spec.json.language).

## Minimal Workflow
- Phase 0 (optional): `/kiro:steering`, `/kiro:steering-custom`
- Phase 1 (Specification):
  - `/kiro:spec-init "description"`
  - `/kiro:spec-requirements {feature}`
  - `/kiro:validate-gap {feature}` (optional: for existing codebase)
  - `/kiro:spec-design {feature} [-y]`
  - `/kiro:validate-design {feature}` (optional: design review)
  - `/kiro:spec-tasks {feature} [-y]`
- Phase 2 (Implementation): `/kiro:spec-impl {feature} [tasks]`
  - `/kiro:validate-impl {feature}` (optional: after implementation)
- Progress check: `/kiro:spec-status {feature}` (use anytime)

## Development Rules
- 3-phase approval workflow: Requirements → Design → Tasks → Implementation
- Human review required each phase; use `-y` only for intentional fast-track
- Keep steering current and verify alignment with `/kiro:spec-status`
- Follow the user's instructions precisely, and within that scope act autonomously: gather the necessary context and complete the requested work end-to-end in this run, asking questions only when essential information is missing or the instructions are critically ambiguous.

## Steering Configuration
- Load entire `.kiro/steering/` as project memory
- Default files: `product.md`, `tech.md`, `structure.md`
- Custom files are supported (managed via `/kiro:steering-custom`)
