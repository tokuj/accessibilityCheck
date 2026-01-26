# Research & Design Decisions: report-enhancement

## Summary

- **Feature**: `report-enhancement`
- **Discovery Scope**: Extension（既存システムの機能拡張）
- **Key Findings**:
  - axe-coreの`NodeResult`型には`target`（CSSセレクタ配列）、`html`（HTML抜粋）、`failureSummary`が含まれる
  - Lighthouseの`audit.details.items`には`NodeValue`オブジェクトがあり、`selector`、`snippet`、`nodeLabel`を持つ
  - Pa11yの`issue`オブジェクトには`selector`と`context`（HTML抜粋）が含まれる
  - 3つのツールすべてでノード情報の抽出が可能

## Research Log

### axe-core NodeResult構造

- **Context**: Requirement 1で必要なノード情報（CSSセレクタ、HTML抜粋）の取得方法
- **Sources Consulted**:
  - axe-core TypeScript定義（axe.d.ts）
  - chromium.googlesource.com のaxe-core型定義
- **Findings**:
  - `NodeResult`インターフェース:
    - `target: string[]` - CSSセレクタ配列（必須）
    - `html: string` - 要素のouterHTML抜粋（必須）
    - `failureSummary?: string` - 失敗理由のサマリー（オプション）
    - `impact?: ImpactValue` - 影響度
    - `any/all/none: CheckResult[]` - チェック結果
  - `Result.nodes: NodeResult[]` として各ルールに紐づく
- **Implications**:
  - 現在の`axe.ts`では`v.nodes.length`のみ使用
  - `nodes`配列をそのまま`RuleResult`に追加することで対応可能
  - HTML抜粋は既に切り詰められているが、フロントエンドで追加制限も可能

### Lighthouse audit.details構造

- **Context**: LighthouseからのノードSource情報取得とscoreDisplayMode判定
- **Sources Consulted**:
  - Lighthouse TypeScript型定義（LH.Audit.Details）
  - developer.chrome.com Lighthouse 10.0リリースノート
- **Findings**:
  - `NodeValue`インターフェース:
    - `selector?: string` - CSSセレクタ
    - `snippet?: string` - HTML抜粋
    - `nodeLabel?: string` - 人間可読なラベル
    - `path?: string` - DevToolsパス
  - `audit.details.type`が`table`または`list`
  - `table`の場合: `items[].node: NodeValue`
  - `list`の場合: `items: NodeValue[]`直接
  - `audit.scoreDisplayMode`で`notApplicable`判定可能
- **Implications**:
  - 現在`scoreDisplayMode`未使用のため追加が必要
  - `details.items`からノード情報を抽出可能
  - ただし`selector`と`snippet`はオプショナル

### Pa11y issue構造

- **Context**: Pa11yからのノード情報取得
- **Sources Consulted**:
  - Pa11y GitHubリポジトリ README
  - @types/pa11y 型定義
- **Findings**:
  - `Pa11yIssue`インターフェース:
    - `selector: string` - CSSセレクタ
    - `context: string` - HTML抜粋
    - `code: string` - ルールコード
    - `message: string` - 説明
    - `type: 'error' | 'warning' | 'notice'`
  - Pa11yは1イシュー=1要素のため、ノード情報は既にissueに含まれる
- **Implications**:
  - 現在`nodeCount: 1`固定で正しい
  - `selector`と`context`を`NodeInfo`として抽出可能

### WCAGレベルマッピング

- **Context**: Requirement 2のWCAGレベル（A/AA/AAA）表示
- **Sources Consulted**:
  - WCAG 2.1公式仕様
- **Findings**:
  - WCAG 2.1は78の成功基準を含む
  - Level A: 30基準（1.1.1, 1.2.1-1.2.3, 1.3.1-1.3.3, 1.4.1-1.4.2, 2.1.1-2.1.2, 2.1.4, など）
  - Level AA: 21基準（1.2.4-1.2.5, 1.3.4-1.3.5, 1.4.3-1.4.5, 1.4.10-1.4.13, など）
  - Level AAA: 27基準（1.2.6-1.2.9, 1.3.6, 1.4.6-1.4.9, など）
- **Implications**:
  - 静的マッピングテーブルで十分
  - `wcag-mapping.ts`ユーティリティとして実装

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A: 既存拡張 | 既存コンポーネントに機能追加 | ファイル数維持、既存パターン活用 | コンポーネント肥大化、テスト複雑化 | 小規模変更向け |
| B: 新規作成 | 共通コンポーネント新規作成 | 関心分離、テスト容易、再利用性 | ファイル増加、統合作業 | 大規模変更向け |
| C: ハイブリッド | バックエンド先行、共通部品追加後に統合 | 段階的リリース、並行開発可能 | フェーズ間調整 | **推奨** |

## Design Decisions

### Decision: RuleResult型の拡張方法

- **Context**: ノード情報を追加しつつ後方互換性を維持する必要がある
- **Alternatives Considered**:
  1. `nodes`フィールドをオプショナルで追加
  2. 新しい`RuleResultWithNodes`型を作成
- **Selected Approach**: `nodes?: NodeInfo[]`をオプショナルフィールドとして追加
- **Rationale**: 後方互換性を維持しつつ、段階的にノード情報を活用可能
- **Trade-offs**: 型の複雑化 vs 破壊的変更の回避
- **Follow-up**: フロントエンドで`nodes`の存在チェックが必要

### Decision: WCAG集約の実行タイミング

- **Context**: バックエンドで事前集約 vs フロントエンドでリアルタイム集約
- **Alternatives Considered**:
  1. バックエンドで`wcagSummary`を生成
  2. フロントエンドで`useMemo`で計算
- **Selected Approach**: フロントエンドでリアルタイム集約
- **Rationale**: APIレスポンスサイズ増加を避け、フィルタリングUIとの連携が容易
- **Trade-offs**: クライアント計算負荷 vs APIシンプル化
- **Follow-up**: 大量データ時のパフォーマンス検証

### Decision: Lighthouse分類閾値

- **Context**: 中間スコア（0 < score < 1）の分類方法
- **Alternatives Considered**:
  1. 0.5閾値で違反/達成に分類
  2. 0.7閾値を使用
  3. 0.9閾値を使用（現在のimpactマッピングと同様）
- **Selected Approach**: 0.5閾値で違反（<0.5）/達成（>=0.5）に分類
- **Rationale**: 明確な基準で「不明」を最小化、ユーザーへのアクションが明確
- **Trade-offs**: 一部の中間状態が失われる vs 明確な分類
- **Follow-up**: `classificationReason`フィールドで分類根拠を記録

### Decision: 仮想スクロール実装

- **Context**: 大量ノード（100件以上）のパフォーマンス対策
- **Alternatives Considered**:
  1. MUI DataGrid Pro（有料）
  2. react-window（軽量）
  3. react-virtuoso（機能豊富）
  4. ページネーション
- **Selected Approach**: ページネーション（最初の10件表示 + 「さらに表示」）
- **Rationale**: 既存MUI依存のみで実装可能、新規ライブラリ追加不要
- **Trade-offs**: 仮想スクロールほど高速ではない vs 実装シンプル
- **Follow-up**: 100件以上のノードが実際に発生する頻度を監視

## Risks & Mitigations

- **APIレスポンスサイズ増加**: ノード情報追加でレスポンスが肥大化 → HTML抜粋を最大200文字に制限
- **後方互換性**: 型変更による既存コード影響 → オプショナルフィールドで追加
- **Lighthouse API変更**: Lighthouse内部構造の変更リスク → 型定義を明示的にインポート
- **パフォーマンス**: 大量データでのUI遅延 → ページネーションと遅延ロード

## References

- [axe-core TypeScript定義](https://github.com/dequelabs/axe-core/blob/develop/axe.d.ts) - NodeResult構造
- [Lighthouse TypeScript型](https://github.com/GoogleChrome/lighthouse/blob/main/types/lhr/audit-details.d.ts) - NodeValue構造
- [Pa11y README](https://github.com/pa11y/pa11y) - issue構造
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/) - 成功基準とレベル
