# フロントエンド環境設定・デプロイガイド

本ドキュメントでは、フロントエンドアプリケーションの環境設定とGoogle Cloud Run（GCR）バックエンドへの接続方法を説明します。

## 目次

1. [環境変数の概要](#環境変数の概要)
2. [ローカル開発環境のセットアップ](#ローカル開発環境のセットアップ)
3. [本番環境用ビルド手順](#本番環境用ビルド手順)
4. [GCRバックエンドへの接続設定](#gcrバックエンドへの接続設定)
5. [トラブルシューティング](#トラブルシューティング)

---

## 環境変数の概要

### フロントエンド環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|------------|
| `VITE_API_URL` | バックエンドAPIのベースURL | 空欄（開発時はViteプロキシ使用） |

### バックエンド環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|------------|
| `ALLOWED_ORIGINS` | CORS許可オリジン（カンマ区切り） | `http://localhost:5173` |
| `NODE_ENV` | 実行環境 | `development` |

### 環境変数ファイル

```
frontend/
├── .env.example      # テンプレート（リポジトリにコミット）
├── .env.development  # 開発環境用（GCRバックエンド使用）
├── .env.production   # 本番環境用（ビルド時に使用）
└── .env.local        # ローカル開発用（gitignore対象、個人設定）
```

---

## ローカル開発環境のセットアップ

### 1. 依存関係のインストール

```bash
# プロジェクトルートで実行
npm install

# フロントエンド単独の場合
cd frontend && npm install
```

### 2. 開発サーバーの起動

```bash
# フロントエンドのみ起動（GCRバックエンドを使用）
cd frontend && npm run dev
```

- フロントエンド: http://localhost:5173
- バックエンドAPI: GCR（`.env.development`で設定）

### 3. 開発環境でのAPI通信

開発環境では、`.env.development`に設定されたGCRバックエンドに直接接続します。

```bash
# frontend/.env.development
VITE_API_URL=https://a11y-check-api-pazgfztcsa-an.a.run.app
```

ローカルでバックエンドを起動する必要はありません。

#### ローカルバックエンドを使用する場合

ローカルでバックエンドを開発・テストする場合は、`.env.local`を作成してプロキシを使用：

```bash
# frontend/.env.local（空欄にするとViteプロキシ使用）
VITE_API_URL=
```

その後、プロジェクトルートで`npm run dev`を実行してフロントエンドとバックエンドを同時起動します。

---

## 本番環境用ビルド手順

### 1. 環境変数の設定

`frontend/.env.production`を編集し、GCRバックエンドのURLを設定：

```bash
# frontend/.env.production
VITE_API_URL=https://a11y-check-api-xxxxx-an.a.run.app
```

### 2. ビルドの実行

```bash
cd frontend
npm run build
```

ビルド成果物は`frontend/dist/`に出力されます。

### 3. 環境変数の埋め込み確認

```bash
# ビルド成果物にAPIURLが埋め込まれていることを確認
grep -r "a11y-check-api" frontend/dist/
```

---

## GCRバックエンドへの接続設定

### バックエンドのCORS設定

フロントエンドをホスティングする際、バックエンドのCORS設定を更新する必要があります。

#### 方法1: 環境変数で指定

```bash
# デプロイ時にFRONTEND_ORIGINを指定
FRONTEND_ORIGIN=https://your-frontend-domain.com ./scripts/deploy.sh
```

#### 方法2: deploy.shを直接編集

```bash
# scripts/deploy.sh
FRONTEND_ORIGIN="https://your-frontend-domain.com"
```

### 複数オリジンの許可

カンマ区切りで複数のオリジンを指定できます：

```bash
FRONTEND_ORIGIN="https://app.example.com,https://staging.example.com"
```

---

## トラブルシューティング

### CORSエラー

**症状**: ブラウザコンソールに「Access-Control-Allow-Origin」エラーが表示される

**原因**: バックエンドの`ALLOWED_ORIGINS`にフロントエンドのオリジンが含まれていない

**解決方法**:
1. Cloud Runの環境変数を確認
   ```bash
   gcloud run services describe a11y-check-api --region asia-northeast1 \
     --format='value(spec.template.spec.containers[0].env)'
   ```
2. `ALLOWED_ORIGINS`にフロントエンドのURLを追加してデプロイ
   ```bash
   FRONTEND_ORIGIN=https://your-frontend-domain.com ./scripts/deploy.sh
   ```

### 接続エラー

**症状**: 「サーバーに接続できません」エラーが表示される

**確認事項**:
- `VITE_API_URL`が正しく設定されているか
- バックエンドサービスが稼働しているか
- ネットワーク接続に問題がないか

**デバッグ方法**:
```bash
# バックエンドのヘルスチェック
curl https://a11y-check-api-xxxxx-an.a.run.app/api/health
```

### タイムアウトエラー

**症状**: 「分析がタイムアウトしました」エラーが表示される

**原因**: 分析対象のページが大きい、または読み込みに時間がかかる

**対処方法**:
- より小さなページで試す
- ネットワーク状況を確認
- Cloud Runのタイムアウト設定を確認（デフォルト300秒）

### 本番ビルドでAPIに接続できない

**症状**: 本番ビルド後、APIリクエストが失敗する

**確認事項**:
1. `.env.production`に正しいURLが設定されているか
2. ビルド成果物にURLが埋め込まれているか
   ```bash
   grep -r "VITE_API_URL\|a11y-check-api" frontend/dist/
   ```
3. ビルド後にURLが変更された場合、再ビルドが必要

---

## 関連ドキュメント

- [GCPアーキテクチャ](./gcp-architecture.md)
- [アクセシビリティテストガイド](./accessibility-testing-guide.md)
