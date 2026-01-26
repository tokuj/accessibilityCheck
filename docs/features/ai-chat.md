# インラインAI対話機能

アクセシビリティレポート画面で、各項目についてAIに質問できるインライン対話機能です。

## 機能概要

Figmaのコメント機能のように、レポート内の各項目（スコア、違反、推奨事項など）に対してコンテキストに応じた質問・回答ができるコンパクトなUIを提供します。

### 主な特徴

- **インラインUI**: 画面遷移なしで項目ごとにAIへ質問可能
- **コンテキスト認識**: 質問対象の項目情報（ルールID、WCAG基準など）を自動的にAIに送信
- **Spindle参照**: [Amebaアクセシビリティガイドライン](https://a11y-guidelines.ameba.design/)を参照元として活用
- **アクセシビリティ対応**: キーボード操作、スクリーンリーダー対応

## 使用方法

### 質問の仕方

1. レポート内の対話可能な項目にある「吹き出しアイコン」をクリック
2. ポップオーバーが開き、入力フィールドにフォーカスが移動
3. 質問を入力してEnterキーまたは送信ボタンをクリック
4. AIが回答を生成し、参照URLとともに表示

### キーボード操作

| キー | 動作 |
|------|------|
| Tab | 対話ボタンにフォーカス |
| Enter / Space | ポップオーバーを開く |
| Enter（入力中） | 質問を送信 |
| Escape | ポップオーバーを閉じる |

## 対話ポイント一覧

レポート内の以下の項目でAI対話が可能です。

### スコア関連（ScoreCard）

| 項目 | コンテキストタイプ | 説明 |
|------|-------------------|------|
| 総合スコア | `score` | 全体のアクセシビリティスコア |
| カテゴリ別スコア | `score` | WCAG基準別のスコア |

### Lighthouseスコア（LighthouseScores）

| 項目 | コンテキストタイプ | 説明 |
|------|-------------------|------|
| Performance | `lighthouse` | パフォーマンススコア |
| Accessibility | `lighthouse` | アクセシビリティスコア |
| Best Practices | `lighthouse` | ベストプラクティススコア |
| SEO | `lighthouse` | SEOスコア |

### AI総評（ImprovementList）

| 項目 | コンテキストタイプ | 説明 |
|------|-------------------|------|
| 全体評価 | `improvement` | overallAssessment |
| 優先改善ポイント | `improvement` | prioritizedImprovements |
| 具体的な推奨事項 | `recommendation` | specificRecommendations |
| 検出された問題 | `issue` | detectedIssues |

### 詳細結果

| 項目 | コンテキストタイプ | 説明 |
|------|-------------------|------|
| 違反行（ViolationsTable） | `violation` | 各違反ルール |
| パス行（PassesTable） | `pass` | 各パスルール |
| 要確認行（IncompleteTable） | `incomplete` | 各要確認ルール |
| WCAG基準 | `wcag` | 各WCAG基準（1.4.3, 1.1.1など） |

## Spindleマッピングの拡充方法

AIがより正確な回答を生成するため、WCAG基準やルールIDとSpindleガイドラインのURLマッピングを管理しています。

### マッピングファイル

`server/data/spindle-mapping.ts`

### マッピングの追加方法

```typescript
// WCAG基準のマッピング追加
export const wcagToSpindleMap: Record<string, string> = {
  // 既存のマッピング
  '1.1.1': `${SPINDLE_BASE_URL}/1/non-text-content/`,
  '1.4.3': `${SPINDLE_BASE_URL}/1/contrast-minimum/`,

  // 新規追加（例）
  '2.1.1': `${SPINDLE_BASE_URL}/2/keyboard/`,
};

// ルールIDのマッピング追加
export const ruleIdToSpindleMap: Record<string, string> = {
  // 既存のマッピング
  'color-contrast': `${SPINDLE_BASE_URL}/1/contrast-minimum/`,
  'image-alt': `${SPINDLE_BASE_URL}/1/non-text-content/`,

  // 新規追加（例）
  'keyboard': `${SPINDLE_BASE_URL}/2/keyboard/`,
};
```

### Spindleガイドラインの構造

Spindleガイドラインは以下のURL構造を持っています。

```text
https://a11y-guidelines.ameba.design/{category}/{page-name}/
```

主要なカテゴリ:

- `1/`: 知覚可能（WCAG 1.x）
- `2/`: 操作可能（WCAG 2.x）
- `3/`: 理解可能（WCAG 3.x）
- `4/`: 堅牢性（WCAG 4.x）

## トラブルシューティング

### 回答が生成されない

**原因**: APIサーバーとの通信エラー、またはGemini APIのレート制限

**対処方法**:

1. ブラウザのネットワークタブでAPIレスポンスを確認
2. エラーメッセージに従って再試行
3. レート制限の場合は表示される待機時間後に再試行

### 「回答を生成中...」が長時間続く

**原因**: Gemini APIの応答遅延

**対処方法**:

1. 30秒でタイムアウトエラーが表示される
2. 再試行ボタンをクリック

### 対話ボタンが表示されない

**原因**: レポートデータが正しく読み込まれていない

**対処方法**:

1. ページをリロード
2. URLを再入力して分析を実行

### 履歴が消えてしまった

**原因**: ブラウザタブを閉じた、またはセッションが終了した

**対処方法**:

対話履歴はsessionStorageに保存されるため、タブを閉じると消去されます。これは仕様です。

## 技術仕様

### APIエンドポイント

```http
POST /api/chat
Content-Type: application/json

{
  "context": {
    "type": "violation",
    "ruleId": "color-contrast",
    "wcagCriteria": ["1.4.3"],
    "data": { ... }
  },
  "question": "この違反はどうすれば修正できますか？"
}
```

### レスポンス

```json
{
  "answer": "コントラスト比を4.5:1以上に調整してください。...",
  "referenceUrl": "https://a11y-guidelines.ameba.design/1/contrast-minimum/",
  "generatedAt": "2026-01-25T12:00:00.000Z"
}
```

### エラーレスポンス

| ステータス | 説明 |
|-----------|------|
| 400 | リクエストパラメータ不正 |
| 429 | レート制限（`retryAfter`秒後に再試行） |
| 504 | タイムアウト |
| 500 | サーバーエラー |

## 関連ドキュメント

- [設計ドキュメント](../../.kiro/specs/inline-ai-discussion/design.md)
- [要件ドキュメント](../../.kiro/specs/inline-ai-discussion/requirements.md)
- [Amebaアクセシビリティガイドライン（Spindle）](https://a11y-guidelines.ameba.design/)
