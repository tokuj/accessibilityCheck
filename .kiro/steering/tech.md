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

---
_created_at: 2025-12-17_
