# Requirements Document

## Introduction

本プロジェクトは、現在のa11y checkerのWCAGカバレッジを拡大することを目的としています。

### 現状分析

**現在のシステム構成:**
- axe-core（@axe-core/playwright）: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`タグで自動チェック
- Pa11y: HTML CodeSnifferベース、WCAG2AA標準
- Lighthouse: axe-coreベースのアクセシビリティ監査

**現在のカバレッジ限界:**
- axe-coreはWCAG 2.1 AAの約30%の成功基準（50項目中16項目）のみカバー
- WCAG 2.2の新基準は未対応
- 各ツールが検出できる項目に重複があり、網羅性が低い

### 拡張可能なツール一覧（調査結果）

**npm/ローカル実行可能なエンジン:**
1. **IBM Equal Access Checker** (`accessibility-checker`, `playwright-accessibility-checker`)
   - Apache-2.0ライセンス
   - WCAG 2.2対応済み（2.4.11/12 Focus Not Obscured、2.5.8 Target Size、3.3.8 Accessible Auth等）

2. **Siteimprove Alfa** (`@siteimprove/alfa-*`)
   - MITライセンス
   - 60+ ACT rules、2.4.13 Focus Appearance、3.2.6 Consistent Help対応

3. **QualWeb** (`@qualweb/core`, `@qualweb/act-rules`, `@qualweb/wcag-techniques`)
   - ISCライセンス
   - 110+ ACT rules、3.3.7 Redundant Entry、3.3.8 Accessible Auth対応

4. **HTML CodeSniffer** (`htmlcs`, `fast_htmlcs`)
   - BSD-3-Clause/MITライセンス
   - AAA rules（1.4.6 Contrast Enhanced、2.4.9 Link Purpose）、Section 508対応

5. **Testaro** (`testaro`)
   - 11エンジンを1つのPlaywrightセッションで実行可能なオーケストレーター

**SaaS API:**
1. **WAVE API** (WebAIM) - REST API、$0.025/URL
2. **Tenon.io** - REST API、`tenon-node` npmパッケージあり
3. **AChecker/ACHECKS** - REST API、無料枠あり

### 半自動化の定義

**許容される半自動化:**
- ツールがスクリーンショットや要素情報を表示
- ユーザーがツール画面上の選択肢（はい/いいえ、適切/不適切等）をクリックして回答
- 全ての操作がこのツール内で完結

**許容されない操作:**
- ユーザーがソースコードを確認する
- ユーザーがブラウザを別途操作して確認する
- ツール外での作業が必要な確認

## Requirements

### Requirement 1: 追加アクセシビリティエンジンの統合

**Objective:** アクセシビリティテスターとして、複数のエンジンを活用してWCAG検出率を向上させたい。

#### Acceptance Criteria

1. The a11y checker shall IBM Equal Access Checker（`accessibility-checker`）を第4のエンジンとして統合する
2. The a11y checker shall Siteimprove Alfa（`@siteimprove/alfa-playwright`）を第5のエンジンとして統合する
3. The a11y checker shall QualWeb（`@qualweb/core`）を第6のエンジンとして統合する
4. When 複数エンジンが同一の違反を検出した場合, the a11y checker shall 重複を排除し、検出元ツールをリストとして表示する
5. The a11y checker shall 各エンジンの有効/無効を個別に設定できるオプションを提供する
6. If いずれかのエンジンがエラーを返した場合, then the a11y checker shall エラーをログに記録し、他のエンジンでの分析を継続する

### Requirement 2: WCAG 2.2対応の拡張

**Objective:** アクセシビリティテスターとして、WCAG 2.2の新しい成功基準を自動チェックできるようにしたい。

#### Acceptance Criteria

1. When ユーザーがWCAG 2.2モードを有効にした場合, the a11y checker shall axe-coreの`wcag22a`, `wcag22aa`タグを有効化する
2. The a11y checker shall IBM Equal Access CheckerのWCAG 2.2ルールセットを使用して以下を検出する:
   - 2.4.11 Focus Not Obscured (Minimum)
   - 2.4.12 Focus Not Obscured (Enhanced)
   - 2.5.7 Dragging Movements
   - 2.5.8 Target Size (Minimum)
   - 3.3.7 Redundant Entry
   - 3.3.8 Accessible Authentication (Minimum)
3. The a11y checker shall Siteimprove Alfaを使用して2.4.13 Focus Appearance、3.2.6 Consistent Helpを検出する
4. If WCAG 2.2ルールが実験的ステータスの場合, then the a11y checker shall レポートに「実験的」ラベルを付与する

### Requirement 3: Playwrightによる拡張自動テスト

**Objective:** アクセシビリティテスターとして、axe-core単体では検出できない項目をPlaywrightで自動検出したい。

#### Acceptance Criteria

1. When 分析を実行した場合, the a11y checker shall Playwrightで以下のキーボードテストを自動実行する:
   - Tab順序の記録（全フォーカス可能要素のリスト生成）
   - キーボードトラップの検出（同一要素への循環を検知）
   - フォーカスインジケーターのCSS検証（outline/box-shadow/borderが有効か）
2. When 動的コンテンツを検出した場合, the a11y checker shall 各状態（開/閉）でaxe-coreスキャンを実行する:
   - モーダルダイアログ
   - ドロップダウンメニュー
   - アコーディオン
   - タブパネル
3. The a11y checker shall 複数ビューポート（モバイル: 375px、タブレット: 768px、デスクトップ: 1280px）でスキャンを実行するオプションを提供する
4. When 200%ズームでスキャンを実行した場合, the a11y checker shall 1.4.10 Reflowの違反を検出する
5. The a11y checker shall フォーカス状態のコントラスト比を計算し、3:1未満の場合に違反として報告する

### Requirement 4: WAVE API統合（オプション）

**Objective:** アクセシビリティテスターとして、WAVE APIを利用して追加の検証を行いたい。

#### Acceptance Criteria

1. Where ユーザーがWAVE APIキーを設定した場合, the a11y checker shall WAVE APIを使用した追加分析を実行する
2. The a11y checker shall WAVEの結果を他のエンジン結果と統合して表示する
3. The a11y checker shall WAVEの構造情報（見出し階層、ランドマーク）を視覚的に表示する
4. If WAVE APIがレート制限またはエラーを返した場合, then the a11y checker shall エラーを表示し、ローカルエンジンの結果のみを使用する
5. The a11y checker shall WAVE API呼び出し数をカウントし、ユーザーに表示する

### Requirement 5: 半自動チェック機能

**Objective:** アクセシビリティテスターとして、自動テストでは判定できない項目についてツール内で簡易確認したい。

#### Acceptance Criteria

1. When 分析が完了した場合, the a11y checker shall 半自動確認が可能な項目をリストアップする
2. The a11y checker shall 各半自動チェック項目について以下を表示する:
   - 該当要素のスクリーンショット
   - 要素のHTML抜粋
   - 確認すべき質問（例：「この画像のalt属性は内容を適切に説明していますか？」）
   - 選択肢（適切/不適切/判断不能）
3. When ユーザーが選択肢を選択した場合, the a11y checker shall 回答を記録し、レポートに反映する
4. The a11y checker shall 以下の項目について半自動チェックを提供する:
   - alt属性の適切性確認（画像とaltテキストを並べて表示）
   - リンクテキストの明確性確認（リンクテキストとリンク先URLを表示）
   - 見出しテキストの適切性確認（見出しとセクション内容の概要を表示）
   - フォーカス可視性の確認（フォーカス前後のスクリーンショットを並べて表示）
5. If ユーザーが「自動テストのみ」オプションを選択した場合, then the a11y checker shall 半自動チェックをスキップする
6. While 半自動チェックを実行中, the a11y checker shall 進捗状況（完了数/全体数）を表示する

### Requirement 6: 違反重複排除と統合レポート

**Objective:** アクセシビリティテスターとして、複数エンジンの結果を統合した見やすいレポートを得たい。

#### Acceptance Criteria

1. When 複数エンジンの分析が完了した場合, the a11y checker shall 同一要素・同一ルールの違反を重複排除する
2. The a11y checker shall 重複排除のロジックとして以下を使用する:
   - CSSセレクタの一致
   - WCAG成功基準の一致
   - 違反内容（description）の類似度
3. The a11y checker shall 統合された違反について、検出元エンジンをリスト表示する（例：「axe-core, IBM Equal Access」）
4. When 違反がツール間で異なる重要度を持つ場合, the a11y checker shall 最も高い重要度を採用する
5. The a11y checker shall エンジン別の検出数サマリーを表示する

### Requirement 7: WCAGカバレッジマトリクス

**Objective:** アクセシビリティテスターとして、どのWCAG成功基準がテストされたかを把握したい。

#### Acceptance Criteria

1. When 分析が完了した場合, the a11y checker shall WCAGカバレッジマトリクスを生成する
2. The a11y checker shall 以下の情報をマトリクスに含める:
   - 各WCAG成功基準（1.1.1〜4.1.3）
   - テスト状態（自動テスト済み/半自動確認済み/未テスト）
   - 結果（合格/違反/要確認/該当なし）
   - 検出に使用したツール
3. The a11y checker shall WCAG適合レベル（A/AA/AAA）ごとのカバレッジ率を計算して表示する
4. When レポートをエクスポートした場合, the a11y checker shall カバレッジマトリクスをCSV形式で出力できる
5. The a11y checker shall 「自動テストでカバー可能」「半自動確認が必要」「手動テストのみ」の3カテゴリを色分けして表示する

### Requirement 8: 分析オプション設定

**Objective:** アクセシビリティテスターとして、分析開始前にテスト範囲を設定したい。

#### Acceptance Criteria

1. When ユーザーが分析を開始しようとした場合, the a11y checker shall 分析オプション設定を表示する
2. The a11y checker shall 以下のオプションを提供する:
   - エンジン選択（axe-core, Pa11y, Lighthouse, IBM, Alfa, QualWeb）
   - WCAGバージョン選択（2.0 AA, 2.1 AA, 2.2 AA）
   - 半自動チェックの有効/無効
   - レスポンシブテストの有効/無効
   - WAVE API使用の有効/無効
3. The a11y checker shall 「クイック分析」プリセット（axe-core + Lighthouseのみ、半自動なし）を提供する
4. The a11y checker shall 「フル分析」プリセット（全エンジン、半自動あり、レスポンシブあり）を提供する
5. The a11y checker shall 前回の設定をlocalStorageに保存し、次回起動時に復元する

### Requirement 9: カスタムルールの追加

**Objective:** アクセシビリティテスターとして、標準ルールでは検出できない問題を追加ルールで検出したい。

#### Acceptance Criteria

1. The a11y checker shall axe-coreのカスタムルール機能を使用して追加ルールを実行する
2. The a11y checker shall 以下のカスタムルールをデフォルトで提供する:
   - 曖昧なリンクテキスト検出（「こちら」「詳細」「クリック」等のみのリンク）
   - 見出しレベルスキップ検出（h1→h3等）
   - 長すぎるalt属性検出（100文字以上）
   - 空のボタン/リンク検出（視覚的テキストなし）
3. When カスタムルールが違反を検出した場合, the a11y checker shall toolSourceを「custom」として報告する
4. The a11y checker shall カスタムルールの有効/無効を個別に設定できるオプションを提供する

### Requirement 10: ARIAライブリージョン検証

**Objective:** アクセシビリティテスターとして、動的更新の通知が正しく実装されているか確認したい。

#### Acceptance Criteria

1. When ページを分析した場合, the a11y checker shall 全てのaria-live属性を持つ要素を検出する
2. The a11y checker shall aria-live要素について以下を検証する:
   - role="alert"、role="status"、role="log"の適切な使用
   - aria-atomic属性の設定
   - aria-relevant属性の設定
3. When フォーム送信をシミュレートした場合, the a11y checker shall エラーメッセージがaria-liveリージョンに追加されるかを検証する
4. If aria-live要素が空の場合, then the a11y checker shall 警告として報告する
5. The a11y checker shall ライブリージョンの一覧をレポートに含める
