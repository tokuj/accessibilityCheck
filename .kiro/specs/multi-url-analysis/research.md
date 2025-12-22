# Research & Design Decisions

---
**Purpose**: 複数URL分析機能の設計判断に関する調査結果と根拠を記録する
---

## Summary

- **Feature**: `multi-url-analysis`
- **Discovery Scope**: Extension（既存システムの拡張）
- **Key Findings**:
  - 既存の`AccessibilityReport`型は`pages: PageResult[]`配列をサポート済みで、複数ページデータ構造は追加不要
  - MUI Chip/Tabs/Badgeコンポーネントが既存で利用可能、新規依存なし
  - SSEストリーミングは既存パターンを拡張し、`pageIndex`フィールド追加で対応可能

## Research Log

### 既存データ構造の複数ページ対応

- **Context**: 複数URLの分析結果を格納するデータ構造の調査
- **Sources Consulted**: `frontend/src/types/accessibility.ts`
- **Findings**:
  - `AccessibilityReport.pages`は既に`PageResult[]`配列
  - `PageResult`には`name`, `url`, `violations`, `passes`, `incomplete`が含まれる
  - 現状は常に1要素の配列だが、複数要素に拡張可能
- **Implications**: バックエンド側で複数ページを配列に追加するだけで対応可能。型変更は最小限

### SSEイベント構造の拡張

- **Context**: 複数URL分析時の進捗通知方法
- **Sources Consulted**: `server/sse-handler.ts`, `frontend/src/types/accessibility.ts`
- **Findings**:
  - 既存SSEイベント型: `LogEvent`, `ProgressEvent`, `ViolationEvent`, `CompleteEvent`, `ErrorEvent`
  - `ProgressEvent`には`step`, `total`, `stepName`があるが、ページ識別なし
  - `CompleteEvent`は単一`report`を送信
- **Implications**:
  - 新規イベント型`PageProgressEvent`追加（`pageIndex`, `pageUrl`, `pageTitle`含む）
  - `CompleteEvent`は既存のまま使用可能（`report.pages`が複数になるだけ）

### UrlInputコンポーネントの拡張ポイント

- **Context**: 複数URL入力UIの実装方法
- **Sources Consulted**: `frontend/src/components/UrlInput.tsx`
- **Findings**:
  - 現在は`useState<string>(url)`で単一URL管理
  - `Paper` + `InputBase` + `IconButton`構成
  - MUI Chipコンポーネントはインポート済み（Badge使用箇所あり）
- **Implications**:
  - `useState<string[]>(urls)`に変更し、チップ表示ロジック追加
  - Chip削除はMUI Chip `onDelete`プロパティで対応

### ReportSummaryのタブ構造

- **Context**: 複数レポートのタブ切り替えUI
- **Sources Consulted**: `frontend/src/components/ReportSummary.tsx`
- **Findings**:
  - 既にMUI `Tabs`/`Tab`コンポーネント使用（違反/パス/要確認の切り替え）
  - `TabPanel`コンポーネントが定義済み
  - 現状は単一レポートを表示
- **Implications**:
  - ページ選択タブ（上位）+ 詳細タブ（下位）の2階層タブ構造
  - 単一URLの場合はページタブ非表示で後方互換性維持

### APIリクエスト・レスポンス構造

- **Context**: 複数URL対応のAPI設計
- **Sources Consulted**: `frontend/src/types/accessibility.ts`, `server/index.ts`
- **Findings**:
  - `AnalyzeRequest`は`url: string`単数形
  - `AnalyzeResponse`は`report?: AccessibilityReport`単数形
  - GETパラメータでURL指定（`/api/analyze-stream?url=...`）
- **Implications**:
  - 配列形式`urls: string[]`に拡張
  - クエリパラメータは`urls[]=url1&urls[]=url2`形式

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 既存コンポーネント拡張 | UrlInput, AnalysisProgress, ReportSummaryを拡張 | ファイル数増加なし、既存パターン活用 | コンポーネントの複雑化 | 条件分岐の増加に注意 |
| 新規コンポーネント作成 | MultiUrlInput, MultiReportSummary等を新規作成 | 責任分離明確 | コード重複、保守対象増加 | 不採用 |
| **ハイブリッド（採用）** | 既存拡張 + 小規模新規コンポーネント | 適度な責任分離、互換性維持 | 設計が若干複雑 | UrlChip等の小コンポーネント分離 |

## Design Decisions

### Decision: UrlInputコンポーネントの拡張方式

- **Context**: 複数URL入力UIの実装アプローチ
- **Alternatives Considered**:
  1. UrlInputを完全に置き換えるMultiUrlInputを新規作成
  2. UrlInputを拡張して複数URL対応
  3. UrlChipを分離し、UrlInputから使用
- **Selected Approach**: Option 3 - UrlChipを分離し、UrlInputを拡張
- **Rationale**:
  - UrlInputの既存機能（認証、セッション管理）を維持
  - チップ表示ロジックを分離することでテスト容易性向上
  - 単一URL時の後方互換性を自然に維持
- **Trade-offs**:
  - ✅ 既存のonAnalyzeインターフェースを拡張可能
  - ✅ 認証設定UIとの統合を維持
  - ❌ UrlInputのpropsが増加

### Decision: SSE進捗通知の拡張

- **Context**: 複数URL分析時の進捗表示
- **Alternatives Considered**:
  1. 既存ProgressEventにpageIndex追加
  2. 新規PageProgressEventを追加
  3. 各ページごとに個別のSSEストリームを開く
- **Selected Approach**: Option 2 - 新規PageProgressEventを追加
- **Rationale**:
  - 既存クライアントへの影響を最小化
  - ページ切り替わりを明示的にイベントとして通知
  - 単一URL分析時はPageProgressEvent未送信で互換性維持
- **Trade-offs**:
  - ✅ 後方互換性維持
  - ✅ ページ単位の進捗を明確に表現
  - ❌ イベント型が増加

### Decision: App状態管理の拡張

- **Context**: 複数レポートの状態管理
- **Alternatives Considered**:
  1. 単一reportを維持し、内部のpages配列で管理
  2. reports配列に変更
  3. Context/Zustand等の状態管理ライブラリ導入
- **Selected Approach**: Option 1 - 既存report構造を活用
- **Rationale**:
  - `AccessibilityReport.pages`が既に配列構造
  - 新規状態管理ライブラリは過剰
  - 既存のレポート処理ロジックを大部分維持可能
- **Trade-offs**:
  - ✅ 変更範囲最小
  - ✅ 既存のCSV出力等の機能がそのまま動作
  - ❌ アクティブページ管理用の追加状態が必要

### Decision: バックエンドの複数URL処理

- **Context**: 複数URLの分析実行方式
- **Alternatives Considered**:
  1. 並列分析（Promise.all）
  2. 順次分析（forループ）
  3. ブラウザインスタンス共有
- **Selected Approach**: Option 2 + 3 - 順次分析 + ブラウザ共有
- **Rationale**:
  - 認証状態（Cookie/storageState）を全URL間で共有するため、同一ブラウザインスタンスが必要
  - 並列実行はリソース消費が大きく、4URLでは過剰
  - SSE進捗通知と自然に統合
- **Trade-offs**:
  - ✅ 認証状態の確実な共有
  - ✅ メモリ効率
  - ❌ 総分析時間は順次のため長い（4URL = 4倍）

## Risks & Mitigations

- **Risk 1**: UrlInputコンポーネントの複雑化
  - Mitigation: UrlChipコンポーネントを分離し、責任を明確化
- **Risk 2**: 単一URL時の回帰
  - Mitigation: 既存テストを維持し、単一URLパスを明示的にテスト
- **Risk 3**: SSEイベント処理の互換性
  - Mitigation: 新規イベント型を追加し、既存イベントは変更しない
- **Risk 4**: 長時間の分析によるタイムアウト
  - Mitigation: 全体タイムアウトを4URL対応に調整（5分 × 4 = 20分）

## References

- [MUI Chip Component](https://mui.com/material-ui/react-chip/) - チップUIの実装パターン
- [MUI Tabs Component](https://mui.com/material-ui/react-tabs/) - タブUIの実装パターン
- [Server-Sent Events MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) - SSEの仕様
