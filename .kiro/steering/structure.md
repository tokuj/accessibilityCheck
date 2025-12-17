# Project Structure

## Organization Philosophy

フロントエンド・バックエンド分離構成。バックエンドはドメイン別にディレクトリを分割。

## Directory Patterns

### フロントエンド (`/frontend/src/`)
**Purpose**: React SPAアプリケーション

- `components/`: UIコンポーネント（機能単位で命名）
- `services/`: API通信ロジック
- `types/`: TypeScript型定義
- `utils/`: ユーティリティ関数

### バックエンド (`/server/`)
**Purpose**: Express APIサーバー

- `analyzers/`: 各アクセシビリティツールのラッパー
- `auth/`: 認証処理
- `index.ts`: エントリーポイント
- `analyzer.ts`: オーケストレーション

### テスト (`/tests/`)
**Purpose**: Playwright E2Eテスト
- `*.spec.ts`: テストファイル

### ドキュメント (`/docs/`)
**Purpose**: 技術ドキュメント・リファレンス

## Naming Conventions

- **Reactコンポーネント**: PascalCase (`ViolationsTable.tsx`)
- **TypeScriptファイル**: camelCase (`scoreCalculator.ts`)
- **型定義**: PascalCase (`AccessibilityReport`)

## Import Organization

```typescript
// 外部ライブラリ
import { useState } from 'react';
import { Box, Typography } from '@mui/material';

// 内部モジュール
import { analyzeWithAxe } from './analyzers/axe';
import type { RuleResult } from './analyzers/types';
```

## Code Organization Principles

- **関心の分離**: analyzer.tsがオーケストレーション、各analyzers/がツール固有処理
- **型の集約**: 共通型は`types.ts`で定義し、re-exportで公開
- **認証の抽象化**: AuthManagerが認証方式の差異を吸収

---
_created_at: 2025-12-17_
