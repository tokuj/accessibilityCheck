#!/bin/bash
# 本番ビルドで環境変数が正しく埋め込まれることを検証するテストスクリプト
# TDD: RED - このスクリプトは .env.production が存在しない場合に失敗する

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")"
EXPECTED_URL="https://a11y-check-api-pazgfztcsa-an.a.run.app"

echo "=========================================="
echo "環境変数ビルドテスト"
echo "=========================================="

# テスト1: .env.productionファイルの存在確認
echo "[TEST 1] .env.production ファイルの存在確認..."
if [ -f "$FRONTEND_DIR/.env.production" ]; then
    echo "  ✓ PASS: .env.production が存在します"
else
    echo "  ✗ FAIL: .env.production が存在しません"
    exit 1
fi

# テスト2: VITE_API_URL環境変数の設定確認
echo "[TEST 2] VITE_API_URL 環境変数の設定確認..."
if grep -q "VITE_API_URL=" "$FRONTEND_DIR/.env.production"; then
    echo "  ✓ PASS: VITE_API_URL が設定されています"
else
    echo "  ✗ FAIL: VITE_API_URL が設定されていません"
    exit 1
fi

# テスト3: VITE_API_URLの値がGCR URLであることの確認
echo "[TEST 3] VITE_API_URL の値確認..."
ACTUAL_URL=$(grep "^VITE_API_URL=" "$FRONTEND_DIR/.env.production" | cut -d'=' -f2)
if [ "$ACTUAL_URL" = "$EXPECTED_URL" ]; then
    echo "  ✓ PASS: VITE_API_URL = $ACTUAL_URL"
else
    echo "  ✗ FAIL: 期待値 $EXPECTED_URL, 実際 $ACTUAL_URL"
    exit 1
fi

# テスト4: 本番ビルドを実行して環境変数が埋め込まれることを確認
echo "[TEST 4] 本番ビルドでの環境変数埋め込み確認..."
cd "$FRONTEND_DIR"
npm run build > /dev/null 2>&1

# ビルド成果物でURLが埋め込まれているか確認
if grep -r "$EXPECTED_URL" "$FRONTEND_DIR/dist/" > /dev/null 2>&1; then
    echo "  ✓ PASS: ビルド成果物に VITE_API_URL が埋め込まれています"
else
    echo "  ✗ FAIL: ビルド成果物に VITE_API_URL が見つかりません"
    exit 1
fi

echo ""
echo "=========================================="
echo "全てのテストに合格しました！"
echo "=========================================="
