# Research & Design Decisions

## Summary
- **Feature**: static-ip-egress
- **Discovery Scope**: Extension（既存Cloud Runデプロイへの機能追加）
- **Key Findings**:
  - Direct VPC egressはServerless VPC Access Connectorより低レイテンシ・高スループット
  - サブネットには/26以上が必要（IPアドレス使用量はインスタンス数×2）
  - Cloud NATはコントロールプレーンのみでパケットは通過しない（追加ホップなし）

## Research Log

### Direct VPC egress vs Serverless VPC Access Connector
- **Context**: Cloud Runから固定IPで外部通信する2つの方法を比較
- **Sources Consulted**:
  - [Direct VPC egress | Cloud Run Documentation](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc)
  - [Static outbound IP address | Cloud Run Documentation](https://docs.cloud.google.com/run/docs/configuring/static-outbound-ip)
- **Findings**:
  - Direct VPC egress: Cloud Runインスタンスに直接VPC内部IPを割り当て、中間プロキシなし
  - Serverless VPC Access Connector: VMフリートを経由するためアイドル時も課金
  - Direct VPC egressの方が低レイテンシ、高スループット、管理オーバーヘッドなし
- **Implications**: Direct VPC egressを採用

### サブネット要件
- **Context**: Direct VPC egress用のサブネットサイズ要件
- **Sources Consulted**: [Best practices for Cloud Run networking](https://cloud.google.com/run/docs/configuring/networking-best-practices)
- **Findings**:
  - /26以上のサブネットが必要
  - IPアドレス使用量 = インスタンス数 × 2
  - RFC 6598 (100.64.0.0/10) または標準プライベートレンジを推奨
- **Implications**: 10.10.0.0/26（64アドレス）で最大32インスタンスをサポート

### Cloud NAT構成
- **Context**: 固定IPアドレスでの外向き通信設定
- **Sources Consulted**: [Static outbound IP address | Cloud Run](https://docs.cloud.google.com/run/docs/configuring/static-outbound-ip)
- **Findings**:
  - Cloud NATはコントロールプレーンのみ（パケットは通過しない）
  - 手動IP割り当てモードで固定IPを使用
  - 大規模ワークロードでは複数IPが必要な場合あり
- **Implications**: 単一固定IPで開始、必要に応じて拡張

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Direct VPC egress | Cloud RunにVPC IPを直接割り当て | 低レイテンシ、管理不要、ゼロスケール時コストなし | /26以上のサブネット必要 | GCP推奨パターン |
| Serverless VPC Access Connector | VMフリート経由 | 設定がシンプル | アイドル課金、レイテンシ増 | レガシーパターン |

## Design Decisions

### Decision: Direct VPC egressの採用
- **Context**: 固定IPアドレスでの外向き通信を実現する方法の選択
- **Alternatives Considered**:
  1. Direct VPC egress — Cloud Runに直接VPC IPを割り当て
  2. Serverless VPC Access Connector — VMプロキシ経由
- **Selected Approach**: Direct VPC egress
- **Rationale**:
  - GCP推奨の最新パターン
  - アイドル時のコネクタ課金なし
  - 低レイテンシ・高スループット
- **Trade-offs**: サブネット管理が必要だが、スクリプトで自動化
- **Follow-up**: IPアドレス使用量のモニタリング

### Decision: 冪等性のあるデプロイスクリプト
- **Context**: VPCインフラとCloud Runを一括デプロイ
- **Selected Approach**: 各リソースの存在チェック後、なければ作成
- **Rationale**: 何度実行しても同じ結果を保証
- **Trade-offs**: スクリプトが長くなるが、安全性向上

## Risks & Mitigations
- コールドスタート時間の増加 — スタートアッププローブの設定を検討
- サブネットIPアドレス枯渇 — モニタリングと/24への拡張を検討
- Cloud NAT課金 — 使用量に応じた月額$6〜$15の追加コスト

## References
- [Direct VPC egress | Cloud Run Documentation](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc)
- [Static outbound IP address | Cloud Run Documentation](https://docs.cloud.google.com/run/docs/configuring/static-outbound-ip)
- [Best practices for Cloud Run networking](https://cloud.google.com/run/docs/configuring/networking-best-practices)
