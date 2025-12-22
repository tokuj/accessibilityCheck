# Implementation Plan

## Task 1: 型定義とエラー型の拡張

- [x] 1.1 GeminiError型にparse_errorを追加
  - エラー型に新しいparse_error種別を追加し、パースエラー時の詳細情報（位置、抜粋）を格納できるようにする
  - 既存の3種類（api_error, timeout, rate_limit）との一貫性を維持する
  - _Requirements: 4.4_

- [x] 1.2 (P) AISummary型にisFallbackフラグを追加
  - オプショナルなisFallbackプロパティを追加し、フォールバック生成であることを識別可能にする
  - 既存のAISummaryを使用するコードに影響を与えないようオプショナルとする
  - _Requirements: 3.4_

## Task 2: 定数定義の追加・変更

- [x] 2.1 maxOutputTokensを4096に増加
  - 既存のインラインリテラル（2048）を定数に置き換え、4096に設定する
  - 将来の変更に備えて定数名をMAX_OUTPUT_TOKENSとして定義する
  - _Requirements: 2.1, 2.2_

- [x] 2.2 (P) リトライ関連の定数を定義
  - RETRY_DELAY_MS（1000ミリ秒）とMAX_RETRIES（1回）の定数を追加する
  - 一時的なエラー時のリトライ制御に使用する
  - _Requirements: 4.2, 4.3_

## Task 3: JSONサニタイズ機能の実装

- [x] 3.1 sanitizeJsonResponse関数の実装
  - Gemini APIレスポンステキストに含まれる制御文字をエスケープする関数を実装する
  - Markdownバッククォート（```json ... ```）で囲まれている場合は除去する
  - 未エスケープの改行（\n）、タブ（\t）、復帰（\r）を適切なエスケープシーケンスに変換する
  - 有効なJSON構造を破壊しないよう、JSON文字列値内のみを処理対象とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

## Task 4: フォールバックAISummary生成機能の実装

- [x] 4.1 generateFallbackSummary関数の実装
  - パース失敗時に違反情報から基本的なAISummaryを生成する関数を実装する
  - 既存のcountByImpact関数を活用して影響度サマリーを計算する
  - 日本語で「検出された違反は〇件で...」形式の評価文を生成する
  - isFallback: trueを設定し、generatedAtに現在時刻を設定する
  - 違反が0件の場合も適切なメッセージを生成する
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 4.2 フォールバック発動時のログ出力
  - フォールバックが発動した際に警告ログを出力する
  - 元のパースエラーの詳細（エラーメッセージ、位置情報）も記録する
  - _Requirements: 3.3_

## Task 5: リトライ機構の実装

- [x] 5.1 リトライ対象エラーの判定ロジック
  - タイムアウト、ネットワークエラー、5xxエラーをリトライ対象として識別する
  - rate_limitエラーはリトライ対象外とする（Retry-Afterに従う）
  - 4xxエラーはリトライ対象外とする
  - _Requirements: 4.2, 4.4_

- [x] 5.2 generateAISummaryへのリトライ機構の組み込み
  - API呼び出し失敗時に1回のリトライを試みるロジックを追加する
  - リトライ前に1秒のバックオフ待機を行う
  - リトライ実行時に情報ログを出力する
  - リトライ後も失敗した場合は適切なエラーを返却する
  - _Requirements: 4.2, 4.3_

## Task 6: parseGeminiResponse関数の拡張

- [x] 6.1 サニタイズ処理の統合
  - JSON.parse実行前にsanitizeJsonResponseを呼び出すよう修正する
  - サニタイズ後もパース失敗した場合はフォールバック処理に進む
  - _Requirements: 1.1_

- [x] 6.2 パースエラー時の詳細ログ出力
  - パースエラー発生時にエラーの位置情報（行番号、列番号）を抽出する
  - 問題箇所周辺の文字列（最大100文字）を抜粋してログに出力する
  - parse_error型のエラー情報にposition、excerptを含める
  - _Requirements: 4.1_

- [x] 6.3 フォールバック生成の統合
  - パース失敗時にgenerateFallbackSummaryを呼び出してAISummaryを返却する
  - 成功応答としてフォールバックAISummaryを返す（エラーではなく値として返却）
  - _Requirements: 3.1_

## Task 7: 単体テストの追加

- [x] 7.1 (P) sanitizeJsonResponseのテスト
  - 未エスケープ改行を含む入力が正しくエスケープされることを検証する
  - 未エスケープタブを含む入力が正しくエスケープされることを検証する
  - 未エスケープバックスラッシュが二重バックスラッシュに変換されることを検証する
  - 有効なJSONを入力した場合に変更されないことを検証する
  - Markdownバッククォートで囲まれた入力からバッククォートが除去されることを検証する
  - _Requirements: 5.1_

- [x] 7.2 (P) generateFallbackSummaryのテスト
  - 違反あり入力で違反件数を含む評価文が生成されることを検証する
  - 違反なし入力で適切なメッセージが生成されることを検証する
  - isFallback: trueが設定されることを検証する
  - generatedAtが現在時刻に設定されることを検証する
  - _Requirements: 5.2_

- [x] 7.3 (P) リトライ機構のテスト
  - タイムアウトエラー発生時に1回リトライが実行されることを検証する
  - 5xxエラー発生時に1回リトライが実行されることを検証する
  - 4xxエラー発生時にリトライが実行されないことを検証する
  - rate_limitエラー発生時にリトライが実行されないことを検証する
  - リトライ間隔が1秒であることを検証する
  - _Requirements: 5.3_

- [x] 7.4 parseGeminiResponse拡張のテスト
  - 不正JSON入力時にフォールバックAISummaryが生成されることを検証する
  - parse_errorの詳細情報（position、excerpt）がログに記録されることを検証する
  - _Requirements: 5.1, 5.2_

## Task 8: 統合テストの追加

- [x] 8.1 正常系の一連フローテスト
  - Gemini API呼び出し → サニタイズ → パース → 成功の一連フローを検証する
  - モックを使用してAPI応答をシミュレートする
  - _Requirements: 5.4_

- [x] 8.2 フォールバック発動フローテスト
  - パース失敗 → フォールバック生成 → 成功応答の一連フローを検証する
  - フォールバックAISummaryが正しく返却されることを確認する
  - _Requirements: 5.4_

- [x] 8.3 リトライ成功フローテスト
  - タイムアウト → リトライ → 成功の一連フローを検証する
  - リトライ後に正常なAISummaryが返却されることを確認する
  - _Requirements: 5.4_
