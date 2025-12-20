#!/bin/bash
# Frontend Cloud Run デプロイスクリプト
# GCPプロジェクト「itgproto」にフロントエンドをデプロイする

set -e  # エラー時に即終了

# 設定
PROJECT_ID="itgproto"
REGION="asia-northeast1"
SERVICE_NAME="a11y-check-frontend"
IMAGE_NAME="a11y-check-frontend"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy"

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

# Cloud Runデプロイ
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
    --port 8080

# デプロイ結果表示
echo ""
echo "=========================================="
echo "Deployment completed!"
echo "=========================================="
echo ""
echo "フロントエンドURL:"
FRONTEND_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format='value(status.url)')
echo "  ${FRONTEND_URL}"
echo ""
echo "バックエンドAPI URL:"
echo "  https://a11y-check-api-783872951114.asia-northeast1.run.app"
echo ""
echo "=========================================="
echo "NOTE: バックエンドのCORS設定を更新する場合:"
echo "  FRONTEND_ORIGIN=${FRONTEND_URL} ./scripts/deploy.sh"
echo "=========================================="
