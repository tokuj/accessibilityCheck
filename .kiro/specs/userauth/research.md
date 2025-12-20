# Research & Design Decisions: userauth

---
**Purpose**: インタラクティブ認証機能の技術設計に必要な調査結果と設計判断を記録する。

**Usage**:
- 発見フェーズの調査活動と成果をログ化
- design.mdには詳細すぎる設計判断のトレードオフを文書化
- 将来の監査や再利用のための参照と証拠を提供
---

## Summary

- **Feature**: `userauth`
- **Discovery Scope**: Complex Integration（既存システムの大幅拡張 + 新規機能追加）
- **Key Findings**:
  1. **Cloud Run制約**: Cloud Runではヘッドブラウザ表示不可 → クライアントサイド実装が必須
  2. **keytar非推奨**: keytarはNode.js 18+でメンテナンス停止、代替案が必要
  3. **ハイブリッドアーキテクチャ**: サーバーオーケストレーション + クライアント実行が最適解

## Research Log

### Playwright Headedモードとユーザーインタラクション

- **Context**: ユーザーがブラウザ上で手動ログインし、その認証状態をキャプチャする機能の実現方法
- **Sources Consulted**:
  - Playwright公式ドキュメント（auth, debug）
  - o3調査結果（2025年最新）
- **Findings**:
  - `chromium.launch({ headless: false })` でheadedモード起動可能
  - `page.pause()` でPlaywright Inspectorを開き、ユーザー操作完了まで待機
  - カスタムプロンプト: `process.stdin.once('data', ...)` でEnterキー待機も可能
  - `context.storageState({ path: 'state.json' })` で認証状態を永続化
  - ログイン完了シグナル: `window.__LOGGED_IN=true` + `page.waitForFunction()` パターン
- **Implications**:
  - Webアプリからの起動は不可（Cloud Run制約）
  - CLIツールまたはElectronアプリとしての実装が必要
  - 本プロジェクトはWeb UIが主体のため、サーバーサイドでのheadedブラウザ起動は断念

### AES-256暗号化（Node.js crypto）

- **Context**: ストレージステートファイルのセキュアな永続化
- **Sources Consulted**:
  - Node.js 22 LTS Web Crypto API ドキュメント
  - PBKDF2反復回数に関する2025年ベストプラクティス
- **Findings**:
  - **推奨アルゴリズム**: AES-256-GCM（認証付き暗号化）
  - **鍵導出**: PBKDF2-SHA-256、310,000反復以上（OWASP 2025推奨）
  - **IV**: 12バイトのランダム値を各暗号化で生成
  - **認証タグ**: 16バイト、改ざん検出に使用
  - **ファイル形式**: `[12-byte IV][encrypted data][16-byte auth tag]`
- **Implications**:
  - Node.js標準cryptoモジュールで実装可能、外部依存不要
  - パスワードベースの鍵導出が最もシンプル
  - OSキーチェーン統合は複雑なため、代替案として暗号化JSONファイル方式を採用

### keytarとOSキーチェーン統合

- **Context**: 暗号化キーのセキュアな保管
- **Sources Consulted**:
  - keytar GitHubリポジトリ（archived状態確認）
  - node-keychain、secret-service、wincred調査
- **Findings**:
  - **keytar**: v7.9.0（2022年2月）でアーカイブ、Node.js 18+でネイティブリビルドが必要
  - **代替ライブラリ**:
    - macOS: `node-keychain` - `security` CLIをシェル呼び出し、純JS
    - Linux: `secret-service` - DBusクライアント、libsecret不要
    - Windows: `wincred` / `winreglib` - Node.js 22用プレビルド有
  - **フォールバック**: 環境変数 + エンベロープ暗号化（暗号化JSONファイル）
- **Implications**:
  - クロスプラットフォーム対応は複雑、メンテナンスコスト高
  - **推奨**: 暗号化JSONファイル方式をデフォルトとし、OSキーチェーンはオプション
  - Cloud Run環境ではOSキーチェーン使用不可

### OAuth 2.0 localhost コールバック

- **Context**: OAuth/OIDC認証フローの実装
- **Sources Consulted**:
  - RFC 8252 (OAuth for Native Apps)
  - OAuth 2.1ドラフト仕様
  - openid-clientライブラリドキュメント
- **Findings**:
  - **動的ポート**: `server.listen(0)` でOS割り当て、主要IdPは任意ポート許可
  - **ループバックアドレス**: `127.0.0.1` または `[::1]` を使用（`localhost`文字列は避ける）
  - **必須セキュリティ**: PKCE（S256）+ ランダムstate（OAuth 2.1で必須）
  - **ライブラリ**: `openid-client`（フルOIDC対応）、`oauth-callback`（軽量）
- **Implications**:
  - localhostコールバックは安全かつ標準的なアプローチ
  - サーバーサイドではなくクライアントサイド（CLIまたはElectron）での実装が必要

### Cloud Run環境の制約

- **Context**: 現行デプロイ環境での技術的制約の確認
- **Sources Consulted**:
  - Google Cloud Run公式ドキュメント
  - Playwright on Cloud Run事例（GitHub issues）
- **Findings**:
  - **GUI不可**: X-serverなし、$DISPLAY未設定、ヘッドブラウザ起動不可
  - **ヘッドレスのみ**: headless Chromium/Firefox/WebKitは動作可能
  - **推奨イメージ**: `mcr.microsoft.com/playwright:v1.55.0-noble`
  - **リソース**: RAM 2GiB以上推奨、`--disable-dev-shm-usage`フラグ推奨
  - **GPU**: L4 GPU対応（2025年2月）だがX-serverは提供されない
- **Implications**:
  - インタラクティブログイン機能はCloud Run上で実行不可
  - 認証済みstorageStateを受け取ってヘッドレス実行するのは可能
  - ハイブリッドアーキテクチャが必須

### ハイブリッドアーキテクチャの検討

- **Context**: サーバーがGUIを表示できない制約下での設計パターン
- **Sources Consulted**:
  - Playwright MCP、xvfb-chrome、Electron accessibility tools
  - 2025年SaaSテストプラットフォーム事例
- **Findings**:
  - **パターンA（サーバーオーケストレーション + クライアント実行）**:
    - Cloud Runはオーケストレーションとヘッドレス実行を担当
    - デスクトップエージェント（CLI/Electron）がheadedブラウザを実行
    - 利点: 実ユーザー環境、クラウド表示問題なし、localhost OAuthサポート
    - 欠点: エージェントの配布・インストールが必要
  - **パターンB（リモートヘッド via VNC/WebRTC）**:
    - 長期稼働VM/Podでヘッドフルブラウザを実行
    - Cloud RunからWebSocket/MCPで接続
    - 利点: サーバーサイド完結
    - 欠点: サーバーレスではない、コスト増
- **Implications**:
  - 本プロジェクトはWeb UIが主体だが、インタラクティブログインは別アプローチが必要
  - **推奨**: パターンA（Phase 1はサーバーサイドheadedモード対応、ローカル開発用）

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| **A. サーバーサイド完結** | Cloud Runでheadedブラウザを起動 | シンプル | GUI表示不可、実装不能 | 却下 |
| **B. Electronデスクトップアプリ** | Electronで認証UI + Playwright | フルGUI、OAuth対応 | 別アプリのインストールが必要 | 将来オプション |
| **C. ハイブリッド（推奨）** | サーバーはオーケストレーション、認証はクライアントまたはサーバーローカル | 柔軟、段階的実装可能 | 複雑性増加 | 採用 |
| **D. ブラウザ拡張機能** | Chrome拡張で認証キャプチャ | インストール簡単 | プラットフォーム制限、審査必要 | 将来オプション |

## Design Decisions

### Decision: 実行環境の分離

- **Context**: Cloud Run環境ではheadedブラウザが使用不可
- **Alternatives Considered**:
  1. Cloud Runでheadedブラウザ → 技術的に不可能
  2. Electronアプリとして別途開発 → 追加開発コスト大
  3. サーバーローカル開発 + 本番はstorageState受け渡しのみ → 現実的
- **Selected Approach**: ハイブリッドアーキテクチャ
  - 開発環境: サーバーサイドでheadedブラウザ起動可能（ローカルPlaywright）
  - 本番環境: フロントエンドからstorageState（暗号化済み）をアップロード
  - 将来: CLIツールまたはElectronアプリでインタラクティブログインを実行
- **Rationale**: 現行Web UIを活かしつつ、段階的に機能拡張可能
- **Trade-offs**: 本番でのインタラクティブログインは制限されるが、手動storageState入力は維持
- **Follow-up**: Phase 2以降でCLI/Electronツール検討

### Decision: 暗号化方式

- **Context**: ストレージステートファイルのセキュアな保存
- **Alternatives Considered**:
  1. OSキーチェーン統合（keytar等） → メンテナンス停止、クロスプラットフォーム複雑
  2. AES-256-GCM + パスワード導出キー → シンプル、標準crypto使用
  3. 外部KMS（AWS KMS、GCP KMS） → 依存性増加
- **Selected Approach**: AES-256-GCM + PBKDF2パスワード導出
  - Node.js標準cryptoモジュール使用
  - ユーザー提供のパスフレーズから鍵導出
  - オプションでOSキーチェーンをアダプター経由でサポート
- **Rationale**: 外部依存最小化、クロスプラットフォーム対応、監査容易
- **Trade-offs**: ユーザーがパスフレーズを覚える必要あり（UX負担）
- **Follow-up**: UX改善としてブラウザ保存オプション検討

### Decision: セッションストレージ形式

- **Context**: 複数セッションの管理とメタデータ保存
- **Alternatives Considered**:
  1. SQLiteデータベース → オーバーキル
  2. 個別JSONファイル + インデックスJSON → シンプル
  3. IndexedDB（ブラウザ） → サーバー連携複雑
- **Selected Approach**: 個別暗号化JSONファイル + インデックスファイル
  - 各セッション: `sessions/{session-id}.enc`
  - インデックス: `sessions/index.json`（メタデータのみ、暗号化不要）
- **Rationale**: ファイルシステムベースでシンプル、バックアップ容易
- **Trade-offs**: 大量セッションには非効率（想定使用量では問題なし）
- **Follow-up**: セッション数上限（例: 20）を設定

### Decision: 認証方式の段階的対応

- **Context**: 複数認証方式（Basic/Form/OAuth/SSO）のサポート
- **Alternatives Considered**:
  1. 全方式を一度に実装 → 複雑、リスク大
  2. 段階的実装（Basic → Form → OAuth → SSO） → リスク分散
- **Selected Approach**: 段階的実装
  - Phase 1: 既存Basic/Form認証 + storageState永続化
  - Phase 2: インタラクティブログイン（開発環境）
  - Phase 3: OAuth/OIDCサポート
  - Phase 4: 企業SSO対応
- **Rationale**: 各フェーズで価値提供、フィードバック反映可能
- **Trade-offs**: 全機能提供まで時間がかかる
- **Follow-up**: Phase 1完了後にユーザーフィードバック収集

## Risks & Mitigations

| Risk | Level | Mitigation |
|------|-------|------------|
| Cloud Runでheadedブラウザ不可 | 高 | ハイブリッドアーキテクチャ採用、本番はstorageState受け渡し方式 |
| keytarメンテナンス停止 | 高 | AES-256-GCM + パスワード方式をデフォルトに |
| OAuth IdP仕様差異 | 中 | 主要IdP（Google、Azure AD、Okta）に絞って対応 |
| 暗号化実装ミス | 中 | Node.js標準crypto使用、セキュリティレビュー必須 |
| UX複雑化 | 中 | 段階的機能追加、ユーザーフィードバック反映 |

## References

- [Playwright Authentication](https://playwright.dev/docs/auth) — storageState永続化の公式ガイド
- [Playwright Debug](https://playwright.dev/docs/debug) — page.pause()の使用方法
- [Node.js Crypto](https://nodejs.org/api/crypto.html) — AES-256-GCM実装
- [PBKDF2 2025 Recommendations](https://dev.to/securebitchat/why-you-should-use-310000-iterations-with-pbkdf2-in-2025-3o1e) — 反復回数の根拠
- [RFC 8252 OAuth for Native Apps](https://datatracker.ietf.org/doc/rfc8252/) — localhostコールバック仕様
- [OAuth 2.1 Draft](https://www.ietf.org/archive/id/draft-ietf-oauth-v2-1-11.html) — PKCE必須化
- [Cloud Run GPU](https://cloud.google.com/run/docs/configuring/services/gpu) — GPU対応状況（GUI非対応）
- [keytar archived](https://github.com/atom/node-keytar) — メンテナンス停止状況
