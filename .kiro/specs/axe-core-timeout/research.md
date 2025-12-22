# Research & Design Decisions

## Summary

- **Feature**: `axe-core-timeout`
- **Discovery Scope**: Extension（既存システムの拡張）
- **Key Findings**:
  - axe-coreには独自タイムアウト設定がなく、Playwright側で制御が必要
  - Pa11yは`hideElements`、Lighthouseは`blockedUrlPatterns`で広告除外可能
  - 共通の広告セレクタリストを定義し全ツールで共有する設計が効果的

## Research Log

### axe-core タイムアウト制御

- **Context**: 広告が多いサイトでaxe-core分析がタイムアウトする
- **Sources Consulted**:
  - @axe-core/playwright npm documentation
  - Playwright test timeouts documentation
- **Findings**:
  - `AxeBuilder.analyze()`はPromiseを返すのみ、独自タイムアウト設定なし
  - タイムアウト制御はPlaywright側で行う（`test.setTimeout()`, `page.setDefaultTimeout()`）
  - `.setLegacyMode(true)`でクロスオリジンiframeスキャンを無効化（広告iframeに有効）
  - `.exclude()`で広告要素を分析対象から除外可能
  - `.disableRules('color-contrast')`で重いルールを無効化可能
- **Implications**: Playwrightタイムアウト設定とaxe-core最適化オプションの組み合わせが必要

### Pa11y タイムアウトと広告対策

- **Context**: Pa11yの広告サイト対応設定を調査
- **Sources Consulted**:
  - Pa11y GitHub repository documentation
  - Pa11y-ci configuration examples
- **Findings**:
  - `timeout`オプション: ハードリミット（デフォルト30秒）
  - `wait`オプション: ページロード後の追加待機時間
  - `hideElements`オプション: CSSセレクタで要素を非表示（アクセシビリティツリーから除外）
  - `chromeLaunchConfig.args`でブラウザオプション設定可能
- **Implications**: `hideElements`による広告除外が最も効果的

### Lighthouse タイムアウトと広告対策

- **Context**: Lighthouseの広告サイト対応設定を調査
- **Sources Consulted**:
  - Lighthouse GitHub repository
  - chrome-launcher documentation
- **Findings**:
  - `maxWaitForLoad`: ページロードタイムアウト（デフォルト30秒）
  - `maxWaitForFcp`: First Contentful Paintタイムアウト
  - `blockedUrlPatterns`: URLパターンでリクエストをブロック
  - chrome-launcherには独自タイムアウト設定なし
- **Implications**: `blockedUrlPatterns`による広告ドメインブロックが効果的

### 既存コードベースパターン分析

- **Context**: 既存のアナライザー実装パターンを調査
- **Findings**:
  - 各アナライザーは`AnalyzerResult`インターフェースを返す統一パターン
  - 認証オプション（`Pa11yAuthOptions`, `LighthouseAuthOptions`）が既に存在
  - `analyzer.ts`がオーケストレーション、各`analyzers/`がツール固有処理
  - 型は`analyzers/types.ts`に集約
- **Implications**: 既存パターンを踏襲し、タイムアウト/広告除外オプションを追加

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 個別設定 | 各アナライザーに個別に設定を追加 | シンプル、影響範囲が限定的 | 設定の重複、整合性維持が困難 | 不採用 |
| 共通設定モジュール | 共通設定を`config/`に集約 | 一元管理、整合性確保 | 追加のモジュール依存 | **採用** |
| 環境変数のみ | 全てを環境変数で制御 | 設定変更が容易 | 複雑な設定が困難 | 部分採用（上書き用） |

## Design Decisions

### Decision: 共通広告除外設定モジュールの導入

- **Context**: 3つのツールで広告除外設定を共有する必要がある
- **Alternatives Considered**:
  1. 各アナライザーに広告セレクタをハードコード
  2. 共通モジュールで広告セレクタリストを定義し共有
- **Selected Approach**: 共通モジュール`server/config/ad-blocking.ts`を新設
- **Rationale**: 広告セレクタの追加・変更が一箇所で完結し、保守性が向上
- **Trade-offs**: 新規ファイル追加によるコード量増加（軽微）
- **Follow-up**: 広告セレクタリストの網羅性をテストで検証

### Decision: オプション型の拡張

- **Context**: 既存の認証オプションパターンを活かしつつ、タイムアウト/広告除外オプションを追加
- **Selected Approach**: 各アナライザーのオプション型を拡張（例: `AxeAnalyzerOptions`）
- **Rationale**: 既存パターンとの一貫性を維持
- **Trade-offs**: インターフェース変更による既存呼び出し元への影響（デフォルト値で後方互換性確保）

### Decision: Playwrightリソースブロックの実装箇所

- **Context**: `page.route()`による広告ブロックをどこで実装するか
- **Alternatives Considered**:
  1. `analyzer.ts`のページ作成直後
  2. 各アナライザー内
  3. 共通ユーティリティ関数
- **Selected Approach**: 共通ユーティリティ関数`setupAdBlocking(page)`を作成し、`analyzer.ts`で呼び出し
- **Rationale**: axe-coreとPa11y/Lighthouseで異なるブラウザを使用するため、共通化は限定的。Playwright使用箇所（axe-core用）でのみ適用
- **Follow-up**: Pa11yはPuppeteerを使用するため、別途対応が必要か検討（現時点では`hideElements`で対応）

## Risks & Mitigations

- **広告セレクタの網羅性不足** — 主要な広告ネットワークを優先し、継続的に追加
- **タイムアウト値の調整** — 環境変数による上書きを可能にし、柔軟に対応
- **後方互換性** — 全オプションにデフォルト値を設定し、既存呼び出しに影響なし
- **パフォーマンス影響** — 広告ブロックによりむしろ改善が期待される

## References

- [@axe-core/playwright npm](https://www.npmjs.com/package/@axe-core/playwright)
- [Playwright test timeouts](https://playwright.dev/docs/test-timeouts)
- [Pa11y configuration](https://github.com/pa11y/pa11y)
- [Lighthouse configuration](https://github.com/GoogleChrome/lighthouse)
