#!/bin/bash
# Load Balancer セットアップスクリプト
# フロントエンド・バックエンド用External Application Load Balancer + Cloud Armor構成
#
# このスクリプトは以下を構成します:
# 1. グローバル静的外部IPアドレス
# 2. Serverless NEG（フロントエンド・バックエンドをバックエンドとして登録）
# 3. Backend Service + Cloud Armorポリシー
# 4. URL Map（/* → フロントエンド、/api/* → バックエンド）
# 5. Target HTTPS Proxy、Forwarding Rule

set -e  # エラー時に即終了

# 設定
PROJECT_ID="itgproto"
PROJECT_NUMBER="783872951114"
REGION="asia-northeast1"

# Load Balancerリソース名（フロントエンド）
LB_IP_NAME="a11y-frontend-ip"
NEG_NAME="a11y-frontend-neg"
BACKEND_SERVICE_NAME="a11y-frontend-backend"
URL_MAP_NAME="a11y-frontend-urlmap"
HTTPS_PROXY_NAME="a11y-frontend-https-proxy"
FORWARDING_RULE_NAME="a11y-frontend-https-rule"
SSL_CERT_NAME="a11y-frontend-cert"

# Load Balancerリソース名（バックエンド）
BACKEND_NEG_NAME="a11y-backend-neg"
BACKEND_SERVICE_BACKEND_NAME="a11y-backend-backend"

# Cloud Armorセキュリティポリシー（既存）
SECURITY_POLICY_NAME="internal-access-limited-policy"

# Cloud Runサービス名
CLOUD_RUN_FRONTEND_SERVICE="a11y-check-frontend"
CLOUD_RUN_BACKEND_SERVICE="a11y-check-api"

# 互換性のための変数（既存スクリプトとの整合性）
CLOUD_RUN_SERVICE="${CLOUD_RUN_FRONTEND_SERVICE}"

echo "=========================================="
echo "Load Balancer セットアップ開始"
echo "=========================================="
echo "プロジェクト: ${PROJECT_ID}"
echo "リージョン: ${REGION}"
echo "=========================================="

# GCPプロジェクト設定
echo "GCPプロジェクトを設定中..."
gcloud config set project ${PROJECT_ID}

# ==========================================
# タスク1.1: グローバル静的外部IPアドレスの予約
# ==========================================
echo ""
echo "[Task 1.1] グローバル静的外部IPアドレスを確認中..."
if gcloud compute addresses describe ${LB_IP_NAME} --global --project=${PROJECT_ID} &>/dev/null; then
    echo "静的IPアドレス ${LB_IP_NAME} は既に存在します。再利用します。"
else
    echo "静的IPアドレス ${LB_IP_NAME} を予約中..."
    gcloud compute addresses create ${LB_IP_NAME} \
        --global \
        --ip-version=IPV4 \
        --project=${PROJECT_ID}
    echo "静的IPアドレス ${LB_IP_NAME} を予約しました。"
fi

# IPアドレスを取得
LB_IP=$(gcloud compute addresses describe ${LB_IP_NAME} --global --project=${PROJECT_ID} --format='value(address)')
echo "Load Balancer用IPアドレス: ${LB_IP}"

# ==========================================
# タスク1.2: Serverless NEGの作成
# ==========================================
echo ""
echo "[Task 1.2] Serverless NEGを確認中..."
if gcloud compute network-endpoint-groups describe ${NEG_NAME} --region=${REGION} --project=${PROJECT_ID} &>/dev/null; then
    echo "Serverless NEG ${NEG_NAME} は既に存在します。再利用します。"
else
    echo "Serverless NEG ${NEG_NAME} を作成中..."
    gcloud compute network-endpoint-groups create ${NEG_NAME} \
        --region=${REGION} \
        --network-endpoint-type=serverless \
        --cloud-run-service=${CLOUD_RUN_SERVICE} \
        --project=${PROJECT_ID}
    echo "Serverless NEG ${NEG_NAME} を作成しました。"
fi

# ==========================================
# タスク1.3: Backend Serviceの設定とCloud Armorポリシーのアタッチ
# ==========================================
echo ""
echo "[Task 1.3] Backend Serviceを確認中..."
if gcloud compute backend-services describe ${BACKEND_SERVICE_NAME} --global --project=${PROJECT_ID} &>/dev/null; then
    echo "Backend Service ${BACKEND_SERVICE_NAME} は既に存在します。再利用します。"
else
    echo "Backend Service ${BACKEND_SERVICE_NAME} を作成中..."
    gcloud compute backend-services create ${BACKEND_SERVICE_NAME} \
        --global \
        --load-balancing-scheme=EXTERNAL_MANAGED \
        --project=${PROJECT_ID}
    echo "Backend Service ${BACKEND_SERVICE_NAME} を作成しました。"

    # NEGをBackend Serviceに追加
    echo "NEGをBackend Serviceに追加中..."
    gcloud compute backend-services add-backend ${BACKEND_SERVICE_NAME} \
        --global \
        --network-endpoint-group=${NEG_NAME} \
        --network-endpoint-group-region=${REGION} \
        --project=${PROJECT_ID}
    echo "NEGをBackend Serviceに追加しました。"
fi

# Cloud Armorポリシーをアタッチ
echo "Cloud Armorポリシーを確認・アタッチ中..."
CURRENT_POLICY=$(gcloud compute backend-services describe ${BACKEND_SERVICE_NAME} --global --project=${PROJECT_ID} --format='value(securityPolicy)' 2>/dev/null || echo "")
if [[ -n "${CURRENT_POLICY}" ]]; then
    echo "Cloud Armorポリシーは既にアタッチされています: ${CURRENT_POLICY}"
else
    echo "Cloud Armorポリシー ${SECURITY_POLICY_NAME} をアタッチ中..."
    gcloud compute backend-services update ${BACKEND_SERVICE_NAME} \
        --global \
        --security-policy=${SECURITY_POLICY_NAME} \
        --project=${PROJECT_ID}
    echo "Cloud Armorポリシーをアタッチしました。"
fi

# ==========================================
# タスク4.4: バックエンド用Serverless NEGとBackend Serviceの作成
# ==========================================
echo ""
echo "[Task 4.4.1] バックエンド用Serverless NEGを確認中..."
if gcloud compute network-endpoint-groups describe ${BACKEND_NEG_NAME} --region=${REGION} --project=${PROJECT_ID} &>/dev/null; then
    echo "Serverless NEG ${BACKEND_NEG_NAME} は既に存在します。再利用します。"
else
    echo "Serverless NEG ${BACKEND_NEG_NAME} を作成中..."
    gcloud compute network-endpoint-groups create ${BACKEND_NEG_NAME} \
        --region=${REGION} \
        --network-endpoint-type=serverless \
        --cloud-run-service=${CLOUD_RUN_BACKEND_SERVICE} \
        --project=${PROJECT_ID}
    echo "Serverless NEG ${BACKEND_NEG_NAME} を作成しました。"
fi

echo ""
echo "[Task 4.4.2] バックエンド用Backend Serviceを確認中..."
if gcloud compute backend-services describe ${BACKEND_SERVICE_BACKEND_NAME} --global --project=${PROJECT_ID} &>/dev/null; then
    echo "Backend Service ${BACKEND_SERVICE_BACKEND_NAME} は既に存在します。再利用します。"
else
    echo "Backend Service ${BACKEND_SERVICE_BACKEND_NAME} を作成中..."
    gcloud compute backend-services create ${BACKEND_SERVICE_BACKEND_NAME} \
        --global \
        --load-balancing-scheme=EXTERNAL_MANAGED \
        --project=${PROJECT_ID}
    echo "Backend Service ${BACKEND_SERVICE_BACKEND_NAME} を作成しました。"

    # NEGをBackend Serviceに追加
    echo "NEGをBackend Serviceに追加中..."
    gcloud compute backend-services add-backend ${BACKEND_SERVICE_BACKEND_NAME} \
        --global \
        --network-endpoint-group=${BACKEND_NEG_NAME} \
        --network-endpoint-group-region=${REGION} \
        --project=${PROJECT_ID}
    echo "NEGをBackend Serviceに追加しました。"
fi

# バックエンド用Cloud Armorポリシーをアタッチ
echo "バックエンド用Cloud Armorポリシーを確認・アタッチ中..."
BACKEND_CURRENT_POLICY=$(gcloud compute backend-services describe ${BACKEND_SERVICE_BACKEND_NAME} --global --project=${PROJECT_ID} --format='value(securityPolicy)' 2>/dev/null || echo "")
if [[ -n "${BACKEND_CURRENT_POLICY}" ]]; then
    echo "Cloud Armorポリシーは既にアタッチされています: ${BACKEND_CURRENT_POLICY}"
else
    echo "Cloud Armorポリシー ${SECURITY_POLICY_NAME} をアタッチ中..."
    gcloud compute backend-services update ${BACKEND_SERVICE_BACKEND_NAME} \
        --global \
        --security-policy=${SECURITY_POLICY_NAME} \
        --project=${PROJECT_ID}
    echo "Cloud Armorポリシーをアタッチしました。"
fi

# ==========================================
# タスク1.4: URL Map、Target HTTPS Proxy、Forwarding Ruleの構成
# ==========================================
echo ""
echo "[Task 1.4] URL Mapを確認中..."
if gcloud compute url-maps describe ${URL_MAP_NAME} --project=${PROJECT_ID} &>/dev/null; then
    echo "URL Map ${URL_MAP_NAME} は既に存在します。パスルールを更新します。"
else
    echo "URL Map ${URL_MAP_NAME} を作成中..."
    gcloud compute url-maps create ${URL_MAP_NAME} \
        --default-service=${BACKEND_SERVICE_NAME} \
        --project=${PROJECT_ID}
    echo "URL Map ${URL_MAP_NAME} を作成しました。"
fi

# パスルールを更新（/api/* → バックエンド）
echo "[Task 4.4.3] URL Mapにパスルールを追加中..."
# 一時的なYAMLファイルでURL Mapを更新
cat > /tmp/url-map-config.yaml << 'EOF'
defaultService: projects/itgproto/global/backendServices/a11y-frontend-backend
hostRules:
  - hosts:
      - '*'
    pathMatcher: path-matcher-1
pathMatchers:
  - name: path-matcher-1
    defaultService: projects/itgproto/global/backendServices/a11y-frontend-backend
    pathRules:
      - paths:
          - /api/*
        service: projects/itgproto/global/backendServices/a11y-backend-backend
EOF
gcloud compute url-maps import ${URL_MAP_NAME} \
    --source=/tmp/url-map-config.yaml \
    --project=${PROJECT_ID} \
    --quiet
rm /tmp/url-map-config.yaml
echo "URL Mapにパスルール（/api/* → バックエンド）を追加しました。"

# ドメイン名（SSL証明書用）
DOMAIN_NAME="a11y-check.itgprototype.com"

# SSL証明書（Google-managed）
echo "SSL証明書を確認中..."
if gcloud compute ssl-certificates describe ${SSL_CERT_NAME} --global --project=${PROJECT_ID} &>/dev/null; then
    echo "SSL証明書 ${SSL_CERT_NAME} は既に存在します。再利用します。"
else
    echo "SSL証明書 ${SSL_CERT_NAME} を作成中..."
    gcloud compute ssl-certificates create ${SSL_CERT_NAME} \
        --global \
        --domains=${DOMAIN_NAME} \
        --project=${PROJECT_ID}
    echo "SSL証明書 ${SSL_CERT_NAME} を作成しました。"
    echo "注意: Google-managed証明書はDNS設定後にプロビジョニングされます。"
fi

# HTTPS Proxy
echo "HTTPS Proxyを確認中..."
if gcloud compute target-https-proxies describe ${HTTPS_PROXY_NAME} --project=${PROJECT_ID} &>/dev/null; then
    echo "HTTPS Proxy ${HTTPS_PROXY_NAME} は既に存在します。再利用します。"
else
    echo "HTTPS Proxy ${HTTPS_PROXY_NAME} を作成中..."
    gcloud compute target-https-proxies create ${HTTPS_PROXY_NAME} \
        --url-map=${URL_MAP_NAME} \
        --ssl-certificates=${SSL_CERT_NAME} \
        --project=${PROJECT_ID}
    echo "HTTPS Proxy ${HTTPS_PROXY_NAME} を作成しました。"
fi

# HTTPS Forwarding Rule
echo "HTTPS Forwarding Ruleを確認中..."
if gcloud compute forwarding-rules describe ${FORWARDING_RULE_NAME} --global --project=${PROJECT_ID} &>/dev/null; then
    echo "HTTPS Forwarding Rule ${FORWARDING_RULE_NAME} は既に存在します。再利用します。"
else
    echo "HTTPS Forwarding Rule ${FORWARDING_RULE_NAME} を作成中..."
    gcloud compute forwarding-rules create ${FORWARDING_RULE_NAME} \
        --global \
        --address=${LB_IP_NAME} \
        --target-https-proxy=${HTTPS_PROXY_NAME} \
        --ports=443 \
        --project=${PROJECT_ID}
    echo "HTTPS Forwarding Rule ${FORWARDING_RULE_NAME} を作成しました。"
fi

# ==========================================
# セットアップ完了
# ==========================================
echo ""
echo "=========================================="
echo "Load Balancer セットアップ完了"
echo "=========================================="
echo ""
echo "Load Balancer IPアドレス:"
echo "  ${LB_IP}"
echo ""
echo "ドメイン名:"
echo "  ${DOMAIN_NAME}"
echo ""
echo "Cloud Armorセキュリティポリシー:"
echo "  ${SECURITY_POLICY_NAME}"
echo ""
echo "URL Mapルーティング:"
echo "  /* → フロントエンド（${CLOUD_RUN_FRONTEND_SERVICE}）"
echo "  /api/* → バックエンド（${CLOUD_RUN_BACKEND_SERVICE}）"
echo ""
echo "次のステップ:"
echo "  1. DNS設定（初回のみ）"
echo "     ${DOMAIN_NAME} のAレコードを ${LB_IP} に設定"
echo "     SSL証明書のプロビジョニング完了を待つ（数分〜数時間）"
echo ""
echo "  2. バックエンドのingress設定変更"
echo "     ./scripts/deploy.sh を実行してingress=internal-and-cloud-load-balancingを適用"
echo ""
echo "  3. フロントエンドの再デプロイ"
echo "     ./scripts/deploy-frontend.sh を実行（VITE_API_URL=空で相対パス使用）"
echo ""
echo "=========================================="
echo "テスト方法:"
echo "  # 社内IPからのフロントエンドアクセステスト（許可されるべき）"
echo "  curl -I https://${DOMAIN_NAME}/"
echo ""
echo "  # 社内IPからのAPIアクセステスト（許可されるべき）"
echo "  curl -I https://${DOMAIN_NAME}/api/health"
echo ""
echo "  # 外部IPからのアクセステスト（403になるべき）"
echo "  curl -I https://${DOMAIN_NAME}/"
echo "=========================================="
