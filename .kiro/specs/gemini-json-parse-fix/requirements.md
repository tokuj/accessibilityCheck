# Requirements Document

## Introduction

本仕様書は、Gemini APIからのJSONレスポンスパースエラーを修正するための要件を定義する。Cloud Runログに記録された`SyntaxError: Unterminated string in JSON`エラーは、Gemini APIがコード例を含むJSON応答を生成する際に、特殊文字（引用符、バックスラッシュ、改行等）がエスケープ不足でJSONを破損させることに起因する。本修正により、GeminiServiceの堅牢性を向上させ、パース失敗時にも適切なフォールバック処理を提供する。

## Project Description (Input)

Cloud Runログに以下のエラーが表示されています：

Gemini: レスポンスのパースに失敗: SyntaxError: Unterminated string in JSON at position 5035 (line 48 column 154)

原因: Gemini APIがJSON形式で応答していますが、コード例に含まれる特殊文字（引用符やバックスラッシュなど）によりJSONが不正になっています。

修正方法:

1. JSONパース前にクリーンアップ処理を追加
2. maxOutputTokensを増やす（現在2048 → 4096）
3. パース失敗時のフォールバック処理を追加

## Requirements

### Requirement 1: JSONレスポンスの前処理（サニタイズ）

**Objective:** As a バックエンドシステム, I want Gemini APIからのJSONレスポンスをパース前にサニタイズする機能, so that コード例に含まれる特殊文字によるパースエラーを防止できる

#### Acceptance Criteria

1. When Gemini APIからJSONレスポンスを受信した場合, the GeminiService shall JSONパース前にレスポンステキストのサニタイズ処理を実行する
2. When レスポンス内のJSON文字列値に未エスケープの制御文字（改行、タブ等）が含まれる場合, the サニタイズ処理 shall 適切にエスケープシーケンスに変換する
3. When レスポンス内のJSON文字列値にエスケープされていないバックスラッシュが含まれる場合, the サニタイズ処理 shall 二重バックスラッシュに変換する
4. The サニタイズ処理 shall 有効なJSONの構造を破壊しない

### Requirement 2: maxOutputTokensの増加

**Objective:** As a バックエンドシステム, I want Gemini APIへのリクエストでmaxOutputTokensを増加させる設定, so that JSONレスポンスが途中で切れることを防止できる

#### Acceptance Criteria

1. When Gemini APIにリクエストを送信する場合, the GeminiService shall maxOutputTokensを4096に設定する
2. If 将来的にトークン数の調整が必要になった場合, the maxOutputTokens shall 定数として定義され容易に変更可能であること

### Requirement 3: パース失敗時のフォールバック処理

**Objective:** As a ユーザー, I want JSONパースが失敗した場合でも基本的な結果を受け取れる仕組み, so that システムが完全に停止せず最低限の情報を得られる

#### Acceptance Criteria

1. If JSONパースが失敗した場合, the GeminiService shall フォールバック用のデフォルトAISummaryを生成する
2. When フォールバックが発動した場合, the フォールバックAISummary shall 違反件数と影響度サマリーを元にした基本的な評価文を含む
3. When フォールバックが発動した場合, the GeminiService shall ログに警告メッセージと元のエラー詳細を記録する
4. If フォールバックが発動した場合, the フォールバックAISummary shall `generatedAt`フィールドに現在時刻を設定し、フォールバックであることを示すフラグまたはメッセージを含む

### Requirement 4: エラー処理の強化

**Objective:** As a 運用担当者, I want 詳細なエラーログとリトライ機構, so that 問題発生時に迅速に原因を特定し対処できる

#### Acceptance Criteria

1. When JSONパースエラーが発生した場合, the GeminiService shall エラーの位置情報（行番号、列番号）と問題の文字列の一部をログに出力する
2. If 一時的なエラー（タイムアウト、ネットワークエラー）が発生した場合, the GeminiService shall 最大1回のリトライを試みる
3. While リトライを実行中, the GeminiService shall 指数バックオフ（最小1秒）を適用する
4. The GeminiService shall すべてのエラーケースで適切なGeminiError型を返却する

### Requirement 5: テスタビリティの確保

**Objective:** As a 開発者, I want 新しい機能が十分にテストされていること, so that 本番環境での予期せぬ動作を防止できる

#### Acceptance Criteria

1. The サニタイズ処理 shall 単体テストで以下のケースを検証する：未エスケープの改行、タブ、バックスラッシュ、引用符を含む入力
2. The フォールバック処理 shall 単体テストでパース失敗時のデフォルト値生成を検証する
3. The リトライ機構 shall 単体テストでリトライ回数とバックオフ間隔を検証する
4. When すべてのテストが実行された場合, the テストカバレッジ shall 新規追加コードに対して80%以上を維持する
