# Research & Design Decisions

## Summary
- **Feature**: cloud-run-deployment
- **Discovery Scope**: Complex Integration
- **Key Findings**:
  - Playwright公式Dockerイメージ `mcr.microsoft.com/playwright:v1.57.0-noble` がCloud Runで推奨
  - Chrome Launcher（Lighthouse用）は `--headless --no-sandbox --disable-gpu` フラグで動作
  - Cloud Runではメモリ2GB以上、タイムアウト300秒以上が必要
  - 既存コードはPORT環境変数に対応済み、ヘルスチェックも実装済み

## Research Log

### Playwright Docker Image
- **Context**: Cloud RunでPlaywrightを動作させるためのベースイメージ選定
- **Sources Consulted**:
  - [Playwright Docker公式ドキュメント](https://playwright.dev/docs/docker)
  - [Google Cloud Run Browser Automation](https://docs.cloud.google.com/run/docs/browser-automation)
- **Findings**:
  - 推奨イメージ: `mcr.microsoft.com/playwright:v1.57.0-noble`（Ubuntu 24.04 LTS）
  - イメージにはChromium、Firefox、WebKitがプリインストール
  - Playwrightパッケージ自体は含まれないため、npm installが必要
  - `--ipc=host` フラグは推奨だがCloud Runでは不要（headlessモードのため）
- **Implications**: Playwrightイメージをベースにし、Node.jsアプリをレイヤーとして追加

### Lighthouse + Chrome Launcher in Container
- **Context**: Lighthouseがchrome-launcherを使用してChromeを起動する
- **Sources Consulted**:
  - [Lighthouse headless-chrome.md](https://github.com/GoogleChrome/lighthouse/blob/main/docs/headless-chrome.md)
  - [Docker Lighthouse discussions](https://github.com/GoogleChrome/lighthouse/discussions/11898)
- **Findings**:
  - 必要なフラグ: `--headless --no-sandbox --disable-gpu`
  - 既存コード `server/analyzers/lighthouse.ts:81` で既に対応済み
  - `CHROME_PATH` 環境変数でChromeバイナリパスを指定可能
  - Playwright公式イメージのChromiumをLighthouseでも使用可能
- **Implications**: Playwright公式イメージのChromiumパスを`CHROME_PATH`として設定

### Pa11y Container Configuration
- **Context**: Pa11yもPuppeteer経由でChromiumを使用
- **Sources Consulted**: 既存コード `server/analyzers/pa11y.ts`
- **Findings**:
  - `chromeLaunchConfig.args` で `--no-sandbox --disable-setuid-sandbox` を指定済み
  - Playwright公式イメージのChromiumで動作可能
- **Implications**: 追加設定不要、既存コードがコンテナ環境に対応済み

### Cloud Run Resource Requirements
- **Context**: Playwright/Lighthouse/Pa11yの同時実行に必要なリソース
- **Sources Consulted**:
  - [Cloud Run Browser Automation](https://docs.cloud.google.com/run/docs/browser-automation)
  - [Medium: Playwright on Cloud Run](https://medium.com/@pawarvaibhav.vppv/running-playwright-tests-in-python-with-flask-on-cloud-run-380c428bebf0)
- **Findings**:
  - 推奨メモリ: 2GB以上（Chromeインスタンス複数起動のため）
  - タイムアウト: 300秒以上（分析処理に60秒+αのため）
  - CPU: 1〜2 vCPU
  - 第2世代実行環境（gen2）推奨だがgen1でも動作
- **Implications**: メモリ2GB、タイムアウト300秒をデプロイスクリプトで設定

### 既存コード分析
- **Context**: 現在のサーバー実装の環境変数・設定対応状況
- **Sources Consulted**: `server/index.ts`, `server/analyzer.ts`
- **Findings**:
  - PORT: `process.env.PORT || 3001` で対応済み
  - ヘルスチェック: `/api/health` エンドポイント実装済み
  - CORS: `cors()` を引数なしで呼び出し（全オリジン許可状態）
  - NODE_ENV: 未使用
- **Implications**: CORS設定を環境変数対応に変更が必要

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Playwright公式イメージベース | `mcr.microsoft.com/playwright:v1.57.0-noble` をベースに使用 | Playwright互換性保証、Chromiumプリインストール | イメージサイズ大（1GB+） | **推奨** |
| Node.jsスリムイメージ | `node:20-bookworm` でChromium手動インストール | イメージサイズ最適化可能 | 依存関係管理が複雑 | 運用コスト高 |
| マルチステージビルド | ビルド用とランタイム用を分離 | サイズと互換性のバランス | ビルド時間増加 | 将来の最適化オプション |

## Design Decisions

### Decision: Playwright公式イメージをベースとする
- **Context**: Cloud Run上でPlaywright/Lighthouse/Pa11yを動作させる必要がある
- **Alternatives Considered**:
  1. Node.js slimイメージ + Chromium手動インストール
  2. Google提供のbrowserlessイメージ
  3. Playwright公式イメージ
- **Selected Approach**: Playwright公式イメージ `mcr.microsoft.com/playwright:v1.57.0-noble`
- **Rationale**:
  - Chromium/依存関係がプリインストール済み
  - Playwrightバージョンとの互換性が保証される
  - Chrome Launcherも同一Chromiumを使用可能
- **Trade-offs**: イメージサイズが大きい（1GB+）が、信頼性を優先
- **Follow-up**: イメージサイズが問題になった場合、マルチステージビルドを検討

### Decision: CORS設定を環境変数対応に変更
- **Context**: 本番環境とローカル環境でCORS許可オリジンを切り替える必要がある
- **Alternatives Considered**:
  1. 全オリジン許可のまま維持
  2. ハードコードで本番オリジンを追加
  3. 環境変数で制御
- **Selected Approach**: 環境変数 `ALLOWED_ORIGINS` で制御
- **Rationale**:
  - セキュリティ向上（必要なオリジンのみ許可）
  - デプロイ時に柔軟に設定可能
  - 開発環境では localhost を許可
- **Trade-offs**: 設定の複雑さが増すが、セキュリティを優先
- **Follow-up**: フロントエンドのデプロイ先URLが決まったら ALLOWED_ORIGINS に追加

### Decision: Artifact Registryを使用
- **Context**: DockerイメージをCloud Runにデプロイするためのレジストリ選定
- **Alternatives Considered**:
  1. Container Registry（旧世代）
  2. Artifact Registry（推奨）
  3. Docker Hub
- **Selected Approach**: Artifact Registry（asia-northeast1-docker.pkg.dev）
- **Rationale**:
  - GCP推奨のレジストリ
  - Container Registryは非推奨化の方向
  - Cloud Runとの統合がスムーズ
- **Trade-offs**: 初回セットアップでリポジトリ作成が必要
- **Follow-up**: リポジトリ作成をデプロイスクリプトに含める

### Decision: CHROME_PATH問題の解決方法
- **Context**: DockerfileでCHROME_PATHにワイルドカード（`/ms-playwright/chromium-*/chrome-linux/chrome`）を使用すると環境変数として展開されない
- **Alternatives Considered**:
  1. Option A: ビルド時に`find`コマンドで解決 → `RUN`の結果が`ENV`に反映されない
  2. Option B: 起動時エントリポイントスクリプトで解決 → 動作するが複雑さが増す
  3. Option C: Playwright APIを使用 → `chromium.executablePath()`で動的取得
- **Selected Approach**: Option C - `chromium.executablePath()` を使用
- **Rationale**:
  - Playwright公式APIで信頼性が高い
  - バージョン変更に自動対応（`/ms-playwright/chromium-XXXX/`のXXXXが変わっても問題なし）
  - Docker/シェルスクリプトのハック不要
  - オーバーヘッドはほぼゼロ（単なる文字列返却）
- **Trade-offs**: コード変更が必要だが、最も堅牢な解決策
- **Source**: o3 AIによる技術レビュー（2025-12-17）
- **Follow-up**: `server/analyzers/lighthouse.ts`で`chromeLauncher.launch()`に`chromePath`オプションを追加

## Risks & Mitigations
- **コールドスタート遅延**: ブラウザ起動を含むため10-20秒かかる可能性 → 最小インスタンス1への変更も検討
- **メモリ不足**: Playwright/Lighthouse並列実行時にOOM発生の可能性 → メモリ4GBへの増量を検討
- **Chromiumバージョン不整合**: Playwright/chrome-launcher間での不整合 → `chromium.executablePath()`で統一

## References
- [Playwright Docker Documentation](https://playwright.dev/docs/docker)
- [Google Cloud Run Browser Automation](https://docs.cloud.google.com/run/docs/browser-automation)
- [Lighthouse Headless Chrome](https://github.com/GoogleChrome/lighthouse/blob/main/docs/headless-chrome.md)
- [Chrome Launcher Docker Support](https://lightrun.com/answers/googlechrome-chrome-launcher-support-launching-in-docker)
