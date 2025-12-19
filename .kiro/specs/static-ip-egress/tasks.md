# Implementation Plan

## Task 1: VPCインフラストラクチャの作成ロジックをdeploy.shに追加

- [x] 1.1 (P) VPCネットワーク作成ロジックを追加する
  - VPC関連の設定変数を定義（VPC_NAME、SUBNET_NAME、SUBNET_RANGE等）
  - gcloud compute networks describeで存在確認を行う
  - 存在しない場合はgcloud compute networks createでカスタムモードVPCを作成
  - 既に存在する場合は再利用するメッセージを表示
  - _Requirements: 1.1, 1.4_

- [x] 1.2 (P) サブネット作成ロジックを追加する
  - gcloud compute networks subnets describeで存在確認を行う
  - 存在しない場合はgcloud compute networks subnets createでサブネットを作成
  - CIDRレンジは10.10.0.0/26（/26以上）を使用
  - 既に存在する場合は再利用するメッセージを表示
  - _Requirements: 1.2, 1.3, 1.5_

## Task 2: 固定IPアドレスとCloud NAT構成を追加

- [x] 2.1 静的外部IPアドレス予約ロジックを追加する
  - gcloud compute addresses describeで存在確認を行う
  - 存在しない場合はgcloud compute addresses createで予約
  - 既に存在する場合は再利用するメッセージを表示
  - 予約したIPアドレスを変数に格納して後続処理で使用
  - _Requirements: 2.1, 2.3, 2.4_

- [x] 2.2 Cloud Router作成ロジックを追加する
  - gcloud compute routers describeで存在確認を行う
  - 存在しない場合はgcloud compute routers createで作成
  - 既に存在する場合は再利用するメッセージを表示
  - _Requirements: 3.1, 3.5_

- [x] 2.3 Cloud NAT作成ロジックを追加する
  - gcloud compute routers nats describeで存在確認を行う
  - 存在しない場合はgcloud compute routers nats createで作成
  - --nat-custom-subnet-ip-rangesでサブネットを指定
  - --nat-external-ip-poolで固定IPを指定
  - 既に存在する場合は再利用するメッセージを表示
  - _Requirements: 3.2, 3.3, 3.4, 3.6_

## Task 3: Cloud RunデプロイにDirect VPC Egress設定を追加

- [x] 3.1 gcloud run deployコマンドにVPC egressオプションを追加する
  - --networkオプションでVPCネットワークを指定
  - --subnetオプションでサブネットを指定
  - --vpc-egress=all-trafficで全外向きトラフィックをVPC経由に設定
  - 既存のデプロイオプション（memory、timeout等）は維持
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 3.2 デプロイ完了時の結果表示を拡張する
  - サービスURLの表示を維持
  - 固定IPアドレスを取得して表示
  - 社内ツール管理者への案内メッセージを追加
  - _Requirements: 2.2, 5.3_

## Task 4: デプロイ実行と動作確認

- [x] 4.1 deploy.shを実行してVPCインフラとCloud Runをデプロイする
  - スクリプトを実行してすべてのリソースが作成されることを確認
  - デプロイ完了後に表示されるサービスURLと固定IPを確認
  - エラーが発生しないことを確認
  - _Requirements: 5.1, 5.2, 5.4_

- [x] 4.2 固定IPアドレスが正しく機能することを確認する
  - curlでapi.ipify.org等にアクセスし、外部IPを確認
  - 表示される外部IPが予約した固定IPと一致することを確認
  - _Requirements: 4.4, 6.1_

- [x] 4.3 既存APIエンドポイントの動作を確認する
  - /api/healthエンドポイントで200 OKが返ることを確認
  - /api/analyzeエンドポイントでアクセシビリティ分析が動作することを確認
  - _Requirements: 6.2, 6.3_

## Task 5: テストとドキュメント

- [ ]* 5.1 deploy.shスクリプトのテストを更新する
  - VPC関連の設定変数が含まれていることを検証するテストを追加
  - --network、--subnet、--vpc-egressオプションが含まれていることを検証
  - 固定IPアドレス表示処理が含まれていることを検証
  - _Requirements: 5.1, 5.2, 5.3_
