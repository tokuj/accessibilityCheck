# Gap Analysis Report: report-ux-enhancements

## 概要
本レポートは、4つの要件に対する既存コードベースとの差分を分析し、実装戦略を提案する。

---

## 1. 現状調査

### 主要ファイル構成

#### フロントエンド (`frontend/src/`)
| ファイル | 役割 |
|---------|------|
| `App.tsx` | メインアプリ、分析状態管理 |
| `components/ReportSummary.tsx` | レポート表示（**maxWidth: 900** で制限あり） |
| `components/ViolationsTable.tsx` | 違反テーブル（8カラム、横スクロール発生） |
| `components/AnalysisProgress.tsx` | 静的なローディング表示（ログなし） |
| `utils/scoreCalculator.ts` | スコア計算・**ルールベース総評生成** |
| `services/api.ts` | REST API呼び出し（ストリーミングなし） |
| `theme.ts` | MUIテーマ設定 |

#### バックエンド (`server/`)
| ファイル | 役割 |
|---------|------|
| `index.ts` | Expressサーバー、`POST /api/analyze` エンドポイント |
| `analyzer.ts` | 分析オーケストレーション（console.logで進捗出力） |
| `analyzers/axe.ts`, `pa11y.ts`, `lighthouse.ts` | 個別ツール実行 |

### 既存パターン・規約
- **UIフレームワーク**: MUI (Material-UI)
- **状態管理**: React hooks (useState)
- **API通信**: fetch API (非同期、タイムアウト5分)
- **型定義**: TypeScript、`types/accessibility.ts` で集約

---

## 2. 要件別ギャップ分析

### 要件1: レポート画面レイアウトの最適化

#### 現状
- `ReportSummary.tsx:59`: `<Card sx={{ maxWidth: 900, mx: 'auto' }}>` で横幅が900pxに制限
- `ViolationsTable.tsx`: 8カラム（ツール、ページ、ルールID、説明、影響度、ノード数、WCAG項番、詳細）
- 説明カラムは `maxWidth: 300` で制限されているが、全体として狭い

#### ギャップ
- **Missing**: フルワイド対応のコンテナ設定
- **Constraint**: MUIのCardコンポーネントの `maxWidth` がハードコード

#### 実装オプション

| オプション | 説明 | トレードオフ |
|-----------|------|-------------|
| **A: Cardの maxWidth 拡張** | `maxWidth: 1400` または `100%` に変更 | ✅ 最小変更、❌ 大画面で間延び |
| **B: Container + breakpoints** | MUIの `Container maxWidth="xl"` を使用 | ✅ レスポンシブ対応、❌ 設計変更 |
| **C: テーブルカラム最適化** | 説明をツールチップに、URL短縮 | ✅ 見やすさ向上、❌ 情報密度減少 |

#### 推奨
**オプションA + C の組み合わせ**: maxWidthを `1400px` に拡張し、必要に応じてカラム最適化

#### 工数・リスク
- **工数**: S (1-3日)
- **リスク**: Low（既存パターンの調整）

---

### 要件2: CSVダウンロード機能

#### 現状
- CSV生成機能は**存在しない**
- `ViolationsTable.tsx` でデータは `allViolations` として準備済み

#### ギャップ
- **Missing**: CSVエクスポート機能全体（生成ロジック、ダウンロードUI）

#### 実装オプション

| オプション | 説明 | トレードオフ |
|-----------|------|-------------|
| **A: フロントエンドのみ** | JavaScript でCSV生成、Blob + URL.createObjectURL | ✅ バックエンド変更不要、❌ 大量データ時のメモリ |
| **B: バックエンドAPI** | `/api/export/csv` エンドポイント追加 | ✅ 大量データ対応、❌ API追加 |

#### 推奨
**オプションA**: フロントエンドで完結（データ量が限定的なため）

#### 実装詳細
```typescript
// utils/csvExport.ts 新規作成
export function exportViolationsToCsv(violations: RuleResult[], targetUrl: string): void {
  const BOM = '\uFEFF';
  const header = 'ツール,ページ,ルールID,説明,影響度,ノード数,WCAG項番,詳細URL\n';
  // CSV生成ロジック
}
```

#### 工数・リスク
- **工数**: S (1-3日)
- **リスク**: Low（新規追加、既存影響なし）

---

### 要件3: AI総評機能の改善（Gemini Flash統合）

#### 現状
- `scoreCalculator.ts:96-117`: `generateSummary()` はルールベースの4段階テンプレート
- AIは**一切使用していない**
- バックエンド: Gemini API統合なし
- GCP Secret Manager統合なし

#### ギャップ
- **Missing**:
  - Gemini API クライアント
  - GCP Secret Manager からのAPIキー取得
  - AI総評生成エンドポイント
  - フロントエンドのAI総評表示コンポーネント
- **Research Needed**:
  - Gemini 3 Flash API のモデル名・エンドポイント確認
  - GCP認証方式（Cloud Run環境でのサービスアカウント利用）

#### 実装オプション

| オプション | 説明 | トレードオフ |
|-----------|------|-------------|
| **A: 分析時に同時生成** | `/api/analyze` 内でGemini呼び出し | ✅ シンプル、❌ 分析時間増加 |
| **B: 別エンドポイント** | `/api/ai-summary` を分離 | ✅ 非同期対応、❌ API増加 |
| **C: ストリーミング** | SSEでAI応答をストリーム | ✅ UX向上、❌ 複雑度増 |

#### 推奨
**オプションA**: 分析完了後にGemini呼び出し（フォールバックでルールベース）

#### 必要な新規ファイル
```
server/
├── services/
│   ├── gemini.ts          # Gemini APIクライアント
│   └── secret-manager.ts  # GCP Secret Manager
```

#### 工数・リスク
- **工数**: M (3-7日)
- **リスク**: Medium（外部API統合、認証設定）

---

### 要件4: 分析中のリアルタイムログ表示

#### 現状
- `App.tsx:87-107`: `loading` 状態で静的なCircularProgressを表示
- `AnalysisProgress.tsx`: 静的なローディングUI（ログ表示なし）
- `analyzer.ts`: `console.log()` でサーバーログ出力（クライアントに送信せず）
- `api.ts`: 単純なfetch（ストリーミング非対応）

#### ギャップ
- **Missing**:
  - WebSocket または SSE サーバー実装
  - フロントエンドのストリーミング受信
  - ログパーサー（Playwright出力の構造化）
  - リアルタイムログ表示UI
- **Research Needed**:
  - Express + SSE の実装パターン
  - 既存の分析フロー（spawn → output capture）の改修方針

#### 実装オプション

| オプション | 説明 | トレードオフ |
|-----------|------|-------------|
| **A: Server-Sent Events (SSE)** | EventSource API使用 | ✅ シンプル、✅ HTTP互換、❌ 単方向 |
| **B: WebSocket** | 双方向通信 | ✅ 柔軟、❌ 設定複雑 |
| **C: ポーリング** | 定期的にログ取得 | ✅ シンプル、❌ リアルタイム性低 |

#### 推奨
**オプションA: SSE**: 単方向ログストリーミングに最適

#### アーキテクチャ変更
```
現状:
  Frontend → POST /api/analyze → Backend → (処理完了) → Response

変更後:
  Frontend → POST /api/analyze-stream → Backend
           ← SSE: { type: 'log', message: '...' }
           ← SSE: { type: 'progress', step: 1, total: 3 }
           ← SSE: { type: 'complete', report: {...} }
```

#### 工数・リスク
- **工数**: L (1-2週)
- **リスク**: High（アーキテクチャ変更、既存フロー大幅改修）

---

## 3. 要件-資産マッピング

| 要件 | 既存資産 | ギャップ | 複雑度 |
|-----|---------|---------|--------|
| 1. レイアウト最適化 | ReportSummary.tsx, ViolationsTable.tsx | maxWidth調整のみ | Low |
| 2. CSVダウンロード | ViolationsTable.tsx (データ) | 新規utils + UIボタン | Low |
| 3. AI総評 (Gemini) | scoreCalculator.ts (フォールバック) | Gemini統合、Secret Manager | Medium |
| 4. ログストリーミング | analyzer.ts (console.log) | SSE実装、UI改修 | High |

---

## 4. 総合評価

### 工数サマリー
| 要件 | 工数 | リスク |
|-----|------|--------|
| 1. レイアウト | S (1-3日) | Low |
| 2. CSV | S (1-3日) | Low |
| 3. AI総評 | M (3-7日) | Medium |
| 4. ログストリーミング | L (1-2週) | High |
| **合計** | **M-L (7-14日)** | **Medium** |

### 推奨実装順序
1. **要件1**: レイアウト（即時効果、リスク低）
2. **要件2**: CSV（独立、リスク低）
3. **要件3**: AI総評（外部依存、事前検証推奨）
4. **要件4**: ログストリーミング（最大規模、最後に実装）

---

## 5. 設計フェーズへの引き継ぎ事項

### Research Needed
1. **Gemini 3 Flash API**: 正式なモデルID、エンドポイント、レート制限
2. **GCP Secret Manager**: Cloud Runからのアクセス方法、サービスアカウント権限
3. **SSE実装**: Expressでのストリーミングパターン、Cloud Run対応

### 設計判断ポイント
1. AI総評の生成タイミング（同期 vs 非同期）
2. ログストリーミングのスコープ（Playwright出力のみ vs 全ツール）
3. CSVに含めるデータ範囲（違反のみ vs パス・要確認含む）

---

_Generated at: 2025-12-20T10:40:00+09:00_
