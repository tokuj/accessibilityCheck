# Implementation Plan

## Task 1: Dockerコンテナ化

- [x] 1.1 (P) Dockerfileを作成する
  - Playwright公式イメージ（mcr.microsoft.com/playwright:v1.57.0-noble）をベースに使用
  - package.jsonとpackage-lock.jsonをコピーし、npm ciで依存関係をインストール
  - server/ディレクトリとtsconfig.jsonをコピー
  - ポート8080でリッスンするようENV PORTを設定
  - npx tsx server/index.tsでサーバーを起動
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 1.2 (P) .dockerignoreファイルを作成する
  - node_modules/を除外（コンテナ内で再インストール）
  - frontend/を除外（バックエンドのみコンテナ化）
  - tests/、test-results/を除外
  - .git/、.kiro/、TODO/を除外
  - _Requirements: 1.4_

- [x] 1.3 Lighthouseのchrome-launcherがPlaywrightのChromiumを使用するよう修正する
  - playwrightからchromiumをインポート
  - chromeLauncher.launch()にchromePath: chromium.executablePath()オプションを追加
  - ローカル環境でも動作することを確認
  - _Requirements: 1.3_

- [x] 1.4 Dockerイメージをビルドして動作確認する
  - docker buildコマンドでイメージをビルド
  - docker runでコンテナを起動し、ポート8080でリクエストを受け付けることを確認
  - /api/healthエンドポイントにアクセスして200 OKが返ることを確認
  - _Requirements: 1.4, 1.5_

## Task 2: バックエンドコード修正

- [x] 2.1 (P) CORS設定を環境変数対応に変更する
  - ALLOWED_ORIGINS環境変数を読み取る関数を作成
  - 未設定時はhttp://localhost:5173をデフォルトとして使用
  - カンマ区切りで複数オリジンを指定可能にする
  - corsミドルウェアに設定を適用
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 2.2 環境変数のデフォルト値を確認・整理する
  - PORT環境変数が既に対応済みであることを確認
  - NODE_ENV環境変数の参照がある場合は確認
  - 環境変数が未設定の場合のデフォルト値動作をテスト
  - _Requirements: 4.1, 4.2, 4.3_

## Task 3: デプロイスクリプト作成

- [x] 3.1 scriptsディレクトリとdeploy.shスクリプトを作成する
  - set -eでエラー時に即終了するよう設定
  - PROJECT_ID、REGION、SERVICE_NAME、IMAGE_NAME、REGISTRYを変数として定義
  - gcloud config set projectでGCPプロジェクトを設定
  - Artifact Registryリポジトリを作成（存在しない場合はスキップ）
  - gcloud auth configure-dockerでDocker認証を設定
  - _Requirements: 3.1, 3.5_

- [x] 3.2 deploy.shにビルドとプッシュ処理を追加する
  - docker buildコマンドでイメージをビルド
  - docker pushコマンドでArtifact Registryにプッシュ
  - エラー発生時はエラーメッセージを表示して終了
  - _Requirements: 3.2, 3.3, 3.7_

- [x] 3.3 deploy.shにCloud Runデプロイ処理を追加する
  - gcloud run deployコマンドでCloud Runにデプロイ
  - リージョン、メモリ、タイムアウト、インスタンス数を設定
  - 未認証アクセスを許可する設定を追加
  - NODE_ENV=production環境変数を設定
  - デプロイ成功時はサービスURLを表示
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.4, 3.6_

## Task 4: デプロイ実行と動作確認

- [x] 4.1 deploy.shを実行してCloud Runにデプロイする
  - スクリプトに実行権限を付与
  - ./scripts/deploy.shを実行
  - デプロイ完了後に表示されるURLを確認
  - _Requirements: 2.1, 2.2, 3.4, 3.6_

- [x] 4.2 デプロイされたサービスの動作を確認する
  - /api/healthエンドポイントにアクセスして200 OKが返ることを確認
  - /api/analyzeエンドポイントでアクセシビリティ分析が動作することを確認
  - Cloud Runコンソールでログを確認
  - _Requirements: 5.1, 5.2, 5.3_

## Task 5: 統合テスト

- [ ]* 5.1 ローカルDockerコンテナでの統合テストを作成する
  - Dockerイメージビルドが成功することを確認するテスト
  - コンテナ起動後にヘルスチェックが通ることを確認するテスト
  - CORS設定が正しく機能することを確認するテスト
  - _Requirements: 1.4, 5.1, 5.2, 6.1_
