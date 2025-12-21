# セッションセキュリティ強化 タスク一覧

## Phase 1: 必須改善（優先度: 高）

### Task 1: レート制限の実装
- [ ] **1.1** セッションロードAPIにレート制限ミドルウェアを追加
  - 1分あたり5回の復号試行制限
  - IPアドレス + ユーザーエージェント単位で制限
- [ ] **1.2** 指数バックオフの実装
  - 失敗後は1秒、2秒、4秒...と遅延を増加
  - 最大遅延は30秒
- [ ] **1.3** レート制限のテスト作成
  - ユニットテスト: 制限到達時の429エラー
  - 統合テスト: バックオフ動作の検証

**対象ファイル:**
- `server/routes/sessions.ts`
- `server/middleware/rate-limit.ts` (新規)
- `server/routes/__tests__/sessions-rate-limit.test.ts` (新規)

**要件:** 1.1

---

### Task 2: セッション有効期限の強制
- [ ] **2.1** SessionMetadataにlastUsedAtフィールドを追加
- [ ] **2.2** セッション読み込み時に有効期限をチェック
  - expiresAtを過ぎていたらエラーを返す
  - lastUsedAtから30日以上経過していたら警告または再キャプチャ要求
- [ ] **2.3** セッション使用時にlastUsedAtを更新
- [ ] **2.4** 有効期限チェックのテスト作成

**対象ファイル:**
- `server/auth/types.ts`
- `server/auth/storage-state-manager.ts`
- `server/routes/sessions.ts`
- `server/auth/__tests__/storage-state-manager.test.ts`

**要件:** 1.2

---

### Task 3: メモリ内鍵のゼロ化
- [ ] **3.1** CryptoServiceのencrypt/decryptメソッドで鍵をゼロ化
  - 処理完了後にBuffer.fill(0)を呼び出す
- [ ] **3.2** finallyブロックで確実にゼロ化を実行
- [ ] **3.3** セキュリティテストの作成（鍵がメモリに残らないことを確認）

**対象ファイル:**
- `server/auth/crypto.ts`
- `server/auth/__tests__/crypto.test.ts`

**要件:** 1.3

---

## Phase 2: 推奨改善（優先度: 中）

### Task 4: Argon2idへの移行
- [ ] **4.1** argon2パッケージのインストール
- [ ] **4.2** CryptoServiceにArgon2id鍵導出メソッドを追加
  - パラメータ: m=64MiB, t=2, p=1
- [ ] **4.3** 暗号化時のバージョンプレフィックス追加
  - v1: PBKDF2（レガシー）
  - v2: Argon2id
- [ ] **4.4** 復号時にバージョンを判定し適切なKDFを使用
- [ ] **4.5** 復号成功時に自動で新スキームに再暗号化
- [ ] **4.6** マイグレーションテストの作成

**対象ファイル:**
- `package.json`
- `server/auth/crypto.ts`
- `server/auth/__tests__/crypto-migration.test.ts` (新規)

**要件:** 2.1

---

### Task 5: AAD（追加認証データ）の追加
- [ ] **5.1** encrypt/decryptメソッドにAADパラメータを追加
- [ ] **5.2** AADにバージョン番号とセッションIDを含める
- [ ] **5.3** AAD不一致時の復号失敗テスト

**対象ファイル:**
- `server/auth/crypto.ts`
- `server/auth/storage-state-manager.ts`
- `server/auth/__tests__/crypto.test.ts`

**要件:** 2.2

---

### Task 6: 監査ログの実装
- [ ] **6.1** AuditLoggerサービスの作成
  - ログ内容: ユーザーID、タイムスタンプ、IPアドレス（マスク済み）、操作、結果
- [ ] **6.2** セッションAPI各エンドポイントにログ出力を追加
- [ ] **6.3** Cloud Loggingへの出力設定
- [ ] **6.4** 監査ログのテスト

**対象ファイル:**
- `server/services/audit-logger.ts` (新規)
- `server/routes/sessions.ts`
- `server/services/__tests__/audit-logger.test.ts` (新規)

**要件:** 2.3

---

## Phase 3: 将来対応（優先度: 低）

### Task 7: メタデータ暗号化
- [ ] **7.1** index.jsonの機密フィールド（domain等）を暗号化
- [ ] **7.2** メタデータ読み込み時に復号
- [ ] **7.3** 既存データのマイグレーション

**対象ファイル:**
- `server/auth/storage-state-manager.ts`
- `server/auth/types.ts`

**要件:** 3.1

---

### Task 8: Cloud Storage永続ストレージへの移行
- [ ] **8.1** Cloud Storage クライアントの設定
- [ ] **8.2** StorageStateManagerをCloud Storage対応に変更
- [ ] **8.3** IAM設定とアクセス制御
- [ ] **8.4** ローカル開発環境用のフォールバック

**対象ファイル:**
- `server/auth/storage-state-manager.ts`
- `server/auth/storage-backends/` (新規ディレクトリ)

**要件:** 3.2

---

### Task 9: MFAゲートの実装
- [ ] **9.1** MFA認証フローの設計
- [ ] **9.2** セッション使用前にMFA検証を要求
- [ ] **9.3** MFA設定UIの追加

**対象ファイル:**
- `server/auth/mfa/` (新規ディレクトリ)
- `frontend/src/components/MfaDialog.tsx` (新規)

**要件:** 3.3
