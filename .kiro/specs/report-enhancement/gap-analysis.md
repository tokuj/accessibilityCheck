# Gap Analysis: report-enhancement

## 概要

本ドキュメントは、`report-enhancement`機能の要件と既存コードベースのギャップを分析し、実装戦略を提案する。

## 1. 現状調査

### 1.1 関連ファイル・モジュール

| カテゴリ | ファイル | 役割 |
|----------|----------|------|
| **バックエンド** | `server/analyzers/axe.ts` | axe-core分析（ノード情報を`nodeCount`のみに縮小） |
| | `server/analyzers/lighthouse.ts` | Lighthouse分析（`scoreDisplayMode`未使用） |
| | `server/analyzers/pa11y.ts` | Pa11y分析（ノード情報なし） |
| | `server/analyzers/types.ts` | 共通型定義（`RuleResult`にノード詳細なし） |
| | `server/analyzer.ts` | オーケストレータ |
| **フロントエンド** | `frontend/src/components/ViolationsTable.tsx` | 違反テーブル（WCAG別AIボタンあり） |
| | `frontend/src/components/IncompleteTable.tsx` | 不明テーブル（WCAG別AIボタンなし） |
| | `frontend/src/components/PassesTable.tsx` | 達成テーブル（WCAG別AIボタンなし、影響度カラムなし） |
| | `frontend/src/components/ImprovementList.tsx` | AI総評セクション |
| | `frontend/src/types/accessibility.ts` | フロントエンド型定義 |

### 1.2 既存パターン・規約

- **コンポーネント命名**: PascalCase（例: `ViolationsTable.tsx`）
- **型定義**: バックエンド・フロントエンドで同様の構造を維持（`RuleResult`）
- **UIライブラリ**: MUI v7.3.6（Collapse、Accordion等の展開コンポーネント利用可能）
- **状態管理**: React useState/useMemo（Redux等は未使用）
- **テスト**: Vitest + Testing Library

### 1.3 統合ポイント

- **データフロー**: `analyzeUrl()` → `AccessibilityReport` → フロントエンドコンポーネント
- **API契約**: `RuleResult`型がバックエンド・フロントエンド間の契約
- **AI機能**: `AIChatButton`コンポーネントが`ChatContext`型でコンテキストを受け取る

## 2. 要件別ギャップ分析

### Requirement 1: 指摘箇所の具体的な特定

| 技術ニーズ | 現状 | ギャップ |
|------------|------|----------|
| ノード情報（CSSセレクタ、HTML抜粋） | axe-coreの`v.nodes`から`nodeCount`のみ抽出 | **Missing**: `target`配列、`html`属性を抽出していない |
| 行展開UI | 展開UIパターンなし | **Missing**: MUI Collapseを使った展開実装が必要 |
| Pa11y/Lighthouseノード情報 | Pa11yは`issue.selector`、`issue.context`あり。Lighthouseは`audit.details.items`あり | **Missing**: 各アナライザーでノード情報を抽出していない |

**Research Needed**:
- axe-coreの`NodeResult`型の詳細構造
- Pa11yの`issue`オブジェクトの`selector`、`context`フィールド
- Lighthouseの`audit.details.items`構造

### Requirement 2: WCAG基準でのアグリゲートレポート

| 技術ニーズ | 現状 | ギャップ |
|------------|------|----------|
| WCAG項番別集約 | 各ツールが個別に`wcagCriteria`を返却 | **Missing**: 集約ロジックなし |
| WCAGレベル判定 | なし | **Missing**: WCAG項番→レベルのマッピングテーブル |
| フィルタリングUI | なし | **Missing**: WCAG項番クリック時のフィルタ機能 |

**Research Needed**:
- WCAGレベルマッピングのデータソース（静的マッピングテーブルで十分）

### Requirement 3: Lighthouse「不明」項目の削減

| 技術ニーズ | 現状 | ギャップ |
|------------|------|----------|
| `scoreDisplayMode`判定 | 未使用 | **Missing**: `audit.scoreDisplayMode`の確認ロジック |
| 中間スコア分類 | `score > 0 && score < 1`はincomplete | **Constraint**: 0.5閾値で分類変更が必要 |
| 分類理由の記録 | なし | **Missing**: `RuleResult`型への`classificationReason`追加 |

**Code Reference**: `server/analyzers/lighthouse.ts:202-209`
```typescript
if (audit.score === 0) {
  violations.push(ruleResult);
} else if (audit.score === 1) {
  passes.push(ruleResult);
} else if (audit.score === null || (audit.score > 0 && audit.score < 1)) {
  incomplete.push(ruleResult);
}
```

### Requirement 4: タブ間の構造統一

| 技術ニーズ | 現状 | ギャップ |
|------------|------|----------|
| WCAG別AIボタン（不明タブ） | なし | **Missing**: `IncompleteTable`に実装必要 |
| WCAG別AIボタン（達成タブ） | なし | **Missing**: `PassesTable`に実装必要 |
| 影響度カラム（達成タブ） | なし | **Missing**: `PassesTable`に影響度カラム追加 |

**Code Reference**:
- `ViolationsTable.tsx:84-104`: WCAG別AIボタンの実装パターン
- `IncompleteTable.tsx:74-84`: WCAGチップのみ（AIボタンなし）
- `PassesTable.tsx:68-80`: WCAGチップのみ（AIボタンなし）

### Requirement 5: 非機能要件

| 技術ニーズ | 現状 | ギャップ |
|------------|------|----------|
| 仮想スクロール | なし | **Missing**: 大量データ対応が必要（MUI Virtualized Tableまたはreact-window） |
| モバイル対応 | MUI responsive props使用 | **低リスク**: 既存パターンで対応可能 |
| エラーハンドリング | 基本的なエラー表示あり | **低リスク**: 既存パターンで対応可能 |

## 3. 実装アプローチオプション

### Option A: 既存コンポーネント拡張

**対象**:
- `RuleResult`型にノード情報フィールド追加
- `ViolationsTable`、`IncompleteTable`、`PassesTable`に展開機能追加
- `ImprovementList`にWCAG集約セクション追加
- `lighthouse.ts`の分類ロジック修正

**トレードオフ**:
- ✅ ファイル数増加なし
- ✅ 既存パターン活用
- ❌ 各テーブルコンポーネントが肥大化（現在100-135行→200-250行に増加見込み）
- ❌ テストの複雑化

### Option B: 新規コンポーネント作成

**対象**:
- `NodeDetails.tsx`: ノード情報展開コンポーネント（再利用可能）
- `WcagAggregateSummary.tsx`: WCAG集約サマリーコンポーネント
- `ResultTable.tsx`: 統一テーブルコンポーネント（3タブで共有）
- `wcag-mapping.ts`: WCAGレベルマッピングユーティリティ

**トレードオフ**:
- ✅ 関心の分離が明確
- ✅ テストが容易
- ✅ 再利用性が高い
- ❌ ファイル数増加（4-5ファイル追加）
- ❌ 既存コンポーネントとの統合作業

### Option C: ハイブリッドアプローチ（推奨）

**フェーズ1（バックエンド）**:
- `RuleResult`型拡張（ノード情報、分類理由）
- `lighthouse.ts`分類ロジック修正
- 各アナライザーでノード情報抽出

**フェーズ2（フロントエンド共通部品）**:
- `NodeDetails.tsx`新規作成
- `wcag-mapping.ts`新規作成
- 共通展開ロジックをカスタムフックに抽出

**フェーズ3（既存コンポーネント統合）**:
- 3つのテーブルコンポーネントにNodeDetails統合
- タブ間構造統一
- WCAG集約サマリーをImprovementListに追加

**トレードオフ**:
- ✅ 段階的なリリースが可能
- ✅ 各フェーズで動作確認可能
- ✅ 必要な部分のみ新規作成
- ❌ フェーズ間の調整が必要

## 4. 工数・リスク評価

| 要件 | 工数 | リスク | 理由 |
|------|------|--------|------|
| Req 1: ノード情報 | M (3-7日) | Medium | バックエンド・フロントエンド両方の変更、UIパターンの新規実装 |
| Req 2: WCAG集約 | M (3-7日) | Low | 静的マッピングとUI実装、既存パターン流用可能 |
| Req 3: Lighthouse改善 | S (1-3日) | Low | 既存ロジックの修正のみ |
| Req 4: タブ統一 | S (1-3日) | Low | 既存パターン（ViolationsTable）をコピー |
| Req 5: 非機能 | S-M (2-5日) | Medium | 仮想スクロール導入が主な作業 |

**合計工数**: L (1-2週間)
**総合リスク**: Medium

## 5. 設計フェーズへの推奨事項

### 推奨アプローチ

**Option C（ハイブリッド）**を推奨。理由:
1. バックエンド変更（ノード情報、Lighthouse分類）を先に完了させることで、フロントエンド開発が並行可能
2. 共通コンポーネント（NodeDetails）により、3つのテーブルでの実装が効率化
3. 段階的リリースでリスク軽減

### 設計フェーズで調査すべき項目

1. **axe-core NodeResult構造**: `target`配列の形式、`html`属性の最大長
2. **Pa11y issue構造**: `selector`、`context`フィールドの有無と形式
3. **Lighthouse audit.details構造**: `items`配列の要素形式
4. **仮想スクロール選択**: MUI DataGrid Pro vs react-window vs react-virtuoso

### 重要な設計決定

1. **RuleResult型の拡張方法**: 後方互換性を維持しつつノード情報を追加
2. **WCAG集約の実行タイミング**: バックエンドで事前集約 vs フロントエンドでリアルタイム集約
3. **仮想スクロールのトリガー閾値**: 何件以上で仮想スクロールを適用するか
