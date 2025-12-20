# Requirements Document

## Introduction
本仕様書は、アクセシビリティチェックツールのレポート画面におけるユーザビリティ向上のための要件を定義する。対象機能は、レイアウト改善、CSVエクスポート機能、AI総評の改善、分析中のリアルタイムログ表示の4つである。

## Project Description (Input)
微調整の依頼です。下記の修正をお願いします。
1.レポート画面の横幅を広くし、詳細結果で横スクロールがいらないようにしてください。
2.詳細結果をcsvでダウンロードしたいです。ダウンロードボタンを追加してcsvダウンロードできるようにしてください。
3.AI総評をもう少し詳しく記述したいです。今はこれどうやって出していますか？AIのAPIキーはないはずですが…
もし実際にはAI総評が機能していないのであればGemini 3 Flashを使ってください。GCPのSecret ManagerにAPIキーが保存されています。
https://console.cloud.google.com/security/secret-manager/secret/google_api_key_toku/versions?project=itgproto

4.分析中にPlaywrightが吐き出すログを確認して今どんなステータスかわかるようにしてください。Playwrightは下記の様なログを吐くはずです。
Running 135 tests using 1 worker

========================================
[トップページ] アクセシビリティ違反検出
URL: https://www.intage.co.jp/
========================================

1. color-contrast
   説明: Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds
   影響度: serious
   対象要素数: 1
   ヘルプ: https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright

2. link-name
   説明: Ensure links have discernible text
   影響度: serious
   対象要素数: 1
   ヘルプ: https://dequeuniversity.com/rules/axe/4.11/link-name?application=playwright

## Requirements

### Requirement 1: レポート画面レイアウトの最適化
**Objective:** ユーザーとして、レポート画面の詳細結果を横スクロールなしで確認したい。効率的に情報を閲覧できるようにするため。

#### Acceptance Criteria
1. The レポート画面 shall 横幅を最大化し、コンテナ幅をフルワイドまたは十分な幅に拡張する
2. When 詳細結果テーブルを表示する際、the ViolationsTable shall 横スクロールが不要なレイアウトで全カラムを表示する
3. The レスポンシブデザイン shall タブレット・デスクトップ環境で横スクロールなしに詳細情報を表示する
4. If 画面幅が狭い場合、then the レポート画面 shall 適切なレスポンシブ対応で可読性を維持する

---

### Requirement 2: CSVダウンロード機能
**Objective:** ユーザーとして、詳細結果をCSV形式でダウンロードしたい。外部ツールでの分析や報告書作成に活用するため。

#### Acceptance Criteria
1. When レポート画面を表示している際、the ViolationsTable shall CSVダウンロードボタンを表示する
2. When ユーザーがCSVダウンロードボタンをクリックした際、the システム shall 詳細結果をCSV形式でダウンロードさせる
3. The CSVファイル shall 以下の情報を含む：ルール名、説明、影響度、対象要素数、URL、ヘルプリンク
4. The CSVファイル shall UTF-8 BOM付きでエンコードし、Excel等での文字化けを防止する
5. The ファイル名 shall 分析対象URLと日時を含む形式とする（例：`accessibility-report_example-com_2025-12-20.csv`）

---

### Requirement 3: AI総評機能の改善（Gemini Flash統合）
**Objective:** ユーザーとして、AI による詳細な総評を確認したい。改善点の優先順位や具体的なアドバイスを得るため。

#### 現状分析
現在の実装（`scoreCalculator.ts`の`generateSummary()`）はルールベースの4段階テンプレート総評であり、実際のAIは使用していない。

#### Acceptance Criteria
1. The バックエンド shall GCP Secret Managerから`google_api_key_toku`を取得し、[Gemini3 Flash](https://aistudio.google.com/?model=gemini-3-flash-preview&hl=ja) APIを利用する
2. When 分析結果が生成された際、the システム shall Gemini Flashに違反情報を送信し、AI総評を生成する
3. The AI総評 shall 以下の内容を含む：
   - 全体的なアクセシビリティ状況の評価
   - 最も重要な改善ポイント（優先度順）
   - 具体的な改善提案
   - 影響度別の問題数サマリー
4. If API呼び出しが失敗した場合、then the システム shall 既存のルールベース総評をフォールバックとして表示する
5. The AI総評 shall 日本語で生成される
6. While AI総評を生成中、the UI shall ローディング状態を表示する

---

### Requirement 4: 分析中のリアルタイムログ表示
**Objective:** ユーザーとして、分析中にPlaywrightのログを確認したい。現在の分析状況と進捗を把握するため。

#### Acceptance Criteria
1. When 分析を開始した際、the フロントエンド shall リアルタイムログ表示エリアを表示する
2. While 分析実行中、the バックエンド shall Playwrightの標準出力をWebSocket/SSEでフロントエンドにストリーミングする
3. The ログ表示 shall 以下のPlaywright出力をパースして表示する：
   - テスト実行数・ワーカー数（例：`Running 135 tests using 1 worker`）
   - 現在分析中のページ名とURL
   - 検出された違反ルール名と影響度
4. The ログ表示エリア shall 自動スクロールで最新ログを表示する
5. When 分析が完了した際、the ログ表示 shall 完了メッセージを表示し、結果画面へ遷移する
6. If 分析中にエラーが発生した場合、then the ログ表示 shall エラー内容を赤色でハイライト表示する

---

## Non-Functional Requirements

### パフォーマンス
- AI総評の生成は5秒以内を目標とする
- ログストリーミングの遅延は500ms以内を目標とする

### セキュリティ
- GCP Secret Manager のAPIキーは環境変数経由でのみ参照し、クライアントサイドには露出させない
- Gemini API呼び出しはサーバーサイドで実行する

### 互換性
- CSVはExcel、Google Spreadsheet、Numbers等で正常に開けること
- ログ表示はChrome、Firefox、Safariの最新版で動作すること
