#!/bin/bash
# Frontend Cloud Run デプロイスクリプト
# GCPプロジェクト「itgproto」にフロントエンドをデプロイする

set -e  # エラー時に即終了

# 設定
PROJECT_ID="itgproto"
PROJECT_NUMBER="783872951114"
REGION="asia-northeast1"
SERVICE_NAME="a11y-check-frontend"
IMAGE_NAME="a11y-check-frontend"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy"

# VPC設定（セキュリティ強化: VPC統合とLoad Balancer経由のアクセス制限）
VPC_NAME="a11y-vpc"
SUBNET_NAME="a11y-cloudrun-subnet"

# URL形式を統一（新しい形式: PROJECT_NUMBER.REGION.run.app）
FRONTEND_URL="https://${SERVICE_NAME}-${PROJECT_NUMBER}.${REGION}.run.app"
BACKEND_URL="https://a11y-check-api-${PROJECT_NUMBER}.${REGION}.run.app"

echo "=========================================="
echo "Frontend Cloud Run デプロイ開始"
echo "=========================================="
echo "プロジェクト: ${PROJECT_ID}"
echo "リージョン: ${REGION}"
echo "サービス名: ${SERVICE_NAME}"
echo "=========================================="

# GCPプロジェクト設定
echo "GCPプロジェクトを設定中..."
gcloud config set project ${PROJECT_ID}

# Artifact Registryリポジトリ作成（存在しない場合）
echo "Artifact Registryリポジトリを確認中..."
gcloud artifacts repositories create cloud-run-source-deploy \
    --repository-format=docker \
    --location=${REGION} \
    --description="Cloud Run deployment images" 2>/dev/null || true

# Cloud Build経由でビルド（ローカルDocker不要）
echo "Cloud Build経由でビルド中..."
gcloud builds submit --tag ${REGISTRY}/${IMAGE_NAME}:latest "$(dirname "$0")/../frontend"

# Cloud Runデプロイ（VPC統合 + Load Balancer経由アクセスのみ許可）
echo "Cloud Runにデプロイ中..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${REGISTRY}/${IMAGE_NAME}:latest \
    --region ${REGION} \
    --platform managed \
    --allow-unauthenticated \
    --memory 256Mi \
    --timeout 60 \
    --min-instances 0 \
    --max-instances 10 \
    --port 8080 \
    --network=${VPC_NAME} \
    --subnet=${SUBNET_NAME} \
    --vpc-egress=all-traffic \
    --ingress=internal-and-cloud-load-balancing

# Load Balancer URL（Cloud Armor適用済み、社内アクセスのみ許可）
LOADBALANCER_URL="https://a11y-check.itgprototype.com"

# デプロイ結果表示
echo ""
echo "=========================================="
echo "Deployment completed!"
echo "=========================================="
echo ""
echo "アクセスURL（社内ネットワークからのみアクセス可能）:"
echo "  ${LOADBALANCER_URL}"
echo ""
echo "Cloud Run直接URL（ingress制限により直接アクセス不可）:"
echo "  ${FRONTEND_URL}"
echo ""
echo "バックエンドAPI URL（VPC内部からのみアクセス可能）:"
echo "  ${BACKEND_URL}"
echo ""
echo "=========================================="
echo "セキュリティ設定:"
echo "  - ingress: internal-and-cloud-load-balancing"
echo "  - VPC: ${VPC_NAME} / ${SUBNET_NAME}"
echo "  - vpc-egress: all-traffic"
echo "=========================================="
