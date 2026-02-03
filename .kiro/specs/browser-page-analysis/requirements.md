# Requirements Document

## Introduction

本機能は、ユーザーが既に開いているブラウザページのアクセシビリティ分析を可能にする機能である。現在のURL入力方式では対応が困難な以下のケースに対応する：

- URLが変わらないSPA（シングルページアプリケーション）
- 複雑な認証が必要なページ
- 多要素認証（MFA）後のページ
- 特定の操作後にのみ表示される状態

Chrome DevTools Protocol（CDP）を活用し、ユーザーがリモートデバッグモードで起動したChromeブラウザに接続することで、ログイン済みセッションやアプリケーションの特定状態を保持したままアクセシビリティ分析を実行できる。

## Requirements

### Requirement 1: CDP接続管理

**Objective:** As a ユーザー, I want ブラウザへのCDP接続を確立・管理できること, so that 既に開いているページに対してアクセシビリティ分析を実行できる

#### Acceptance Criteria

1. When ユーザーがCDP接続エンドポイント（例：`http://localhost:9222`）を指定して接続を要求したとき, the CDP Connection Manager shall リモートデバッグが有効なChromeブラウザへの接続を確立する
2. When CDP接続が確立されたとき, the CDP Connection Manager shall 接続中のブラウザで開いている全てのタブ（ページ）の一覧を取得して返却する
3. If CDP接続エンドポイントに到達できない場合, the CDP Connection Manager shall 「指定されたエンドポイントに接続できません。Chromeが`--remote-debugging-port`オプションで起動されているか確認してください」というエラーメッセージを表示する
4. If CDP接続がタイムアウトした場合（10秒以内に応答がない）, the CDP Connection Manager shall 接続タイムアウトエラーを返却する
5. When ユーザーが分析を完了して切断を要求したとき, the CDP Connection Manager shall CDP接続を切断し、ユーザーのChromeブラウザは引き続き動作を継続する

### Requirement 2: ページ選択

**Objective:** As a ユーザー, I want 接続中のブラウザから分析対象のページを選択できること, so that 複数タブの中から目的のページを分析できる

#### Acceptance Criteria

1. When CDP接続が確立されたとき, the Page Selector shall 各ページのタイトルとURLを含むタブ一覧をユーザーに表示する
2. When ユーザーがタブ一覧からページを選択したとき, the Page Selector shall 選択されたページを分析対象として設定する
3. While ページ一覧を表示中, the Page Selector shall 各ページのファビコン（取得可能な場合）を表示して視覚的な識別を支援する
4. When ユーザーが一覧の更新を要求したとき, the Page Selector shall 最新のタブ一覧を再取得して表示を更新する
5. If 接続中のブラウザにページが存在しない場合, the Page Selector shall 「分析対象のページがありません。ブラウザでページを開いてから再試行してください」というメッセージを表示する

### Requirement 3: ブラウザページ分析実行

**Objective:** As a ユーザー, I want 選択したページに対してアクセシビリティ分析を実行できること, so that 認証済みセッションやアプリケーション状態を保持したまま分析できる

#### Acceptance Criteria

1. When ユーザーが分析開始を要求したとき, the Browser Page Analyzer shall 選択されたページに対してaxe-core、Pa11y、Lighthouseによるマルチエンジン分析を実行する
2. While 分析を実行中, the Browser Page Analyzer shall 分析の進捗状況（現在実行中のエンジン名など）をユーザーに表示する
3. When 分析が完了したとき, the Browser Page Analyzer shall 既存のURL入力分析と同一形式のレポートを生成して表示する
4. The Browser Page Analyzer shall 分析実行時にページの現在の状態のスクリーンショットを取得してレポートに含める
5. If 分析対象ページがナビゲーションやリロードによって変更された場合, the Browser Page Analyzer shall 分析を中断し「ページが変更されました。再度ページを選択してください」というメッセージを表示する
6. When ユーザーがWCAGレベル（A、AA、AAA）を指定したとき, the Browser Page Analyzer shall 指定されたレベルに基づいて分析を実行する

### Requirement 4: ユーザーガイダンス

**Objective:** As a ユーザー, I want Chromeのリモートデバッグモードでの起動方法を理解できること, so that CDP接続機能を正しく利用できる

#### Acceptance Criteria

1. The User Guide shall Chromeをリモートデバッグモードで起動するためのコマンドをOS別（Windows、macOS、Linux）に提供する
2. The User Guide shall 一般的なポート番号（9222）を使用した起動例を表示する
3. When ユーザーがブラウザ分析モードを選択したとき, the User Guide shall CDP接続の前提条件と手順の概要を表示する
4. The User Guide shall リモートデバッグモードのセキュリティ上の注意事項（ローカル接続のみ推奨など）を明示する

### Requirement 5: UIモード切り替え

**Objective:** As a ユーザー, I want URL入力モードとブラウザ接続モードを切り替えられること, so that 状況に応じて適切な分析方法を選択できる

#### Acceptance Criteria

1. The Analysis Mode Selector shall 「URL入力」と「ブラウザ接続」の2つの分析モードをユーザーが選択できるUIを提供する
2. When ユーザーが「ブラウザ接続」モードを選択したとき, the Analysis Mode Selector shall CDP接続設定フォーム（エンドポイントURL入力欄）を表示する
3. When ユーザーが「URL入力」モードを選択したとき, the Analysis Mode Selector shall 従来のURL入力フォームを表示する
4. The Analysis Mode Selector shall デフォルトで「URL入力」モードを選択状態にする
5. While モード切り替え中, the Analysis Mode Selector shall 既存の分析結果をクリアするかどうかをユーザーに確認する

### Requirement 6: エラーハンドリングとリカバリー

**Objective:** As a ユーザー, I want CDP接続に関するエラーが発生した場合に適切なガイダンスを受けられること, so that 問題を自己解決できる

#### Acceptance Criteria

1. If Chromeがリモートデバッグモードで起動されていない場合, the Error Handler shall リモートデバッグモードでの起動手順へのリンクを含むエラーメッセージを表示する
2. If CDP接続が分析中に切断された場合, the Error Handler shall 「ブラウザとの接続が切断されました。再接続してください」というメッセージを表示し、再接続オプションを提供する
3. If 指定されたポートが既に他のプロセスで使用されている場合, the Error Handler shall 別のポート番号の使用を提案するメッセージを表示する
4. When エラーが発生したとき, the Error Handler shall エラーログを記録し、トラブルシューティング情報を提供する
5. If ユーザーのChromeブラウザがCDP接続をサポートしていないバージョンの場合, the Error Handler shall サポートされるChromeバージョン（Chromium系ブラウザ）の情報を表示する

### Requirement 7: セキュリティ考慮事項

**Objective:** As a システム管理者, I want CDP接続機能がセキュリティリスクを最小化すること, so that ユーザーのブラウザセッションが安全に保護される

#### Acceptance Criteria

1. The CDP Connection Manager shall デフォルトでローカルホスト（127.0.0.1 または localhost）へのCDP接続のみを許可する
2. If ユーザーがリモートホストへのCDP接続を試みた場合, the CDP Connection Manager shall セキュリティ警告を表示し、接続の確認を求める
3. The CDP Connection Manager shall CDP接続時にブラウザに保存されている認証情報やCookieにアクセスしない
4. The Browser Page Analyzer shall 分析完了後、注入したスクリプト（axe-coreなど）をページから削除する
5. The CDP Connection Manager shall 接続セッションのタイムアウト（30分の非アクティブ後に自動切断）を実装する

## Technical Research Notes

### CDP（Chrome DevTools Protocol）について

CDPはChromium系ブラウザのリモートデバッグプロトコルで、以下の特徴がある：

- JSON-over-WebSocketプロトコル
- Network、DOM、Runtime、Accessibilityなど複数のドメインを提供
- `--remote-debugging-port=9222`オプションでChromeを起動することで有効化

### Playwrightの CDP サポート

Playwrightは`chromium.connectOverCDP()`メソッドを提供し、既存のChromeブラウザへの接続をサポート：

```javascript
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const [context] = browser.contexts();
const [page] = context.pages();
```

接続後は通常のPlaywright APIが使用可能で、既存のaxe-core統合コードを再利用できる。

### 制約事項

- ユーザーがChromeをリモートデバッグモードで起動する必要がある（通常起動のChromeには後から接続不可）
- Chromium系ブラウザ（Chrome、Edge、Brave等）のみ対応
- Firefox、Safariは別プロトコル（対象外）
