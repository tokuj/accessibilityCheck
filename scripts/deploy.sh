#!/bin/bash
# Cloud Run デプロイスクリプト
# GCPプロジェクト「itgproto」にバックエンドAPIをデプロイする
# VPCインフラストラクチャ + Cloud NATによる固定IP egress対応

set -e  # エラー時に即終了

# 設定
PROJECT_ID="itgproto"
REGION="asia-northeast1"
SERVICE_NAME="a11y-check-api"
IMAGE_NAME="a11y-check-api"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy"

# VPCインフラストラクチャ設定
VPC_NAME="a11y-vpc"
SUBNET_NAME="a11y-cloudrun-subnet"
SUBNET_RANGE="10.10.0.0/26"
ROUTER_NAME="a11y-router"
NAT_NAME="a11y-nat"
STATIC_IP_NAME="a11y-static-ip"

# CORS設定
# フロントエンドのホスティングURLを設定（複数指定可能：カンマ区切り）
# 本番フロントエンドと開発環境（localhost:5173）の両方を許可
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-https://a11y-check-frontend-783872951114.asia-northeast1.run.app,http://localhost:5173}"

echo "=========================================="
echo "Cloud Run デプロイ開始"
echo "=========================================="
echo "プロジェクト: ${PROJECT_ID}"
echo "リージョン: ${REGION}"
echo "サービス名: ${SERVICE_NAME}"
echo "=========================================="

# GCPプロジェクト設定
echo "GCPプロジェクトを設定中..."
gcloud config set project ${PROJECT_ID}

# ==========================================
# VPCインフラストラクチャのセットアップ
# ==========================================

# VPCネットワーク作成（存在チェック付き）
echo "VPCネットワークを確認中..."
if gcloud compute networks describe ${VPC_NAME} --project=${PROJECT_ID} &>/dev/null; then
    echo "VPCネットワーク ${VPC_NAME} は既に存在します。再利用します。"
else
    echo "VPCネットワーク ${VPC_NAME} を作成中..."
    gcloud compute networks create ${VPC_NAME} \
        --project=${PROJECT_ID} \
        --subnet-mode=custom
    echo "VPCネットワーク ${VPC_NAME} を作成しました。"
fi

# サブネット作成（存在チェック付き）
echo "サブネットを確認中..."
if gcloud compute networks subnets describe ${SUBNET_NAME} --region=${REGION} --project=${PROJECT_ID} &>/dev/null; then
    echo "サブネット ${SUBNET_NAME} は既に存在します。再利用します。"
else
    echo "サブネット ${SUBNET_NAME} を作成中..."
    gcloud compute networks subnets create ${SUBNET_NAME} \
        --project=${PROJECT_ID} \
        --network=${VPC_NAME} \
        --region=${REGION} \
        --range=${SUBNET_RANGE}
    echo "サブネット ${SUBNET_NAME} を作成しました。"
fi

# 静的外部IPアドレス予約（存在チェック付き）
echo "静的外部IPアドレスを確認中..."
if gcloud compute addresses describe ${STATIC_IP_NAME} --region=${REGION} --project=${PROJECT_ID} &>/dev/null; then
    echo "静的IPアドレス ${STATIC_IP_NAME} は既に存在します。再利用します。"
else
    echo "静的IPアドレス ${STATIC_IP_NAME} を予約中..."
    gcloud compute addresses create ${STATIC_IP_NAME} \
        --project=${PROJECT_ID} \
        --region=${REGION}
    echo "静的IPアドレス ${STATIC_IP_NAME} を予約しました。"
fi

# 固定IPアドレスを取得
STATIC_IP=$(gcloud compute addresses describe ${STATIC_IP_NAME} --region=${REGION} --project=${PROJECT_ID} --format='value(address)')
echo "固定IPアドレス: ${STATIC_IP}"

# Cloud Router作成（存在チェック付き）
echo "Cloud Routerを確認中..."
if gcloud compute routers describe ${ROUTER_NAME} --region=${REGION} --project=${PROJECT_ID} &>/dev/null; then
    echo "Cloud Router ${ROUTER_NAME} は既に存在します。再利用します。"
else
    echo "Cloud Router ${ROUTER_NAME} を作成中..."
    gcloud compute routers create ${ROUTER_NAME} \
        --project=${PROJECT_ID} \
        --network=${VPC_NAME} \
        --region=${REGION}
    echo "Cloud Router ${ROUTER_NAME} を作成しました。"
fi

# Cloud NAT作成（存在チェック付き）
echo "Cloud NATを確認中..."
if gcloud compute routers nats describe ${NAT_NAME} --router=${ROUTER_NAME} --region=${REGION} --project=${PROJECT_ID} &>/dev/null; then
    echo "Cloud NAT ${NAT_NAME} は既に存在します。再利用します。"
else
    echo "Cloud NAT ${NAT_NAME} を作成中..."
    gcloud compute routers nats create ${NAT_NAME} \
        --project=${PROJECT_ID} \
        --router=${ROUTER_NAME} \
        --region=${REGION} \
        --nat-custom-subnet-ip-ranges=${SUBNET_NAME} \
        --nat-external-ip-pool=${STATIC_IP_NAME}
    echo "Cloud NAT ${NAT_NAME} を作成しました。"
fi

echo "VPCインフラストラクチャのセットアップ完了"
echo "=========================================="

# Cloud Build経由でビルド（ローカルDocker不要）
echo "Cloud Build経由でビルド中..."
gcloud builds submit --tag ${REGISTRY}/${IMAGE_NAME}:latest .

# Cloud Runにデプロイ（VPC egress設定付き + Secret Manager）
echo "Cloud Runにデプロイ中（VPC egress: all-traffic）..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${REGISTRY}/${IMAGE_NAME}:latest \
    --region ${REGION} \
    --platform managed \
    --allow-unauthenticated \
    --memory 4Gi \
    --timeout 300 \
    --min-instances 0 \
    --max-instances 10 \
    --network=${VPC_NAME} \
    --subnet=${SUBNET_NAME} \
    --vpc-egress=all-traffic \
    --set-secrets="GOOGLE_API_KEY=google_api_key_toku:latest" \
    --set-env-vars "^##^NODE_ENV=production##ALLOWED_ORIGINS=${FRONTEND_ORIGIN}"

# デプロイ結果表示
echo ""
echo "=========================================="
echo "Deployment completed!"
echo "=========================================="
echo ""
echo "サービスURL:"
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format='value(status.url)')
echo "  ${SERVICE_URL}"
echo ""
echo "固定IPアドレス（外向き通信用）:"
echo "  ${STATIC_IP}"
echo ""
echo "=========================================="
echo "社内ツール管理者への案内:"
echo "  上記の固定IPアドレスをIP許可リストに追加してください。"
echo "  Cloud Runからの全ての外向き通信がこのIPアドレスから発信されます。"
echo "=========================================="
