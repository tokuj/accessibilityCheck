# Requirements Document

## Introduction

本仕様は、アクセシビリティチェックツールのバックエンドAPI（Cloud Run）からの外向き通信に固定IPアドレスを使用するための要件を定義する。IPアドレス制限のある社内ツールのアクセシビリティチェックを可能にするため、VPC + Cloud NATによるDirect VPC egress構成を採用する。

## Requirements

### Requirement 1: VPCネットワーク構成

**Objective:** As a 開発者, I want Cloud Run用のVPCネットワークを構成する, so that 固定IPアドレスでの外向き通信が可能になる

#### Acceptance Criteria
1. The deploy script shall GCPプロジェクト「itgproto」にVPCネットワーク「a11y-vpc」を作成する
2. The deploy script shall asia-northeast1リージョンにサブネット「a11y-cloudrun-subnet」を作成する
3. The subnet shall /26以上のCIDRレンジ（10.10.0.0/26）を使用する
4. If VPCネットワークが既に存在する場合, the deploy script shall 既存のネットワークを再利用する
5. If サブネットが既に存在する場合, the deploy script shall 既存のサブネットを再利用する

### Requirement 2: 固定IPアドレスの割り当て

**Objective:** As a 開発者, I want 固定外部IPアドレスを予約する, so that 社内ツールのIP許可リストに登録できる

#### Acceptance Criteria
1. The deploy script shall asia-northeast1リージョンに静的外部IPアドレス「a11y-static-ip」を予約する
2. When デプロイが完了した時, the deploy script shall 予約した固定IPアドレスを表示する
3. If 静的IPアドレスが既に予約済みの場合, the deploy script shall 既存のIPアドレスを再利用する
4. The static IP address shall Cloud NATの外部IPプールとして使用される

### Requirement 3: Cloud NAT構成

**Objective:** As a 開発者, I want Cloud NATを構成する, so that Cloud Runからの外向き通信が固定IPアドレスを使用する

#### Acceptance Criteria
1. The deploy script shall Cloud Router「a11y-router」を作成する
2. The deploy script shall Cloud NAT「a11y-nat」を作成する
3. The Cloud NAT shall 静的IPアドレス「a11y-static-ip」を外部IPプールとして使用する
4. The Cloud NAT shall サブネット「a11y-cloudrun-subnet」からのトラフィックをNAT変換する
5. If Cloud Routerが既に存在する場合, the deploy script shall 既存のルーターを再利用する
6. If Cloud NATが既に存在する場合, the deploy script shall 既存のNATを再利用する

### Requirement 4: Cloud Run Direct VPC Egress設定

**Objective:** As a 開発者, I want Cloud RunをVPC経由で外部通信するよう設定する, so that すべての外向きトラフィックがCloud NATを経由する

#### Acceptance Criteria
1. The Cloud Run service shall VPCネットワーク「a11y-vpc」に接続する
2. The Cloud Run service shall サブネット「a11y-cloudrun-subnet」を使用する
3. The Cloud Run service shall vpc-egressを「all-traffic」に設定する
4. When Cloud Runからターゲットサイトにアクセスした時, the request shall 固定IPアドレスから発信される

### Requirement 5: デプロイスクリプトの拡張

**Objective:** As a 開発者, I want deploy.shを拡張する, so that VPCインフラとCloud Runを一括でデプロイできる

#### Acceptance Criteria
1. The deploy script shall VPCインフラストラクチャの作成ロジックを含む
2. The deploy script shall 冪等性を確保する（何度実行しても同じ結果）
3. When デプロイが完了した時, the deploy script shall サービスURLと固定IPアドレスの両方を表示する
4. If いずれかのステップでエラーが発生した場合, the deploy script shall エラーメッセージを表示して終了する

### Requirement 6: 動作確認

**Objective:** As a 開発者, I want 固定IPアドレスが正しく機能することを確認する, so that IPアドレス制限のあるサイトへのアクセスが可能であることを検証できる

#### Acceptance Criteria
1. When Cloud Runから外部サービス（api.ipify.org等）にアクセスした時, the response shall 予約した固定IPアドレスを返す
2. The Cloud Run service shall 既存のヘルスチェックエンドポイント（/api/health）で正常に応答する
3. The Cloud Run service shall 既存の分析エンドポイント（/api/analyze）で正常にアクセシビリティ分析を実行する
