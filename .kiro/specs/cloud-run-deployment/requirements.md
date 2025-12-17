# Requirements Document

## Introduction

本仕様は、アクセシビリティチェックツールのバックエンドAPI（Express + Node.js）をGoogle Cloud Runにデプロイするための要件を定義する。GCPプロジェクト「itgproto」を使用し、シェルスクリプトによる再現性のあるデプロイを実現する。

## Requirements

### Requirement 1: Dockerコンテナ化

**Objective:** As a 開発者, I want バックエンドをDockerコンテナ化する, so that Cloud Runへのデプロイが可能になる

#### Acceptance Criteria
1. The Dockerfile shall バックエンドサーバー（server/ディレクトリ）をコンテナ化する
2. The Dockerfile shall Node.js 18以上のベースイメージを使用する
3. The Docker image shall Playwright、Chrome、およびすべての依存関係を含む
4. When `docker build`を実行した時, the build process shall エラーなく完了する
5. When コンテナを起動した時, the server shall ポート8080でリクエストを受け付ける

### Requirement 2: Cloud Run デプロイ設定

**Objective:** As a 開発者, I want Cloud Runへのデプロイ設定を行う, so that バックエンドがクラウドで稼働する

#### Acceptance Criteria
1. The deployment shall GCPプロジェクト「itgproto」にデプロイする
2. The Cloud Run service shall リージョン「asia-northeast1」（東京）で稼働する
3. The Cloud Run service shall 未認証アクセスを許可する（パブリックAPI）
4. The Cloud Run service shall 最小インスタンス数0、最大インスタンス数を設定する
5. The Cloud Run service shall メモリ2GB以上を割り当てる（Playwright/Lighthouse実行のため）
6. The Cloud Run service shall タイムアウトを300秒以上に設定する（分析処理時間を考慮）

### Requirement 3: デプロイスクリプト

**Objective:** As a 開発者, I want シェルスクリプトでデプロイを自動化する, so that 再現性のあるデプロイが可能になる

#### Acceptance Criteria
1. The deploy script shall `scripts/deploy.sh`に配置する
2. When スクリプトを実行した時, the script shall Dockerイメージをビルドする
3. When スクリプトを実行した時, the script shall Artifact Registryにイメージをプッシュする
4. When スクリプトを実行した時, the script shall Cloud Runにデプロイする
5. The deploy script shall 必要なGCPプロジェクト設定（gcloud config）を含む
6. If デプロイが成功した時, the script shall デプロイされたサービスのURLを表示する
7. If エラーが発生した時, the script shall エラーメッセージを表示して終了する

### Requirement 4: 環境変数・設定管理

**Objective:** As a 開発者, I want 環境変数を適切に管理する, so that 本番環境とローカル環境を切り替えられる

#### Acceptance Criteria
1. The Cloud Run service shall 環境変数`PORT`を参照してリッスンポートを決定する
2. The Cloud Run service shall 環境変数`NODE_ENV=production`で稼働する
3. The server shall 環境変数が未設定の場合、デフォルト値を使用する
4. The deployment shall シークレット情報を環境変数または Secret Manager経由で注入する

### Requirement 5: ヘルスチェック・監視

**Objective:** As a 運用者, I want ヘルスチェックエンドポイントを提供する, so that サービスの稼働状況を監視できる

#### Acceptance Criteria
1. The server shall `/api/health`エンドポイントでヘルスチェックに応答する
2. When ヘルスチェックリクエストを受信した時, the server shall 200 OKを返す
3. The Cloud Run service shall ヘルスチェックエンドポイントを使用してインスタンスの正常性を確認する

### Requirement 6: CORS設定

**Objective:** As a フロントエンド開発者, I want CORS設定を適切に行う, so that フロントエンドからAPIを呼び出せる

#### Acceptance Criteria
1. The server shall フロントエンドのオリジンからのリクエストを許可する
2. The server shall 環境変数でCORS許可オリジンを設定可能にする
3. While 開発環境で稼働中, the server shall localhost:5173からのリクエストを許可する
