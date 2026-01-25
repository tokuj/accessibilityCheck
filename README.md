# a11y Checker

Webアクセシビリティを自動でテスト・分析するWebアプリケーション。開発者やQAエンジニアが、WCAG準拠状況を効率的に確認できます。

## 主な機能

### マルチURL分析
1回の操作で最大4つのURLを同時に分析可能。同一ドメイン内の複数ページを効率的にチェックできます。

### マルチエンジン分析
3つのアクセシビリティエンジンを統合し、網羅的なチェックを実施：
- **axe-core**: 業界標準のアクセシビリティテストエンジン
- **Pa11y**: HTML CodeSnifferベースの検証
- **Lighthouse**: Googleによる総合評価（パフォーマンス含む）

### AI総評（Gemini Flash）
分析結果をAIが解析し、以下の情報を提供：
- 全体的なアクセシビリティ状況の評価
- 最も重要な改善ポイント（優先度順）
- 具体的な改善提案
- 影響度別の問題数サマリー

### ダウンロード機能
- **詳細結果CSV**: 違反情報をExcel等で活用可能
- **AI総評CSV**: 問題点と修正方法をタスク管理ツールにインポート
- **レポートPDF**: 画面全体をドキュメントとして保存

### 認証サポート
以下の認証方式に対応：
- Basic認証
- Cookie認証
- Bearer Token認証
- フォームログイン

### セッション管理
インタラクティブログイン機能で認証セッションを記録・再利用可能。セッションはAES-256-GCMで暗号化されてローカルに保存されます。

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フロントエンド | React 19 + Vite + MUI |
| バックエンド | Express 5 + Node.js |
| テスト | Playwright + axe-core |
| AI | Gemini Flash |
| インフラ | Google Cloud Run |
| 言語 | TypeScript |

## クイックスタート

### 前提条件
- Node.js 18以上
- npm

### ローカル開発

```bash
# 依存関係のインストール
npm install
cd frontend && npm install && cd ..

# フロントエンド＋バックエンドを同時起動
npm run dev
```

ブラウザで http://localhost:5173 にアクセスしてください。

### 個別起動

```bash
# バックエンドサーバーのみ（ポート3001）
npm run server

# フロントエンドのみ（ポート5173）
npm run dev:frontend
```

## 本番環境

### サービスURL

| サービス | URL |
|---------|-----|
| フロントエンド | https://a11y-check-frontend-783872951114.asia-northeast1.run.app |
| バックエンドAPI | https://a11y-check-api-783872951114.asia-northeast1.run.app |
| 固定IP（外向き通信） | 35.243.70.169 |

### デプロイ方法

```bash
# バックエンドのデプロイ（VPCインフラ構築含む）
./scripts/deploy.sh

# フロントエンドのデプロイ
./scripts/deploy-frontend.sh
```

詳細は [デプロイガイド](docs/deployment-guide.md) および [GCPアーキテクチャ](docs/gcp-architecture.md) を参照してください。

## 結果の読み方

### 影響度（Impact）

| 影響度 | 説明 |
|--------|------|
| `critical` | 致命的。一部のユーザーがコンテンツにアクセスできない |
| `serious` | 深刻。多くのユーザーに影響を与える |
| `moderate` | 中程度。一部のユーザーに影響を与える |
| `minor` | 軽微。ユーザー体験に若干の影響 |

### スコアの解釈

各エンジンがスコアを算出します：
- **axe-core**: 違反数とパス数から計算
- **Lighthouse**: 0-100のスコア
- **Pa11y**: 違反数ベースの評価

### 自動テストの限界

axe-coreのWCAG基準カバー率は約20-30%です。自動テストは補助的なツールであり、手動でのアクセシビリティ確認も併せて行うことを推奨します。

詳細は [WCAG網羅性と改善戦略](docs/wcag-coverage-strategy.md) を参照してください。

### 詳しい読み解き方

各エンジンの結果の詳細な読み方、WCAG達成基準ごとの解説、手動テストが必要な項目については [結果読み解きガイド](docs/results-interpretation-guide.md) を参照してください。

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `npm run dev` | フロントエンド＋バックエンド同時起動 |
| `npm run server` | バックエンドのみ起動 |
| `npm run dev:frontend` | フロントエンドのみ起動 |
| `npm run test:a11y` | アクセシビリティテスト実行 |
| `npm run test:a11y:ui` | UIモードでテスト実行 |
| `npm run report:a11y` | レポート生成 |
| `npm run test:report` | HTMLレポート表示 |

## プロジェクト構成

```
accessibilityCheck/
├── frontend/          # React SPAアプリケーション
│   ├── src/
│   │   ├── components/  # UIコンポーネント
│   │   ├── services/    # API通信
│   │   └── types/       # 型定義
│   └── ...
├── server/            # Express APIサーバー
│   ├── analyzers/     # axe-core, Pa11y, Lighthouse ラッパー
│   ├── auth/          # 認証処理
│   └── services/      # Gemini API等
├── tests/             # Playwright E2Eテスト
├── docs/              # 技術ドキュメント
├── scripts/           # デプロイスクリプト
└── .kiro/             # CC-SDD仕様・設計ドキュメント
    ├── specs/         # 機能仕様（requirements, design, tasks）
    └── steering/      # プロジェクトガイドライン
```

## 開発について

本プロジェクトは **CC-SDD（Claude Code Spec-Driven Development）** で開発されています。

開発の履歴と仕様は `.kiro/specs/` に格納されています：

| 仕様 | 内容 |
|------|------|
| multi-url-analysis | 複数URL同時分析機能 |
| download-enhancements | CSV/PDFダウンロード機能 |
| report-ux-enhancements | AI総評・リアルタイムログ |
| cloud-run-deployment | バックエンドCloud Runデプロイ |
| frontend-cloud-run-deployment | フロントエンドCloud Runデプロイ |
| static-ip-egress | 固定IPアドレス外向き通信 |
| userauth | 認証機能 |
| session-security | セッション管理 |

## ドキュメント

- [結果読み解きガイド](docs/results-interpretation-guide.md) - 初心者向け結果の読み方
- [デプロイガイド](docs/deployment-guide.md)
- [GCPアーキテクチャ](docs/gcp-architecture.md)
- [アクセシビリティテストガイド](docs/accessibility-testing-guide.md)
- [WCAG網羅性と改善戦略](docs/wcag-coverage-strategy.md)
- [セッション管理](docs/session-management.md)
- [GitHub Actions CI ガイド](docs/github-actions-ci-guide.md)

## 参考資料

- [Playwright公式ドキュメント](https://playwright.dev/)
- [axe-core GitHub](https://github.com/dequelabs/axe-core)
- [Pa11y](https://pa11y.org/)
- [Lighthouse](https://developer.chrome.com/docs/lighthouse/)
- [WCAG 2.1 日本語訳](https://waic.jp/docs/WCAG21/)

## ライセンス

ISC
