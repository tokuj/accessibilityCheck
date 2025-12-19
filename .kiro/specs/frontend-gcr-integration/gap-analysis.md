# Gap Analysis: frontend-gcr-integration

## 1. Current State Investigation

### 1.1 Key Files and Modules

| コンポーネント | ファイル | 役割 |
|-------------|---------|------|
| APIクライアント | `frontend/src/services/api.ts` | `VITE_API_URL`環境変数を使用してAPIエンドポイントを設定（既存） |
| Vite設定 | `frontend/vite.config.ts` | 開発環境用プロキシ設定（localhost:3001） |
| バックエンドCORS | `server/cors-config.ts` | `ALLOWED_ORIGINS`環境変数でCORS許可オリジンを設定（既存） |
| バックエンドエントリ | `server/index.ts` | CORSミドルウェア適用済み |
| デプロイスクリプト | `scripts/deploy.sh` | バックエンドのCloud Runデプロイ（VPC/NAT設定含む） |

### 1.2 Existing Patterns and Conventions

- **環境変数パターン**: `import.meta.env.VITE_*`（フロントエンド）、`process.env.*`（バックエンド）
- **API通信**: fetch APIをシンプルに使用、POSTリクエストのみ
- **エラーハンドリング**: `try-catch`でエラーをキャッチし、Alertコンポーネントで表示
- **CORS設定**: 環境変数ベースで動的に設定可能（実装済み）

### 1.3 Integration Surfaces

- **GCRバックエンドURL**: `https://a11y-check-api-xxxxxxxxxx-an.a]run.app`形式
- **APIエンドポイント**: `/api/analyze`, `/api/health`, `/api/egress-ip`
- **CORS許可オリジン**: `ALLOWED_ORIGINS`環境変数で設定

---

## 2. Requirements Feasibility Analysis

### 2.1 Requirement-to-Asset Map

| 要件 | 既存資産 | ギャップ |
|-----|---------|---------|
| Req 1: 環境変数によるAPIエンドポイント設定 | `api.ts`: `VITE_API_URL`使用済み | **なし** - 既に実装済み |
| Req 2: 本番環境用ビルド設定 | Vite標準機能サポート | **Missing**: `.env.production`ファイル未作成 |
| Req 3: CORS対応 | `cors-config.ts`: 環境変数ベース設定済み | **Constraint**: GCRデプロイ時に`ALLOWED_ORIGINS`設定が必要 |
| Req 4: APIエラーハンドリング | `App.tsx`: 基本的なエラー表示 | **Missing**: タイムアウト処理、詳細なエラー分類 |
| Req 5: 環境設定ドキュメント | `docs/gcp-architecture.md`存在 | **Missing**: フロントエンド設定手順の追記 |

### 2.2 Technical Gaps Identified

1. **`.env.production`ファイル**: GCRバックエンドのURLを設定するファイルが存在しない
2. **タイムアウト処理**: fetch APIにtimeout設定がない（長時間の分析で問題になる可能性）
3. **CORS設定のデプロイ**: バックエンドデプロイ時に`ALLOWED_ORIGINS`を設定する手順が未定義
4. **フロントエンドデプロイ**: 本番ビルドのデプロイ先・方法が未定義

### 2.3 Complexity Signals

- **Simple Configuration**: 環境変数設定とファイル作成が中心
- **Minor Enhancement**: APIクライアントのタイムアウト追加
- **Documentation**: 既存ドキュメントへの追記

---

## 3. Implementation Approach Options

### Option A: Extend Existing Components（推奨）

**概要**: 既存のファイルに最小限の変更を加える

**変更対象**:
- `frontend/.env.production` - 新規作成（GCR URL設定）
- `frontend/.env.example` - 新規作成（テンプレート）
- `frontend/src/services/api.ts` - タイムアウト処理追加（オプション）
- `scripts/deploy.sh` - `ALLOWED_ORIGINS`設定追加
- `docs/gcp-architecture.md` - フロントエンド設定手順追記

**Trade-offs**:
- ✅ 最小限の変更で要件を満たせる
- ✅ 既存パターンをそのまま活用
- ✅ 学習コスト低
- ❌ 設定が複数ファイルに分散

### Option B: Create New Components

**概要**: 環境設定を集約する新しいモジュールを作成

**新規ファイル**:
- `frontend/src/config/environment.ts` - 環境設定を集約
- `frontend/src/services/apiClient.ts` - タイムアウト・リトライ機能付きクライアント
- `docs/deployment/frontend.md` - フロントエンド専用デプロイガイド

**Trade-offs**:
- ✅ 設定の一元管理
- ✅ 将来の拡張に備えた構造
- ❌ 過剰な抽象化のリスク
- ❌ 現時点では不要な複雑さ

### Option C: Hybrid Approach

**概要**: 設定ファイルは新規作成、ロジック変更は最小限

**変更**:
- `.env.*`ファイル群を新規作成
- `api.ts`に軽微なタイムアウト処理追加
- ドキュメント更新

**Trade-offs**:
- ✅ バランスの取れたアプローチ
- ✅ 段階的な改善が可能
- ❌ 特になし

---

## 4. Implementation Complexity & Risk

### Effort: S（1-3日）

**理由**:
- 既存パターンの延長で実装可能
- 主に設定ファイルの作成とドキュメント更新
- コード変更は軽微（タイムアウト処理のみ）

### Risk: Low

**理由**:
- 既存の`VITE_API_URL`パターンが動作確認済み
- CORSは`cors-config.ts`で環境変数対応済み
- 技術的な未知要素なし

---

## 5. Recommendations for Design Phase

### 推奨アプローチ: Option A（Extend Existing Components）

**理由**:
1. 既存の環境変数パターン（`VITE_API_URL`、`ALLOWED_ORIGINS`）が適切に設計されている
2. 新しい抽象化は不要で、設定ファイル追加で十分
3. 実装工数を最小限に抑えられる

### Key Decisions for Design Phase

1. **GCRバックエンドURLの取得方法**: 手動設定 or 自動取得（deploy.sh出力から）
2. **フロントエンドのホスティング先**: Firebase Hosting / Cloud Storage / 他
3. **タイムアウト値**: 分析に時間がかかるため、300秒程度が妥当

### Research Items to Carry Forward

1. **フロントエンドホスティング**: Firebase Hostingを使用する場合の設定手順
2. **VITE_API_URLのビルド時埋め込み確認**: 本番ビルドで環境変数が正しく反映されるか確認

---

## Output Summary

| 項目 | 内容 |
|-----|------|
| **対象範囲** | フロントエンドAPI接続設定、CORS、エラーハンドリング、ドキュメント |
| **既存資産活用** | 高（`VITE_API_URL`、`ALLOWED_ORIGINS`パターン既存） |
| **主要ギャップ** | `.env.production`未作成、タイムアウト処理なし、デプロイ手順未文書化 |
| **推奨アプローチ** | Option A: 既存コンポーネント拡張 |
| **工数** | S（1-3日） |
| **リスク** | Low |
