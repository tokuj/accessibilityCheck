# Implementation Plan

## Tasks

- [ ] 1. Load Balancerインフラストラクチャの構築
- [ ] 1.1 グローバル静的外部IPアドレスの予約
  - フロントエンド用の固定IPアドレスを予約する
  - Cloud Console経由でのアクセスに必要なIPを確保する
  - DNSレコード設定に使用するIPアドレスを取得する
  - _Requirements: 3.4_

- [ ] 1.2 (P) Serverless NEGの作成
  - Cloud RunサービスをLoad Balancerのバックエンドとして登録する
  - asia-northeast1リージョンに配置する
  - フロントエンドCloud Runサービスと接続する
  - _Requirements: 3.4_

- [ ] 1.3 Backend Serviceの設定とCloud Armorポリシーのアタッチ
  - グローバルBackend Serviceを作成する
  - Serverless NEGをバックエンドとして追加する
  - 既存のCloud Armorポリシー（internal-access-limited-policy）を適用する
  - 社内IPからのアクセスのみを許可する設定を有効化する
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 1.4 URL Map、Target HTTPS Proxy、Forwarding Ruleの構成
  - URL Mapを作成してデフォルトバックエンドを設定する
  - SSL証明書を設定してHTTPS通信を有効化する
  - Target HTTPS Proxyを作成してURL MapとSSL証明書を関連付ける
  - Forwarding Ruleを作成して静的IPとHTTPSプロキシを接続する
  - HTTPS（ポート443）でのアクセスを有効化する
  - _Requirements: 3.4_

- [ ] 2. フロントエンドのVPC統合とingress設定
- [ ] 2.1 deploy-frontend.shへのVPC設定追加
  - VPC名（a11y-vpc）とサブネット名（a11y-cloudrun-subnet）の変数を追加する
  - gcloud run deployコマンドに`--network`と`--subnet`フラグを追加する
  - `--vpc-egress=all-traffic`フラグを追加してすべての送信トラフィックをVPC経由にする
  - `--ingress=internal-and-cloud-load-balancing`フラグを追加してLoad Balancer経由のアクセスのみを許可する
  - _Requirements: 2.1, 2.3, 5.2_

- [ ] 2.2 フロントエンドのVPC統合デプロイ
  - 更新したdeploy-frontend.shを使用してフロントエンドをデプロイする
  - VPC接続が正常に確立されることを確認する
  - Load Balancer経由でフロントエンドにアクセスできることを確認する
  - 直接URLでのアクセスが拒否されることを確認する
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 3. バックエンドのingress制限設定
- [ ] 3.1 deploy.shへのingress設定追加
  - gcloud run deployコマンドに`--ingress=internal`フラグを追加する
  - 既存のVPC設定（network、subnet、vpc-egress）は維持する
  - 決定論的URL形式の出力を継続する
  - _Requirements: 1.3, 5.1, 5.4_

- [ ] 3.2 バックエンドのingress制限デプロイ
  - 更新したdeploy.shを使用してバックエンドをデプロイする
  - VPC内部からのアクセスのみが許可されることを確認する
  - 外部からの直接アクセスが拒否されることを確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 4. 統合テストと動作検証
- [ ] 4.1 セキュリティ設定の検証
  - 外部IPからバックエンドへの直接アクセスが403または接続拒否になることを確認する
  - 社内ネットワークからLoad Balancer経由でフロントエンドにアクセスできることを確認する
  - 許可されていないIPからのアクセスがCloud Armorによってブロックされることを確認する
  - _Requirements: 1.1, 3.2, 3.3_

- [ ] 4.2 VPC内部通信の検証
  - フロントエンドからバックエンドAPIへのVPC経由通信が成功することを確認する
  - バックエンドからの外部通信が既存の静的IPで行われることを確認する
  - Cloud NAT経由での外部サイトへのアクセスが正常に動作することを確認する
  - _Requirements: 2.2, 4.1, 4.2, 4.3, 4.4_

- [ ] 4.3 既存機能の回帰テスト
  - 社内ネットワークからURL入力によるアクセシビリティ分析が正常に動作することを確認する
  - axe-core、Pa11y、Lighthouseの3エンジンによるマルチエンジン分析が正常に実行されることを確認する
  - Basic認証、フォーム認証、セッション認証を使用したサイト分析が動作することを確認する
  - 分析結果に違反箇所、改善提案、スクリーンショットが含まれることを確認する
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 5. ロールバック手順の整備
- [ ] 5.1 ロールバックスクリプトの作成
  - バックエンドのingress設定を`all`に戻すコマンドを文書化する
  - フロントエンドのingress設定を`all`に戻すコマンドを文書化する
  - 緊急時の復旧手順を明確化する
  - _Requirements: 5.3_

## Requirements Coverage

| Requirement | Tasks |
|-------------|-------|
| 1.1 | 3.2, 4.1 |
| 1.2 | 3.2 |
| 1.3 | 3.1, 3.2 |
| 1.4 | 3.2 |
| 2.1 | 2.1, 2.2 |
| 2.2 | 2.2, 4.2 |
| 2.3 | 2.1, 2.2 |
| 2.4 | 2.2 |
| 3.1 | 1.3 |
| 3.2 | 1.3, 4.1 |
| 3.3 | 1.3, 4.1 |
| 3.4 | 1.1, 1.2, 1.4 |
| 4.1 | 4.2 |
| 4.2 | 4.2 |
| 4.3 | 4.2 |
| 4.4 | 4.2 |
| 5.1 | 3.1 |
| 5.2 | 2.1 |
| 5.3 | 5.1 |
| 5.4 | 3.1 |
| 6.1 | 4.3 |
| 6.2 | 4.3 |
| 6.3 | 4.3 |
| 6.4 | 4.3 |
