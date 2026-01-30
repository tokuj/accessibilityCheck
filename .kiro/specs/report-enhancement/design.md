# Design Document: report-enhancement

## Overview

**Purpose**: アクセシビリティレポートの品質向上を実現し、開発者がより効率的にWCAG違反を特定・修正できるようにする。

**Users**: 開発者、QAエンジニア、アクセシビリティ担当者がレポートを利用して具体的な修正箇所を特定し、WCAG準拠に向けた優先順位付けを行う。

**Impact**: 既存のレポートUIに対して、ノード情報の展開表示、WCAG集約サマリー、Lighthouse分類改善、タブ間構造統一を追加する。

### Goals

- 違反箇所の具体的なHTML要素情報（CSSセレクタ、HTML抜粋）をレポートで確認可能にする
- WCAG項番ごとに全ツールの指摘を集約し、対応すべき基準を明確化する
- Lighthouse「不明」項目を削減し、違反/達成の分類を明確化する
- 違反・達成・不明タブ間でUI構造を統一する

### Non-Goals

- 新規アクセシビリティツールの追加
- レポートのPDF/CSV出力形式の変更
- バックエンドAPIエンドポイントの新規追加
- リアルタイム分析機能

## Architecture

### Existing Architecture Analysis

**Current Patterns**:

- フロントエンド・バックエンド分離構成
- `RuleResult`型がAPI契約として機能
- 各アナライザー（axe、pa11y、lighthouse）が独立して結果を返却
- `analyzer.ts`がオーケストレーション

**Integration Points**:

- `server/analyzers/types.ts`: 共通型定義（拡張対象）
- `server/analyzers/*.ts`: 各ツールのアナライザー（修正対象）
- `frontend/src/components/*Table.tsx`: テーブルコンポーネント（修正対象）
- `frontend/src/components/ImprovementList.tsx`: AI総評セクション（拡張対象）

**Technical Debt**:

- ViolationsTable/IncompleteTable/PassesTable間でコード重複あり
- Lighthouse分類ロジックが`scoreDisplayMode`を活用していない

### Architecture Pattern & Boundary Map

```mermaid
graph TB
    subgraph Backend
        Axe[axe.ts]
        Pa11y[pa11y.ts]
        Lighthouse[lighthouse.ts]
        Types[types.ts]
        Analyzer[analyzer.ts]
    end

    subgraph Frontend
        ImprovementList[ImprovementList.tsx]
        ViolationsTable[ViolationsTable.tsx]
        IncompleteTable[IncompleteTable.tsx]
        PassesTable[PassesTable.tsx]
        NodeDetails[NodeDetails.tsx NEW]
        WcagSummary[WcagAggregateSummary.tsx NEW]
        WcagMapping[wcag-mapping.ts NEW]
    end

    Axe --> Types
    Pa11y --> Types
    Lighthouse --> Types
    Types --> Analyzer

    Analyzer --> ImprovementList
    ImprovementList --> WcagSummary
    WcagSummary --> WcagMapping

    Analyzer --> ViolationsTable
    Analyzer --> IncompleteTable
    Analyzer --> PassesTable

    ViolationsTable --> NodeDetails
    IncompleteTable --> NodeDetails
    PassesTable --> NodeDetails
```

**Architecture Integration**:

- 選択パターン: ハイブリッドアプローチ（バックエンド先行、共通コンポーネント追加後に統合）
- ドメイン境界: バックエンド（データ抽出・分類）とフロントエンド（表示・集約）の責務分離
- 既存パターン維持: `RuleResult`型拡張、MUIコンポーネント使用
- 新規コンポーネント: `NodeDetails`（ノード展開）、`WcagAggregateSummary`（WCAG集約）、`wcag-mapping.ts`（レベルマッピング）
- Steering準拠: TypeScript型安全性、フロントエンド・バックエンド分離

### Technology Stack

| Layer | Choice / Version | Role in Feature | Notes |
|-------|------------------|-----------------|-------|
| Frontend | React 19 + MUI 7.3.6 | UI表示、WCAG集約計算 | 既存スタック維持 |
| Backend | Express 5 + Node.js | ノード情報抽出、分類ロジック | 既存スタック維持 |
| Accessibility | axe-core 4.11, pa11y 9.0, lighthouse 12.0 | ノード情報取得元 | 既存バージョン維持 |

## System Flows

### ノード情報取得フロー

```mermaid
sequenceDiagram
    participant User
    participant UI as ReportUI
    participant API as Backend API
    participant Axe as axe-core
    participant Pa11y as pa11y
    participant LH as lighthouse

    User->>UI: URL分析リクエスト
    UI->>API: POST /analyze
    API->>Axe: analyzeWithAxe()
    Axe-->>API: violations with nodes[]
    API->>Pa11y: analyzeWithPa11y()
    Pa11y-->>API: issues with selector, context
    API->>LH: analyzeWithLighthouse()
    LH-->>API: audits with details.items
    API-->>UI: AccessibilityReport with nodes
    UI->>UI: 行展開時にノード表示
```

### WCAG集約フロー

```mermaid
flowchart LR
    A[violations/passes/incomplete] --> B[useMemo]
    B --> C[WCAG項番でグループ化]
    C --> D[ツール別カウント]
    D --> E[レベル判定]
    E --> F[WcagAggregateSummary表示]
    F --> G{ユーザークリック}
    G -->|WCAG項番選択| H[ViolationsTableフィルタ]
```

## Requirements Traceability

| Requirement | Summary | Components | Interfaces | Flows |
|-------------|---------|------------|------------|-------|
| 1.1 | 違反テーブル行展開でノードセレクタ表示 | NodeDetails, ViolationsTable | NodeInfo | ノード情報取得 |
| 1.2 | ノード選択時HTML抜粋表示 | NodeDetails | NodeInfo.html | ノード情報取得 |
| 1.3 | バックエンドでノード情報返却 | axe.ts, pa11y.ts, lighthouse.ts | RuleResult.nodes | ノード情報取得 |
| 1.4 | 10件超時に「さらに表示」 | NodeDetails | - | - |
| 1.5 | 不明・達成タブでもノード表示 | IncompleteTable, PassesTable, NodeDetails | NodeInfo | - |
| 2.1 | AI総評にWCAG項番別サマリー | WcagAggregateSummary, ImprovementList | WcagSummaryItem | WCAG集約 |
| 2.2 | ツール別検出件数表示 | WcagAggregateSummary | WcagSummaryItem.toolCounts | - |
| 2.3 | 違反件数順ソート | WcagAggregateSummary | - | - |
| 2.4 | WCAG項番クリックでフィルタ | WcagAggregateSummary, ViolationsTable | onWcagFilter callback | WCAG集約 |
| 2.5 | WCAGレベル表示 | WcagAggregateSummary, wcag-mapping.ts | getWcagLevel() | - |
| 2.6 | バックエンドでWCAG集約データ返却 | - | - | フロントエンド集約に変更 |
| 3.1 | scoreDisplayModeでnotApplicable除外 | lighthouse.ts | - | - |
| 3.2 | 0.5閾値で違反/達成分類 | lighthouse.ts | - | - |
| 3.3 | scoreDisplayMode確認 | lighthouse.ts | audit.scoreDisplayMode | - |
| 3.4 | 不明理由表示 | IncompleteTable | RuleResult.classificationReason | - |
| 3.5 | 生スコアと分類理由返却 | lighthouse.ts | RuleResult.rawScore, classificationReason | - |
| 4.1 | 不明タブにWCAG別AIボタン | IncompleteTable | AIChatButton props | - |
| 4.2 | 達成タブにWCAG別AIボタン | PassesTable | AIChatButton props | - |
| 4.3 | 全タブで同一カラム構成 | ViolationsTable, IncompleteTable, PassesTable | - | - |
| 4.4 | 達成タブに影響度カラム | PassesTable | ImpactBadge | - |
| 4.5 | 全タブでノード展開機能 | NodeDetails | NodeInfo | - |
| 5.1 | 展開100ms以内 | NodeDetails | - | パフォーマンス |
| 5.2 | API応答時間+10%以内 | axe.ts, pa11y.ts, lighthouse.ts | - | パフォーマンス |
| 5.3 | 100件以上でページネーション | NodeDetails | - | - |
| 5.4 | モバイル対応 | 全UIコンポーネント | MUI responsive props | - |
| 5.5 | エラー時グレースフルデグラデーション | NodeDetails | - | エラーハンドリング |
| 6.1 | ノードのバウンディングボックス返却 | axe.ts, NodeInfo | BoundingBox | 位置情報取得 |
| 6.2 | スクリーンショット上でハイライト表示 | HighlightedScreenshot, NodeDetails | NodeInfo.boundingBox | 視覚的特定 |
| 6.3 | 複数ノードに番号振り | HighlightedScreenshot | - | 視覚的特定 |
| 6.4 | XPath表示とコピー機能 | NodeDetails | NodeInfo.xpath | - |
| 6.5 | 周辺HTMLコンテキスト表示 | NodeDetails | NodeInfo.contextHtml | - |
| 6.6 | failureSummaryを修正方法として表示 | NodeDetails | NodeInfo.failureSummary | - |
| 6.7 | 非表示要素の明示 | NodeDetails | NodeInfo.isHidden | - |

## Components and Interfaces

### Component Summary

| Component | Domain/Layer | Intent | Req Coverage | Key Dependencies | Contracts |
|-----------|--------------|--------|--------------|------------------|-----------|
| RuleResult (拡張) | Backend/Types | ノード情報を含む結果型 | 1.3, 3.5 | - | Type |
| NodeInfo (拡張) | Backend/Types | 個別ノード情報型（位置情報含む） | 1.1, 1.2, 6.1, 6.4, 6.5, 6.7 | - | Type |
| BoundingBox (新規) | Backend/Types | 要素の位置情報型 | 6.1 | - | Type |
| axe.ts (修正) | Backend/Analyzer | ノード情報・位置情報抽出追加 | 1.3, 6.1, 6.4, 6.5 | axe-core, Playwright (P0) | - |
| pa11y.ts (修正) | Backend/Analyzer | ノード情報抽出追加 | 1.3 | pa11y (P0) | - |
| lighthouse.ts (修正) | Backend/Analyzer | 分類ロジック改善、ノード抽出 | 1.3, 3.1-3.5 | lighthouse (P0) | - |
| NodeDetails (拡張) | Frontend/UI | ノード情報展開表示、視覚的特定 | 1.1, 1.2, 1.4, 1.5, 4.5, 5.1, 5.3, 5.5, 6.2-6.7 | MUI Collapse, HighlightedScreenshot (P1) | State |
| HighlightedScreenshot (新規) | Frontend/UI | スクリーンショット上のハイライト | 6.2, 6.3 | Canvas API (P1) | State |
| WcagAggregateSummary (新規) | Frontend/UI | WCAG項番別集約表示 | 2.1-2.5 | wcag-mapping (P1) | State |
| wcag-mapping.ts (新規) | Frontend/Utils | WCAGレベル判定 | 2.5 | - | Service |
| ViolationsTable (修正) | Frontend/UI | NodeDetails統合 | 1.1, 4.5 | NodeDetails (P1) | - |
| IncompleteTable (修正) | Frontend/UI | WCAG AIボタン、NodeDetails統合 | 3.4, 4.1, 4.5 | NodeDetails (P1), AIChatButton (P1) | - |
| PassesTable (修正) | Frontend/UI | 影響度カラム、WCAG AIボタン、NodeDetails統合 | 4.2, 4.3, 4.4, 4.5 | NodeDetails (P1), ImpactBadge (P1) | - |
| ImprovementList (修正) | Frontend/UI | WcagAggregateSummary統合 | 2.1 | WcagAggregateSummary (P1) | - |

### Backend / Types

#### NodeInfo (新規)

| Field | Detail |
|-------|--------|
| Intent | 個別DOM要素のアクセシビリティ違反情報を表現 |
| Requirements | 1.1, 1.2 |

**Type Definition**

```typescript
interface BoundingBox {
  /** 左上X座標（ページ座標系） */
  x: number;
  /** 左上Y座標（ページ座標系） */
  y: number;
  /** 要素の幅（ピクセル） */
  width: number;
  /** 要素の高さ（ピクセル） */
  height: number;
}

interface NodeInfo {
  /** CSSセレクタ（要素を一意に特定） */
  target: string;
  /** XPath（要素をDOM上で正確に特定） @requirement 6.4 */
  xpath?: string;
  /** HTML抜粋（最大200文字） */
  html: string;
  /** 周辺HTML（親要素と兄弟要素を含む） @requirement 6.5 */
  contextHtml?: string;
  /** 失敗理由のサマリー（axe-coreのみ） */
  failureSummary?: string;
  /** 要素のバウンディングボックス @requirement 6.1 */
  boundingBox?: BoundingBox;
  /** 要素がビューポート外または非表示かどうか @requirement 6.7 */
  isHidden?: boolean;
}
```

#### RuleResult (拡張)

| Field | Detail |
|-------|--------|
| Intent | 既存のRuleResult型にノード情報と分類情報を追加 |
| Requirements | 1.3, 3.5 |

**Type Definition (追加フィールド)**

```typescript
interface RuleResult {
  // 既存フィールド省略...

  /** ノード情報配列（オプショナル、後方互換性維持） */
  nodes?: NodeInfo[];

  /** Lighthouse生スコア（0-1、Lighthouseのみ） */
  rawScore?: number | null;

  /** 分類理由（Lighthouseのincomplete項目のみ） */
  classificationReason?: 'manual-review' | 'insufficient-data' | 'partial-support';
}
```

### Backend / Analyzers

#### axe.ts (修正)

| Field | Detail |
|-------|--------|
| Intent | axe-core結果からノード情報を抽出 |
| Requirements | 1.3 |

**Responsibilities & Constraints**

- `scanResults.violations[].nodes`から`NodeInfo`配列を生成
- `target`配列を単一文字列に結合（` > `セパレータ）
- `html`は200文字に切り詰め

**Implementation Notes**

- 変更箇所: `analyzeWithAxe()`関数内のマッピング処理
- 既存の`nodeCount`は維持（後方互換性）

#### pa11y.ts (修正)

| Field | Detail |
|-------|--------|
| Intent | Pa11y結果からノード情報を抽出 |
| Requirements | 1.3 |

**Responsibilities & Constraints**

- `issue.selector`と`issue.context`から`NodeInfo`を生成
- Pa11yは1イシュー=1ノードのため、`nodes`配列は常に1要素

**Implementation Notes**

- 変更箇所: `analyzeWithPa11y()`関数内のマッピング処理

#### lighthouse.ts (修正)

| Field | Detail |
|-------|--------|
| Intent | Lighthouse分類ロジック改善とノード情報抽出 |
| Requirements | 1.3, 3.1, 3.2, 3.3, 3.4, 3.5 |

**Responsibilities & Constraints**

- `audit.scoreDisplayMode === 'notApplicable'`の場合はスキップ
- `score === null`かつ`scoreDisplayMode !== 'notApplicable'`の場合のみincomplete
- `0 < score < 0.5`は違反、`0.5 <= score < 1`は達成に分類
- `audit.details.items`からノード情報を抽出
- `rawScore`と`classificationReason`を結果に含める

**Implementation Notes**

- 変更箇所: 分類条件の書き換え（186-209行目付近）
- `details.type === 'table'`と`details.type === 'list'`で抽出方法が異なる

### Frontend / Utils

#### wcag-mapping.ts (新規)

| Field | Detail |
|-------|--------|
| Intent | WCAG項番からレベル（A/AA/AAA）を判定 |
| Requirements | 2.5 |

**Service Interface**

```typescript
type WcagLevel = 'A' | 'AA' | 'AAA' | 'unknown';

interface WcagCriterionInfo {
  criterion: string;
  level: WcagLevel;
  name: string;
}

function getWcagLevel(criterion: string): WcagLevel;
function getWcagInfo(criterion: string): WcagCriterionInfo | null;
function getAllWcagCriteria(): WcagCriterionInfo[];
```

**Implementation Notes**

- WCAG 2.1の78基準を静的マッピングテーブルとして保持
- Level A: 30基準、Level AA: 21基準、Level AAA: 27基準

### Frontend / UI Components

#### NodeDetails (新規)

| Field | Detail |
|-------|--------|
| Intent | ノード情報の展開表示コンポーネント（問題箇所の視覚的特定を含む） |
| Requirements | 1.1, 1.2, 1.4, 1.5, 4.5, 5.1, 5.3, 5.5, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7 |

**Dependencies**

- Inbound: ViolationsTable, IncompleteTable, PassesTable — ノード表示 (P1)
- Outbound: HighlightedScreenshot — スクリーンショット上のハイライト (P1)
- External: MUI Collapse, Box, Typography — UI表示 (P1)

**Contracts**: State [x]

**Props Interface**

```typescript
interface NodeDetailsProps {
  /** ノード情報配列 */
  nodes: NodeInfo[];
  /** 展開状態 */
  expanded: boolean;
  /** 展開トグルコールバック */
  onToggle: () => void;
  /** 初期表示件数（デフォルト: 10） */
  initialDisplayCount?: number;
  /** スクリーンショット画像（Base64） @requirement 6.2 */
  screenshot?: string;
  /** 選択中のノードインデックス @requirement 6.5 */
  selectedNodeIndex?: number;
  /** ノード選択コールバック @requirement 6.5 */
  onNodeSelect?: (index: number) => void;
}
```

**State Management**

- `showAll: boolean` - 全件表示フラグ
- `selectedNode: number | null` - 選択中のノードインデックス
- 10件超の場合は「さらに表示」ボタンで残りを展開

**Implementation Notes**

- MUI Collapseで展開アニメーション
- HTML抜粋は`<code>`タグでモノスペース表示
- XPathとCSSセレクタの両方を表示し、コピーボタンを設置 @requirement 6.4
- `failureSummary`を「修正方法」ラベルで表示 @requirement 6.6
- ノードクリック時に`contextHtml`（周辺HTML）を表示 @requirement 6.5
- `isHidden`がtrueの場合「この要素はビューポート外または非表示です」を表示 @requirement 6.7
- エラー時は「ノード情報を取得できませんでした」を表示

#### HighlightedScreenshot (新規)

| Field | Detail |
|-------|--------|
| Intent | スクリーンショット上で問題箇所をハイライト表示 |
| Requirements | 6.2, 6.3 |

**Dependencies**

- Inbound: NodeDetails — ハイライト表示 (P1)
- External: MUI Box, canvas API — 描画 (P1)

**Contracts**: State [x]

**Props Interface**

```typescript
interface HighlightedScreenshotProps {
  /** スクリーンショット画像（Base64） */
  screenshot: string;
  /** ハイライト対象のノード情報配列 */
  nodes: NodeInfo[];
  /** 選択中のノードインデックス */
  selectedNodeIndex?: number;
  /** ノードクリックコールバック */
  onNodeClick?: (index: number) => void;
}
```

**Implementation Notes**

- Canvas APIまたはSVGオーバーレイでバウンディングボックスを赤枠描画 @requirement 6.2
- 各ノードに番号ラベル（1, 2, 3...）を表示 @requirement 6.3
- 選択中のノードは強調色（青枠）で表示
- スクリーンショット拡大・縮小機能を提供
- boundingBoxがないノードはリストにのみ表示（スクリーンショット上にはマークなし）

#### WcagAggregateSummary (新規)

| Field | Detail |
|-------|--------|
| Intent | WCAG項番別の集約サマリー表示 |
| Requirements | 2.1, 2.2, 2.3, 2.4, 2.5 |

**Dependencies**

- Inbound: ImprovementList — サマリー表示 (P1)
- Outbound: wcag-mapping — レベル判定 (P1)
- External: MUI Chip, Box, Typography — UI表示 (P1)

**Contracts**: State [x]

**Props Interface**

```typescript
interface WcagSummaryItem {
  criterion: string;
  level: WcagLevel;
  totalCount: number;
  toolCounts: {
    'axe-core': number;
    'pa11y': number;
    'lighthouse': number;
  };
}

interface WcagAggregateSummaryProps {
  /** 全違反結果 */
  violations: RuleResult[];
  /** WCAG項番クリック時のコールバック */
  onWcagFilter?: (criterion: string) => void;
}
```

**State Management**

- `summaryItems: WcagSummaryItem[]` - useMemoで計算
- 違反件数降順でソート

**Implementation Notes**

- 各ツールのChipを色分け表示（既存パターン踏襲）
- レベルバッジ（A: success, AA: primary, AAA: secondary）

#### ViolationsTable (修正)

| Field | Detail |
|-------|--------|
| Intent | NodeDetails統合による行展開機能追加 |
| Requirements | 1.1, 4.5 |

**Implementation Notes**

- 各行に展開アイコン（IconButton）追加
- 展開状態は`expandedRows: Set<string>`で管理
- NodeDetailsを展開行として表示

#### IncompleteTable (修正)

| Field | Detail |
|-------|--------|
| Intent | WCAG別AIボタン追加、NodeDetails統合、分類理由表示 |
| Requirements | 3.4, 4.1, 4.5 |

**Implementation Notes**

- ViolationsTableのWCAG列実装をコピー
- `classificationReason`をTooltipで表示

#### PassesTable (修正)

| Field | Detail |
|-------|--------|
| Intent | 影響度カラム追加、WCAG別AIボタン追加、NodeDetails統合 |
| Requirements | 4.2, 4.3, 4.4, 4.5 |

**Implementation Notes**

- 影響度カラム追加（`impact`がundefinedの場合は「-」表示）
- ImpactBadgeコンポーネントを使用（既存）

#### ImprovementList (修正)

| Field | Detail |
|-------|--------|
| Intent | WcagAggregateSummary統合 |
| Requirements | 2.1 |

**Implementation Notes**

- AI総評セクション内にWcagAggregateSummaryを追加
- 「WCAG項番別サマリー」セクションとして表示

## Data Models

### Domain Model

**NodeInfo Aggregate**

- 値オブジェクト: 不変、ツールからの抽出結果を表現
- `target`（識別子）、`html`（コンテンツ）、`failureSummary`（メタデータ）

**RuleResult Extension**

- 既存の`RuleResult`エンティティを拡張
- `nodes`はオプショナル（後方互換性）
- `rawScore`、`classificationReason`はLighthouse固有

### Logical Data Model

**RuleResult with NodeInfo**

```
RuleResult (1) -----> (0..N) NodeInfo
    |
    +-- id: string
    +-- description: string
    +-- impact: ImpactLevel?
    +-- nodeCount: number
    +-- helpUrl: string
    +-- wcagCriteria: string[]
    +-- toolSource: ToolSource
    +-- nodes?: NodeInfo[]        [NEW]
    +-- rawScore?: number         [NEW, Lighthouse only]
    +-- classificationReason?: string [NEW, Lighthouse incomplete only]
```

### Data Contracts & Integration

**API Response Schema (変更後)**

```typescript
// AccessibilityReport.pages[].violations[]
{
  id: "color-contrast",
  description: "Elements must have sufficient color contrast",
  impact: "serious",
  nodeCount: 3,
  helpUrl: "https://...",
  wcagCriteria: ["1.4.3"],
  toolSource: "axe-core",
  // 新規フィールド
  nodes: [
    {
      target: "html > body > main > p:nth-child(2)",
      html: "<p style=\"color: #777\">Low contrast text...</p>",
      failureSummary: "Fix any of the following: Element has insufficient color contrast..."
    }
  ]
}
```

## Error Handling

### Error Strategy

- ノード情報抽出失敗時: 空配列を返却、`nodeCount`は維持
- WCAG集約計算失敗時: サマリーセクション非表示、他機能に影響なし
- Lighthouse詳細取得失敗時: `nodes`は空、基本情報は維持

### Error Categories and Responses

**User Errors**: なし（表示専用機能）

**System Errors**:

- ノード情報抽出エラー → 空配列返却、ログ記録
- WCAG集約エラー → try-catchでセクション非表示

**Business Logic Errors**: なし

### Monitoring

- `nodes`配列が空の違反をカウント（ログレベル: warn）
- Lighthouse `scoreDisplayMode`の分布をログ

## Testing Strategy

### Unit Tests

- `wcag-mapping.ts`: 全78基準のレベル判定
- `NodeInfo`抽出ロジック（各アナライザー）
- WCAG集約計算ロジック
- Lighthouse分類条件

### Integration Tests

- axe-core → RuleResult.nodes 変換
- Pa11y → RuleResult.nodes 変換
- Lighthouse → RuleResult.nodes + 分類改善
- フロントエンド型との互換性

### E2E/UI Tests

- 違反テーブル行展開でノード表示
- WCAG項番クリックでフィルタ動作
- 10件超ノードの「さらに表示」動作
- タブ切り替え時のUI一貫性

### Performance

- ノード展開100ms以内（Requirement 5.1）
- API応答時間+10%以内（Requirement 5.2）
- 100件ノードでのレンダリングパフォーマンス

## Performance & Scalability

### Target Metrics

- ノード展開: 100ms以内
- API応答: 現行比+10%以内
- 初期レンダリング: 現行維持

### Optimization Techniques

- ノード情報の遅延展開（Collapseで初期非表示）
- WCAG集約はuseMemoでメモ化
- HTML抜粋は200文字制限でペイロード削減
- 10件ページネーションで大量データ対応

## Requirement 7: 問題箇所表示の改善

### 7.1 axe-core日本語ロケール適用

**目的**: failureSummary、description、helpを日本語で出力する

**技術調査結果**:
- axe-coreは`node_modules/axe-core/locales/ja.json`で日本語ロケールを提供
- `@axe-core/playwright`のAxeBuilderはカスタム`axeSource`を受け入れる
- 日本語ロケールには全ルール・チェック・failureSummariesの翻訳が含まれる

**実装方法**:

```typescript
// server/analyzers/axe.ts
import * as fs from 'fs';

// axe-coreソースと日本語ロケールを読み込み
const axeCoreSource = fs.readFileSync(
  require.resolve('axe-core/axe.min.js'),
  'utf8'
);
const jaLocale = JSON.parse(
  fs.readFileSync(
    require.resolve('axe-core/locales/ja.json'),
    'utf8'
  )
);

// ロケール設定を含むカスタムソースを生成
const axeSourceWithJaLocale = `
  ${axeCoreSource}
  axe.configure({ locale: ${JSON.stringify(jaLocale)} });
`;

// AxeBuilderで使用
function createAxeBuilder(page: Page): AxeBuilder {
  return new AxeBuilder({
    page,
    axeSource: axeSourceWithJaLocale,
  }).withTags(WCAG_TAGS);
}
```

**出力例**:
- Before: `Fix all of the following: Element is in tab order and does not have accessible text`
- After: `次のいずれかを修正します: 要素にアクセシブルな名前がありません`

### 7.2 要素説明（elementDescription）の追加

**目的**: CSSセレクタの代わりに人間が読める説明を表示

**NodeInfo型拡張**:

```typescript
// server/analyzers/types.ts
export interface NodeInfo {
  target: string;
  html: string;
  failureSummary?: string;
  xpath?: string;
  contextHtml?: string;
  boundingBox?: BoundingBox;
  isHidden?: boolean;
  // 新規フィールド
  elementDescription?: string;  // 例: 'リンク「詳細はこちら...」'
}
```

**タグ名→日本語ラベル変換テーブル**:

```typescript
const TAG_LABELS: Record<string, string> = {
  'a': 'リンク',
  'img': '画像',
  'button': 'ボタン',
  'input': '入力欄',
  'select': 'セレクトボックス',
  'textarea': 'テキストエリア',
  'form': 'フォーム',
  'table': 'テーブル',
  'nav': 'ナビゲーション',
  'header': 'ヘッダー',
  'footer': 'フッター',
  'main': 'メインコンテンツ',
  'section': 'セクション',
  'article': '記事',
  'aside': 'サイドバー',
  'h1': '見出し1',
  'h2': '見出し2',
  'h3': '見出し3',
  'h4': '見出し4',
  'h5': '見出し5',
  'h6': '見出し6',
  'p': '段落',
  'ul': 'リスト',
  'ol': '番号付きリスト',
  'li': 'リスト項目',
  'div': 'ブロック要素',
  'span': 'インライン要素',
  'iframe': 'インラインフレーム',
  'video': '動画',
  'audio': '音声',
};
```

**生成ロジック**:

```typescript
async function generateElementDescription(element: ElementHandle): Promise<string> {
  return await element.evaluate((el) => {
    const tagName = el.tagName.toLowerCase();
    const tagLabel = TAG_LABELS[tagName] || tagName;

    // テキスト内容を取得（20文字で切り詰め）
    const textContent = el.textContent?.trim().slice(0, 20) || '';

    // alt属性やaria-labelから補足情報を取得
    const alt = el.getAttribute('alt');
    const ariaLabel = el.getAttribute('aria-label');
    const title = el.getAttribute('title');
    const placeholder = el.getAttribute('placeholder');

    // 優先順位: aria-label > alt > title > placeholder > textContent
    const label = ariaLabel || alt || title || placeholder || textContent;

    if (label) {
      const truncatedLabel = label.length > 20 ? label.slice(0, 20) + '...' : label;
      return `${tagLabel}「${truncatedLabel}」`;
    }

    return tagLabel;
  });
}
```

**表示例**:
- Before: `.md\:max-w-\[max\(273px\,calc\(33\.3\%_-\(24px\*2\/3\)\)\)\]:nth-child(3)`
- After: `リンク「詳細はこちら...」`

### 7.3 HighlightedScreenshot統合

**目的**: スクリーンショット上で問題箇所をハイライト表示し、ノードリストと連携

**ViolationsTable修正**:

```typescript
// frontend/src/components/ViolationsTable.tsx

interface ViolationsTableProps {
  violations: RuleResult[];
  onAIChatRequest?: (violation: RuleResult) => void;
  wcagFilter?: string | null;
  // 新規プロパティ
  screenshot?: string;
}

// 展開行内でHighlightedScreenshotを表示
{screenshot && nodes.some(n => n.boundingBox) && (
  <Box sx={{ mb: 2 }}>
    <HighlightedScreenshot
      screenshot={screenshot}
      nodes={nodes}
      selectedNodeIndex={selectedNodeIndex}
      onNodeClick={setSelectedNodeIndex}
    />
  </Box>
)}
```

**ReportSummary修正**:

```typescript
// frontend/src/components/ReportSummary.tsx

<ViolationsTable
  violations={violations}
  wcagFilter={wcagFilter}
  onAIChatRequest={handleAIChatRequest}
  screenshot={currentScreenshot}  // 新規追加
/>
```

**ノード選択の同期**:

```typescript
// ViolationsTable内で展開行ごとにselectedNodeIndex状態を管理
const [selectedNodes, setSelectedNodes] = useState<Record<string, number | undefined>>({});

const handleNodeSelect = (violationId: string, nodeIndex: number) => {
  setSelectedNodes(prev => ({
    ...prev,
    [violationId]: nodeIndex,
  }));
};
```

### 7.4 位置情報バッジ

**目的**: 要素がページ内のどこにあるかを視覚的に表示

**位置計算ロジック**:

```typescript
function getPositionLabel(boundingBox: BoundingBox, viewportSize: { width: number; height: number }): string {
  const { x, y, width, height } = boundingBox;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  // 垂直位置
  let vertical: string;
  if (centerY < viewportSize.height / 3) {
    vertical = '上部';
  } else if (centerY < (viewportSize.height * 2) / 3) {
    vertical = '中央';
  } else {
    vertical = '下部';
  }

  // 水平位置
  let horizontal: string;
  if (centerX < viewportSize.width / 3) {
    horizontal = '左';
  } else if (centerX < (viewportSize.width * 2) / 3) {
    horizontal = '中央';
  } else {
    horizontal = '右';
  }

  return `${vertical}・${horizontal}`;
}
```

**NodeDetails内での表示**:

```tsx
{node.boundingBox && (
  <Chip
    label={getPositionLabel(node.boundingBox, viewportSize)}
    size="small"
    variant="outlined"
    sx={{ ml: 1 }}
  />
)}
```

### 7.5 NodeDetails UI改善

**要素説明を優先表示**:

```tsx
// 要素説明を大きく表示
{node.elementDescription && (
  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
    {node.elementDescription}
  </Typography>
)}

// CSSセレクタは折りたたみ
<Accordion>
  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
    <Typography variant="caption" color="text.secondary">
      技術詳細を表示
    </Typography>
  </AccordionSummary>
  <AccordionDetails>
    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
      CSS: {node.target}
    </Typography>
    {node.xpath && (
      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
        XPath: {node.xpath}
      </Typography>
    )}
  </AccordionDetails>
</Accordion>
```

### 7.6 タスクとコンポーネントのマッピング

| タスク | コンポーネント | Requirements |
|--------|----------------|--------------|
| 14.1 | server/analyzers/axe.ts | 7.1 |
| 14.2 | server/analyzers/types.ts, frontend/src/types/accessibility.ts | 7.2 |
| 14.3 | server/analyzers/axe.ts | 7.2, 7.7 |
| 14.4 | ViolationsTable, ReportSummary | 7.4, 7.5 |
| 14.5 | NodeDetails | 7.3, 7.6 |
| 14.6 | NodeDetails | 7.6 |
| 14.7 | テストファイル | 7.1-7.7 |
