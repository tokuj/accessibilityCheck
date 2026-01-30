# Implementation Plan: report-enhancement

## Task Overview

本実装計画は、アクセシビリティレポート改善機能を段階的に実装するためのタスクを定義する。

## Tasks

### Phase 1: バックエンド型定義とデータ抽出

- [x] 1. 共通型定義の拡張
- [x] 1.1 NodeInfo型とRuleResult拡張を追加する
  - ノード情報を表現するNodeInfo型を定義する（target、html、failureSummary）
  - RuleResult型にオプショナルなnodes配列を追加する
  - Lighthouse用のrawScoreとclassificationReasonフィールドを追加する
  - フロントエンド型定義も同期して更新する
  - _Requirements: 1.1, 1.2, 1.3, 3.5_

- [x] 2. axe-coreアナライザーでノード情報を抽出する
- [x] 2.1 (P) 違反・パス・不完全結果からノード詳細を抽出する
  - axe-coreのnodes配列からtargetとhtmlを抽出する
  - target配列を単一のCSSセレクタ文字列に結合する
  - HTML抜粋を最大200文字に切り詰める
  - failureSummaryを含める
  - 既存のnodeCountは後方互換性のため維持する
  - _Requirements: 1.3, 5.2_

- [x] 3. Pa11yアナライザーでノード情報を抽出する
- [x] 3.1 (P) issueオブジェクトからセレクタとコンテキストを抽出する
  - issue.selectorをtargetとして使用する
  - issue.contextをhtmlとして使用する（200文字制限）
  - 1イシュー=1ノードのため、nodes配列は常に1要素
  - _Requirements: 1.3, 5.2_

- [x] 4. Lighthouseアナライザーの分類ロジックを改善する
- [x] 4.1 scoreDisplayModeによる適用外判定を追加する
  - audit.scoreDisplayModeがnotApplicableの場合はスキップする
  - score === nullかつnotApplicable以外の場合のみincompleteとする
  - _Requirements: 3.1, 3.3_

- [x] 4.2 中間スコアの分類閾値を0.5に変更する
  - 0 < score < 0.5は違反として分類する
  - 0.5 <= score < 1は達成として分類する
  - rawScoreフィールドに元のスコアを記録する
  - classificationReasonフィールドに分類理由を記録する
  - _Requirements: 3.2, 3.5_

- [x] 4.3 (P) audit.details.itemsからノード情報を抽出する
  - details.type === 'table'の場合はitems[].nodeから抽出する
  - details.type === 'list'の場合はitemsから直接抽出する
  - selector、snippet、nodeLabelをNodeInfoに変換する
  - _Requirements: 1.3, 5.2_

### Phase 2: フロントエンド共通コンポーネント

- [x] 5. WCAGレベルマッピングユーティリティを作成する
- [x] 5.1 (P) WCAG 2.1全基準のレベル判定機能を実装する
  - 78基準の静的マッピングテーブルを作成する
  - getWcagLevel関数でA/AA/AAAを返却する
  - getWcagInfo関数で基準名も含めて返却する
  - 不明な基準に対してはunknownを返却する
  - _Requirements: 2.5_

- [x] 5.2* WCAGマッピングのユニットテストを作成する
  - 全レベル（A、AA、AAA）の判定をテストする
  - 境界ケースと不明な基準のテストを含める
  - _Requirements: 2.5_

- [x] 6. NodeDetailsコンポーネントを作成する
- [x] 6.1 ノード情報の展開表示UIを実装する
  - MUI Collapseを使用して展開アニメーションを実装する
  - CSSセレクタをリスト形式で表示する
  - HTML抜粋をcodeタグでモノスペース表示する
  - 10件超の場合は「さらに表示」ボタンで残りを展開可能にする
  - エラー時はグレースフルにメッセージを表示する
  - _Requirements: 1.1, 1.2, 1.4, 5.1, 5.3, 5.5_

- [x] 6.2* NodeDetailsコンポーネントのテストを作成する
  - 展開・折りたたみ動作をテストする
  - 10件超時のページネーション動作をテストする
  - 空配列時のエラー表示をテストする
  - _Requirements: 1.1, 1.4, 5.5_

- [x] 7. WcagAggregateSummaryコンポーネントを作成する
- [x] 7.1 WCAG項番別の集約サマリーUIを実装する
  - violationsをWCAG項番でグループ化する
  - 各項番に対してツール別（axe-core、Pa11y、Lighthouse）の件数を表示する
  - 違反件数の多い順にソートする
  - WCAGレベルバッジ（A: success、AA: primary、AAA: secondary）を表示する
  - 項番クリック時にonWcagFilterコールバックを呼び出す
  - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [x] 7.2* WcagAggregateSummaryコンポーネントのテストを作成する
  - 集約ロジックの正確性をテストする
  - ソート順をテストする
  - クリックイベントのコールバック呼び出しをテストする
  - _Requirements: 2.1, 2.3_

### Phase 3: テーブルコンポーネント統合

- [x] 8. ViolationsTableにNodeDetails展開機能を統合する
- [x] 8.1 行展開UIとNodeDetails表示を追加する
  - 各行に展開アイコンボタンを追加する
  - expandedRows状態をSetで管理する
  - 展開行の下にNodeDetailsコンポーネントを表示する
  - モバイル対応のレスポンシブレイアウトを確保する
  - _Requirements: 1.1, 4.5, 5.4_

- [x] 9. IncompleteTableの構造を統一する
- [x] 9.1 WCAG別AIボタンとNodeDetails展開を追加する
  - ViolationsTableと同様のWCAG列構造に変更する
  - 各WCAG項番にAIChatButtonを追加する
  - NodeDetails展開機能を統合する
  - classificationReasonをTooltipで表示する
  - _Requirements: 3.4, 4.1, 4.5_

- [x] 10. PassesTableの構造を統一する
- [x] 10.1 影響度カラム、WCAG別AIボタン、NodeDetails展開を追加する
  - 影響度カラムを追加する（undefinedの場合は「-」表示）
  - ImpactBadgeコンポーネントを使用する
  - 各WCAG項番にAIChatButtonを追加する
  - NodeDetails展開機能を統合する
  - _Requirements: 4.2, 4.3, 4.4, 4.5_

### Phase 4: AI総評セクション統合

- [x] 11. ImprovementListにWCAG集約サマリーを統合する
- [x] 11.1 WcagAggregateSummaryをAI総評セクションに追加する
  - AI総評セクション内に「WCAG項番別サマリー」セクションを追加する
  - WcagAggregateSummaryコンポーネントを配置する
  - WCAGフィルタ選択状態を管理する
  - _Requirements: 2.1_

- [x] 11.2 WCAG項番クリックでテーブルフィルタを連動させる
  - フィルタ状態をReportSummaryで管理する
  - 選択されたWCAG項番でViolationsTableをフィルタリングする
  - フィルタ解除機能を提供する
  - _Requirements: 2.4_

### Phase 5: 統合テストと最終検証

- [x] 12. 統合テストとパフォーマンス検証を実施する
- [x] 12.1 バックエンド統合テストを作成する
  - axe-core、Pa11y、LighthouseそれぞれのRuleResult.nodes変換をテストする
  - Lighthouse分類ロジックの改善をテストする
  - API応答時間が+10%以内であることを検証する
  - _Requirements: 1.3, 3.1, 3.2, 5.2_

- [x] 12.2 フロントエンド統合テストを作成する
  - 違反テーブル行展開でノード表示されることをテストする
  - WCAG項番クリックでフィルタが動作することをテストする
  - タブ切り替え時のUI一貫性をテストする
  - _Requirements: 1.1, 2.4, 4.3_

- [x] 12.3 パフォーマンステストを実施する
  - ノード展開が100ms以内であることを検証する
  - 100件以上のノードでのレンダリングパフォーマンスを検証する
  - モバイルデバイスでの動作を検証する
  - _Requirements: 5.1, 5.3, 5.4_

### Phase 6: 問題箇所の視覚的特定

- [x] 13. 問題箇所の視覚的特定機能を実装する
- [x] 13.1 (P) NodeInfo型を拡張してバウンディングボックスとXPathを追加する
  - BoundingBox型（x, y, width, height）を定義する
  - NodeInfoにboundingBox、xpath、contextHtml、isHiddenフィールドを追加する
  - フロントエンド型定義も同期して更新する
  - _Requirements: 6.1, 6.4, 6.5, 6.7_

- [x] 13.2 (P) axe-coreアナライザーでバウンディングボックスとXPathを抽出する
  - Playwrightの`element.boundingBox()`を使用して要素の位置情報を取得する
  - CSSセレクタからXPathを生成する（または直接取得）
  - 親要素と兄弟要素を含むcontextHtmlを抽出する
  - 要素が非表示またはビューポート外の場合はisHiddenをtrueに設定する
  - _Requirements: 6.1, 6.4, 6.5, 6.7_

- [x] 13.3 HighlightedScreenshotコンポーネントを作成する
  - スクリーンショット画像上にCanvas/SVGでバウンディングボックスを赤枠描画する
  - 各ノードに番号ラベル（1, 2, 3...）を表示する
  - ノードクリックで選択状態を切り替え、選択中は青枠で強調する
  - スクリーンショットの拡大・縮小機能を提供する
  - _Requirements: 6.2, 6.3_

- [x] 13.4 NodeDetailsコンポーネントを拡張する
  - XPathとCSSセレクタの両方を表示し、コピーボタンを設置する
  - failureSummaryを「修正方法」ラベルで分かりやすく表示する
  - ノードクリック時にcontextHtml（周辺HTML）をシンタックスハイライト付きで表示する
  - isHiddenがtrueの場合は「この要素はビューポート外または非表示です」を警告表示する
  - HighlightedScreenshotと連携してノード選択を同期する
  - _Requirements: 6.4, 6.5, 6.6, 6.7_

- [x] 13.5* 問題箇所視覚的特定機能のテストを作成する
  - バウンディングボックス情報の抽出をテストする
  - スクリーンショットハイライト表示をテストする
  - XPathコピー機能をテストする
  - 非表示要素の警告表示をテストする
  - _Requirements: 6.1, 6.2, 6.4, 6.7_

### Phase 7: 問題箇所表示の改善

- [x] 14. 問題箇所表示の改善を実装する
- [x] 14.1 (P) axe-coreに日本語ロケールを設定する
  - axe-coreソースと日本語ロケール（ja.json）を読み込む
  - カスタムaxeSourceを生成してAxeBuilderに渡す
  - failureSummary、description、helpが日本語で出力されることを確認
  - 既存テストへの影響を確認・修正
  - _Requirements: 7.1_

- [x] 14.2 (P) NodeInfoにelementDescriptionフィールドを追加する
  - server/analyzers/types.tsにelementDescription?: string を追加
  - frontend/src/types/accessibility.tsを同期
  - _Requirements: 7.2_

- [x] 14.3 extractEnhancedNodeInfoで要素説明を生成する
  - TAG_LABELS定数（a→リンク、img→画像等）を定義
  - generateElementDescription関数を実装
  - aria-label > alt > title > placeholder > textContentの優先順で取得
  - 20文字で切り詰め
  - extractEnhancedNodeInfoでelementDescriptionを設定
  - _Requirements: 7.2, 7.7_

- [x] 14.4 ViolationsTableにHighlightedScreenshotを統合する
  - ViolationsTablePropsにscreenshot?: stringを追加
  - ReportSummaryでscreenshot={currentScreenshot}を渡す
  - 展開行の上部にHighlightedScreenshotを表示
  - selectedNodeIndex状態を管理
  - ノードクリックでNodeDetailsとHighlightedScreenshotを同期
  - _Requirements: 7.4, 7.5_

- [x] 14.5 NodeDetailsで要素説明を優先表示する
  - elementDescriptionを大きく表示（Typography variant="subtitle1"）
  - CSSセレクタをAccordionで「技術詳細を表示」折りたたみに変更
  - XPathも折りたたみ内に移動
  - _Requirements: 7.3_

- [x] 14.6 位置情報バッジを追加する
  - getPositionLabel関数を実装（上部・中央・下部、左・中央・右）
  - NodeDetailsで位置情報をChipで表示
  - viewportSizeはpropsで受け取る（バックエンドから渡す必要あり）
  - _Requirements: 7.6_

- [x] 14.7* 問題箇所表示改善のテストを作成する
  - axe-core日本語ロケールのテスト（failureSummaryが日本語）
  - 要素説明生成のテスト（タグラベル、テキスト抽出）
  - ViolationsTable + HighlightedScreenshot統合テスト
  - 位置情報バッジのテスト
  - _Requirements: 7.1-7.7_

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
| 6.1 | 13.1, 13.2 |
| 6.2 | 13.3 |
| 6.3 | 13.3 |
| 6.4 | 13.1, 13.2, 13.4 |
| 6.5 | 13.1, 13.2, 13.4 |
| 6.6 | 13.4 |
| 6.7 | 13.1, 13.2, 13.4 |
| 7.1 | 14.1 |
| 7.2 | 14.2, 14.3 |
| 7.3 | 14.5 |
| 7.4 | 14.4 |
| 7.5 | 14.4 |
| 7.6 | 14.6 |
| 7.7 | 14.3 |
