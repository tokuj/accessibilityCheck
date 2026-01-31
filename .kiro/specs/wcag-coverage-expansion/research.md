# Research & Design Decisions

## Summary

- **Feature**: wcag-coverage-expansion
- **Discovery Scope**: Complex Integration
- **Key Findings**:
  - IBM Equal Access Checker、Siteimprove Alfa、QualWebの3つのエンジンがnpmパッケージとして利用可能で、Playwright統合が可能
  - 既存の`server/analyzers/`パターン（`analyzeWith*`関数、`AnalyzerResult`インターフェース）を拡張することで一貫性を維持
  - 各エンジンの結果形式が異なるため、共通の`RuleResult`型への正規化レイヤーが必要

## Research Log

### IBM Equal Access Checker統合

- **Context**: WCAG 2.2対応のための追加エンジン調査
- **Sources Consulted**:
  - npmjs.com/package/accessibility-checker
  - github.com/IBMa/equal-access
- **Findings**:
  - `accessibility-checker`パッケージでPlaywright `page`オブジェクトを直接渡せる
  - `aChecker.getCompliance(page, label)`でスキャン実行
  - 結果は`report.results[]`配列で、各要素に`level`（violation/potentialviolation/pass等）を持つ
  - `.achecker.yml`で`policies: [WCAG_2_2]`を指定してWCAG 2.2ルールセットを有効化
  - ライセンス: Apache-2.0（商用利用可）
- **Implications**:
  - 既存の`analyzeWithAxe`パターンに従い`analyzeWithIBM`関数を作成
  - 設定ファイル（`.achecker.yml`）をプロジェクトルートに配置

### Siteimprove Alfa統合

- **Context**: ACT rules準拠のエンジン追加
- **Sources Consulted**:
  - alfa.siteimprove.com/code-checker/getting-started/usage/playwright
  - npmjs.com/package/@siteimprove/alfa-playwright
- **Findings**:
  - `@siteimprove/alfa-playwright`と`@siteimprove/alfa-test-utils`が必要
  - `Playwright.toPage(documentHandle)`でAlfa Page形式に変換
  - `Audit.run(alfaPage, options)`でルール実行
  - 結果は`ResultAggregate`（ルールごとのpass/fail/cantTell/inapplicable数）
  - `Rules.aaFilter`でAA levelのみフィルタ可能
  - ライセンス: MIT
- **Implications**:
  - 変換ステップ（Playwright→Alfa Page）が必要
  - `analyzeWithAlfa`関数でラップ

### QualWeb統合

- **Context**: 110+ ACT rulesを持つエンジン
- **Sources Consulted**:
  - github.com/qualweb/core
  - npmjs.com/package/@qualweb/core
- **Findings**:
  - 独自のPuppeteerクラスタを起動するため、Playwrightとの直接統合は複雑
  - `html`オプションでPlaywrightから取得したHTMLを渡すアプローチが推奨
  - `qw.evaluate({ html: markup })`でスキャン実行
  - 結果は`modules.act-rules.assertions`と`modules.wcag-techniques.assertions`
  - 各assertionに`verdict`（passed/failed/warning等）を持つ
  - ライセンス: ISC
- **Implications**:
  - `page.content()`でHTMLを取得してQualWebに渡す設計
  - Puppeteerクラスタの起動/停止管理が必要

### WAVE API統合

- **Context**: SaaS APIによる追加検証
- **Sources Consulted**:
  - wave.webaim.org/api
  - wave.webaim.org/api/details
- **Findings**:
  - REST API: `GET https://wave.webaim.org/api/request?key=KEY&url=URL`
  - レポートタイプ1-4で詳細度が異なる（タイプ3以上でXPath取得可能）
  - レート制限: 同時2リクエストまで推奨
  - 価格: $0.025/URL（10,000+クレジット時）
  - 結果カテゴリ: error, contrast, alert, feature, structure, aria
- **Implications**:
  - APIキーを環境変数またはSecret Managerで管理
  - レポートタイプ3を使用（XPath含む）
  - 呼び出し数カウント機能が必要

### 既存アナライザーパターン分析

- **Context**: 既存コードベースとの一貫性確保
- **Sources Consulted**:
  - server/analyzers/axe.ts
  - server/analyzers/pa11y.ts
  - server/analyzers/lighthouse.ts
  - server/analyzers/types.ts
- **Findings**:
  - 共通インターフェース: `AnalyzerResult { violations, passes, incomplete, duration }`
  - 各アナライザーは`analyzeWith*`関数をエクスポート
  - `RuleResult`型に正規化して統一的に扱う
  - `toolSource`フィールドでエンジンを識別
  - `wcagCriteria`フィールドでWCAG基準を記録
  - タイミング・ログ機能は`utils/analyzer-timing.ts`で共通化
- **Implications**:
  - 新エンジンも同じパターンに従う
  - `ToolSource`型を拡張（`'ibm' | 'alfa' | 'qualweb' | 'wave'`追加）

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Analyzer per file | 各エンジンを個別の`analyzers/*.ts`ファイルに実装 | 既存パターンと一致、保守性が高い | ファイル数増加 | 採用 |
| Plugin system | エンジンをプラグインとして動的ロード | 拡張性が高い | 過剰設計、現時点では不要 | 将来検討 |
| Unified engine wrapper | 全エンジンを1つのラッパーで統合 | コード削減 | 責任が曖昧、テスト困難 | 不採用 |

## Design Decisions

### Decision: エンジン別ファイル分割

- **Context**: 3つの新エンジン（IBM、Alfa、QualWeb）+ 1つのAPI（WAVE）を追加
- **Alternatives Considered**:
  1. 全て1ファイルに統合
  2. 各エンジンを個別ファイルに
  3. プラグインシステム
- **Selected Approach**: 各エンジンを`server/analyzers/`に個別ファイルとして追加
- **Rationale**: 既存の`axe.ts`、`pa11y.ts`、`lighthouse.ts`パターンと一致し、チームが理解しやすい
- **Trade-offs**: ファイル数増加vs保守性向上
- **Follow-up**: なし

### Decision: 結果正規化レイヤー

- **Context**: 各エンジンの結果形式が異なる
- **Alternatives Considered**:
  1. 各エンジン内で`RuleResult`に変換
  2. 共通正規化サービスを作成
- **Selected Approach**: 各エンジン内で変換（既存パターンに従う）
- **Rationale**: axe.ts、pa11y.ts、lighthouse.tsが既にこのパターンを使用
- **Trade-offs**: 変換ロジックが分散するが、各エンジンの特性に合わせた変換が可能
- **Follow-up**: なし

### Decision: QualWebのPlaywright統合方式

- **Context**: QualWebは独自Puppeteerを使用
- **Alternatives Considered**:
  1. QualWebのPuppeteerを直接使用（別ブラウザ起動）
  2. PlaywrightのHTMLを取得してQualWebに渡す
- **Selected Approach**: `page.content()`でHTMLを取得してQualWebの`html`オプションに渡す
- **Rationale**: 1つのブラウザで完結、認証状態を維持
- **Trade-offs**: 動的DOMの状態を正確にキャプチャできるが、JavaScriptイベントは失われる
- **Follow-up**: 動的コンテンツテストでの影響を確認

### Decision: 半自動チェックのUI設計

- **Context**: ユーザーがツール内で簡易判断を行う機能
- **Alternatives Considered**:
  1. モーダルダイアログで1項目ずつ確認
  2. カード形式で一覧表示、個別に回答
  3. ウィザード形式で順次確認
- **Selected Approach**: カード形式で一覧表示
- **Rationale**: ユーザーが全体を把握しながら効率的に回答可能
- **Trade-offs**: UI実装の複雑さ増加
- **Follow-up**: フロントエンド設計で詳細化

### Decision: 違反重複排除ロジック

- **Context**: 複数エンジンが同一問題を検出
- **Alternatives Considered**:
  1. CSSセレクタ完全一致
  2. WCAG基準 + セレクタ類似度
  3. ルールID + セレクタ
- **Selected Approach**: WCAG基準 + CSSセレクタ正規化 + 違反内容の類似度
- **Rationale**: 各エンジンのルールIDは異なるが、WCAG基準は共通
- **Trade-offs**: 類似度計算のオーバーヘッド
- **Follow-up**: 閾値のチューニングが必要

## Risks & Mitigations

- **QualWebのブラウザ競合**: Puppeteerクラスタ管理による複雑さ → HTMLパススルー方式で回避
- **WAVE APIのレート制限**: 同時2リクエスト制限 → キュー管理、オプショナル機能として実装
- **新エンジン追加による分析時間増加**: 6エンジン並列実行 → タイムアウト設定、エンジン選択オプション
- **結果形式の変更**: 外部パッケージ更新で結果形式が変わる可能性 → 型定義とテストで検知

## References

- [IBM Equal Access Checker npm](https://www.npmjs.com/package/accessibility-checker) — Playwright統合API
- [Siteimprove Alfa Playwright](https://alfa.siteimprove.com/code-checker/getting-started/usage/playwright) — 公式ドキュメント
- [QualWeb Core GitHub](https://github.com/qualweb/core) — HTML入力オプション
- [WAVE API Details](https://wave.webaim.org/api/details) — レポートタイプとレスポンス形式
- [axe-core WCAG 2.2 tags](https://www.deque.com/axe/core-documentation/api-documentation/) — wcag22a/wcag22aa対応
