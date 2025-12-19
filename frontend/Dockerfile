# Stage 1: Build
FROM node:22-alpine AS build

WORKDIR /app

# 依存関係インストール（キャッシュ効率化のため先にpackage*.jsonをコピー）
COPY package*.json ./
RUN npm ci

# ソースコードコピーとビルド
COPY . .
RUN npm run build

# Stage 2: Production
FROM nginx:alpine-slim

# nginx設定をコピー
COPY nginx.conf /etc/nginx/nginx.conf

# ビルド成果物をコピー
COPY --from=build /app/dist /usr/share/nginx/html

# Cloud Run用ポート
EXPOSE 8080

# nginx起動
CMD ["nginx", "-g", "daemon off;"]
