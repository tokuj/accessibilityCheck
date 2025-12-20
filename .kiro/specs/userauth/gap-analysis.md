# Gap Analysis: userauth

## 1. 現状調査

### 1.1 既存の認証関連コンポーネント

| ファイル | 役割 | 詳細 |
|---------|------|------|
| `server/auth/manager.ts` | 認証マネージャー | AuthManagerクラス、createAuthSession関数、Cookie/Basic/Bearer/Form認証に対応 |
| `server/auth/types.ts` | 認証型定義 | AuthType, AuthConfig, AuthSession, Cookie, StorageState, AuthResult |
| `frontend/src/components/AuthSettings.tsx` | 認証設定ダイアログ | 手動入力UI（Cookie、Bearer Token、Basic認証、フォームログイン） |
| `frontend/src/components/UrlInput.tsx` | URL入力・認証ボタン | 認証設定ダイアログの開閉、AuthConfigの管理 |
| `frontend/src/types/accessibility.ts` | フロントエンド型定義 | AuthType, AuthConfig（server/auth/types.tsと重複） |
| `frontend/src/services/api.ts` | API通信 | SSEストリーミング、認証パラメータのクエリ文字列渡し |
| `server/sse-handler.ts` | SSEハンドラー | parseAuthFromQuery関数で認証パラメータをパース |

### 1.2 既存パターン・アーキテクチャ

- **認証情報の流れ**: フロントエンド → クエリパラメータ → バックエンド → Playwrightコンテキスト
- **storageState活用**: `server/auth/manager.ts:168`でPlaywrightの`context.storageState()`を使用済み
- **認証方式の抽象化**: AuthManagerがFactory/Strategyパターンで認証方式を統一的に扱う
- **Secret Manager統合**: `server/services/secret-manager.ts`でGCP Secret Managerとの統合が既に存在
- **SSE通信**: リアルタイム進捗表示のSSE基盤が構築済み

### 1.3 統合サーフェス

| カテゴリ | 既存コンポーネント | 統合ポイント |
|---------|------------------|-------------|
| データモデル | `AuthConfig`, `StorageState`, `AuthSession` | 拡張が必要（暗号化、セッション名、有効期限） |
| API | `/api/analyze-stream` (SSE) | 新規エンドポイント追加が必要 |
| フロントエンド | `AuthSettings.tsx`, `UrlInput.tsx` | 大幅な拡張または新規コンポーネント |
| バックエンド | `AuthManager`, `sse-handler.ts` | インタラクティブログイン機能の追加 |

---

## 2. 要件から導出される技術ニーズ

### 2.1 Requirement別の技術要件

| Req # | 要件 | 必要な技術 | 既存資産 | ギャップ |
|-------|------|-----------|---------|---------|
| 1 | インタラクティブログイン記録 | Headedブラウザ起動、ユーザー操作待ち、storageState保存 | `AuthManager.performFormLogin`（ヘッドレス） | ブラウザ表示・ユーザー操作待機が未実装 |
| 2 | セッション再利用 | storageState読み込み、復号化 | `context.storageState()`使用済み | ファイル永続化・暗号化が未実装 |
| 3 | 複数認証方式 | Basic/Form/OAuth/SSO対応 | Basic/Form対応済み | OAuth/SSO、localhostコールバック未実装 |
| 4 | セキュア管理 | AES-256暗号化、OSキーチェーン | なし | 全て新規実装 |
| 5 | セッションプリセット | 複数セッション保存、メタデータ管理 | なし | 全て新規実装 |
| 6 | ライフサイクル管理 | トークンリフレッシュ、並列ワーカー分離 | なし | 全て新規実装 |
| 7 | UI | 認証状態表示、ワンクリックログイン | `AuthSettings.tsx`（手動入力のみ） | インタラクティブUI未実装 |

### 2.2 非機能要件

| 項目 | 要件 | 現状 |
|------|------|------|
| セキュリティ | 認証情報の暗号化保存 | 未対応（メモリ/クエリパラメータのみ） |
| セキュリティ | OSキーチェーン統合 | 未対応 |
| セキュリティ | 生パスワード非保存 | 部分的対応（formログイン時のみ） |
| パフォーマンス | 並列ワーカー分離 | 未対応 |
| 信頼性 | セッション期限切れ検出・自動リフレッシュ | 未対応 |

---

## 3. ギャップ識別

### 3.1 Missing（欠落）

| 機能 | 説明 | 優先度 |
|------|------|--------|
| **インタラクティブブラウザ起動** | ヘッドモードでブラウザを起動し、ユーザーの操作を待機する機能 | 高 |
| **ストレージステート永続化** | storageStateをファイルとして暗号化保存する機能 | 高 |
| **AES-256暗号化** | ストレージファイルの暗号化・復号化 | 高 |
| **OSキーチェーン統合** | macOS Keychain / Windows DPAPI / Linux libsecret | 高 |
| **セッションプリセットUI** | 複数セッションの管理・切り替えUI | 中 |
| **OAuth/OIDCフロー** | システムブラウザ + localhostコールバック | 中 |
| **トークンリフレッシュ** | OAuth/OIDCトークンの自動更新 | 低 |
| **並列ワーカー分離** | マスターストレージのワーカーごとコピー | 低 |

### 3.2 Unknown（要調査）

| 項目 | 調査内容 | 調査方法 |
|------|---------|---------|
| **OSキーチェーンライブラリ** | Node.js向けキーチェーン統合ライブラリの選定 | npm調査（keytar, node-keychain等） |
| **ヘッドブラウザのUX** | ガイダンスバナーの表示方法（Playwright拡張機能？） | Playwright API調査 |
| **フロントエンド ↔ バックエンド通信** | ブラウザ起動〜ログイン完了の通知方法 | WebSocket / SSE / ポーリング比較 |
| **企業SSO対応** | SAML/Azure AD対応のベストプラクティス | セキュリティ資料調査 |
| **並列実行時の分離** | Playwrightのワーカーごとコンテキスト管理 | Playwright並列実行ドキュメント調査 |

### 3.3 Constraint（制約）

| 制約 | 影響 | 対応 |
|------|------|------|
| **現行AuthManagerの設計** | headlessモード前提のため、headedモード対応に改修が必要 | 既存コードの拡張 |
| **クエリパラメータによる認証情報送信** | URLにパスワードが含まれるセキュリティリスク | 新しいAPI設計が必要 |
| **Cloud Run環境** | ヘッドブラウザ表示不可（サーバー側）、OSキーチェーンなし | クライアントサイド実装が必須 |
| **GCPデプロイ** | Secret Managerは既に統合済みで活用可能 | 継続利用 |

---

## 4. 実装アプローチオプション

### Option A: 既存コンポーネント拡張

**対象ファイル**:
- `server/auth/manager.ts`: インタラクティブログイン機能追加
- `server/auth/types.ts`: 型拡張（セッション名、有効期限、暗号化フラグ）
- `frontend/src/components/AuthSettings.tsx`: インタラクティブログインUI追加
- `server/index.ts`: 新規エンドポイント追加

**評価**:
- ✅ 既存パターンを踏襲、学習コスト低
- ✅ 新規ファイル最小限
- ❌ AuthManagerが複雑化するリスク
- ❌ ファイルサイズ増大

### Option B: 新規コンポーネント作成

**新規ファイル**:
- `server/auth/interactive-login.ts`: インタラクティブログイン専用モジュール
- `server/auth/storage-state-manager.ts`: ストレージステート永続化・暗号化
- `server/auth/crypto.ts`: 暗号化ユーティリティ
- `server/auth/keychain.ts`: OSキーチェーン統合（※注: Cloud Runでは使用不可）
- `frontend/src/components/SessionManager.tsx`: セッション管理UI
- `frontend/src/components/InteractiveLogin.tsx`: インタラクティブログインUI

**評価**:
- ✅ 関心の分離が明確
- ✅ テストしやすい
- ✅ AuthManagerの責任範囲を維持
- ❌ ファイル数増加
- ❌ 統合インターフェース設計が必要

### Option C: ハイブリッドアプローチ（推奨）

**戦略**:
1. **Phase 1**: 既存AuthManagerを拡張してインタラクティブログインの基盤を追加
2. **Phase 2**: ストレージステート永続化を新規モジュールとして作成
3. **Phase 3**: フロントエンドUIを新規コンポーネントとして作成

**具体的な分割**:

| フェーズ | 既存拡張 | 新規作成 |
|---------|---------|---------|
| Phase 1 | `AuthManager`にインタラクティブ機能追加 | `server/auth/interactive-login.ts` |
| Phase 2 | `AuthSession`型拡張 | `server/auth/storage-state-manager.ts`, `server/auth/crypto.ts` |
| Phase 3 | `AuthSettings.tsx`に切り替えUI追加 | `SessionManager.tsx`, `InteractiveLoginTrigger.tsx` |

**評価**:
- ✅ 段階的な実装でリスク分散
- ✅ 既存の安定部分を維持しつつ新機能追加
- ✅ フィーチャーフラグによる段階的ロールアウト可能
- ❌ 設計の一貫性維持に注意が必要

---

## 5. 実装規模とリスク

### 5.1 工数見積もり

| 要件 | 工数 | 理由 |
|------|------|------|
| Req 1: インタラクティブログイン記録 | **L** | 新しいUXパターン、ブラウザ↔サーバー通信設計 |
| Req 2: セッション再利用 | **M** | 既存storageState活用、永続化追加 |
| Req 3: 複数認証方式 | **L** | OAuth/SSOは複雑な外部連携 |
| Req 4: セキュア管理 | **M** | 暗号化は標準ライブラリ利用可 |
| Req 5: セッションプリセット | **S** | CRUD + UIのみ |
| Req 6: ライフサイクル管理 | **M** | トークンリフレッシュは外部仕様依存 |
| Req 7: UI | **M** | 既存MUI活用、新規コンポーネント設計 |

**総合工数**: **L〜XL**（2週間以上）

### 5.2 リスク評価

| リスク | レベル | 説明 | 対策 |
|--------|--------|------|------|
| OSキーチェーン統合 | **高** | Cloud Run環境では使用不可、クライアントサイド実装が必要 | クライアントサイドElectron化、またはブラウザベースの代替案 |
| インタラクティブブラウザUX | **中** | ユーザー体験の設計が複雑 | Playwright/Cypressのパターンを参考 |
| OAuth/SSO対応 | **中** | 各IdPの仕様差異が大きい | 主要IdP（Google, Azure AD）に絞って対応 |
| セキュリティ監査 | **中** | 暗号化実装の正確性 | 標準ライブラリ（Node.js crypto）使用、レビュー必須 |

---

## 6. デザインフェーズへの推奨事項

### 6.1 優先アプローチ

**Option C（ハイブリッド）を推奨**

理由:
1. 既存AuthManagerの設計は堅実で拡張に耐えうる
2. 新機能（インタラクティブログイン、ストレージ永続化）は責任範囲が明確に分離できる
3. 段階的実装により、各フェーズでユーザーフィードバックを取得可能

### 6.2 主要な設計決定事項

| 決定事項 | 選択肢 | 推奨 |
|---------|--------|------|
| インタラクティブブラウザの実行場所 | サーバーサイド / クライアントサイド | **クライアントサイド**（Cloud Run制約） |
| OSキーチェーン統合 | keytar / ブラウザWeb Crypto API | **要調査**（実行環境依存） |
| OAuth localhostコールバック | 固定ポート / 動的ポート | 動的ポート（競合回避） |
| ストレージファイル形式 | JSON + AES-256 / SQLite | JSON + AES-256（シンプル） |

### 6.3 調査を継続する項目

1. **クライアントサイドでのPlaywright実行方法**
   - Electronラッパー vs ブラウザ拡張機能 vs Webベースアプローチ

2. **ブラウザベースの暗号化**
   - Web Crypto API + IndexedDB vs ファイルシステムアクセス

3. **keytarライブラリの評価**
   - OSキーチェーン統合のNode.jsライブラリ調査

4. **Playwrightのheadedモード + ユーザー操作待機**
   - `page.pause()` または カスタムガイダンスUI

---

## まとめ

本ギャップ分析により、以下が明らかになりました：

1. **既存資産の活用可能性**: AuthManager、storageState対応、Secret Manager統合は再利用可能
2. **主要ギャップ**: インタラクティブログイン、暗号化永続化、OSキーチェーン統合が未実装
3. **アーキテクチャ上の制約**: Cloud Run環境ではヘッドブラウザ・OSキーチェーンが使用不可、クライアントサイド実装が必須
4. **推奨アプローチ**: ハイブリッド（Option C）で段階的に実装
5. **工数・リスク**: L〜XL規模、OSキーチェーン統合が最大のリスク要因

デザインフェーズでは、特にクライアントサイドでのブラウザ起動・認証キャプチャの実現方法を重点的に検討する必要があります。
