# Requirements Document

## Introduction

広告要素が多いWebサイト（例: game8.jp等のゲーム攻略サイト）でアクセシビリティテストを実行する際、各分析ツール（axe-core、Pa11y、Lighthouse）がタイムアウトする問題を解決する。本仕様では、3つのツール全てについてタイムアウトの根本原因を分析し、適切な対策を実装する。

### 背景と調査結果

#### コードベース調査

| ツール | ファイル | 現在の設定 | デフォルト | 問題点 |
|--------|----------|-----------|-----------|--------|
| axe-core | `server/analyzers/axe.ts:13-15` | なし | Playwright 30秒 | タイムアウト設定なし、legacyMode未使用 |
| Pa11y | `server/analyzers/pa11y.ts:50-57` | 60秒 | 30秒 | 広告サイトには不足、hideElements未設定 |
| Lighthouse | `server/analyzers/lighthouse.ts:88-93` | なし | 30秒 | maxWaitForLoad未設定、blockedUrlPatterns未設定 |
| Playwright page.goto | `server/analyzer.ts:203` | 60秒 | 30秒 | 広告サイトには不足の可能性 |
| Playwright CLI | `playwright.config.ts` | なし | 30秒 | グローバルタイムアウト未設定 |
| CLI テスト | `tests/accessibility.spec.ts:26` | networkidle | - | 広告リクエストで完了しない可能性 |

#### 外部調査（o3検索結果）

**axe-core:**
- `@axe-core/playwright`には独自のタイムアウト設定がない
- タイムアウト制御はPlaywright側で行う必要がある
- 推奨対策:
  - `.setLegacyMode(true)` - クロスオリジンiframeのペナルティを回避（広告iframeに有効）
  - `.include()` / `.exclude()` - 分析スコープを限定
  - `.disableRules('color-contrast')` - 大規模DOMで重いルールを無効化
  - `page.route()` - 広告リクエスト自体をブロック

**Pa11y:**
- `timeout`オプションでハードリミット設定可能（デフォルト30秒）
- `wait`オプションでページロード後の追加待機時間を設定可能
- `hideElements`で広告要素をアクセシビリティツリーから除外可能
- Puppeteerのリクエストインターセプトで広告ブロック可能

**Lighthouse:**
- `maxWaitForLoad`でページロードタイムアウトを設定（デフォルト30秒）
- `maxWaitForFcp`でFirst Contentful Paintのタイムアウトを設定
- `blockedUrlPatterns`で広告ドメインをブロック可能
- chrome-launcherには独自のタイムアウト設定はない

### タイムアウト対策のアプローチ

単純にタイムアウト時間を延長するだけでなく、以下の多角的アプローチを採用：

1. **広告要素の除外/ブロック** - 根本原因への対処（最優先）
2. **ツール固有の最適化設定** - 各ツールの特性を活かした設定
3. **タイムアウト値の適切な設定** - 最後の手段として延長

## Requirements

### Requirement 1: axe-core分析の最適化

**Objective:** 開発者として、axe-core分析を広告が多いサイトでも安定して実行し、タイムアウトを防止したい。

#### Acceptance Criteria

1. The AxeBuilder shall `setLegacyMode(true)`を設定し、クロスオリジンiframeのスキャンによるペナルティを回避する
2. When 広告要素除外オプションが有効な場合, the AxeBuilder shall 一般的な広告関連セレクタ（`iframe[src*="ads"]`, `iframe[src*="doubleclick"]`, `[class*="ad-"]`, `[id*="ad-"]`, `.adsbygoogle`等）を`.exclude()`で除外する
3. The AccessibilityAnalyzer shall axe-core分析のデフォルトで広告要素除外を有効にする
4. When Playwrightページを作成する時, the AccessibilityAnalyzer shall `page.setDefaultTimeout(120000)`を設定する
5. The AxeBuilder shall `color-contrast`ルールの無効化オプションを提供する（大規模DOMサイト向け）

### Requirement 2: Pa11y分析の最適化

**Objective:** 開発者として、Pa11y分析を広告が多いサイトでも安定して実行し、タイムアウトを防止したい。

#### Acceptance Criteria

1. The Pa11yAnalyzer shall `timeout`を90秒（90000ms）に設定する
2. The Pa11yAnalyzer shall `wait`を3秒（3000ms）に設定し、ページ安定化を待つ
3. When 広告要素除外オプションが有効な場合, the Pa11yAnalyzer shall `hideElements`オプションで広告関連セレクタ（`.ad`, `.advert`, `[data-ad-slot]`, `.adsbygoogle`, `iframe[src*="ads"]`等）を非表示にする
4. The Pa11yAnalyzer shall デフォルトで広告要素除外を有効にする

### Requirement 3: Lighthouse分析の最適化

**Objective:** 開発者として、Lighthouse分析を広告が多いサイトでも安定して実行し、タイムアウトを防止したい。

#### Acceptance Criteria

1. The LighthouseAnalyzer shall `maxWaitForLoad`を90秒（90000ms）に設定する
2. The LighthouseAnalyzer shall `maxWaitForFcp`を60秒（60000ms）に設定する
3. When 広告ブロックオプションが有効な場合, the LighthouseAnalyzer shall `blockedUrlPatterns`で広告ドメイン（`*doubleclick.net/*`, `*googlesyndication.com/*`, `*adservice.google.*`等）をブロックする
4. The LighthouseAnalyzer shall デフォルトで広告ブロックを有効にする

### Requirement 4: 共通設定とオプション

**Objective:** 開発者として、3つのツール共通の設定を一元管理し、必要に応じて個別にカスタマイズしたい。

#### Acceptance Criteria

1. The AccessibilityAnalyzer shall 共通の広告除外セレクタリストを定義し、全ツールで共有する
2. The AccessibilityAnalyzer shall 環境変数`AXE_TIMEOUT_MS`、`PA11Y_TIMEOUT_MS`、`LIGHTHOUSE_TIMEOUT_MS`でツール別タイムアウトを上書き可能にする
3. When `DISABLE_AD_BLOCKING`環境変数が設定された場合, the AccessibilityAnalyzer shall 全ツールで広告除外/ブロックを無効にする
4. The AccessibilityAnalyzer shall ページ読み込みタイムアウトを90秒（90000ms）に延長する

### Requirement 5: Playwrightリソースブロック

**Objective:** 開発者として、ページ読み込み時点で広告リソースをブロックし、全ツールの分析パフォーマンスを向上させたい。

#### Acceptance Criteria

1. When 広告ブロックオプションが有効な場合, the AccessibilityAnalyzer shall `page.route()`で広告関連URL（`**/ads/**`, `**/*doubleclick*`, `**/*googlesyndication*`等）へのリクエストをabortする
2. The AccessibilityAnalyzer shall 大きなメディアファイル（`*.mp4`, `*.webm`等）のブロックオプションを提供する
3. The AccessibilityAnalyzer shall ブロックしたリクエスト数をログに記録する
4. When リソースブロックが有効な場合, the AccessibilityAnalyzer shall ブロック対象パターンをログに出力する

### Requirement 6: CLIテスト設定の更新

**Objective:** 開発者として、Playwright CLIテストでも同様のタイムアウト設定と最適化を適用し、CI/CDパイプラインでのテスト失敗を防止したい。

#### Acceptance Criteria

1. The playwright.config.ts shall グローバルテストタイムアウトを180秒（180000ms）に設定する
2. The playwright.config.ts shall アクションタイムアウトを90秒（90000ms）に設定する
3. The accessibility.spec.ts shall ページ読み込み戦略を`domcontentloaded`に変更し、追加で2秒の安定化待機を行う
4. The accessibility.spec.ts shall `setLegacyMode(true)`と広告要素除外を適用する

### Requirement 7: エラーハンドリングとログ改善

**Objective:** 開発者として、タイムアウト発生時の詳細情報を取得し、問題の診断を容易にしたい。

#### Acceptance Criteria

1. When タイムアウトが発生した場合, the AccessibilityAnalyzer shall タイムアウト発生箇所（ページ読み込み/axe-core/Pa11y/Lighthouse）を明示するエラーメッセージを返す
2. The AccessibilityAnalyzer shall 各ツールの分析開始時刻と終了時刻をログに記録する
3. If いずれかのツールの分析が60秒を超えた場合, the AccessibilityAnalyzer shall 警告ログを出力する
4. When エラーが発生した場合, the AccessibilityAnalyzer shall 対象URL、ツール名、経過時間、エラー詳細を含む構造化ログを出力する
