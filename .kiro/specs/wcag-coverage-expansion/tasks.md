# Implementation Plan

## Tasks

- [x] 1. 型定義とインフラストラクチャの拡張
- [x] 1.1 (P) ToolSource型を拡張し、新しいエンジン識別子を追加
  - 既存の`ToolSource`型に`ibm`、`alfa`、`qualweb`、`wave`、`custom`を追加
  - `RuleResult`インターフェースに`toolSources`配列と`isExperimental`フラグを追加
  - 既存のコードとの後方互換性を維持
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 1.2 (P) 分析オプション型を定義
  - エンジン選択、WCAGバージョン、半自動チェック、レスポンシブテストのオプション型を定義
  - デフォルト値とプリセット（クイック/フル）の定数を定義
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 2. 新規アクセシビリティエンジンの統合
- [x] 2.1 (P) IBM Equal Access Checkerアナライザーを実装
  - `accessibility-checker`パッケージをインストールして設定
  - Playwright pageオブジェクトを受け取り、IBM Equal Accessでスキャンする関数を作成
  - WCAG 2.2ポリシー設定ファイル（`.achecker.yml`）を作成
  - 結果を`RuleResult`型に正規化する変換ロジックを実装
  - エラーハンドリングとタイムアウト処理を追加
  - _Requirements: 1.1, 1.6, 2.2_

- [x] 2.2 (P) Siteimprove Alfaアナライザーを実装
  - `@siteimprove/alfa-playwright`と関連パッケージをインストール
  - Playwright DocumentHandleをAlfa Page形式に変換する処理を実装
  - AA levelフィルタでルールを実行し、結果を収集
  - 結果を`RuleResult`型に正規化
  - Focus Appearance（2.4.13）とConsistent Help（3.2.6）の検出を確認
  - _Requirements: 1.2, 1.6, 2.3_

- [x] 2.3 (P) QualWebアナライザーを実装
  - `@qualweb/core`と関連パッケージをインストール
  - Playwrightから`page.content()`でHTMLを取得してQualWebに渡す処理を実装
  - Puppeteerクラスタのライフサイクル管理（起動/停止）を実装
  - ACT rulesとWCAG techniquesの結果を`RuleResult`型に正規化
  - _Requirements: 1.3, 1.6_

- [x] 2.4 (P) WAVE APIアナライザーを実装
  - WAVE REST APIを呼び出すHTTPクライアント処理を実装
  - APIキーの安全な取得（環境変数/Secret Manager）を実装
  - レポートタイプ3（XPath含む）のレスポンスを解析
  - 結果を`RuleResult`型に正規化
  - レート制限エラー（429）とAPIキーエラー（401）のハンドリング
  - API呼び出し数のカウント機能を追加
  - _Requirements: 4.1, 4.2, 4.4, 4.5_

- [x] 3. オーケストレーターの拡張
- [x] 3.1 オーケストレーターに新エンジンを統合
  - `analyzer.ts`に新エンジンの呼び出しロジックを追加
  - 分析オプションに基づいてエンジンの有効/無効を制御
  - 並列実行の最適化（Promise.allSettledを使用）
  - 各エンジンのエラーを個別にハンドリングし、他エンジンの処理を継続
  - 進捗イベントに新エンジンのステータスを追加
  - _Requirements: 1.5, 1.6, 2.1_

- [x] 4. 結果統合と重複排除
- [x] 4.1 重複排除サービスを実装
  - CSSセレクタの正規化ロジックを実装
  - WCAG成功基準による一致判定を実装
  - 違反内容の類似度計算（Levenshtein距離またはシンプルな文字列比較）を実装
  - 同一違反を統合し、検出元エンジンをリストとして保持
  - 異なる重要度の場合は最高重要度を採用
  - エンジン別検出数サマリーを生成
  - _Requirements: 1.4, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 5. Playwright拡張テスト機能
- [x] 5.1 (P) キーボードナビゲーションテスターを実装
  - Tabキーを順次押下してフォーカス可能要素のリストを生成
  - 各要素のフォーカス順序を記録
  - キーボードトラップの検出（同一要素への循環検知）を実装
  - フォーカスインジケーターのCSS検証（outline/box-shadow/border）を実装
  - フォーカススタイルがない場合に違反として報告
  - _Requirements: 3.1_

- [x] 5.2 (P) 動的コンテンツテスターを実装
  - モーダル、ドロップダウン、アコーディオン、タブパネルの検出ロジックを実装
  - 各動的コンテンツのトリガー要素を特定
  - 開/閉状態でaxe-coreスキャンを実行
  - 状態別の違反を統合してレポート
  - _Requirements: 3.2_

- [x] 5.3 (P) レスポンシブテスト機能を実装
  - 複数ビューポート（375px、768px、1280px）でのスキャン実行
  - 200%ズーム時のReflow（1.4.10）違反検出
  - ビューポート固有の問題を識別してレポート
  - _Requirements: 3.3, 3.4_

- [x] 5.4 (P) フォーカスコントラストチェッカーを実装
  - フォーカス状態の前後でスクリーンショットを取得
  - フォーカスインジケーターの色を抽出
  - 背景色とのコントラスト比を計算
  - 3:1未満の場合に違反として報告
  - _Requirements: 3.5_

- [x] 6. カスタムルールエンジン
- [x] 6.1 axe-coreカスタムルールサービスを実装
  - axe-coreのカスタムルール登録機能を使用
  - 曖昧なリンクテキスト検出ルール（「こちら」「詳細」「クリック」等）を実装
  - 見出しレベルスキップ検出ルール（h1→h3等）を実装
  - 長すぎるalt属性検出ルール（100文字以上）を実装
  - 空のボタン/リンク検出ルールを実装
  - カスタムルールの有効/無効設定を実装
  - 違反検出時に`toolSource: 'custom'`として報告
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 7. ARIAライブリージョン検証
- [x] 7.1 ライブリージョンバリデーターを実装
  - ページ内の全てのaria-live属性を持つ要素を検出
  - role属性（alert/status/log）の適切な使用を検証
  - aria-atomicとaria-relevant属性の設定を確認
  - 空のライブリージョンを警告として報告
  - フォーム送信シミュレーション時のエラーメッセージ追加を検証
  - ライブリージョン一覧をレポートに含める
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 8. WCAGカバレッジサービス
- [x] 8.1 カバレッジ計算サービスを実装
  - 全WCAG成功基準（1.1.1〜4.1.3）のマスターリストを定義
  - 各基準のテスト状態（自動/半自動/手動/未テスト）を計算
  - 各基準の結果（合格/違反/要確認/該当なし）を判定
  - 検出に使用したツールを記録
  - 適合レベル別（A/AA/AAA）カバレッジ率を計算
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 8.2 カバレッジマトリクスのCSVエクスポートを実装
  - カバレッジマトリクスをCSV形式に変換
  - ダウンロード機能を提供
  - _Requirements: 7.4_

- [x] 9. 半自動チェックサービス
- [x] 9.1 半自動チェック項目抽出サービスを実装
  - `incomplete`結果から半自動確認が可能な項目を抽出
  - 各項目について質問文を生成
  - スクリーンショットとHTML抜粋を含める
  - alt属性、リンクテキスト、見出し、フォーカス可視性の確認項目を生成
  - _Requirements: 5.1, 5.2, 5.4_

- [x] 9.2 回答記録と進捗管理を実装
  - ユーザー回答（適切/不適切/判断不能）を記録
  - 回答をレポートに反映
  - 進捗状況（完了数/全体数）を追跡
  - _Requirements: 5.3, 5.6_

- [x] 10. フロントエンド - 分析オプションパネル
- [x] 10.1 AnalysisOptionsPanelコンポーネントを実装
  - エンジン選択チェックボックス（axe-core, Pa11y, Lighthouse, IBM, Alfa, QualWeb）を表示
  - WCAGバージョン選択（2.0 AA, 2.1 AA, 2.2 AA）ドロップダウンを表示
  - 半自動チェック有効/無効トグルを表示
  - レスポンシブテスト有効/無効トグルを表示
  - WAVE API設定（有効/無効、APIキー入力）を表示
  - プリセットボタン（クイック分析/フル分析）を表示
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 10.2 オプション永続化を実装
  - localStorageに設定を保存
  - 次回起動時に設定を復元
  - _Requirements: 8.5_

- [x] 11. フロントエンド - 半自動チェックパネル
- [x] 11.1 SemiAutoCheckPanelコンポーネントを実装
  - カード形式で半自動チェック項目を一覧表示
  - 各カードにスクリーンショット、HTML抜粋、質問を表示
  - 選択肢ボタン（適切/不適切/判断不能）を表示
  - 進捗バーで完了状況を表示
  - スキップボタンで後回しを可能に
  - 「自動テストのみ」オプション時はパネルを非表示
  - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6_

- [x] 12. フロントエンド - WCAGカバレッジマトリクス
- [x] 12.1 WCAGCoverageMatrixコンポーネントを実装
  - 全WCAG成功基準をテーブル形式で表示
  - 各基準のテスト状態と結果を表示
  - 検出に使用したツールを表示
  - 適合レベル別カバレッジ率のサマリーを表示
  - 「自動/半自動/手動」カテゴリを色分けして表示
  - CSVエクスポートボタンを表示
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 13. フロントエンド - エンジンサマリー表示
- [x] 13.1 エンジン別検出数サマリーコンポーネントを実装
  - 各エンジンの違反数・パス数を表示
  - 複数エンジンで検出された違反の統合表示
  - 検出元エンジンのリスト表示（例：「axe-core, IBM Equal Access」）
  - _Requirements: 1.4, 6.3, 6.5_

- [x] 13.2 WAVE構造情報表示を実装
  - WAVEの見出し階層情報を視覚的に表示
  - ランドマーク情報を表示
  - _Requirements: 4.3_

- [x] 14. 統合テスト
- [x] 14.1 新エンジン統合テストを作成
  - IBM Equal Access Checkerの単体テスト
  - Siteimprove Alfaの単体テスト
  - QualWebの単体テスト
  - WAVE APIのモックテスト
  - _Requirements: 1.1, 1.2, 1.3, 4.1_

- [x] 14.2 重複排除サービスのテストを作成
  - セレクタ正規化のテスト
  - WCAG基準一致判定のテスト
  - 類似度計算のテスト
  - 重要度採用ロジックのテスト
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 14.3 E2Eテストを作成
  - 分析オプションパネルの設定・保存テスト
  - 半自動チェックパネルの回答フローテスト
  - カバレッジマトリクスの表示・エクスポートテスト
  - 複数エンジン同時実行テスト
  - _Requirements: 5.1, 5.3, 7.1, 7.4, 8.1, 8.5_

- [x] 15. APIエンドポイント統合
- [x] 15.1 SSEハンドラーにオプションパラメータを追加
  - `AnalyzeFunction`型に`options`引数を追加
  - `parseOptionsFromQuery`関数を実装してクエリパラメータからオプションを取得
  - `createSSEHandler`内でオプションを取得してanalyzeFnに渡す
  - _Requirements: 1.5, 1.6, 2.1_

- [x] 15.2 APIエンドポイントで新分析関数を使用
  - `server/index.ts`で`analyzeUrlWithOptions`をインポート
  - `/api/analyze`エンドポイントでリクエストボディから`options`を受け取る
  - SSEハンドラーに渡す関数でオプションがある場合は`analyzeUrlWithOptions`を使用
  - 後方互換性を維持（オプションがない場合は既存の`analyzeUrl`を使用）
  - _Requirements: 1.5, 1.6, 2.1_

- [x] 15.3 フロントエンドAPIサービスにオプション送信を追加
  - `AnalyzeRequest`型に`options`フィールドを追加
  - `analyzeUrlWithSSE`でオプションをクエリパラメータに追加
  - `analyzeMultipleUrlsWithSSE`でも同様に対応
  - _Requirements: 8.1, 8.2_

- [x] 15.4 フロントエンドUIにAnalysisOptionsPanelを統合
  - App.tsxまたは該当コンポーネントに`AnalysisOptionsPanel`を配置
  - オプション状態を管理（useState）
  - 分析実行時にオプションをAPIリクエストに含める
  - localStorageからの設定復元を対応
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 16. 半自動チェック機能の統合
- [x] 16.1 analyzer.tsで半自動チェック項目を抽出
  - `semiAutoCheck`オプションが有効な場合に`SemiAutoCheckService`を呼び出す
  - `incomplete`結果から半自動確認項目を抽出
  - 抽出した項目をレポートに含める
  - _Requirements: 5.1, 5.2, 5.4_

- [x] 16.2 AccessibilityReport型に半自動チェック項目を追加
  - `semiAutoItems`フィールドを`AccessibilityReport`型に追加
  - 各ページ結果にも`semiAutoItems`を追加
  - _Requirements: 5.1, 5.6_

- [x] 16.3 フロントエンドにSemiAutoCheckPanelを統合
  - レポート表示画面に`SemiAutoCheckPanel`を配置
  - 半自動チェック項目がある場合のみ表示
  - 回答結果をAPIに送信する仕組みを実装
  - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6_

- [x] 17. レポート表示コンポーネントの統合
- [x] 17.1 WCAGCoverageMatrixをレポート画面に統合
  - レポート表示画面に`WCAGCoverageMatrix`を配置
  - 分析結果からカバレッジマトリクスを計算
  - CSVエクスポート機能を接続
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 17.2 EngineSummaryPanelをレポート画面に統合
  - レポート表示画面に`EngineSummaryPanel`を配置
  - 複数エンジンが有効な場合にエンジン別サマリーを表示
  - 複数エンジンで検出された違反の統合表示
  - _Requirements: 1.4, 6.3, 6.5_

- [x] 17.3 WaveStructurePanelをレポート画面に統合
  - WAVE APIが有効な場合に`WaveStructurePanel`を表示
  - 見出し階層とランドマーク情報を表示
  - _Requirements: 4.3_

