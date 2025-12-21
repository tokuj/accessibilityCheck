# Technology Stack

## Architecture

フロントエンド + バックエンドAPIの分離構成。バックエンドでブラウザを起動し、各種アクセシビリティツールを実行。

## Core Technologies

- **Language**: TypeScript
- **Frontend**: React 19 + Vite + MUI
- **Backend**: Express 5 + Node.js
- **Testing**: Playwright + axe-core

## Key Libraries

### アクセシビリティエンジン
- `@axe-core/playwright`: Playwrightとの統合
- `pa11y`: HTML CodeSniffer ベースの検証
- `lighthouse`: パフォーマンス含む総合評価

### フロントエンド
- `@mui/material`: UIコンポーネント
- `@emotion/react`: スタイリング

## Development Standards

### Type Safety
- TypeScript使用（フロントエンド・バックエンド共に）
- API型定義を `types/` ディレクトリで管理

### Code Quality
- ESLint設定済み（フロントエンド）
- 日本語コメント・ログを推奨

### Testing
- Playwrightによるアクセシビリティテスト
- WCAG 2.1 AA準拠を基準とする

## Development Environment

### Required Tools
- Node.js 18+
- npm

### Common Commands
```bash
# 開発（フロントエンド + バックエンド同時起動）
npm run dev

# テスト実行
npm run test:a11y

# レポート生成
npm run report:a11y
```

## Key Technical Decisions

- **マルチエンジン統合**: 各ツールの得意分野を活かし、検出率向上
- **認証の抽象化**: AuthManagerで認証方式を統一的に扱う
- **スクリーンショット取得**: 分析結果と視覚的コンテキストを併せて提供

## Cloud Run デプロイ

### URL形式（重要）

**決定論的URL（Deterministic URL）のみを使用すること。**

```
# 決定論的URL形式（使用する）
https://SERVICE-PROJECT_NUMBER.REGION.run.app

# 非決定論的URL形式（使用禁止）
https://SERVICE-RANDOMHASH-REGION.a.run.app
```

### 本プロジェクトのURL

| サービス | URL |
|----------|-----|
| フロントエンド | `https://a11y-check-frontend-783872951114.asia-northeast1.run.app` |
| バックエンド | `https://a11y-check-api-783872951114.asia-northeast1.run.app` |

### 注意事項

- `gcloud run services describe --format='value(status.url)'` は非決定論的URLを返すため使用禁止
- デプロイ時のURL表示は `scripts/deploy.sh` および `scripts/deploy-frontend.sh` で管理
- プロジェクト番号 `783872951114` はスクリプト内で `PROJECT_NUMBER` 変数として定義済み

---
_created_at: 2025-12-17_
