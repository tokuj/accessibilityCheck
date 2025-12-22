# Requirements Document

## Introduction

本仕様は、アクセシビリティチェッカーを拡張し、1回の分析で最大4つのURLを同時に入力・分析できる機能を定義する。現状は1つのURLのみ対応しているため、複数ページを持つWebサイトの一括分析が非効率である。この機能により、ユーザーは同一ドメイン内の複数ページを効率的にアクセシビリティ分析できるようになる。

## Project Description (Input)

今はURLを1回の分析で1つのURLしか分析ができません。これは非効率なので最大４つまでURLを受け付けるようにします。

URLをのインプットはdocs/img/multipulurl.pngを参考にしてください。ポイントはURLを入力したらツールチップ化して同一のインタフェースから追加できるようになります。最大４つだとひと目でわかるようにします。（＋や本アイコンはノイズなので無視してください）

レポート結果画面はページタイトルが書かれたタブで切り替えられるようにします。

認証情報はすべてのサイトで使われます。そのため、複数ページの入力が同一ドメインじゃない場合はエラー出します。

分析中画面ではURLとページタイトルを記載しどのページの分析をしているかを把握できるようにします。

分析中画面は横幅が分析ステータスで変わらないようにもう少し広くし、固定してください。

## Requirements

### Requirement 1: 複数URL入力機能

**Objective:** ユーザーとして、同一ドメインの複数ページを1回の操作で分析したいので、複数URLを入力できる機能が必要です。

#### Acceptance Criteria

1. When ユーザーがURLを入力してEnterを押すかURL入力を確定する, the UrlInput shall URLをチップ形式のタグに変換して入力欄内に表示する
2. When URLがチップとして追加された後, the UrlInput shall 入力欄をクリアし、次のURL入力を受け付け可能にする
3. The UrlInput shall 最大4つのURLまで追加を許可する
4. When 4つのURLが既に追加されている, the UrlInput shall 新規URL入力を無効化する
5. The UrlInput shall 現在の入力済みURL数と最大数を「n/4」形式のカウンターで表示する
6. When ユーザーがチップのバツアイコンをクリック, the UrlInput shall 対象のURLをリストから削除する
7. When URLが1つも登録されていない場合, the UrlInput shall プレースホルダーテキストを表示する

### Requirement 2: ドメイン検証機能

**Objective:** ユーザーとして、認証情報の適用範囲を明確にしたいので、異なるドメインのURLを入力した際にエラー通知が必要です。

#### Acceptance Criteria

1. When 2つ目以降のURLが追加される, the UrlInput shall 既存URLとのドメイン一致を検証する
2. If 追加されるURLのドメインが既存URLのドメインと異なる場合, the UrlInput shall エラーメッセージを表示してURLの追加を拒否する
3. The UrlInput shall ドメインとしてホスト名（サブドメインを含む完全なホスト名）を使用する
4. When 全てのチップが削除された状態, the UrlInput shall 任意のドメインのURLを受け入れ可能にする

### Requirement 3: 分析中画面の改善

**Objective:** ユーザーとして、複数ページ分析時に進捗状況を把握したいので、現在分析中のページを明確に表示する必要があります。

#### Acceptance Criteria

1. The AnalysisProgress shall 現在分析中のURLとページタイトルを表示する
2. When 複数URLの分析実行時, the AnalysisProgress shall 全体の進捗（例: ページ2/4）と各ページ内の進捗を表示する
3. The AnalysisProgress shall 固定幅（最小幅600px）を維持し、ステータステキストの変化で幅が変動しないようにする
4. When 各ページの分析が完了, the AnalysisProgress shall 完了したページと残りのページ数を視覚的に区別する

### Requirement 4: レポート結果画面のタブ切り替え

**Objective:** ユーザーとして、複数ページの分析結果を簡単に比較・確認したいので、タブによる結果切り替えが必要です。

#### Acceptance Criteria

1. When 複数URLの分析が完了, the ReportSummary shall 各ページの結果をタブ形式で表示する
2. The ReportSummary shall タブラベルにページタイトルを表示する
3. If ページタイトルが長い場合, the ReportSummary shall タイトルを省略表示（ellipsis）する
4. When ユーザーがタブをクリック, the ReportSummary shall 対応するページの分析結果に切り替える
5. The ReportSummary shall 各タブに違反数のバッジを表示して、問題の多いページを識別しやすくする
6. When 単一URLの分析の場合, the ReportSummary shall タブ表示なしで従来どおりの単一レポート形式を維持する

### Requirement 5: バックエンドAPI対応

**Objective:** システムとして、複数URLの分析リクエストを効率的に処理できるよう、APIを拡張する必要があります。

#### Acceptance Criteria

1. The API shall 配列形式で複数URLを受け付けるエンドポイントを提供する
2. When 複数URLがリクエストされた場合, the API shall 各URLを順番に分析し、進捗をSSEで通知する
3. The API shall 各URLの分析結果を配列としてレスポンスに含める
4. The API shall 認証情報を全てのURL分析に共通で適用する
5. If いずれかのURLの分析が失敗した場合, the API shall 他のURLの分析を継続し、失敗したURLについてはエラー情報を含める
6. The API shall 各ページのタイトルを取得してレスポンスに含める

### Requirement 6: 状態管理とデータ構造

**Objective:** システムとして、複数レポートを管理するための状態構造を持つ必要があります。

#### Acceptance Criteria

1. The App shall 複数のAccessibilityReportを配列として管理する状態を持つ
2. The App shall 各レポートに対応するURL情報とページタイトルを保持する
3. When 分析が開始される, the App shall 入力されたURLリストを保存し、分析状態を初期化する
4. The App shall 現在アクティブなレポート（表示中のタブ）のインデックスを管理する

## Non-Functional Requirements

### パフォーマンス

- 4URLの順次分析において、1URLあたりの分析時間は単独分析時と同等であること
- ログ表示は最大1000エントリまでメモリ効率を維持する（既存実装を継続）

### ユーザビリティ

- チップ化UIはワンクリックで削除可能であること
- カウンター表示により残りの追加可能数が一目でわかること
- タブ切り替えは即座に反応すること

### 互換性

- 単一URL入力時の既存ワークフローを維持すること
- 既存の認証設定機能との連携を保つこと
