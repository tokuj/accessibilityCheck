# Research & Design Decisions: inline-ai-discussion

## Summary

- **Feature**: `inline-ai-discussion`
- **Discovery Scope**: Extension（既存システムへの新機能追加）
- **Key Findings**:
  1. MUI Popoverはフォーカストラップ・キーボードナビゲーションを内蔵しており、アクセシビリティ要件を満たせる
  2. 既存のWCAG→ルールIDマッピング（`server/analyzers/lighthouse.ts`）を拡張してSpindle URLマッピングを構築可能
  3. GeminiServiceの既存パターンを踏襲し、対話用の新関数を追加する設計が適切

## Research Log

### MUI Popover アクセシビリティ

- **Context**: 要件6（アクセシビリティ対応）の実現方法調査
- **Sources Consulted**:
  - [MUI Modal Documentation](https://mui.com/material-ui/react-modal/)
  - [MUI Popover Documentation](https://mui.com/material-ui/react-popover/)
  - [MUI FocusTrap Component](https://v6.mui.com/base-ui/react-focus-trap/)
- **Findings**:
  - Popoverは内部でModalコンポーネントを使用しており、以下の機能を自動提供:
    - フォーカストラップ（モーダル外への移動を防止）
    - ESCキーでの閉じる操作
    - 適切なARIAロール自動付与
  - `aria-labelledby`と`aria-describedby`の手動設定が推奨
  - `aria-expanded`と`aria-controls`をトリガー要素に設定する必要あり
- **Implications**:
  - MUI Popoverを使用し、追加のARIA属性を手動設定することで要件6を満たせる
  - カスタムのフォーカストラップ実装は不要

### 既存WCAGマッピングの活用

- **Context**: 要件8（Spindleマッピング）の既存資産調査
- **Sources Consulted**:
  - `server/analyzers/lighthouse.ts:60-93` - wcagMapオブジェクト
  - `server/analyzers/types.ts:14` - wcagCriteria型定義
- **Findings**:
  - Lighthouseアナライザに30以上のルールID→WCAG基準マッピングが既存
  - axe-core, pa11yでも`extractWcagCriteria`関数でタグからWCAG抽出済み
  - `RuleResult.wcagCriteria: string[]`で統一的にアクセス可能
- **Implications**:
  - 新規のSpindleマッピングデータは、既存のwcagMap構造を参考に作成
  - WCAG基準 → Spindle URLの1対1または1対多マッピングを構築

### Spindleガイドライン構造

- **Context**: Spindle URLマッピングデータ設計
- **Sources Consulted**:
  - [Ameba アクセシビリティガイドライン](https://a11y-guidelines.ameba.design/)
- **Findings**:
  - トップレベルカテゴリ: 知覚可能、操作可能、理解可能、堅牢性（WCAG原則に対応）
  - URL構造: `https://a11y-guidelines.ameba.design/[category]/[criterion]/`
  - 例: コントラスト関連は `/1/contrast/` のようなパス構造と推測
- **Implications**:
  - 初期実装ではフォールバックURLを活用し、段階的にマッピングを拡充
  - マッピングデータはJSONで管理し、更新容易性を確保

### GeminiService拡張パターン

- **Context**: 対話用API設計の既存パターン調査
- **Sources Consulted**:
  - `server/services/gemini.ts` - 既存実装
- **Findings**:
  - `sanitizeJsonResponse`, `logFallbackActivation`, `generateFallbackSummary`などのユーティリティ関数
  - `GeminiError`型による構造化エラーハンドリング
  - タイムアウト30秒、リトライ3回の設定済み
  - プロンプトビルダーパターン（`buildPrompt`関数）
- **Implications**:
  - 対話用の`generateChatResponse`関数を同ファイルに追加
  - 既存のエラーハンドリング・タイムアウト設定を再利用

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A: 既存拡張 | 各UIコンポーネントに直接対話機能を埋め込む | コンテキスト受け渡しが容易 | コンポーネント肥大化、テスト困難 | 非推奨 |
| B: 新規分離 | 対話機能を完全に独立したコンポーネント群として作成 | 関心分離、テスト容易 | ファイル数増加 | 推奨 |
| C: ハイブリッド | 共通コンポーネントを新規作成、段階的に統合 | リスク分散、柔軟性 | 計画必要 | gap-analysisで推奨済み |

**選択**: Option B（新規分離）をベースに、段階的なロールアウト（Option C要素）を組み合わせ

## Design Decisions

### Decision: コンポーネント分離戦略

- **Context**: 7つの既存コンポーネントに対話機能を追加する方法
- **Alternatives Considered**:
  1. 各コンポーネントに直接埋め込み
  2. 共通コンポーネント（AIChatButton, AIChatPopover）を作成し、既存コンポーネントからラップ利用
- **Selected Approach**: Option 2 - 共通コンポーネント作成
- **Rationale**:
  - 単一責任原則の維持
  - 対話ロジックの集約によるテスト容易性
  - 将来の拡張（他画面への対話機能追加）への対応
- **Trade-offs**:
  - ✅ 保守性・テスト容易性向上
  - ❌ 初期ファイル数増加（約10ファイル）
- **Follow-up**: 各コンポーネントへの統合時にpropsインターフェースの検証

### Decision: 履歴管理ストレージ

- **Context**: 対話履歴の保存場所（要件3）
- **Alternatives Considered**:
  1. localStorage（永続化）
  2. sessionStorage（タブ単位）
  3. React Context / State（メモリのみ）
- **Selected Approach**: sessionStorage
- **Rationale**:
  - 要件3.4「ブラウザタブを閉じた場合、履歴は削除される」に準拠
  - タブ単位で独立した履歴管理が可能
  - 既存localStorage実装パターンを参考に容易に実装可能
- **Trade-offs**:
  - ✅ 要件準拠、プライバシー配慮
  - ❌ タブを閉じると履歴喪失

### Decision: Popover vs Dialog

- **Context**: 対話UIのモーダル種類選択（要件1, 6）
- **Alternatives Considered**:
  1. MUI Dialog（フルモーダル）
  2. MUI Popover（インライン表示）
  3. カスタムポップオーバー
- **Selected Approach**: MUI Popover
- **Rationale**:
  - Figmaコメントのようなインライン体験を実現
  - 既存コンテキストを維持しながら対話可能
  - MUI内蔵のアクセシビリティ機能を活用
- **Trade-offs**:
  - ✅ コンパクトなUI、コンテキスト維持
  - ❌ 画面端での位置調整が必要（MUIが自動処理）

## Risks & Mitigations

- **Spindleマッピング不完全** — 初期リリースではフォールバックURL（トップページ）を使用し、段階的に拡充
- **AIハルシネーション** — プロンプトで「参照元に記載のない情報は推測しない」を明示、回答に参照URL必須
- **Popover位置調整** — MUIの`anchorOrigin`/`transformOrigin`設定で対応、画面端テストを実施
- **対話ポイント過多によるUI煩雑化** — ホバー時のみアイコン表示、コンパクトなデザイン採用

## References

- [MUI Modal Documentation](https://mui.com/material-ui/react-modal/) — フォーカストラップ、ARIA属性の実装詳細
- [MUI Popover Documentation](https://mui.com/material-ui/react-popover/) — Popoverコンポーネントの使用方法
- [Ameba アクセシビリティガイドライン](https://a11y-guidelines.ameba.design/) — Spindle参照元
- [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/) — アクセシビリティ標準
