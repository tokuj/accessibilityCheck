# Implementation Plan: report-enhancement

## Task Overview

本実装計画は、アクセシビリティレポート改善機能を段階的に実装するためのタスクを定義する。

## Tasks

### Phase 1: バックエンド型定義とデータ抽出

- [ ] 1. 共通型定義の拡張
- [ ] 1.1 NodeInfo型とRuleResult拡張を追加する
  - ノード情報を表現するNodeInfo型を定義する（target、html、failureSummary）
  - RuleResult型にオプショナルなnodes配列を追加する
  - Lighthouse用のrawScoreとclassificationReasonフィールドを追加する
  - フロントエンド型定義も同期して更新する
  - _Requirements: 1.1, 1.2, 1.3, 3.5_

- [ ] 2. axe-coreアナライザーでノード情報を抽出する
- [ ] 2.1 (P) 違反・パス・不完全結果からノード詳細を抽出する
  - axe-coreのnodes配列からtargetとhtmlを抽出する
  - target配列を単一のCSSセレクタ文字列に結合する
  - HTML抜粋を最大200文字に切り詰める
  - failureSummaryを含める
  - 既存のnodeCountは後方互換性のため維持する
  - _Requirements: 1.3, 5.2_

- [ ] 3. Pa11yアナライザーでノード情報を抽出する
- [ ] 3.1 (P) issueオブジェクトからセレクタとコンテキストを抽出する
  - issue.selectorをtargetとして使用する
  - issue.contextをhtmlとして使用する（200文字制限）
  - 1イシュー=1ノードのため、nodes配列は常に1要素
  - _Requirements: 1.3, 5.2_

- [ ] 4. Lighthouseアナライザーの分類ロジックを改善する
- [ ] 4.1 scoreDisplayModeによる適用外判定を追加する
  - audit.scoreDisplayModeがnotApplicableの場合はスキップする
  - score === nullかつnotApplicable以外の場合のみincompleteとする
  - _Requirements: 3.1, 3.3_

- [ ] 4.2 中間スコアの分類閾値を0.5に変更する
  - 0 < score < 0.5は違反として分類する
  - 0.5 <= score < 1は達成として分類する
  - rawScoreフィールドに元のスコアを記録する
  - classificationReasonフィールドに分類理由を記録する
  - _Requirements: 3.2, 3.5_

- [ ] 4.3 (P) audit.details.itemsからノード情報を抽出する
  - details.type === 'table'の場合はitems[].nodeから抽出する
  - details.type === 'list'の場合はitemsから直接抽出する
  - selector、snippet、nodeLabelをNodeInfoに変換する
  - _Requirements: 1.3, 5.2_

### Phase 2: フロントエンド共通コンポーネント

- [ ] 5. WCAGレベルマッピングユーティリティを作成する
- [ ] 5.1 (P) WCAG 2.1全基準のレベル判定機能を実装する
  - 78基準の静的マッピングテーブルを作成する
  - getWcagLevel関数でA/AA/AAAを返却する
  - getWcagInfo関数で基準名も含めて返却する
  - 不明な基準に対してはunknownを返却する
  - _Requirements: 2.5_

- [ ] 5.2* WCAGマッピングのユニットテストを作成する
  - 全レベル（A、AA、AAA）の判定をテストする
  - 境界ケースと不明な基準のテストを含める
  - _Requirements: 2.5_

- [ ] 6. NodeDetailsコンポーネントを作成する
- [ ] 6.1 ノード情報の展開表示UIを実装する
  - MUI Collapseを使用して展開アニメーションを実装する
  - CSSセレクタをリスト形式で表示する
  - HTML抜粋をcodeタグでモノスペース表示する
  - 10件超の場合は「さらに表示」ボタンで残りを展開可能にする
  - エラー時はグレースフルにメッセージを表示する
  - _Requirements: 1.1, 1.2, 1.4, 5.1, 5.3, 5.5_

- [ ] 6.2* NodeDetailsコンポーネントのテストを作成する
  - 展開・折りたたみ動作をテストする
  - 10件超時のページネーション動作をテストする
  - 空配列時のエラー表示をテストする
  - _Requirements: 1.1, 1.4, 5.5_

- [ ] 7. WcagAggregateSummaryコンポーネントを作成する
- [ ] 7.1 WCAG項番別の集約サマリーUIを実装する
  - violationsをWCAG項番でグループ化する
  - 各項番に対してツール別（axe-core、Pa11y、Lighthouse）の件数を表示する
  - 違反件数の多い順にソートする
  - WCAGレベルバッジ（A: success、AA: primary、AAA: secondary）を表示する
  - 項番クリック時にonWcagFilterコールバックを呼び出す
  - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [ ] 7.2* WcagAggregateSummaryコンポーネントのテストを作成する
  - 集約ロジックの正確性をテストする
  - ソート順をテストする
  - クリックイベントのコールバック呼び出しをテストする
  - _Requirements: 2.1, 2.3_

### Phase 3: テーブルコンポーネント統合

- [ ] 8. ViolationsTableにNodeDetails展開機能を統合する
- [ ] 8.1 行展開UIとNodeDetails表示を追加する
  - 各行に展開アイコンボタンを追加する
  - expandedRows状態をSetで管理する
  - 展開行の下にNodeDetailsコンポーネントを表示する
  - モバイル対応のレスポンシブレイアウトを確保する
  - _Requirements: 1.1, 4.5, 5.4_

- [ ] 9. IncompleteTableの構造を統一する
- [ ] 9.1 WCAG別AIボタンとNodeDetails展開を追加する
  - ViolationsTableと同様のWCAG列構造に変更する
  - 各WCAG項番にAIChatButtonを追加する
  - NodeDetails展開機能を統合する
  - classificationReasonをTooltipで表示する
  - _Requirements: 3.4, 4.1, 4.5_

- [ ] 10. PassesTableの構造を統一する
- [ ] 10.1 影響度カラム、WCAG別AIボタン、NodeDetails展開を追加する
  - 影響度カラムを追加する（undefinedの場合は「-」表示）
  - ImpactBadgeコンポーネントを使用する
  - 各WCAG項番にAIChatButtonを追加する
  - NodeDetails展開機能を統合する
  - _Requirements: 4.2, 4.3, 4.4, 4.5_

### Phase 4: AI総評セクション統合

- [ ] 11. ImprovementListにWCAG集約サマリーを統合する
- [ ] 11.1 WcagAggregateSummaryをAI総評セクションに追加する
  - AI総評セクション内に「WCAG項番別サマリー」セクションを追加する
  - WcagAggregateSummaryコンポーネントを配置する
  - WCAGフィルタ選択状態を管理する
  - _Requirements: 2.1_

- [ ] 11.2 WCAG項番クリックでテーブルフィルタを連動させる
  - フィルタ状態をReportSummaryで管理する
  - 選択されたWCAG項番でViolationsTableをフィルタリングする
  - フィルタ解除機能を提供する
  - _Requirements: 2.4_

### Phase 5: 統合テストと最終検証

- [ ] 12. 統合テストとパフォーマンス検証を実施する
- [ ] 12.1 バックエンド統合テストを作成する
  - axe-core、Pa11y、LighthouseそれぞれのRuleResult.nodes変換をテストする
  - Lighthouse分類ロジックの改善をテストする
  - API応答時間が+10%以内であることを検証する
  - _Requirements: 1.3, 3.1, 3.2, 5.2_

- [ ] 12.2 フロントエンド統合テストを作成する
  - 違反テーブル行展開でノード表示されることをテストする
  - WCAG項番クリックでフィルタが動作することをテストする
  - タブ切り替え時のUI一貫性をテストする
  - _Requirements: 1.1, 2.4, 4.3_

- [ ] 12.3 パフォーマンステストを実施する
  - ノード展開が100ms以内であることを検証する
  - 100件以上のノードでのレンダリングパフォーマンスを検証する
  - モバイルデバイスでの動作を検証する
  - _Requirements: 5.1, 5.3, 5.4_

## Requirements Coverage

| Requirement | Tasks |
|-------------|-------|
| 1.1 | 1.1, 6.1, 8.1, 12.2 |
| 1.2 | 1.1, 6.1 |
| 1.3 | 1.1, 2.1, 3.1, 4.3, 12.1 |
| 1.4 | 6.1, 6.2 |
| 1.5 | 9.1, 10.1 |
| 2.1 | 7.1, 11.1 |
| 2.2 | 7.1 |
| 2.3 | 7.1, 7.2 |
| 2.4 | 11.2, 12.2 |
| 2.5 | 5.1, 5.2, 7.1 |
| 3.1 | 4.1, 12.1 |
| 3.2 | 4.2, 12.1 |
| 3.3 | 4.1 |
| 3.4 | 9.1 |
| 3.5 | 1.1, 4.2 |
| 4.1 | 9.1 |
| 4.2 | 10.1 |
| 4.3 | 10.1, 12.2 |
| 4.4 | 10.1 |
| 4.5 | 8.1, 9.1, 10.1 |
| 5.1 | 6.1, 12.3 |
| 5.2 | 2.1, 3.1, 4.3, 12.1 |
| 5.3 | 6.1, 12.3 |
| 5.4 | 8.1, 12.3 |
| 5.5 | 6.1, 6.2 |
