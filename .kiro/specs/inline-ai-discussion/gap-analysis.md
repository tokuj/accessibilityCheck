# ギャップ分析: inline-ai-discussion

## 概要

本ドキュメントは、インラインAI対話機能の要件と既存コードベースの間のギャップを分析し、実装アプローチを評価します。

---

## 1. 現状調査

### 1.1 関連する既存アセット

#### フロントエンド (`/frontend/src/`)

| カテゴリ | ファイル | 役割 | 再利用可能性 |
|---------|----------|------|-------------|
| **レポートUI** | `components/ReportSummary.tsx` | レポート全体の表示 | 対話ポイント設置の起点 |
| **スコア表示** | `components/ScoreCard.tsx` | 総合・カテゴリ別スコア | 対話ポイント設置対象 |
| **Lighthouse** | `components/LighthouseScores.tsx` | 4項目のスコア表示 | 対話ポイント設置対象 |
| **AI総評** | `components/ImprovementList.tsx` | AI総評の詳細表示 | 対話ポイント設置対象 |
| **違反テーブル** | `components/ViolationsTable.tsx` | 違反一覧 | 各行に対話ポイント設置 |
| **パステーブル** | `components/PassesTable.tsx` | パス一覧 | 各行に対話ポイント設置 |
| **要確認テーブル** | `components/IncompleteTable.tsx` | 要確認一覧 | 各行に対話ポイント設置 |
| **API通信** | `services/api.ts` | バックエンドAPI呼び出し | パターン再利用可 |
| **型定義** | `types/accessibility.ts` | レポート型定義 | 拡張可 |
| **ストレージ** | `utils/form-login-storage.ts` | localStorage管理 | パターン参考可（sessionStorage版を新規作成） |

#### バックエンド (`/server/`)

| カテゴリ | ファイル | 役割 | 再利用可能性 |
|---------|----------|------|-------------|
| **エントリ** | `index.ts` | Expressサーバー、ルート登録 | 新規ルート追加箇所 |
| **Gemini** | `services/gemini.ts` | Gemini API呼び出し | **高い**: プロンプト生成ロジックを参考に新関数追加 |
| **型定義** | `analyzers/types.ts` | RuleResult, AISummary型 | 拡張可 |
| **ルート** | `routes/auth.ts`, `routes/sessions.ts` | 既存APIルート | パターン参考可 |

### 1.2 既存の規約・パターン

#### UIパターン
- **MUI使用**: `@mui/material`のコンポーネント（Dialog, Popover, Chip, Table等）
- **コンポーネント構成**: 機能単位でPascalCase命名
- **状態管理**: React hooks（useState, useCallback, useMemo）
- **ダイアログ**: 既存でDialog使用例あり（`InteractiveLoginDialog.tsx`, `PassphraseDialog.tsx`）

#### API通信パターン
- **fetch使用**: AbortSignal.timeoutでタイムアウト管理
- **エラーハンドリング**: ApiErrorクラスで型付きエラー
- **SSE**: EventSourceでストリーミング対応済み

#### ストレージパターン
- **localStorage**: `form-login-storage.ts`でCRUD操作の参考実装あり
- **sessionStorage**: **未使用** → 新規実装必要

### 1.3 統合ポイント

| 統合箇所 | 詳細 |
|---------|------|
| **Geminiサービス** | 既存の`GeminiService.generateAISummary`を参考に、対話用の新関数`generateChatResponse`を追加 |
| **APIエンドポイント** | `server/index.ts`に`POST /api/chat`ルートを追加 |
| **型定義** | フロントエンド・バックエンド両方に新しい型（ChatRequest, ChatResponse, ContextType等）を追加 |

---

## 2. 要件実現可能性分析

### 2.1 技術要件マッピング

| 要件 | 必要な技術 | 既存アセット | ギャップ |
|------|-----------|-------------|---------|
| **Req 1: インラインUI** | MUI Popover | Dialog使用例あり | **Missing**: Popover使用例なし、新規コンポーネント必要 |
| **Req 2: コンテキスト付き対話** | API, プロンプト生成 | GeminiService | **Extend**: 対話用プロンプトビルダー追加 |
| **Req 3: 履歴管理** | sessionStorage | localStorage例あり | **Missing**: sessionStorage管理ユーティリティ |
| **Req 4: 対話ポイント** | コンポーネント拡張 | 各コンポーネント | **Extend**: 各コンポーネントにアイコン追加 |
| **Req 5: ローディング/エラー** | UI状態管理 | 既存パターンあり | **Low Gap**: 既存パターン適用可 |
| **Req 6: アクセシビリティ** | ARIA属性, キーボード | 既存Dialog参考 | **Extend**: Popover用にカスタム実装 |
| **Req 7: バックエンドAPI** | Express, Gemini | 既存ルート | **Missing**: /api/chatエンドポイント |
| **Req 8: Spindleマッピング** | データマッピング | なし | **Missing**: WCAG→Spindle URLマッピングデータ |
| **Req 9: プロンプト** | プロンプトテンプレート | buildPrompt参考 | **Missing**: 対話用テンプレート |

### 2.2 複雑度シグナル

| 項目 | 複雑度 | 理由 |
|------|--------|------|
| **UIコンポーネント** | 中 | MUI Popoverは初使用だが、Dialog経験あり |
| **対話ポイント設置** | 中-高 | 7コンポーネントへの修正、個別項目への設置 |
| **Spindleマッピング** | 中 | 手動でマッピングデータ作成が必要 |
| **プロンプトエンジニアリング** | 中 | 既存実装を参考にできる |
| **sessionStorage管理** | 低 | localStorage実装を参考に容易 |

### 2.3 要調査項目（Research Needed）

1. **Spindleサイト構造**: WCAG基準・ルールIDに対応するページURLの特定
2. **MUI Popoverアクセシビリティ**: フォーカストラップ、Escape閉じ、aria属性の実装詳細
3. **axe-core全ルールID一覧**: マッピングデータ作成用

---

## 3. 実装アプローチ選択肢

### Option A: 既存コンポーネント拡張

**概要**: 各コンポーネント（ScoreCard, ViolationsTable等）に直接対話機能を埋め込む

**変更ファイル**:
- `ScoreCard.tsx` - 対話ポイント追加
- `LighthouseScores.tsx` - 対話ポイント追加
- `ImprovementList.tsx` - 対話ポイント追加
- `ViolationsTable.tsx` - 対話ポイント追加
- `PassesTable.tsx` - 対話ポイント追加
- `IncompleteTable.tsx` - 対話ポイント追加

**トレードオフ**:
- ✅ 既存コンポーネントと密結合、コンテキスト受け渡しが容易
- ❌ 各コンポーネントが肥大化
- ❌ 対話ロジックが分散、テストが複雑化
- ❌ 単一責任原則違反

### Option B: 新規コンポーネント作成

**概要**: 対話機能を独立したコンポーネント群として作成し、既存コンポーネントから利用

**新規ファイル**:
- `components/AIChatPopover.tsx` - ポップオーバーUI（共通）
- `components/AIChatButton.tsx` - 対話ボタン（コンテキスト付き）
- `hooks/useAIChat.ts` - 対話状態管理カスタムフック
- `hooks/useChatHistory.ts` - 履歴管理カスタムフック
- `services/chat-api.ts` - チャットAPI呼び出し
- `utils/chat-storage.ts` - sessionStorage管理
- `server/routes/chat.ts` - バックエンドAPIルート
- `server/services/chat-prompt.ts` - 対話用プロンプトビルダー
- `server/data/spindle-mapping.ts` - SpindleURLマッピング

**既存ファイル修正**:
- 各コンポーネントにAIChatButtonをラップして追加（最小限の変更）

**トレードオフ**:
- ✅ 関心の分離が明確
- ✅ 独立してテスト可能
- ✅ 再利用性が高い
- ❌ ファイル数増加
- ❌ インターフェース設計が必要

### Option C: ハイブリッドアプローチ（推奨）

**概要**: 共通コンポーネント・フックを新規作成し、既存コンポーネントへの統合は段階的に実施

**Phase 1: 基盤構築**
- 対話ポップオーバー、API、プロンプトビルダーを新規作成
- ViolationsTableのみ先行実装

**Phase 2: 横展開**
- 他コンポーネント（ScoreCard, LighthouseScores等）に展開
- Spindleマッピングデータ拡充

**Phase 3: 改善**
- ユーザーフィードバックを元に調整
- プロンプト最適化

**トレードオフ**:
- ✅ リスク分散、段階的な検証
- ✅ 柔軟性（問題発見時に軌道修正可能）
- ❌ 計画・調整が必要
- ❌ フェーズ間で一時的な不整合

---

## 4. 工数・リスク評価

### 工数見積もり

| 項目 | 工数 | 根拠 |
|------|------|------|
| **全体** | **L（1〜2週間）** | 7コンポーネント修正、新規API、マッピングデータ作成 |

**内訳**:
- フロントエンド基盤（Popover, hooks）: M（3-5日）
- バックエンドAPI・プロンプト: S（2-3日）
- Spindleマッピングデータ: S（1-2日）
- 各コンポーネント統合: M（3-5日）
- テスト・調整: S（2-3日）

### リスク評価

| リスク | レベル | 対策 |
|--------|--------|------|
| **Spindleマッピング不完全** | 中 | フォールバックURLを用意、段階的に拡充 |
| **Popoverアクセシビリティ** | 中 | MUI公式ドキュメント・既存Dialog実装を参考 |
| **AIハルシネーション** | 中 | プロンプトで「推測禁止」指示、参照元必須 |
| **パフォーマンス** | 低 | 対話ポイント数は有限、遅延読み込み検討 |

---

## 5. 設計フェーズへの推奨事項

### 推奨アプローチ

**Option C（ハイブリッド）** を推奨

**理由**:
1. 新規コンポーネント群で対話機能を独立させることで、テスト容易性・保守性を確保
2. 段階的な実装で、早期にフィードバックを得られる
3. 既存コンポーネントへの変更を最小限に抑えられる

### キー設計決定

1. **AIChatButtonコンポーネント**: コンテキスト（type, ruleId, wcagCriteria, data）をpropsで受け取り、統一的なUI提供
2. **useAIChatフック**: API呼び出し、ローディング状態、エラー処理をカプセル化
3. **SpindleマッピングJSON**: `server/data/spindle-mapping.json`で管理、動的に拡張可能

### 調査継続項目

1. **Spindleサイト構造の詳細調査**: WCAG基準ごとのページURL特定
2. **MUI Popoverのフォーカス管理**: aria-modal, フォーカストラップ実装方法
3. **Gemini応答の文字数制御**: 300文字以内で有用な回答を得るためのプロンプト調整

---

## 出力チェックリスト

- [x] 要件-アセットマップ（ギャップタグ付き）
- [x] Option A/B/C のトレードオフ
- [x] 工数（L）とリスク（中）の根拠
- [x] 設計フェーズへの推奨事項
