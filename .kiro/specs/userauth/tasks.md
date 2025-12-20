# Implementation Tasks: userauth

## Phase 1: 基盤構築

### Task 1: CryptoService実装

**Description**: AES-256-GCM暗号化・復号化とPBKDF2鍵導出を提供するCryptoServiceモジュールを実装する。

**Requirements Covered**: 4.1, 4.6, 1.5

**Acceptance Criteria**:
- [ ] `encrypt(data, passphrase)` が有効な暗号化結果を返す
- [ ] `decrypt(encryptedData, passphrase)` が元データを正しく復元する
- [ ] PBKDF2-SHA256で310,000反復の鍵導出を実装
- [ ] 暗号化データフォーマット: [64-byte salt][12-byte IV][ciphertext][16-byte authTag]
- [ ] 不正なパスフレーズで復号化失敗時に`invalid_passphrase`エラーを返す
- [ ] 改ざんデータで復号化失敗時に`corrupted_data`エラーを返す
- [ ] パスフレーズをログ・ファイルに出力しない

**Files to Modify**:
- `server/auth/crypto.ts` (新規作成)
- `server/auth/types.ts` (EncryptionResult, DecryptionError型追加)

**Tests to Write**:
- `server/auth/__tests__/crypto.test.ts` (新規作成)
  - 暗号化・復号化往復テスト
  - 不正パスフレーズテスト
  - 改ざんデータテスト
  - 空パスフレーズ拒否テスト

**Depends On**: なし

---

### Task 2: StorageStateManager実装 (P)

**Description**: 暗号化されたセッションファイルの永続化・読み込み・管理を行うStorageStateManagerを実装する。

**Requirements Covered**: 1.4, 2.1, 5.1-5.5, 6.1

**Acceptance Criteria**:
- [ ] `save(sessionName, storageState, passphrase, options)` でセッションを暗号化保存
- [ ] `load(sessionId, passphrase)` でセッションを復号化読み込み
- [ ] `list()` でセッションメタデータ一覧を取得
- [ ] `delete(sessionId)` でセッションを削除
- [ ] セッションインデックス(`server/data/sessions/index.json`)を管理
- [ ] セッションファイル(`server/data/sessions/{id}.enc`)を管理
- [ ] セッション名はドメイン内で一意（重複時`duplicate_name`エラー）
- [ ] SessionMetadataにschemaVersion, createdAt, updatedAt, expiresAtを含める
- [ ] autoDestroyオプションをサポート
- [ ] セッション数上限20を設定

**Files to Modify**:
- `server/auth/storage-state-manager.ts` (新規作成)
- `server/auth/types.ts` (SessionMetadata, SessionOptions, SaveError, LoadError, DeleteError型追加)

**Tests to Write**:
- `server/auth/__tests__/storage-state-manager.test.ts` (新規作成)
  - セッション保存・読み込み往復テスト
  - セッション一覧取得テスト
  - セッション削除テスト
  - 重複名エラーテスト
  - セッション数上限テスト

**Depends On**: Task 1

---

### Task 3: Session Management API実装 (P)

**Description**: セッションのCRUD操作を提供するREST APIエンドポイントを実装する。

**Requirements Covered**: 2.1, 5.1-5.5

**Acceptance Criteria**:
- [ ] `GET /api/sessions` でセッション一覧を取得
- [ ] `POST /api/sessions` でセッションを作成（暗号化保存）
- [ ] `GET /api/sessions/:id` でセッションメタデータを取得
- [ ] `DELETE /api/sessions/:id` でセッションを削除
- [ ] `POST /api/sessions/:id/load` でセッションを復号化読み込み
- [ ] 400: パスフレーズ空、セッション名無効
- [ ] 401: パスフレーズ不正（復号化失敗）
- [ ] 404: セッション存在しない
- [ ] 409: セッション名重複
- [ ] 500: I/Oエラー

**Files to Modify**:
- `server/routes/sessions.ts` (新規作成)
- `server/index.ts` (ルート登録追加)

**Tests to Write**:
- `server/routes/__tests__/sessions.test.ts` (新規作成)
  - 各エンドポイントの正常系テスト
  - 各エラーケースのテスト

**Depends On**: Task 2

---

### Task 4: SessionManagerUIコンポーネント実装 (P)

**Description**: セッション一覧表示・選択・管理のReactコンポーネントを実装する。

**Requirements Covered**: 5.2-5.4, 7.1, 7.4, 7.6

**Acceptance Criteria**:
- [ ] セッション一覧をドロップダウンで表示
- [ ] セッション選択時に親コンポーネントに通知
- [ ] 各セッションにロックアイコンを表示
- [ ] ホバー時にドメイン、認証タイプ、有効期限をツールチップ表示
- [ ] セッション削除ボタンと確認ダイアログ
- [ ] 認証状態インジケーター（未認証/認証済み/期限切れ）を表示
- [ ] 「ログイン記録」ボタンを表示（開発環境のみ有効）
- [ ] 「再認証」ボタンを表示（期限切れ時）
- [ ] ローディング状態とエラー状態を表示

**Files to Modify**:
- `frontend/src/components/SessionManager.tsx` (新規作成)
- `frontend/src/services/api.ts` (セッションAPI呼び出し追加)
- `frontend/src/types/accessibility.ts` (SessionMetadata, AuthStatus型追加)

**Tests to Write**:
- `frontend/src/components/__tests__/SessionManager.test.tsx` (新規作成)
  - セッション一覧表示テスト
  - セッション選択テスト
  - セッション削除テスト

**Depends On**: Task 3

---

### Task 5: UrlInputとの統合

**Description**: SessionManagerUIをUrlInputコンポーネントに統合し、セッション選択状態を検証リクエストに含める。

**Requirements Covered**: 2.2, 7.5

**Acceptance Criteria**:
- [ ] UrlInputにSessionManagerUIを組み込み
- [ ] セッション選択時にselectedSessionIdを管理
- [ ] 検証開始時にセッションIDとパスフレーズをAPIに送信
- [ ] 既存のAuthSettings（手動認証）との共存
- [ ] 認証方式選択UI（セッション/手動）を提供

**Files to Modify**:
- `frontend/src/components/UrlInput.tsx` (SessionManager統合)
- `frontend/src/services/api.ts` (analyzeStream関数にセッションパラメータ追加)

**Tests to Write**:
- `frontend/src/components/__tests__/UrlInput.test.tsx` (更新)
  - セッション選択状態の管理テスト
  - 認証方式切り替えテスト

**Depends On**: Task 4

---

### Task 6: analyze-streamエンドポイントのセッション対応

**Description**: SSEストリーミングエンドポイントでセッションベースの認証をサポートする。

**Requirements Covered**: 2.2, 2.3, 2.4

**Acceptance Criteria**:
- [ ] リクエストボディまたはクエリからセッションIDとパスフレーズを受け取る
- [ ] StorageStateManagerでセッションを復号化
- [ ] 復号化成功時はstorageStateをPlaywrightコンテキストに適用
- [ ] 復号化失敗時はSSEでエラーイベントを送信
- [ ] 401/403エラー検出時はSSEで`session_expired`イベントを送信
- [ ] 既存のクエリパラメータ認証との後方互換性維持

**Files to Modify**:
- `server/sse-handler.ts` (セッションパース・適用ロジック追加)
- `server/auth/manager.ts` (storageStateからのセッション作成対応)

**Tests to Write**:
- `server/__tests__/sse-handler.test.ts` (更新)
  - セッションベース認証テスト
  - 復号化失敗テスト
  - 401/403エラー検出テスト

**Depends On**: Task 2, Task 3

---

## Phase 2: インタラクティブログイン

### Task 7: InteractiveLoginサービス実装

**Description**: headedブラウザでのユーザー手動ログインとセッションキャプチャを行うInteractiveLoginサービスを実装する。

**Requirements Covered**: 1.1-1.3, 2.5, 3.3, 4.3

**Acceptance Criteria**:
- [ ] `startLogin(loginUrl, options)` でheadedブラウザを起動
- [ ] Chromium headedモード（`headless: false`）で起動
- [ ] 環境変数`ALLOW_HEADED_BROWSER`でheaded許可を制御
- [ ] headless環境では`headless_environment`エラーを返す
- [ ] `captureSession(loginSessionId, sessionName, passphrase)` でstorageStateをキャプチャ
- [ ] キャプチャ後にStorageStateManagerでセッション保存
- [ ] `cancelLogin(loginSessionId)` でブラウザを閉じる
- [ ] 同時に1つのLoginSessionのみアクティブ
- [ ] タイムアウト設定（デフォルト5分）

**Files to Modify**:
- `server/auth/interactive-login.ts` (新規作成)
- `server/auth/types.ts` (LoginSession, LoginOptions, LoginError, CaptureError型追加)

**Tests to Write**:
- `server/auth/__tests__/interactive-login.test.ts` (新規作成)
  - headless環境検出テスト（モック）
  - セッションライフサイクルテスト
  - タイムアウトテスト

**Depends On**: Task 2

---

### Task 8: Interactive Login API実装 (P)

**Description**: インタラクティブログインの開始・キャプチャ・キャンセルを行うAPIエンドポイントを実装する。

**Requirements Covered**: 1.1-1.4

**Acceptance Criteria**:
- [ ] `POST /api/auth/interactive-login` でログインセッション開始
- [ ] `POST /api/auth/capture-session` でセッションキャプチャ
- [ ] `DELETE /api/auth/interactive-login` でログインセッションキャンセル
- [ ] 400: loginUrlが無効
- [ ] 404: ログインセッションが存在しない
- [ ] 503: headedブラウザ環境が利用不可

**Files to Modify**:
- `server/routes/auth.ts` (新規作成またはinteractive-login部分追加)
- `server/index.ts` (ルート登録追加)

**Tests to Write**:
- `server/routes/__tests__/auth.test.ts` (新規作成)
  - 各エンドポイントの正常系テスト
  - 各エラーケースのテスト

**Depends On**: Task 7

---

### Task 9: インタラクティブログインUI実装 (P)

**Description**: ログイン記録ボタン・進行状況表示・完了通知のUIを実装する。

**Requirements Covered**: 7.1-7.3

**Acceptance Criteria**:
- [ ] 「ログイン記録」ボタンでログインURL入力ダイアログを表示
- [ ] ブラウザ起動中は「ブラウザでログインしてください」メッセージ表示
- [ ] 「ログイン完了」ボタンでキャプチャ実行
- [ ] セッション名とパスフレーズ入力ダイアログ
- [ ] 成功時はトースト「ログイン記録完了」表示
- [ ] 失敗時はエラーメッセージ表示
- [ ] キャンセルボタンでブラウザを閉じる
- [ ] 開発環境でのみ「ログイン記録」ボタンを有効化

**Files to Modify**:
- `frontend/src/components/InteractiveLoginDialog.tsx` (新規作成)
- `frontend/src/components/SessionManager.tsx` (ダイアログ統合)
- `frontend/src/services/api.ts` (インタラクティブログインAPI呼び出し追加)

**Tests to Write**:
- `frontend/src/components/__tests__/InteractiveLoginDialog.test.tsx` (新規作成)
  - ダイアログ開閉テスト
  - フォーム入力テスト
  - API呼び出しテスト

**Depends On**: Task 8, Task 4

---

### Task 10: パスフレーズ入力UIコンポーネント

**Description**: セッション読み込み時のパスフレーズ入力ダイアログを実装する。

**Requirements Covered**: 4.1, 2.1

**Acceptance Criteria**:
- [ ] セッション選択時にパスフレーズ入力ダイアログを表示
- [ ] パスワード入力フィールド（表示/非表示切り替え）
- [ ] 「このセッションのパスフレーズを記憶」オプション（sessionStorage）
- [ ] 不正パスフレーズ時はエラーメッセージ表示
- [ ] キャンセルでセッション選択を解除

**Files to Modify**:
- `frontend/src/components/PassphraseDialog.tsx` (新規作成)
- `frontend/src/components/SessionManager.tsx` (ダイアログ統合)

**Tests to Write**:
- `frontend/src/components/__tests__/PassphraseDialog.test.tsx` (新規作成)
  - パスフレーズ入力テスト
  - 表示切り替えテスト
  - 記憶オプションテスト

**Depends On**: Task 4

---

## Phase 3: 統合・最適化

### Task 11: セッション期限切れ検出と再認証フロー

**Description**: セッション期限切れの検出と再認証UIフローを実装する。

**Requirements Covered**: 2.4, 6.3, 7.6

**Acceptance Criteria**:
- [ ] SessionManagerUIで期限切れセッションに警告アイコン表示
- [ ] 401/403エラー時にSSEで`session_expired`イベント受信
- [ ] 「セッション期限切れ - 再ログインしますか？」確認ダイアログ表示
- [ ] 「再認証」ボタンでインタラクティブログインダイアログ表示
- [ ] 再ログイン成功時に既存セッションを更新

**Files to Modify**:
- `frontend/src/components/SessionManager.tsx` (期限切れ表示追加)
- `frontend/src/components/SessionExpiredDialog.tsx` (新規作成)
- `frontend/src/services/api.ts` (SSEイベントハンドリング更新)

**Tests to Write**:
- `frontend/src/components/__tests__/SessionExpiredDialog.test.tsx` (新規作成)
  - ダイアログ表示テスト
  - 再認証フローテスト

**Depends On**: Task 9, Task 6

---

### Task 12: AuthSettingsコンポーネント拡張

**Description**: 既存のAuthSettingsコンポーネントを拡張し、セッション選択オプションを追加する。

**Requirements Covered**: 3.1, 7.5

**Acceptance Criteria**:
- [ ] 認証方式選択に「保存済みセッション」オプション追加
- [ ] 「保存済みセッション」選択時はSessionManager表示
- [ ] 既存のBasic/Form/Bearer/Cookie認証UIを維持
- [ ] 認証方式切り替え時に状態をリセット

**Files to Modify**:
- `frontend/src/components/AuthSettings.tsx` (セッション選択オプション追加)

**Tests to Write**:
- `frontend/src/components/__tests__/AuthSettings.test.tsx` (更新)
  - セッション選択オプションテスト
  - 認証方式切り替えテスト

**Depends On**: Task 4

---

### Task 13: E2Eテストの実装

**Description**: セッション管理機能のE2Eテストを実装する。

**Requirements Covered**: 全要件

**Acceptance Criteria**:
- [ ] セッション作成・読み込み・削除のE2Eフロー
- [ ] 認証済みセッションでのアクセシビリティ検証フロー
- [ ] パスフレーズ入力フロー
- [ ] エラーケースのテスト（不正パスフレーズ等）

**Files to Modify**:
- `tests/session-management.spec.ts` (新規作成)

**Tests to Write**:
- E2Eテストファイル自体

**Depends On**: Task 1-12

---

### Task 14: ドキュメント更新

**Description**: セッション管理機能に関するドキュメントを更新する。

**Requirements Covered**: 全要件

**Acceptance Criteria**:
- [ ] README.mdにセッション管理機能の概要追加
- [ ] API仕様ドキュメント（OpenAPI形式推奨）
- [ ] セキュリティ考慮事項のドキュメント

**Files to Modify**:
- `README.md` (機能説明追加)
- `docs/session-management.md` (新規作成)
- `docs/api-reference.md` (新規作成または更新)

**Tests to Write**: なし

**Depends On**: Task 1-12

---

## Task Dependency Graph

```
Phase 1 (基盤構築):
Task 1 (CryptoService)
    ↓
Task 2 (StorageStateManager) ──────┬───────┐
    ↓                              ↓       ↓
Task 3 (Session API) ─────→ Task 6 (SSE対応)
    ↓
Task 4 (SessionManagerUI)
    ↓
Task 5 (UrlInput統合)

Phase 2 (インタラクティブログイン):
Task 2 ─→ Task 7 (InteractiveLogin)
              ↓
          Task 8 (Interactive API)
              ↓
Task 4 ─→ Task 9 (インタラクティブUI) ←─ Task 8
    ↓
Task 10 (パスフレーズUI)

Phase 3 (統合・最適化):
Task 6, 9 ─→ Task 11 (期限切れ検出)
Task 4 ─→ Task 12 (AuthSettings拡張)
Task 1-12 ─→ Task 13 (E2Eテスト)
Task 1-12 ─→ Task 14 (ドキュメント)
```

## Parallel Execution Groups

以下のタスクは並列実行可能（(P)マーカー付き）:

**Group A** (Task 1完了後):
- Task 2 (StorageStateManager)

**Group B** (Task 2完了後):
- Task 3 (Session API)
- Task 7 (InteractiveLogin)

**Group C** (Task 3完了後):
- Task 4 (SessionManagerUI)
- Task 6 (SSE対応)

**Group D** (Task 4, 7完了後):
- Task 8 (Interactive API)
- Task 10 (パスフレーズUI)

**Group E** (Task 8完了後):
- Task 9 (インタラクティブUI)

**Group F** (Phase 2完了後):
- Task 11 (期限切れ検出)
- Task 12 (AuthSettings拡張)
- Task 13 (E2Eテスト)
- Task 14 (ドキュメント)

## Implementation Priority

| Priority | Tasks | Rationale |
|----------|-------|-----------|
| P0 | Task 1, 2, 3, 4 | 基盤機能、他タスクの前提条件 |
| P1 | Task 5, 6, 7, 8, 9 | コア機能、ユーザー価値提供 |
| P2 | Task 10, 11, 12 | UX改善、エラーハンドリング |
| P3 | Task 13, 14 | 品質保証、ドキュメント |
