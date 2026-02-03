# Research & Design Decisions

## Summary

- **Feature**: `browser-page-analysis`
- **Discovery Scope**: Extension（既存システムへの機能追加）
- **Key Findings**:
  - PlaywrightのconnectOverCDP APIを使用して既存Chromeブラウザへの接続が可能
  - 既存のaxe-core統合コードを再利用可能（AxeBuilder APIはCDP接続でも動作）
  - ローカルホストのみへの接続制限でセキュリティリスクを最小化

## Research Log

### CDP接続メカニズム

- **Context**: ユーザーが開いているブラウザページにどのように接続するか
- **Sources Consulted**:
  - Playwright公式ドキュメント: `chromium.connectOverCDP()`
  - Chrome DevTools Protocol公式ドキュメント
- **Findings**:
  - `chromium.connectOverCDP('http://localhost:9222')`でHTTPエンドポイント経由で接続可能
  - `browser.contexts()`で既存のブラウザコンテキストを取得
  - `context.pages()`で開いているページ一覧を取得
  - 接続後は通常のPlaywright Page APIが使用可能
- **Implications**:
  - 既存の`analyzeWithAxeEnhanced`関数をそのまま再利用可能
  - 新規ブラウザ起動コードをスキップしてCDP接続に置き換える設計

### Chromeリモートデバッグモード

- **Context**: ユーザーがChromeをどのように準備する必要があるか
- **Sources Consulted**:
  - Chrome DevTools Protocol documentation
  - 実際のコマンドラインオプション検証
- **Findings**:
  - `--remote-debugging-port=9222`オプションでChromeを起動する必要がある
  - 通常起動のChromeには後から接続不可（再起動が必要）
  - `--user-data-dir`で別プロファイルを指定可能
  - OS別の起動コマンドが必要（Windows、macOS、Linux）
- **Implications**:
  - UIにOS別の起動コマンドガイドを表示する必要あり
  - ユーザーへの事前説明が重要

### AxeBuilder API互換性

- **Context**: CDP接続したページでaxe-coreが正常動作するか
- **Sources Consulted**:
  - @axe-core/playwright ドキュメント
  - Playwright accessibility testing ガイド
- **Findings**:
  - `AxeBuilder({ page })`はCDP接続で取得したPageオブジェクトでも動作
  - `withTags()`, `exclude()`, `setLegacyMode()`などの設定も使用可能
  - スクリーンショット取得（`page.screenshot()`）も動作
- **Implications**:
  - 既存の`analyzeWithAxeEnhanced`関数をそのまま使用可能
  - 分析結果は既存のURL入力分析と同一形式

### Pa11y / Lighthouseの制約

- **Context**: CDP接続で他のエンジン（Pa11y、Lighthouse）は使用可能か
- **Sources Consulted**:
  - Pa11y / Lighthouse ドキュメント
  - 実装コード分析
- **Findings**:
  - Pa11y: 内部でpuppeteerを起動するため、CDP接続ページには使用不可
  - Lighthouse: 同様に独自ブラウザプロセスを使用
  - IBM、Alfa、QualWeb: Playwright Pageオブジェクトを使用するため対応可能
- **Implications**:
  - ブラウザ接続モードではaxe-core、IBM、Alfa、QualWebのみ使用可能
  - Pa11y、Lighthouseはスキップ（またはURL再取得で別途実行の選択肢）
  - UIでエンジン制限を明示

### セキュリティ考慮事項

- **Context**: CDP接続機能のセキュリティリスク
- **Sources Consulted**:
  - Chrome DevTools Protocol セキュリティドキュメント
  - OWASP ガイドライン
- **Findings**:
  - CDPはデフォルトでlocalhostのみリッスン（外部からの接続不可）
  - リモートホストへのCDP接続は危険（ブラウザの完全制御が可能）
  - 分析スクリプト（axe-core）の注入は一時的
- **Implications**:
  - バックエンドAPIでlocalhostへの接続のみ許可
  - リモートホスト接続は警告を表示して確認

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| モード切り替え方式 | URL入力とブラウザ接続を切り替えUI | 既存UIへの影響最小、ユーザーが選択可能 | モード切り替えの複雑さ | 採用 |
| 統合API方式 | バックエンドで自動判定 | UIがシンプル | 判定ロジックの複雑化 | 不採用 |
| 別アプリ方式 | ブラウザ拡張機能として実装 | 完全な分離 | 開発・保守コスト大 | 不採用 |

## Design Decisions

### Decision: CDP接続の実装アプローチ

- **Context**: 既存のPlaywrightコードとどう統合するか
- **Alternatives Considered**:
  1. 新規analyzer関数を作成（CDP専用）
  2. 既存analyzer関数を拡張（Pageオブジェクトを外部から渡す）
- **Selected Approach**: 既存analyzer関数を拡張
- **Rationale**:
  - `analyzeWithAxeEnhanced(page)`はすでにPageオブジェクトを引数に取る
  - CDP接続で取得したPageオブジェクトをそのまま渡せば動作
  - コード重複を回避
- **Trade-offs**:
  - 既存関数の呼び出し元が増える
  - エラーハンドリングの分岐が必要
- **Follow-up**: CDP接続特有のエラー（接続切断など）のハンドリングを追加

### Decision: エンジン制限

- **Context**: ブラウザ接続モードで使用可能なエンジンの決定
- **Alternatives Considered**:
  1. axe-coreのみ
  2. axe-core + Playwrightページ対応エンジン（IBM、Alfa、QualWeb）
  3. 全エンジン（Pa11y、Lighthouseは別途URL取得で実行）
- **Selected Approach**: axe-core + Playwrightページ対応エンジン
- **Rationale**:
  - Pa11y/Lighthouseは内部でブラウザを起動するため、CDP接続ページでは使用不可
  - 無理に対応させるより、使用可能なエンジンを明確にする
  - axe-coreだけでも十分な検出カバレッジ
- **Trade-offs**:
  - Lighthouseスコアが取得できない
  - Pa11yの検出結果が得られない
- **Follow-up**: UIでエンジン制限を明示的に表示

### Decision: ユーザーガイダンスの実装方式

- **Context**: CDP接続の操作が複雑なため、使い方を表示する必要がある
- **Alternatives Considered**:
  1. 静的なヘルプページへのリンク
  2. モード選択時にインラインガイドを表示
  3. ステップバイステップのウィザード形式
- **Selected Approach**: モード選択時にインラインガイドを表示
- **Rationale**:
  - ユーザーが必要な時に必要な情報を得られる
  - 別ページへの遷移不要
  - OS別の起動コマンドをコピー可能なUIで提供
- **Trade-offs**:
  - UIの複雑さが増す
  - モバイル表示での可読性
- **Follow-up**: コピーボタンの実装、コマンド実行確認のためのトラブルシューティングガイド

## Risks & Mitigations

- **ユーザーがリモートデバッグモードでChromeを起動しない** — インラインガイドで明確な手順を提供、接続エラー時に詳細なヘルプメッセージを表示
- **CDP接続が分析中に切断される** — 接続状態を監視し、切断時にユーザーへ通知、再接続オプションを提供
- **Pa11y/Lighthouseが使えないことへのユーザーの不満** — エンジン制限を事前に明示、将来的なURL再取得オプションの検討
- **セキュリティリスク（リモートホストへの接続）** — デフォルトでlocalhost制限、リモート接続時は警告表示

## References

- [Playwright connectOverCDP API](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp) — CDP接続の公式ドキュメント
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) — CDPの公式仕様
- [@axe-core/playwright](https://www.npmjs.com/package/@axe-core/playwright) — Playwright用axe-core統合
- [Playwright Accessibility Testing](https://playwright.dev/docs/accessibility-testing) — 公式アクセシビリティテストガイド
