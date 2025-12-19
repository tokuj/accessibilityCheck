# Requirements Document

## Introduction

本仕様は、アクセシビリティチェックツールのフロントエンド（React 19 + Vite + MUI）をGoogle Cloud Runにデプロイするための要件を定義する。GCPプロジェクト「itgproto」を使用し、シェルスクリプトによる再現性のあるデプロイを実現する。バックエンドのデプロイ（cloud-run-deployment）と同様のアプローチを採用し、フロントエンド固有の要件に対応する。

## Requirements

### Requirement 1: Dockerコンテナ化

**Objective:** As a 開発者, I want フロントエンドをDockerコンテナ化する, so that Cloud Runへのデプロイが可能になる

#### Acceptance Criteria
1. The Dockerfile shall フロントエンドアプリケーション（frontend/ディレクトリ）をコンテナ化する
2. The Dockerfile shall マルチステージビルドを使用して本番用の最適化されたビルドを生成する
3. The Docker image shall Node.js 18以上のベースイメージを使用してビルドを行う
4. The Docker image shall 軽量なWebサーバー（nginx等）で静的ファイルを配信する
5. When `docker build`を実行した時, the build process shall エラーなく完了する
6. When コンテナを起動した時, the server shall ポート8080でリクエストを受け付ける

### Requirement 2: 本番ビルド設定

**Objective:** As a 開発者, I want Viteの本番ビルド設定を行う, so that 最適化されたフロントエンドをデプロイできる

#### Acceptance Criteria
1. The build process shall `npm run build`コマンドでプロダクションビルドを生成する
2. The build output shall `dist/`ディレクトリに静的ファイルを出力する
3. The build process shall TypeScriptのコンパイルエラーがない状態でビルドを完了する
4. The built assets shall 適切なキャッシュバスティング用のハッシュ付きファイル名を持つ

### Requirement 3: Cloud Run デプロイ設定

**Objective:** As a 開発者, I want Cloud Runへのデプロイ設定を行う, so that フロントエンドがクラウドで稼働する

#### Acceptance Criteria
1. The deployment shall GCPプロジェクト「itgproto」にデプロイする
2. The Cloud Run service shall リージョン「asia-northeast1」（東京）で稼働する
3. The Cloud Run service shall 未認証アクセスを許可する（パブリックWebアプリ）
4. The Cloud Run service shall 最小インスタンス数0、最大インスタンス数を設定する
5. The Cloud Run service shall 適切なメモリ割り当てを設定する（静的ファイル配信のため128MB〜256MB程度）
6. The Cloud Run service shall コンテナ起動タイムアウトを適切に設定する

### Requirement 4: デプロイスクリプト

**Objective:** As a 開発者, I want シェルスクリプトでフロントエンドのデプロイを自動化する, so that 再現性のあるデプロイが可能になる

#### Acceptance Criteria
1. The deploy script shall `scripts/deploy-frontend.sh`に配置する
2. When スクリプトを実行した時, the script shall Dockerイメージをビルドする
3. When スクリプトを実行した時, the script shall Artifact Registryにイメージをプッシュする
4. When スクリプトを実行した時, the script shall Cloud Runにデプロイする
5. The deploy script shall 必要なGCPプロジェクト設定（gcloud config）を含む
6. The deploy script shall バックエンドAPIのURLを環境変数として設定する
7. If デプロイが成功した時, the script shall デプロイされたサービスのURLを表示する
8. If エラーが発生した時, the script shall エラーメッセージを表示して終了する

### Requirement 5: API接続設定

**Objective:** As a 開発者, I want バックエンドAPIへの接続設定を管理する, so that 本番環境で正しくAPIと通信できる

#### Acceptance Criteria
1. The frontend shall 環境変数`VITE_API_URL`でバックエンドAPIのURLを設定できる
2. The deployment shall Cloud RunにデプロイされたバックエンドAPIのURLを設定する
3. If 環境変数が未設定の場合, the frontend shall デフォルトのローカルホストURLを使用する
4. The frontend shall 相対パスではなく絶対URLでAPIを呼び出す

### Requirement 6: Webサーバー設定

**Objective:** As a 運用者, I want 適切なWebサーバー設定を行う, so that SPAが正しく動作する

#### Acceptance Criteria
1. The web server shall すべてのルートリクエストを`index.html`にフォールバックする（SPA対応）
2. The web server shall 静的アセット（JS、CSS、画像）に適切なContent-Typeヘッダーを設定する
3. The web server shall gzip圧縮を有効にする
4. The web server shall 適切なキャッシュヘッダーを設定する（ハッシュ付きアセットは長期キャッシュ、index.htmlは短期キャッシュ）

### Requirement 7: ヘルスチェック

**Objective:** As a 運用者, I want ヘルスチェックエンドポイントを提供する, so that サービスの稼働状況を監視できる

#### Acceptance Criteria
1. The web server shall ルートパス（/）へのGETリクエストに200 OKで応答する
2. The Cloud Run service shall ヘルスチェックを使用してインスタンスの正常性を確認する
