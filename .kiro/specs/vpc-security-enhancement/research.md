# Research & Design Decisions

## Summary

- **Feature**: `vpc-security-enhancement`
- **Discovery Scope**: Complex Integration
- **Key Findings**:
  - Cloud Runの`ingress=internal`設定でバックエンドへのVPC内部限定アクセスを実現可能
  - フロントエンドはDirect VPC egress設定でVPC経由のバックエンド通信が可能
  - Cloud ArmorはExternal Application Load Balancer経由でのみ適用可能、Serverless NEGとBackend Serviceの構成が必要

## Research Log

### Cloud Run Ingress設定の調査

- **Context**: バックエンドサービスへのアクセスをVPC内部からのみに制限する方法
- **Sources Consulted**:
  - [Cloud Run Ingress Documentation](https://docs.cloud.google.com/run/docs/securing/ingress)
  - [Private networking and Cloud Run](https://docs.cloud.google.com/run/docs/securing/private-networking)
- **Findings**:
  - `ingress=internal`: VPCネットワーク、Internal Load Balancer、同一プロジェクトのGoogle Cloudサービスからのみアクセス許可
  - `ingress=internal-and-cloud-load-balancing`: 上記に加え、External Application Load Balancerからのアクセスも許可
  - `ingress=all`: すべてのリクエストを許可（デフォルト）
- **Implications**:
  - バックエンドには`--ingress=internal`を設定し、フロントエンドのみがVPC経由でアクセス可能にする
  - フロントエンドには`--ingress=internal-and-cloud-load-balancing`を設定し、Load Balancer経由のアクセスを許可

### Cloud Run VPC Egress設定の調査

- **Context**: フロントエンドからバックエンドへの内部通信経路の確保
- **Sources Consulted**:
  - [Direct VPC egress](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc)
  - [VPC with connectors](https://cloud.google.com/run/docs/configuring/vpc-connectors)
- **Findings**:
  - Direct VPC egress（推奨）: VPCコネクタ不要でVPCネットワークにトラフィックを送信可能
  - 現在のバックエンドは既にDirect VPC egress（`--network`, `--subnet`, `--vpc-egress=all-traffic`）を使用
  - フロントエンドも同様の設定でVPC経由の通信が可能
  - `--vpc-egress=all-traffic`で全送信トラフィックをVPC経由にすることで、バックエンドへのinternal通信が成立
- **Implications**:
  - フロントエンドに`--network`, `--subnet`, `--vpc-egress=all-traffic`を追加
  - 既存のバックエンド設定はそのまま維持し、`--ingress=internal`のみ追加

### Cloud Armor + External Application Load Balancer構成の調査

- **Context**: フロントエンドへのアクセスをCloud Armorで社内IPに制限
- **Sources Consulted**:
  - [Setting up HTTPS serverless](https://docs.cloud.google.com/load-balancing/docs/https/setting-up-https-serverless)
  - [Integrating Cloud Armor](https://cloud.google.com/armor/docs/integrating-cloud-armor)
  - [Security policy overview](https://cloud.google.com/armor/docs/security-policy-overview)
- **Findings**:
  - Cloud ArmorはExternal Application Load Balancerのバックエンドサービスにのみ適用可能
  - Cloud RunをバックエンドにするにはServerless NEGが必要
  - 構成要素: 静的IP → URL Map → Target HTTPS Proxy → Forwarding Rule → Backend Service → Serverless NEG → Cloud Run
  - Cloud Armorセキュリティポリシーは既存（`internal-access-limited-policy`）を使用
- **Implications**:
  - フロントエンド用のLoad Balancer構成を新規作成
  - `--ingress=internal-and-cloud-load-balancing`でLoad Balancer経由のトラフィックを許可
  - Cloud Armorポリシーをバックエンドサービスにアタッチ

### 既存インフラ構成の分析

- **Context**: 現在のデプロイ構成と変更点の特定
- **Sources Consulted**:
  - `scripts/deploy.sh` - バックエンドデプロイスクリプト
  - `scripts/deploy-frontend.sh` - フロントエンドデプロイスクリプト
- **Findings**:
  - バックエンド: VPC（a11y-vpc）、サブネット（a11y-cloudrun-subnet）、Cloud Router、Cloud NAT、静的IP設定済み
  - バックエンド: `--network`, `--subnet`, `--vpc-egress=all-traffic`設定済み（Direct VPC egress）
  - バックエンド: `--allow-unauthenticated`で未認証アクセス許可（変更不要、ingressで制御）
  - フロントエンド: VPC設定なし、シンプルなCloud Runデプロイ
- **Implications**:
  - バックエンド: `--ingress=internal`追加のみ
  - フロントエンド: VPC設定追加 + `--ingress=internal-and-cloud-load-balancing`追加
  - フロントエンド: Load Balancer構成を新規作成

### Cloud Armorポリシー内容の確認

- **Context**: 既存のCloud Armorポリシー（internal-access-limited-policy）の実際のルール確認
- **Sources Consulted**:
  - `gcloud compute security-policies describe internal-access-limited-policy --project=itgproto`
- **Findings**:
  - **ポリシー名**: `internal-access-limited-policy`
  - **説明**: 社内N/Wからのアクセスのみ許可
  - **Priority 10 (allow)**: 社内ネットワーク7つのIPレンジを許可
    - 221.116.1.10/32
    - 221.116.1.32/30
    - 61.208.159.130/32
    - 61.208.159.144/30
    - 27.110.19.112/28
    - 27.110.26.112/28
    - 39.110.199.38/32
  - **Priority 2147483647 (deny)**: その他すべてを403で拒否
  - **Layer 7 DDoS Defense**: 無効
  - **JSON Parsing**: 無効
- **Implications**:
  - 既存ポリシーをそのままBackend Serviceにアタッチ可能
  - 追加のルール作成は不要
  - ポリシールールの変更は本設計の範囲外

### ドメイン・DNS設定の確認

- **Context**: SSL証明書用のドメイン確認
- **Sources Consulted**:
  - `gcloud dns managed-zones list --project=itgproto`
  - `gcloud dns record-sets list --zone=itgprototype-com`
- **Findings**:
  - **ドメイン**: itgprototype.com（Cloud DNS: itgprototype-com ゾーン）
  - **既存サブドメイン**: backstage, biscope, blsreporter, cpn-tgt-*, cx-healthchk, cxmpf, cxmpf-api等多数
  - **a11y-check.itgprototype.com**: 未使用（利用可能）
- **Implications**:
  - a11y-check.itgprototype.com をフロントエンド用に使用可能
  - Google-managed SSL証明書を使用
  - DNS AレコードをLoad BalancerのIPアドレスに設定

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Direct VPC egress + ingress=internal | バックエンドをVPC内部限定、フロントエンドもDirect VPC egressでVPC経由通信 | シンプル、既存構成を活用、追加コストなし | フロントエンドへのWAF適用にはLoad Balancer必要 | 選択: バックエンドのアクセス制限 |
| External ALB + Cloud Armor | Load Balancer経由でCloud Armorポリシー適用 | IPベースのアクセス制御、DDoS保護 | 追加リソース・コスト発生、構成複雑化 | 選択: フロントエンドのWAF保護 |
| IAP (Identity-Aware Proxy) | ユーザー認証ベースのアクセス制御 | 細かいユーザー制御 | 設定が複雑、ユーザーログインが必要 | 不採用: IP制限のみ要求 |

## Design Decisions

### Decision: バックエンドIngress設定

- **Context**: バックエンドAPIへの外部からのアクセスを遮断
- **Alternatives Considered**:
  1. `ingress=all` + Firewall Rules - 現状維持、ファイアウォールで制御
  2. `ingress=internal` - Cloud Run組み込み機能でVPC内部限定
  3. `ingress=internal-and-cloud-load-balancing` - Load Balancer経由も許可
- **Selected Approach**: `ingress=internal`
- **Rationale**: バックエンドはフロントエンドからのVPC内部通信のみ受け付ければよく、Load Balancer経由のアクセスは不要
- **Trade-offs**: デバッグ時に直接アクセスできなくなるが、セキュリティが向上
- **Follow-up**: デプロイ後にVPC外からのアクセス拒否を検証

### Decision: フロントエンドLoad Balancer構成

- **Context**: Cloud ArmorをCloud Runフロントエンドに適用
- **Alternatives Considered**:
  1. Cloud Runの直接URL + IAP - 認証ベースのアクセス制御
  2. External ALB + Serverless NEG + Cloud Armor - IP制限ベースのWAF
  3. Cloud Run直接URL + ingress=internal - VPC内部限定（社外ユーザーアクセス不可）
- **Selected Approach**: External ALB + Serverless NEG + Cloud Armor
- **Rationale**: 既存のCloud Armorポリシー（internal-access-limited-policy）を活用可能、IPベースの制限が要件に合致
- **Trade-offs**: 構成が複雑化、追加コスト発生（Load Balancer, 静的IP）
- **Follow-up**: SSL証明書の設定、ドメイン名の決定

### Decision: フロントエンドVPC Egress設定

- **Context**: フロントエンドからバックエンドへのVPC内部通信
- **Alternatives Considered**:
  1. VPC Connector経由 - 従来型のVPC接続
  2. Direct VPC egress - 推奨される新しい方式
- **Selected Approach**: Direct VPC egress（バックエンドと同一構成）
- **Rationale**: バックエンドと同じVPC・サブネットを使用することで構成を統一、VPC Connectorより推奨される方式
- **Trade-offs**: サブネットのIP範囲内でIPが割り当てられる
- **Follow-up**: サブネットのIP範囲（/26=64アドレス）が十分か確認

## Risks & Mitigations

- **サービス中断リスク**: ingress設定変更時にアクセス不可となる可能性
  - 対策: 事前に別リビジョンでテスト、段階的なロールアウト
- **Load Balancer構成エラー**: 複雑な構成でミスの可能性
  - 対策: Terraformまたはgcloudスクリプトで構成を文書化・自動化
- **コスト増加**: Load Balancer、静的IPの追加コスト
  - 対策: 事前にコスト試算、不要リソースの削除確認
- **SSL証明書管理**: Load Balancer用のSSL証明書が必要
  - 対策: Google-managed SSL certificateを使用

## References

- [Cloud Run Ingress Documentation](https://docs.cloud.google.com/run/docs/securing/ingress) - ingress設定の公式ドキュメント
- [Direct VPC egress](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc) - VPC直接接続の設定
- [Setting up HTTPS serverless](https://docs.cloud.google.com/load-balancing/docs/https/setting-up-https-serverless) - Serverless NEGを使用したLoad Balancer構成
- [Cloud Armor Security Policies](https://cloud.google.com/armor/docs/security-policy-overview) - セキュリティポリシーの概要
- [Private networking and Cloud Run](https://docs.cloud.google.com/run/docs/securing/private-networking) - プライベートネットワーク構成
