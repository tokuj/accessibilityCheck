# GCPインフラストラクチャ構成図

## 概要

アクセシビリティチェックツールのCloud Run構成。フロントエンド（React SPA）とバックエンド（Node.js + Playwright）を独立したCloud Runサービスとしてデプロイ。バックエンドは固定IPアドレスによる外向き通信を実現し、IP制限のある社内ツールへのアクセスを可能にする。

## サービスURL

| サービス | URL |
|---------|-----|
| フロントエンド | https://a11y-check-frontend-783872951114.asia-northeast1.run.app |
| バックエンドAPI | https://a11y-check-api-783872951114.asia-northeast1.run.app |
| 固定IP（外向き通信） | 35.243.70.169 |

## アーキテクチャ図

```mermaid
graph TB
    subgraph Internet["インターネット"]
        User["ユーザー / ブラウザ"]
        TargetSite["対象Webサイト"]
        IPRestrictedSite["IP制限サイト<br/>(社内ツール等)"]
    end

    subgraph GCP["GCP Project: itgproto"]
        subgraph CloudRun["Cloud Run (asia-northeast1)"]
            Frontend["a11y-check-frontend<br/>- nginx:alpine-slim<br/>- React SPA配信"]
            Backend["a11y-check-api<br/>- /api/health<br/>- /api/analyze<br/>- /api/egress-ip"]
        end

        subgraph AR["Artifact Registry"]
            FrontendImage["a11y-check-frontend:latest"]
            BackendImage["a11y-check-api:latest"]
        end

        subgraph VPC["VPC: a11y-vpc"]
            subgraph Subnet["Subnet: a11y-cloudrun-subnet<br/>10.10.0.0/26"]
                VPCEndpoint["Direct VPC Egress<br/>接続ポイント"]
            end

            Router["Cloud Router<br/>a11y-router"]

            subgraph NAT["Cloud NAT: a11y-nat"]
                NATConfig["NAT設定<br/>- Manual IP Mode<br/>- Custom Subnet"]
            end
        end

        StaticIP["静的外部IP<br/>a11y-static-ip<br/>35.243.70.169"]
    end

    User -->|HTTPS| Frontend
    Frontend -.->|静的ファイル配信| User
    User -->|API リクエスト| Backend
    FrontendImage -.->|デプロイ| Frontend
    BackendImage -.->|デプロイ| Backend
    Backend -->|VPC Egress: all-traffic| VPCEndpoint
    VPCEndpoint --> Router
    Router --> NAT
    NAT --> StaticIP
    StaticIP -->|固定IPで通信| TargetSite
    StaticIP -->|固定IPで通信| IPRestrictedSite
```

## ネットワークフロー詳細

```mermaid
sequenceDiagram
    participant Client as クライアント
    participant CR as Cloud Run<br/>a11y-check-api
    participant VPC as VPC Subnet<br/>10.10.0.0/26
    participant NAT as Cloud NAT
    participant IP as 静的IP<br/>35.243.70.169
    participant Target as 対象サイト

    Client->>CR: POST /api/analyze
    Note over CR: Playwright起動<br/>アクセシビリティ分析開始

    CR->>VPC: 外向き通信<br/>(vpc-egress: all-traffic)
    VPC->>NAT: NAT変換リクエスト
    NAT->>IP: 送信元IPを変換
    IP->>Target: HTTPSリクエスト<br/>(送信元: 35.243.70.169)

    Target-->>IP: レスポンス
    IP-->>NAT: レスポンス転送
    NAT-->>VPC: NAT逆変換
    VPC-->>CR: レスポンス受信

    Note over CR: axe-core分析実行<br/>レポート生成
    CR-->>Client: 分析結果レスポンス
```

## リソース一覧

| リソース種別 | リソース名 | リージョン | 詳細 |
|-------------|-----------|-----------|------|
| Cloud Run | a11y-check-frontend | asia-northeast1 | Memory: 256Mi, nginx:alpine-slim |
| Cloud Run | a11y-check-api | asia-northeast1 | Memory: 2Gi, Timeout: 300s, Playwright |
| VPCネットワーク | a11y-vpc | グローバル | カスタムモード |
| サブネット | a11y-cloudrun-subnet | asia-northeast1 | CIDR: 10.10.0.0/26 (64アドレス) |
| 静的外部IP | a11y-static-ip | asia-northeast1 | 35.243.70.169 |
| Cloud Router | a11y-router | asia-northeast1 | VPC: a11y-vpc |
| Cloud NAT | a11y-nat | asia-northeast1 | Router: a11y-router |
| Artifact Registry | cloud-run-source-deploy | asia-northeast1 | Docker形式 |

## デプロイフロー

```mermaid
flowchart TD
    Start([deploy.sh 実行]) --> SetProject[GCPプロジェクト設定]

    SetProject --> CheckVPC{VPC存在?}
    CheckVPC -->|No| CreateVPC[VPC作成<br/>a11y-vpc]
    CheckVPC -->|Yes| ReuseVPC[既存VPC再利用]
    CreateVPC --> CheckSubnet
    ReuseVPC --> CheckSubnet

    CheckSubnet{Subnet存在?}
    CheckSubnet -->|No| CreateSubnet[Subnet作成<br/>10.10.0.0/26]
    CheckSubnet -->|Yes| ReuseSubnet[既存Subnet再利用]
    CreateSubnet --> CheckIP
    ReuseSubnet --> CheckIP

    CheckIP{静的IP存在?}
    CheckIP -->|No| CreateIP[静的IP予約]
    CheckIP -->|Yes| ReuseIP[既存IP再利用]
    CreateIP --> CheckRouter
    ReuseIP --> CheckRouter

    CheckRouter{Router存在?}
    CheckRouter -->|No| CreateRouter[Router作成]
    CheckRouter -->|Yes| ReuseRouter[既存Router再利用]
    CreateRouter --> CheckNAT
    ReuseRouter --> CheckNAT

    CheckNAT{NAT存在?}
    CheckNAT -->|No| CreateNAT[NAT作成]
    CheckNAT -->|Yes| ReuseNAT[既存NAT再利用]
    CreateNAT --> DockerBuild
    ReuseNAT --> DockerBuild

    DockerBuild[Docker Build<br/>--platform linux/amd64] --> DockerPush[Docker Push]
    DockerPush --> Deploy[Cloud Run Deploy<br/>--vpc-egress=all-traffic]
    Deploy --> ShowResult[結果表示<br/>- サービスURL<br/>- 固定IP]
    ShowResult --> End([完了])
```

## API エンドポイント

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/api/health` | GET | ヘルスチェック |
| `/api/analyze` | POST | アクセシビリティ分析実行 |
| `/api/egress-ip` | GET | 外向き通信の固定IP確認 |

## 固定IPアドレス情報

社内ツールのIP許可リストに追加するIPアドレス:

```
35.243.70.169
```

Cloud Runからの全ての外向き通信（Playwright経由のWebサイトアクセス含む）はこのIPアドレスから発信されます。

## 参考リンク

- [Direct VPC egress | Cloud Run](https://cloud.google.com/run/docs/configuring/vpc-direct-vpc)
- [Static outbound IP | Cloud Run](https://cloud.google.com/run/docs/configuring/static-outbound-ip)
- [Cloud NAT概要](https://cloud.google.com/nat/docs/overview)
