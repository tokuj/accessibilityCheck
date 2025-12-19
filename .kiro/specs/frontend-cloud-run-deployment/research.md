# Research & Design Decisions

## Summary
- **Feature**: `frontend-cloud-run-deployment`
- **Discovery Scope**: Extension（既存バックエンドデプロイパターンの拡張）
- **Key Findings**:
  - nginxベースのマルチステージビルドが最も軽量かつ高パフォーマンス
  - 既存の`scripts/deploy.sh`パターンを踏襲し、フロントエンド固有の設定を追加
  - `VITE_API_URL`は既にフロントエンドで実装済み（`frontend/src/services/api.ts:3`）

## Research Log

### nginx vs Node.js静的サーバー

- **Context**: フロントエンドの静的ファイル配信に最適なWebサーバーの選定
- **Sources Consulted**:
  - Cloud Run公式ドキュメント
  - nginx公式イメージ
  - Viteデプロイメントガイド
- **Findings**:
  - nginx:alpine イメージサイズ: 約23MB
  - Node.js + serve イメージサイズ: 約200MB+
  - nginxはC言語実装で高パフォーマンス、低リソース消費
  - Cloud Runは8080ポートを期待（nginx.confで設定可能）
- **Implications**: nginx:alpineを採用、マルチステージビルドで最終イメージを最小化

### SPA対応のnginx設定

- **Context**: React SPAのクライアントサイドルーティング対応
- **Sources Consulted**:
  - React公式ドキュメント（Static File Serving）
  - nginx try_files ディレクティブ
- **Findings**:
  - `try_files $uri $uri/ /index.html;` でSPAルーティング対応
  - 静的アセット（JS/CSS）は長期キャッシュ（1年）
  - index.htmlは短期キャッシュまたはno-cache
- **Implications**: nginx.confにtry_filesとキャッシュ設定を含める

### 環境変数とViteビルド

- **Context**: ビルド時の環境変数注入方法
- **Sources Consulted**:
  - Vite公式ドキュメント（Env Variables and Modes）
- **Findings**:
  - `VITE_`プレフィックス付き変数のみクライアントに公開
  - ビルド時に静的に埋め込まれる（ランタイム変更不可）
  - `.env.production`ファイルで本番環境用の値を設定
- **Implications**: `.env.production`に`VITE_API_URL`を設定済み。Dockerビルド時に参照される

### Cloud Runリソース設定

- **Context**: フロントエンド配信に必要なリソースの見積もり
- **Sources Consulted**:
  - Cloud Run pricing
  - 類似プロジェクトの設定値
- **Findings**:
  - 静的ファイル配信は軽量（メモリ128MB〜256MBで十分）
  - nginxのコールドスタートは1-2秒
  - 最小インスタンス0でコスト最適化
- **Implications**: メモリ256MB、タイムアウト60秒で設定

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| nginx + multi-stage | Node.jsでビルド → nginxで配信 | 軽量（〜25MB）、高パフォーマンス | nginx設定の知識必要 | **採用** |
| Node.js + serve | 単一ステージでserveパッケージ使用 | シンプル、Node.jsのみ | イメージ大、パフォーマンス劣る | 不採用 |
| Cloud Storage + CDN | 静的ホスティング | CDN高速、Run不要 | 構成が異なる、SPA設定複雑 | 不採用 |

## Design Decisions

### Decision: マルチステージDockerビルド

- **Context**: フロントエンドの本番イメージサイズと配信パフォーマンスの最適化
- **Alternatives Considered**:
  1. 単一ステージ（Node.js + serve）— イメージ200MB+、実行時オーバーヘッド
  2. マルチステージ（Node.js → nginx）— イメージ25MB、高パフォーマンス
- **Selected Approach**: マルチステージビルドでNode.js 22-alpineをビルドステージ、nginx:alpine-slimを実行ステージとして使用
- **Rationale**:
  - 最小イメージサイズによるコールドスタート短縮
  - nginxの高効率な静的ファイル配信
  - バックエンドと同じCloud Runパターンで運用統一
- **Trade-offs**:
  - nginx設定ファイルの作成が必要
  - バックエンドとは異なるベースイメージ
- **Follow-up**: gzip圧縮とキャッシュヘッダーの動作確認

### Decision: バックエンドAPIのURL設定

- **Context**: 本番環境でフロントエンドからバックエンドAPIへの接続
- **Alternatives Considered**:
  1. ビルド時埋め込み（`.env.production`）— 既存実装
  2. ランタイム環境変数 — JSで実行時に読み込み
- **Selected Approach**: ビルド時埋め込み（既存の`.env.production`を使用）
- **Rationale**:
  - 既に`VITE_API_URL`が実装済み
  - バックエンドAPIのURLは固定（Cloud Run URL）
  - 追加実装不要
- **Trade-offs**: URL変更時は再ビルドが必要（現状では問題なし）

## Risks & Mitigations

- **Risk 1**: nginxのSPA設定ミスでルーティングが動作しない
  - **Mitigation**: try_filesディレクティブの動作をローカルDockerで事前検証

- **Risk 2**: キャッシュ設定による更新遅延
  - **Mitigation**: index.htmlはno-cache、アセットはハッシュ付きファイル名で長期キャッシュ

- **Risk 3**: CORSエラーでAPIが呼び出せない
  - **Mitigation**: バックエンドのALLOWED_ORIGINSにフロントエンドのCloud Run URLを追加

## References

- [Vite Static Deploy](https://vitejs.dev/guide/static-deploy.html) — Vite公式のデプロイガイド
- [nginx docker image](https://hub.docker.com/_/nginx) — nginx公式Dockerイメージ
- [Cloud Run documentation](https://cloud.google.com/run/docs) — Cloud Run公式ドキュメント
- [React Deployment](https://create-react-app.dev/docs/deployment/) — SPA静的ファイル配信のベストプラクティス
