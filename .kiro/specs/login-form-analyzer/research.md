# Research & Design Decisions

## Summary
- **Feature**: login-form-analyzer
- **Discovery Scope**: Extension（既存フォーム認証機能の拡張）
- **Key Findings**:
  - 既存の`AuthConfig`型に`usernameSelector`、`passwordSelector`、`submitSelector`フィールドが存在
  - `AuthSettings.tsx`コンポーネントに手動セレクタ入力UIが実装済み
  - Playwright経由でページアクセスとフォーム操作が既に`manager.ts`で実装済み

## Research Log

### ログインフォーム要素の自動検出方法
- **Context**: URLからログインフォームのセレクタを自動的に推測する方法
- **Sources Consulted**: Playwright DOM API、一般的なログインフォームのパターン
- **Findings**:
  - ユーザー名フィールド: `input[type="text"]`, `input[type="email"]`, `input[name*="user"]`, `input[name*="email"]`, `input[name*="login"]`, `input[id*="user"]`, `input[id*="email"]`
  - パスワードフィールド: `input[type="password"]`
  - 送信ボタン: `button[type="submit"]`, `input[type="submit"]`, `form button`（フォーム内の最後のボタン）
- **Implications**: ヒューリスティックベースの検出アルゴリズムを実装し、複数候補がある場合はユーザーに選択させる

### 既存コードベースの統合ポイント
- **Context**: 新機能を既存アーキテクチャにどのように統合するか
- **Sources Consulted**: プロジェクトコードベース分析
- **Findings**:
  - フロントエンド: `AuthSettings.tsx`の`config.type === 'form'`セクションを拡張
  - バックエンド: `server/auth/`に新しいモジュール`form-analyzer.ts`を追加
  - API: `server/routes/auth.ts`に`/api/auth/analyze-form`エンドポイントを追加
  - 型定義: `server/auth/types.ts`に解析結果用の型を追加
- **Implications**: 既存パターンに従い、最小限の変更で機能追加が可能

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Backend Analysis | サーバーサイドでPlaywrightを使用してフォーム解析 | 既存インフラ活用、headlessで高速 | サーバーリソース消費 | 採用 |
| Frontend Analysis | クライアント側でフォーム解析 | サーバー負荷なし | CORS制約、セキュリティ問題 | 不採用 |

## Design Decisions

### Decision: バックエンドでのPlaywrightベースフォーム解析
- **Context**: ログインページのフォーム要素を自動検出する必要がある
- **Alternatives Considered**:
  1. フロントエンドでiframe経由での解析 - CORSとセキュリティ制約で不可
  2. バックエンドでPlaywrightを使用 - 既存インフラを活用可能
- **Selected Approach**: バックエンドでPlaywright headlessブラウザを使用してフォーム要素を解析
- **Rationale**: 既存の認証実行ロジック（`manager.ts`）と同じアプローチで一貫性を保持
- **Trade-offs**: サーバーリソースを消費するが、信頼性と正確性が高い
- **Follow-up**: 解析タイムアウトとエラーハンドリングの実装

### Decision: ヒューリスティックベースのフォーム要素検出
- **Context**: 様々なログインフォームの構造に対応する必要がある
- **Selected Approach**: 複数のセレクタパターンを優先順位付きで試行
- **Rationale**: 一般的なログインフォームのパターンをカバー
- **Trade-offs**: 非標準的なフォームでは検出失敗の可能性があるが、手動フォールバックで対応

## Risks & Mitigations
- フォーム検出失敗 → 手動設定モードへのフォールバック提供
- ページアクセスタイムアウト → 適切なタイムアウト設定とリトライオプション
- 動的ロードコンテンツ → ページ読み込み完了後の適切な待機

## References
- [Playwright Page API](https://playwright.dev/docs/api/class-page) - DOM操作とセレクタAPI
- 既存実装: `server/auth/manager.ts` - フォームログイン実行ロジック
