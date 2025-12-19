# Accessibility Check API - Cloud Run Deployment
# Base: Playwright公式イメージ（Chromium + 依存関係プリインストール）
FROM mcr.microsoft.com/playwright:v1.57.0-noble

WORKDIR /app

# 依存関係インストール（package-lock.jsonを使用して再現性を確保）
COPY package*.json ./
RUN npm ci

# ソースコードコピー
COPY server/ ./server/

# 環境変数設定
ENV PORT=8080
ENV NODE_ENV=production
# Note: CHROME_PATHはコード側でPlaywright APIから動的に取得

# ポート公開
EXPOSE 8080

# サーバー起動
CMD ["npx", "tsx", "server/index.ts"]
