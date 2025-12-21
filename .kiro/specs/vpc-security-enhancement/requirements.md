# Requirements Document

## Introduction

本ドキュメントは、アクセシビリティチェックツールのセキュリティ強化に関する要件を定義します。現在、フロントエンド・バックエンドともにインターネット経由でどこからでもアクセス可能な状態ですが、これを以下のように制限します：

1. **バックエンドアクセス制限**: VPCコネクタ経由の内部通信のみに限定
2. **フロントエンドVPC統合**: バックエンドと同一VPC内に配置
3. **WAF適用**: Cloud Armorポリシー（internal-access-limited-policy）による社内アクセス制限
4. **外部通信の維持**: バックエンドからの外部通信（対象サイト分析用）は既存の静的IPアドレスを継続使用

## Project Description (Input)

セキュリティ強化を行います。今はフロントエンドもバックエンドもどこからでもアクセスが可能になっています。これを修正します。
バックエンドは同一VPCのみからアクセスができるようにし、フロントエンドはバックエンドと同一のVPC内に配置します。
また下記のWAFを通し、社内のみからしかアクセスできないようにします。
https://console.cloud.google.com/net-security/securitypolicies/details/internal-access-limited-policy?project=itgproto&tab=targets

ただし、バックエンドが外に通信するIPアドレスは引き続き同じIPアドレスを用います。

## Requirements

### Requirement 1: バックエンドサービスのVPC内部限定アクセス

**Objective:** As a セキュリティ担当者, I want バックエンドAPIへのアクセスをVPC内部からのみに制限したい, so that 外部からの不正アクセスを防止し、セキュリティリスクを低減できる

#### Acceptance Criteria

1. When 外部ネットワークからa11y-check-apiへHTTPリクエストが送信される, the Cloud Run shall 403 Forbiddenまたは接続拒否を返す
2. When VPCコネクタ経由でa11y-check-apiへHTTPリクエストが送信される, the Cloud Run shall 正常にリクエストを処理し、レスポンスを返す
3. The a11y-check-api shall Cloud Runの`--ingress=internal`設定により内部トラフィックのみを許可する
4. The a11y-check-api shall 既存のVPCコネクタ（a11y-connector）を使用してVPCに接続する

### Requirement 2: フロントエンドサービスのVPC統合

**Objective:** As a 開発者, I want フロントエンドをバックエンドと同一VPC内に配置したい, so that フロントエンドからバックエンドへの通信がVPC内部で完結し、セキュリティを確保できる

#### Acceptance Criteria

1. The a11y-check-frontend shall バックエンドと同一のVPCコネクタ（a11y-connector）を使用してVPCに接続する
2. When ブラウザからバックエンドAPIへリクエストを送信する, the リクエスト shall Load Balancer経由でCloud Armorポリシーを通過し、バックエンドに転送される
3. The a11y-check-frontend shall Cloud Runの`--vpc-egress=all-traffic`設定によりすべての送信トラフィックをVPC経由にする
4. When フロントエンドがバックエンドAPIを呼び出す, the フロントエンド shall Load BalancerのURL（同一オリジン /api/*）を使用する

### Requirement 3: WAFによるアクセス制限

**Objective:** As a セキュリティ担当者, I want フロントエンドへのアクセスをCloud Armor WAFポリシーで社内に制限したい, so that 許可されたネットワークからのみアクセス可能となる

#### Acceptance Criteria

1. The a11y-check-frontend shall Cloud Armorセキュリティポリシー（internal-access-limited-policy）の対象として設定される
2. When 社内ネットワーク（許可されたIPレンジ）からアクセスする, the Cloud Armor shall リクエストを許可する
3. When 許可されていないIPアドレスからアクセスする, the Cloud Armor shall リクエストをブロックし、403 Forbiddenを返す
4. The フロントエンドアクセス shall External Application Load Balancer経由でCloud Armorポリシーを通過する

### Requirement 4: バックエンドの外部通信維持

**Objective:** As a システム管理者, I want バックエンドからの外部通信（対象サイト分析用）を既存の静的IPで維持したい, so that 分析対象サイトのIPホワイトリスト設定を変更せずに運用を継続できる

#### Acceptance Criteria

1. The a11y-check-api shall 外部サイト分析時に既存のCloud NAT経由で通信を行う
2. The a11y-check-api shall 外部通信時に既存の静的外部IPアドレスを送信元として使用する
3. When バックエンドがアクセシビリティ分析対象サイトに接続する, the Cloud NAT shall 既存の静的IPアドレスをNATアドレスとして使用する
4. The VPCセキュリティ変更 shall 既存のCloud NAT設定および静的IPアドレスに影響を与えない

### Requirement 5: デプロイスクリプトとインフラ設定の更新

**Objective:** As a 開発者, I want デプロイスクリプトがVPC設定を含むようにしたい, so that 今後のデプロイでもセキュリティ設定が自動的に適用される

#### Acceptance Criteria

1. The deploy.sh shall バックエンドデプロイ時に`--ingress=internal`フラグを含める
2. The deploy-frontend.sh shall フロントエンドデプロイ時に`--vpc-connector`および`--vpc-egress`フラグを含める
3. When 新規デプロイを実行する, the デプロイスクリプト shall VPCセキュリティ設定を自動的に適用する
4. The デプロイスクリプト shall 決定論的URL形式（SERVICE-PROJECT_NUMBER.REGION.run.app）を継続して使用する

### Requirement 6: 既存機能の維持（回帰防止）

**Objective:** As a ユーザー, I want セキュリティ変更後も全機能が正常に動作してほしい, so that セキュリティ強化により業務に支障が出ない

#### Acceptance Criteria

1. When 社内ネットワークからフロントエンドにアクセスする, the アプリケーション shall 従来通りURL入力によるアクセシビリティ分析機能を提供する
2. When 分析リクエストを実行する, the バックエンド shall axe-core、Pa11y、Lighthouseによるマルチエンジン分析を正常に実行する
3. When 認証が必要なサイトを分析する, the 認証機能（Basic認証、フォーム認証、セッション認証） shall 従来通り動作する
4. The 分析結果 shall 違反箇所、改善提案、スクリーンショットを含む完全なレポートを返す

## Non-Functional Requirements

### セキュリティ

- 通信はすべてHTTPSで暗号化される
- VPC Service Controlsとの互換性を考慮する
- 監査ログ（Cloud Audit Logs）でアクセス履歴を追跡可能にする

### パフォーマンス

- VPCコネクタ追加による遅延は最小限に抑える（追加遅延 < 50ms）
- 既存の分析処理時間に大きな影響を与えない

### 運用

- 設定変更はTerraformまたはgcloudコマンドで再現可能にする
- ロールバック手順を文書化する
