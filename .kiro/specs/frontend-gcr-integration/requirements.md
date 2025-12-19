# Requirements Document

## Introduction

本仕様は、フロントエンドアプリケーションをGoogle Cloud Run（GCR）にデプロイされたバックエンドAPIに接続するための要件を定義します。バックエンドはcloud-run-deploymentタスクでGCRにデプロイ済みであり、フロントエンドが正しくGCRのエンドポイントを参照するよう設定変更を行います。

## Requirements

### Requirement 1: 環境変数によるAPIエンドポイント設定

**Objective:** As a 開発者, I want フロントエンドのAPIエンドポイントを環境変数で設定できる, so that 開発・ステージング・本番環境で異なるバックエンドに接続できる

#### Acceptance Criteria
1. The Frontend Application shall 環境変数`VITE_API_URL`でAPIエンドポイントのベースURLを設定可能とする
2. When `VITE_API_URL`が設定されていない場合, the Frontend Application shall 空文字列をデフォルト値として使用する（ローカル開発時のプロキシ対応）
3. When APIリクエストを送信する場合, the Frontend Application shall `VITE_API_URL`の値をベースURLとして使用する

### Requirement 2: 本番環境用ビルド設定

**Objective:** As a デプロイ担当者, I want 本番環境用のビルド設定ファイルを用意する, so that GCRバックエンドのURLを含むビルドを生成できる

#### Acceptance Criteria
1. The Build System shall 本番環境用の環境変数ファイル（`.env.production`）をサポートする
2. When 本番ビルドを実行する場合, the Build System shall `.env.production`の環境変数をビルドに埋め込む
3. The `.env.production` shall GCRバックエンドのエンドポイントURL（`VITE_API_URL`）を含む

### Requirement 3: CORS対応

**Objective:** As a フロントエンド開発者, I want クロスオリジンリクエストが正しく動作する, so that フロントエンドとバックエンドが異なるドメインでもAPI通信できる

#### Acceptance Criteria
1. When フロントエンドがGCRバックエンドにリクエストを送信する場合, the Backend API shall 適切なCORSヘッダーを返す
2. If CORSエラーが発生した場合, the Frontend Application shall エラーメッセージを表示する
3. The Backend API shall フロントエンドのオリジンからのリクエストを許可する

### Requirement 4: APIエラーハンドリング

**Objective:** As a ユーザー, I want API接続エラー時に分かりやすいメッセージを見たい, so that 問題を理解し対処できる

#### Acceptance Criteria
1. If APIエンドポイントへの接続が失敗した場合, the Frontend Application shall ユーザーにエラーメッセージを表示する
2. If ネットワークタイムアウトが発生した場合, the Frontend Application shall タイムアウトエラーとして処理する
3. When APIからエラーレスポンス（4xx/5xx）を受信した場合, the Frontend Application shall ステータスコードに応じたエラーメッセージを表示する

### Requirement 5: 環境設定ドキュメント

**Objective:** As a 運用担当者, I want 環境設定の手順が文書化されている, so that 新しい環境へのデプロイが容易になる

#### Acceptance Criteria
1. The Project Documentation shall フロントエンドの環境変数設定手順を含む
2. The Project Documentation shall GCRバックエンドへの接続設定手順を含む
3. The Project Documentation shall ローカル開発環境と本番環境の違いを説明する
