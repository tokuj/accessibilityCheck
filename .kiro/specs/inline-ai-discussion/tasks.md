# Implementation Tasks: inline-ai-discussion

## Overview

本タスクリストは、インラインAI対話機能の実装を段階的に進めるためのチェックリストです。各タスクはTDD（テスト駆動開発）手法に従い、テストファーストで実装します。

### Task Execution Guidelines

- 各タスクは「テスト作成 → 実装 → リファクタリング」のサイクルで進める
- (P)マーカーのタスクは並列実行可能
- 依存関係のあるタスクは順次実行
- 各タスクの完了後、関連するE2Eテストで動作確認

---

## Phase 1: 基盤コンポーネント

### Task 1.1: sessionStorageユーティリティ実装 (P)

**Requirements Covered**: 3.1, 3.4, 3.5

**File**: `frontend/src/utils/chat-storage.ts`

**Acceptance Criteria**:

- [ ] 1.1.1: `generateContextKey(context: ChatContext): string`関数を実装し、コンテキストから一意のキーを生成する
- [ ] 1.1.2: `getHistory(contextKey: string): ChatHistoryEntry[]`関数を実装し、sessionStorageから履歴を取得する
- [ ] 1.1.3: `saveHistory(contextKey: string, history: ChatHistoryEntry[]): void`関数を実装し、履歴を保存する
- [ ] 1.1.4: 履歴が20件を超える場合、古いエントリから削除する機能を実装
- [ ] 1.1.5: キー名は`a11y_chat_history_{contextKey}`形式とする
- [ ] 1.1.6: 単体テストで全関数の動作を検証

**Tests**:

```typescript
// frontend/src/utils/chat-storage.test.ts
describe('chat-storage', () => {
  describe('generateContextKey', () => {
    it('should generate key from type only');
    it('should include ruleId when present');
    it('should include wcagCriteria when present');
  });
  describe('getHistory', () => {
    it('should return empty array when no history');
    it('should return parsed history from sessionStorage');
  });
  describe('saveHistory', () => {
    it('should save history to sessionStorage');
    it('should truncate to 20 entries when exceeding limit');
  });
});
```

---

### Task 1.2: Spindleマッピングデータ実装 (P)

**Requirements Covered**: 8.1, 8.2, 8.3, 8.5

**File**: `server/data/spindle-mapping.ts`

**Acceptance Criteria**:

- [ ] 1.2.1: `SPINDLE_BASE_URL`定数を定義（`https://a11y-guidelines.ameba.design`）
- [ ] 1.2.2: `wcagToSpindleMap: Record<string, string>`でWCAG基準→URLマッピングを定義（主要10基準以上）
- [ ] 1.2.3: `ruleIdToSpindleMap: Record<string, string>`でルールID→URLマッピングを定義（主要15ルール以上）
- [ ] 1.2.4: `getUrlForWcag(criterion: string): string`関数を実装
- [ ] 1.2.5: `getUrlForRuleId(ruleId: string): string`関数を実装
- [ ] 1.2.6: `getUrlForContext(context: ChatContext): string`関数を実装（ruleId優先、なければwcag、なければフォールバック）
- [ ] 1.2.7: マッピングがない場合はフォールバックURL（トップページ）を返却
- [ ] 1.2.8: 単体テストで全関数の動作を検証

**Tests**:

```typescript
// server/data/spindle-mapping.test.ts
describe('SpindleMapping', () => {
  describe('getUrlForWcag', () => {
    it('should return mapped URL for known WCAG criterion');
    it('should return fallback URL for unknown criterion');
  });
  describe('getUrlForRuleId', () => {
    it('should return mapped URL for known rule ID');
    it('should return fallback URL for unknown rule ID');
  });
  describe('getUrlForContext', () => {
    it('should prioritize ruleId over wcagCriteria');
    it('should use wcagCriteria when ruleId not present');
    it('should return fallback when neither present');
  });
});
```

---

### Task 1.3: プロンプトビルダー実装 (P)

**Requirements Covered**: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8

**File**: `server/services/chat-prompt.ts`

**Acceptance Criteria**:

- [ ] 1.3.1: `PromptBuilder`クラスまたは関数を作成
- [ ] 1.3.2: `buildPrompt(context: ChatContext, question: string): BuiltPrompt`関数を実装
- [ ] 1.3.3: 違反（violation）用テンプレートを実装（ルールID、WCAG基準、修正例指示を含む）
- [ ] 1.3.4: スコア（score, lighthouse）用テンプレートを実装（算出根拠、改善アドバイス指示を含む）
- [ ] 1.3.5: WCAG基準（wcag）用テンプレートを実装（達成基準の説明指示を含む）
- [ ] 1.3.6: 改善提案（improvement, recommendation, issue）用テンプレートを実装
- [ ] 1.3.7: 共通指示（日本語、300文字以内、推測禁止、参照URL必須）を全テンプレートに含める
- [ ] 1.3.8: SpindleMappingと連携してreferenceUrlを取得
- [ ] 1.3.9: 単体テストで各タイプのプロンプト生成を検証

**Tests**:

```typescript
// server/services/chat-prompt.test.ts
describe('PromptBuilder', () => {
  describe('buildPrompt', () => {
    it('should generate violation prompt with ruleId and WCAG criteria');
    it('should generate score prompt with improvement advice instruction');
    it('should generate wcag prompt with criterion explanation instruction');
    it('should include common instructions in all prompts');
    it('should include reference URL from SpindleMapping');
  });
});
```

---

### Task 1.4: チャットAPI（バックエンド）実装

**Requirements Covered**: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 2.2, 2.3, 2.4, 2.5, 2.6

**File**: `server/routes/chat.ts`

**Dependencies**: Task 1.2, Task 1.3

**Acceptance Criteria**:

- [ ] 1.4.1: `POST /api/chat`エンドポイントを作成
- [ ] 1.4.2: リクエストボディのバリデーション（context, question必須）を実装
- [ ] 1.4.3: `context.type`が許可リスト（score, lighthouse, violation, pass, incomplete, improvement, recommendation, issue, wcag）に含まれるか検証
- [ ] 1.4.4: PromptBuilderでプロンプトを生成
- [ ] 1.4.5: GeminiServiceの新関数`generateChatResponse`を呼び出し
- [ ] 1.4.6: レスポンス形式`{ answer, referenceUrl, generatedAt }`を返却
- [ ] 1.4.7: タイムアウト（30秒）時は504を返却
- [ ] 1.4.8: レート制限時は429と`retryAfter`を返却
- [ ] 1.4.9: バリデーションエラー時は400を返却
- [ ] 1.4.10: `server/index.ts`にルートを登録
- [ ] 1.4.11: 統合テストでエンドツーエンドフローを検証

**Tests**:

```typescript
// server/routes/chat.test.ts
describe('ChatRouter', () => {
  describe('POST /api/chat', () => {
    it('should return 400 when context is missing');
    it('should return 400 when question is missing');
    it('should return 400 when context.type is invalid');
    it('should return answer with referenceUrl on success');
    it('should return 504 on timeout');
    it('should return 429 with retryAfter on rate limit');
  });
});
```

---

### Task 1.5: GeminiService拡張

**Requirements Covered**: 2.2, 7.5

**File**: `server/services/gemini.ts`

**Dependencies**: Task 1.3

**Acceptance Criteria**:

- [ ] 1.5.1: `generateChatResponse(systemPrompt: string, userPrompt: string): Promise<string>`関数を追加
- [ ] 1.5.2: 既存のタイムアウト設定（30秒）、リトライ設定（3回）を再利用
- [ ] 1.5.3: 既存のエラーハンドリング（GeminiError）を再利用
- [ ] 1.5.4: レート制限エラー時に`retryAfter`情報を含める
- [ ] 1.5.5: 単体テストで成功・エラーケースを検証

**Tests**:

```typescript
// server/services/gemini.test.ts (追加)
describe('GeminiService', () => {
  describe('generateChatResponse', () => {
    it('should return response on success');
    it('should throw GeminiError on timeout');
    it('should throw GeminiError with retryAfter on rate limit');
  });
});
```

---

## Phase 2: フロントエンドコアコンポーネント

### Task 2.1: チャットAPIクライアント実装 (P)

**Requirements Covered**: 2.1

**File**: `frontend/src/services/chat-api.ts`

**Acceptance Criteria**:

- [ ] 2.1.1: `sendChatRequest(request: ChatRequest): Promise<ChatResponse>`関数を実装
- [ ] 2.1.2: 既存のAPI通信パターン（fetch + AbortSignal.timeout）を使用
- [ ] 2.1.3: エラー時はApiErrorをスロー（type: timeout, rate_limit, server, network）
- [ ] 2.1.4: レート制限時は`retryAfter`をエラーに含める
- [ ] 2.1.5: 単体テストでモックAPIを使用して検証

**Tests**:

```typescript
// frontend/src/services/chat-api.test.ts
describe('chat-api', () => {
  describe('sendChatRequest', () => {
    it('should return response on success');
    it('should throw ApiError with type timeout on 504');
    it('should throw ApiError with type rate_limit and retryAfter on 429');
    it('should throw ApiError with type server on 500');
  });
});
```

---

### Task 2.2: useChatHistoryフック実装 (P)

**Requirements Covered**: 3.1, 3.2, 3.3, 3.4, 3.5

**File**: `frontend/src/hooks/useChatHistory.ts`

**Dependencies**: Task 1.1

**Acceptance Criteria**:

- [ ] 2.2.1: `useChatHistory(context: ChatContext)`フックを実装
- [ ] 2.2.2: `history: ChatHistoryEntry[]`を返却（時系列順）
- [ ] 2.2.3: `historyCount: number`を返却
- [ ] 2.2.4: `addEntry(question: string, answer: ChatAnswer): void`関数を返却
- [ ] 2.2.5: `clearHistory(): void`関数を返却
- [ ] 2.2.6: コンテキスト変更時に履歴を再読み込み
- [ ] 2.2.7: 単体テストで全機能を検証

**Tests**:

```typescript
// frontend/src/hooks/useChatHistory.test.ts
describe('useChatHistory', () => {
  it('should return empty history initially');
  it('should add entry to history');
  it('should return correct historyCount');
  it('should reload history when context changes');
  it('should clear history');
});
```

---

### Task 2.3: useAIChatフック実装

**Requirements Covered**: 2.1, 5.1, 5.2, 5.3, 5.4

**File**: `frontend/src/hooks/useAIChat.ts`

**Dependencies**: Task 2.1, Task 2.2

**Acceptance Criteria**:

- [ ] 2.3.1: `useAIChat(context: ChatContext)`フックを実装
- [ ] 2.3.2: `isLoading: boolean`状態を管理
- [ ] 2.3.3: `error: ChatError | null`状態を管理
- [ ] 2.3.4: `lastAnswer: ChatAnswer | null`状態を管理
- [ ] 2.3.5: `sendQuestion(question: string): Promise<void>`関数を実装
- [ ] 2.3.6: `retry(): Promise<void>`関数を実装（前回の質問を再送信）
- [ ] 2.3.7: `clearError(): void`関数を実装
- [ ] 2.3.8: 送信成功時にuseChatHistoryの`addEntry`を呼び出し
- [ ] 2.3.9: 単体テストで全状態遷移を検証

**Tests**:

```typescript
// frontend/src/hooks/useAIChat.test.ts
describe('useAIChat', () => {
  it('should set isLoading true while sending');
  it('should set lastAnswer on success');
  it('should set error on failure');
  it('should retry with previous question');
  it('should add entry to history on success');
  it('should clear error');
});
```

---

### Task 2.4: AIChatPopoverコンポーネント実装

**Requirements Covered**: 1.2, 1.3, 1.4, 1.6, 5.1, 5.2, 5.3, 5.4, 5.5, 6.2, 6.3, 6.4, 6.5, 6.6

**File**: `frontend/src/components/AIChatPopover.tsx`

**Dependencies**: Task 2.3

**Acceptance Criteria**:

- [ ] 2.4.1: MUI Popoverを使用してコンポーネントを作成
- [ ] 2.4.2: 質問入力フィールド（TextField）を実装
- [ ] 2.4.3: 送信ボタン（IconButton）を実装
- [ ] 2.4.4: 閉じるボタンを実装
- [ ] 2.4.5: 対話履歴を時系列で表示（ユーザー質問とAI回答を視覚的に区別）
- [ ] 2.4.6: ローディング中はスピナーと「回答を生成中...」を表示
- [ ] 2.4.7: ローディング中は送信ボタンを無効化
- [ ] 2.4.8: エラー時はエラーメッセージと再試行ボタンを表示
- [ ] 2.4.9: 最大幅400px、最大高さ500pxを設定
- [ ] 2.4.10: オーバーフロー時はスクロール可能に設定
- [ ] 2.4.11: 外側クリックで閉じる（`onClose`呼び出し）
- [ ] 2.4.12: Escapeキーで閉じる
- [ ] 2.4.13: 開いた時に入力フィールドにフォーカス
- [ ] 2.4.14: 閉じた時にトリガー要素にフォーカスを戻す（`onClose`で処理）
- [ ] 2.4.15: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`を設定
- [ ] 2.4.16: AI回答に`aria-live="polite"`を設定
- [ ] 2.4.17: 参照URLをリンクとして表示
- [ ] 2.4.18: 単体テストで全UI動作を検証

**Tests**:

```typescript
// frontend/src/components/AIChatPopover.test.tsx
describe('AIChatPopover', () => {
  it('should render input field, send button, and close button');
  it('should display chat history');
  it('should show loading state while sending');
  it('should disable send button while loading');
  it('should show error message and retry button on error');
  it('should close on outside click');
  it('should close on Escape key');
  it('should focus input field when opened');
  it('should have correct ARIA attributes');
  it('should display reference URL as link');
});
```

---

### Task 2.5: AIChatButtonコンポーネント実装

**Requirements Covered**: 1.1, 1.5, 6.1, 4.12

**File**: `frontend/src/components/AIChatButton.tsx`

**Dependencies**: Task 2.4

**Acceptance Criteria**:

- [ ] 2.5.1: ホバー時にコメントアイコン（CommentIcon）を表示
- [ ] 2.5.2: クリックでAIChatPopoverを開閉
- [ ] 2.5.3: 対話履歴がある場合はバッジ（Badge）で件数を表示
- [ ] 2.5.4: キーボードフォーカス可能（tabIndex=0）
- [ ] 2.5.5: Enterキーで開閉
- [ ] 2.5.6: `aria-label="この項目についてAIに質問する"`を設定
- [ ] 2.5.7: `aria-expanded`と`aria-controls`を設定
- [ ] 2.5.8: `size`プロパティ（small/medium）に対応
- [ ] 2.5.9: Popover閉じた時にフォーカスを戻す
- [ ] 2.5.10: 単体テストで全動作を検証

**Tests**:

```typescript
// frontend/src/components/AIChatButton.test.tsx
describe('AIChatButton', () => {
  it('should show icon on hover');
  it('should open popover on click');
  it('should close popover on second click');
  it('should show badge with history count');
  it('should be keyboard focusable');
  it('should open/close on Enter key');
  it('should have correct aria-label');
  it('should have correct aria-expanded and aria-controls');
  it('should return focus on popover close');
});
```

---

## Phase 3: コンポーネント統合

### Task 3.1: ScoreCard統合

**Requirements Covered**: 4.1, 4.2

**File**: `frontend/src/components/ScoreCard.tsx`

**Dependencies**: Task 2.5

**Acceptance Criteria**:

- [ ] 3.1.1: 総合スコア表示部にAIChatButtonを追加
- [ ] 3.1.2: 各カテゴリ別スコア（WCAG基準別）にAIChatButtonを追加
- [ ] 3.1.3: コンテキストに`type: 'score'`と該当データを設定
- [ ] 3.1.4: 既存のスタイルを崩さない配置
- [ ] 3.1.5: 統合テストで対話フローを検証

---

### Task 3.2: LighthouseScores統合

**Requirements Covered**: 4.3

**File**: `frontend/src/components/LighthouseScores.tsx`

**Dependencies**: Task 2.5

**Acceptance Criteria**:

- [ ] 3.2.1: Performance行にAIChatButtonを追加
- [ ] 3.2.2: Accessibility行にAIChatButtonを追加
- [ ] 3.2.3: Best Practices行にAIChatButtonを追加
- [ ] 3.2.4: SEO行にAIChatButtonを追加
- [ ] 3.2.5: コンテキストに`type: 'lighthouse'`と該当スコアデータを設定
- [ ] 3.2.6: 統合テストで対話フローを検証

---

### Task 3.3: ImprovementList統合

**Requirements Covered**: 4.4, 4.5, 4.6, 4.7

**File**: `frontend/src/components/ImprovementList.tsx`

**Dependencies**: Task 2.5

**Acceptance Criteria**:

- [ ] 3.3.1: 全体評価（overallAssessment）にAIChatButtonを追加
- [ ] 3.3.2: 各優先改善ポイント項目にAIChatButtonを追加（`type: 'improvement'`）
- [ ] 3.3.3: 各具体的な推奨事項にAIChatButtonを追加（`type: 'recommendation'`）
- [ ] 3.3.4: 各検出問題（detectedIssue）にAIChatButtonを追加（`type: 'issue'`）
- [ ] 3.3.5: 各項目のコンテキストに該当データを設定
- [ ] 3.3.6: 統合テストで対話フローを検証

---

### Task 3.4: ViolationsTable統合

**Requirements Covered**: 4.8, 4.11

**File**: `frontend/src/components/ViolationsTable.tsx`

**Dependencies**: Task 2.5

**Acceptance Criteria**:

- [ ] 3.4.1: 各違反行にAIChatButtonを追加
- [ ] 3.4.2: コンテキストに`type: 'violation'`、`ruleId`、`wcagCriteria`を設定
- [ ] 3.4.3: WCAG基準表示部分に個別のAIChatButtonを追加（`type: 'wcag'`）
- [ ] 3.4.4: テーブルレイアウトを崩さない配置
- [ ] 3.4.5: 統合テストで対話フローを検証

---

### Task 3.5: PassesTable統合 (P)

**Requirements Covered**: 4.9

**File**: `frontend/src/components/PassesTable.tsx`

**Dependencies**: Task 2.5

**Acceptance Criteria**:

- [ ] 3.5.1: 各パス行にAIChatButtonを追加
- [ ] 3.5.2: コンテキストに`type: 'pass'`、`ruleId`を設定
- [ ] 3.5.3: テーブルレイアウトを崩さない配置
- [ ] 3.5.4: 統合テストで対話フローを検証

---

### Task 3.6: IncompleteTable統合 (P)

**Requirements Covered**: 4.10

**File**: `frontend/src/components/IncompleteTable.tsx`

**Dependencies**: Task 2.5

**Acceptance Criteria**:

- [ ] 3.6.1: 各要確認行にAIChatButtonを追加
- [ ] 3.6.2: コンテキストに`type: 'incomplete'`、`ruleId`を設定
- [ ] 3.6.3: テーブルレイアウトを崩さない配置
- [ ] 3.6.4: 統合テストで対話フローを検証

---

## Phase 4: E2Eテスト・仕上げ

### Task 4.1: E2Eテスト作成

**Requirements Covered**: 全要件

**File**: `tests/e2e/ai-chat.spec.ts`

**Dependencies**: Phase 1-3完了

**Acceptance Criteria**:

- [ ] 4.1.1: 違反行での対話フロー（ホバー→クリック→質問入力→送信→回答表示→閉じる）をテスト
- [ ] 4.1.2: スコア項目での対話フローをテスト
- [ ] 4.1.3: 履歴の保持と再表示をテスト
- [ ] 4.1.4: エラー時の再試行フローをテスト
- [ ] 4.1.5: キーボードナビゲーション（Tab, Enter, Escape）をテスト
- [ ] 4.1.6: 複数対話ポイント間の遷移をテスト

---

### Task 4.2: アクセシビリティテスト

**Requirements Covered**: 6.1-6.6

**File**: `tests/accessibility/ai-chat-a11y.spec.ts`

**Dependencies**: Phase 1-3完了

**Acceptance Criteria**:

- [ ] 4.2.1: axe-coreでAIChatButton、AIChatPopoverの自動テスト
- [ ] 4.2.2: ARIA属性の正確性を検証
- [ ] 4.2.3: フォーカス管理（開閉時のフォーカス移動）を検証
- [ ] 4.2.4: スクリーンリーダー用の`aria-live`通知を検証

---

### Task 4.3: ドキュメント更新

**Requirements Covered**: -

**File**: `docs/features/ai-chat.md`（新規）

**Dependencies**: Phase 1-3完了

**Acceptance Criteria**:

- [ ] 4.3.1: 機能概要の記載
- [ ] 4.3.2: 使用方法の記載
- [ ] 4.3.3: 対話ポイント一覧の記載
- [ ] 4.3.4: Spindleマッピングの拡充方法の記載
- [ ] 4.3.5: トラブルシューティングの記載

---

## Summary

| Phase | Tasks | Parallel (P) |
|-------|-------|--------------|
| Phase 1: 基盤 | 1.1-1.5 | 1.1, 1.2, 1.3 |
| Phase 2: フロントエンドコア | 2.1-2.5 | 2.1, 2.2 |
| Phase 3: 統合 | 3.1-3.6 | 3.5, 3.6 |
| Phase 4: E2E・仕上げ | 4.1-4.3 | - |

**Total Tasks**: 17

**Estimated Effort**: L（1-2週間）

---

## Dependencies Graph

```mermaid
graph TD
    T1.1[1.1 chat-storage]
    T1.2[1.2 SpindleMapping]
    T1.3[1.3 PromptBuilder]
    T1.4[1.4 ChatRouter]
    T1.5[1.5 GeminiService]
    T2.1[2.1 chat-api]
    T2.2[2.2 useChatHistory]
    T2.3[2.3 useAIChat]
    T2.4[2.4 AIChatPopover]
    T2.5[2.5 AIChatButton]
    T3.1[3.1 ScoreCard]
    T3.2[3.2 LighthouseScores]
    T3.3[3.3 ImprovementList]
    T3.4[3.4 ViolationsTable]
    T3.5[3.5 PassesTable]
    T3.6[3.6 IncompleteTable]
    T4.1[4.1 E2Eテスト]
    T4.2[4.2 a11yテスト]
    T4.3[4.3 ドキュメント]

    T1.2 --> T1.3
    T1.3 --> T1.4
    T1.3 --> T1.5
    T1.5 --> T1.4
    T1.1 --> T2.2
    T1.4 --> T2.1
    T2.1 --> T2.3
    T2.2 --> T2.3
    T2.3 --> T2.4
    T2.4 --> T2.5
    T2.5 --> T3.1
    T2.5 --> T3.2
    T2.5 --> T3.3
    T2.5 --> T3.4
    T2.5 --> T3.5
    T2.5 --> T3.6
    T3.1 --> T4.1
    T3.2 --> T4.1
    T3.3 --> T4.1
    T3.4 --> T4.1
    T3.5 --> T4.1
    T3.6 --> T4.1
    T4.1 --> T4.2
    T4.1 --> T4.3
```
