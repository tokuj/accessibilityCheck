# Requirements Document

## Project Description (Input)

レポート画面にAIとの対話機能を設けます。よくあるチャット画面ではなく、Figmaのコメントの様にレポートの各項目についてAIとディスカッションができるようにします。
つまり、ユーザーがこの項目ってどういうこと？と思ったときに質問ができる、どうすれば良い？に答えられる簡易的なチャット機能を実現します。
それらはFigmaのコメントの様にコンパクト化され、クリックすることで閲覧ができるようにします。

質問可能なポイントはAIレポートのそれぞれの結果・指標になります。つまり全ての結果、指標についてヒアリングを行えるようにします。

技術的な話は下記のサイトを参考にし、参照リンクを必ず貼ること。
[Ameba アクセシビリティガイドライン（Spindle）](https://a11y-guidelines.ameba.design/)

現在のAI機能と同様にGemini 2.0 Flashを使うこと。

## Introduction

本仕様は、アクセシビリティレポート画面に**インラインAI対話機能**を追加するものです。従来の全画面チャットUIではなく、Figmaのコメント機能のように、レポート内の各項目（スコア、違反、推奨事項など）に対してコンテキストに応じた質問・回答ができるコンパクトなUIを実現します。

### ハルシネーション防止戦略

AIの回答精度を高め、誤情報（ハルシネーション）を防ぐため、**Amebaアクセシビリティガイドライン（Spindle）**を参照元データとして使用します。各WCAG基準・ルールIDに対応するSpindleのページURLをマッピングし、AIプロンプトに含めることで、根拠のある回答を生成します。

### 対話可能なデータポイント（詳細）

レポート内のすべての個別結果・指標に対話ポイントを設置します：

1. **スコア関連**
   - 総合スコア（ScoreCard）
   - カテゴリ別スコア（WCAG基準別：各カテゴリ個別）
   - Lighthouseスコア（Performance, Accessibility, Best Practices, SEO：各項目個別）

2. **AI総評関連（ImprovementList）**
   - 全体評価（overallAssessment）
   - 影響度サマリーの各影響度（critical, serious, moderate, minor：各個別）
   - 優先改善ポイント（prioritizedImprovements：各項目個別）
   - 具体的な推奨事項（specificRecommendations：各項目個別）
   - 検出された問題と修正方法（detectedIssues：**各問題個別**）

3. **詳細結果関連（各行・各項目個別）**
   - 違反（ViolationsTable）：**各違反ルール個別**（例：color-contrast, image-alt など）
   - パス（PassesTable）：**各パスルール個別**
   - 要確認（IncompleteTable）：**各要確認ルール個別**
   - 各ルールのWCAG基準：**各WCAG基準個別**（例：1.4.3, 1.1.1 など）

## Requirements

### Requirement 1: インラインコメントUI

**Objective:** As a 開発者/QAエンジニア, I want レポート内の各項目に対してAIに質問できるインラインコメントUI, so that 各指標・結果の意味や対応方法を画面遷移なしにすぐに確認できる

#### Acceptance Criteria

1. When ユーザーがレポート内の対話可能な項目にマウスをホバーした場合, the フロントエンドシステム shall 吹き出しアイコン（コメントアイコン）を表示する
2. When ユーザーがコメントアイコンをクリックした場合, the フロントエンドシステム shall コンパクトなコメントポップオーバーを該当項目の近くに表示する
3. The コメントポップオーバー shall 質問入力フィールド、送信ボタン、閉じるボタンを含む
4. While コメントポップオーバーが開いている状態で, when ユーザーがポップオーバー外をクリックした場合, the フロントエンドシステム shall ポップオーバーを閉じる
5. When 既にAIとの対話履歴が存在する項目の場合, the フロントエンドシステム shall コメントアイコンにバッジ（対話数）を表示する
6. The コメントポップオーバー shall 最大幅400px、最大高さ500pxとし、内容がオーバーフローする場合はスクロール可能とする

### Requirement 2: コンテキスト付きAI対話

**Objective:** As a 開発者/QAエンジニア, I want 質問時に該当項目のコンテキスト（何についての質問か）がAIに自動的に伝わる, so that 質問内容を詳しく説明しなくても的確な回答が得られる

#### Acceptance Criteria

1. When ユーザーが質問を送信した場合, the フロントエンドシステム shall 質問対象の項目情報（項目タイプ、ルールID、WCAG基準、データ内容）を含めてバックエンドAPIに送信する
2. The バックエンドAPI shall 項目コンテキストと質問文を組み合わせたプロンプトをGemini 2.0 Flash APIに送信する
3. The Gemini APIプロンプト shall 該当項目に対応するSpindle（Amebaアクセシビリティガイドライン）の参照URLを含める
4. When AIが回答を生成した場合, the バックエンドAPI shall 回答テキストと参照元URLをフロントエンドに返却する
5. If Gemini API呼び出しがタイムアウトした場合（30秒）, then the バックエンドAPI shall タイムアウトエラーメッセージを返却する
6. If Gemini APIがレート制限エラーを返した場合, then the バックエンドAPI shall レート制限エラーメッセージと再試行までの待機時間を返却する

### Requirement 3: 対話履歴管理

**Objective:** As a 開発者/QAエンジニア, I want 同一レポートセッション内での対話履歴が保持される, so that 過去の質問・回答を参照しながら追加質問ができる

#### Acceptance Criteria

1. The フロントエンドシステム shall 各項目ごとの対話履歴（質問・回答ペア）をセッションストレージに保存する
2. When コメントポップオーバーを再度開いた場合, the フロントエンドシステム shall 過去の対話履歴を時系列順に表示する
3. The 対話履歴表示 shall ユーザーの質問とAIの回答を視覚的に区別できるスタイルで表示する
4. When ブラウザタブを閉じた場合, the 対話履歴 shall 削除される（永続化しない）
5. The 対話履歴 shall 各項目につき最大20件までとし、超過時は古い履歴から削除する

### Requirement 4: 対話可能ポイントの実装（詳細）

**Objective:** As a 開発者/QAエンジニア, I want レポート内のすべての個別結果・指標に対話ポイントが設置される, so that 気になる項目についてすぐに質問できる

#### Acceptance Criteria

1. The ScoreCardコンポーネント shall 総合スコアに対話ポイントを設置する
2. The ScoreCardコンポーネント shall 各カテゴリ別スコア（WCAG基準別）に**個別の**対話ポイントを設置する
3. The LighthouseScoresコンポーネント shall 各スコア行（Performance, Accessibility, Best Practices, SEO）に**個別の**対話ポイントを設置する
4. The ImprovementListコンポーネント shall 全体評価に対話ポイントを設置する
5. The ImprovementListコンポーネント shall 各優先改善ポイント項目に**個別の**対話ポイントを設置する
6. The ImprovementListコンポーネント shall 各具体的な推奨事項に**個別の**対話ポイントを設置する
7. The ImprovementListコンポーネント shall 各検出問題（detectedIssue）に**個別の**対話ポイントを設置する
8. The ViolationsTable shall 各違反行に**個別の**対話ポイントを設置し、ルールIDとWCAG基準をコンテキストとして渡す
9. The PassesTable shall 各パス行に**個別の**対話ポイントを設置する
10. The IncompleteTable shall 各要確認行に**個別の**対話ポイントを設置する
11. Where WCAG基準が表示される箇所（例：1.4.3, 1.1.1）, the システム shall 各WCAG基準に**個別の**対話ポイントを設置する
12. Where 対話ポイントが設置される項目, the システム shall aria-label属性で「この項目についてAIに質問する」という説明を付与する

### Requirement 5: ローディングとエラー状態

**Objective:** As a 開発者/QAエンジニア, I want AI回答の生成中やエラー発生時に適切なフィードバックが表示される, so that システムの状態を把握でき安心して利用できる

#### Acceptance Criteria

1. While AI回答を生成中の状態で, the コメントポップオーバー shall ローディングインジケーター（スピナー）とメッセージ「回答を生成中...」を表示する
2. While ローディング中, the 送信ボタン shall 無効化される
3. If API呼び出しがエラーを返した場合, then the コメントポップオーバー shall エラーメッセージと再試行ボタンを表示する
4. When ユーザーが再試行ボタンをクリックした場合, the フロントエンドシステム shall 同じ質問を再送信する
5. The エラーメッセージ shall ユーザーフレンドリーな日本語で表示する（技術的詳細は非表示）

### Requirement 6: アクセシビリティ対応

**Objective:** As a スクリーンリーダーユーザー, I want インラインコメント機能がキーボード操作とスクリーンリーダーで利用可能, so that 支援技術を使用していてもAI対話機能を利用できる

#### Acceptance Criteria

1. The コメントアイコン shall キーボードフォーカス可能で、Enterキーで開閉できる
2. When コメントポップオーバーが開いた場合, the フォーカス shall 質問入力フィールドに自動的に移動する
3. The コメントポップオーバー shall Escapeキーで閉じることができる
4. When コメントポップオーバーが閉じた場合, the フォーカス shall 元のコメントアイコンに戻る
5. The AI回答 shall aria-live="polite"属性を使用してスクリーンリーダーに通知する
6. The コメントポップオーバー shall role="dialog"とaria-modal="true"を設定する

### Requirement 7: バックエンドAPI

**Objective:** As a フロントエンド開発者, I want インライン対話用のAPIエンドポイントが提供される, so that フロントエンドからAI対話リクエストを送信できる

#### Acceptance Criteria

1. The バックエンドサーバー shall POST /api/chat エンドポイントを提供する
2. The リクエストボディ shall { context: { type: string, ruleId?: string, wcagCriteria?: string[], data: object }, question: string } 形式とする
3. The レスポンス shall { answer: string, referenceUrl?: string, generatedAt: string } 形式とする
4. If リクエストのcontextまたはquestionが欠落している場合, then the API shall 400 Bad Requestを返却する
5. The API shall 既存のGeminiService（server/services/gemini.ts）を再利用する
6. The APIリクエスト shall 既存の認証・セッション管理と統合する（認証が必要な場合）

### Requirement 8: Spindle参照データ管理（ハルシネーション防止）

**Objective:** As a システム, I want WCAG基準・ルールIDとSpindleガイドラインのマッピングデータを保持する, so that AIが根拠のある回答を生成できハルシネーションを防止できる

#### Acceptance Criteria

1. The バックエンドシステム shall WCAG基準（例：1.4.3, 1.1.1）とSpindleガイドラインURLのマッピングデータを保持する
2. The バックエンドシステム shall axe-core/pa11y/lighthouseのルールID（例：color-contrast, image-alt）とSpindleガイドラインURLのマッピングデータを保持する
3. The マッピングデータ shall JSONファイルまたはTypeScriptオブジェクトとして管理する
4. When 質問対象のルールIDまたはWCAG基準に対応するSpindleページが存在する場合, the システム shall そのURLをプロンプトに含める
5. When 対応するSpindleページが存在しない場合, the システム shall Spindleトップページ（https://a11y-guidelines.ameba.design/）を参照元として使用する
6. The AI回答 shall 参照したSpindleページへのリンクを含める

### Requirement 9: プロンプトエンジニアリング

**Objective:** As a システム, I want コンテキストに応じた適切なプロンプトが生成される, so that AIが的確で有用な回答を生成できる

#### Acceptance Criteria

1. The プロンプトビルダー shall 項目タイプ（スコア、違反、推奨事項など）に応じたプロンプトテンプレートを使用する
2. The プロンプト shall 回答を日本語で、300文字以内で簡潔に生成するよう指示する
3. The プロンプト shall アクセシビリティの専門家としてのペルソナを設定する
4. The プロンプト shall 「以下のSpindleガイドラインを参照元として回答してください」という指示とURLを含める
5. The プロンプト shall 「参照元に記載のない情報は推測せず、『詳細はガイドラインをご確認ください』と案内してください」という指示を含める
6. Where 違反項目への質問の場合, the プロンプト shall 該当ルールのSpindle解説ページURL、WCAG基準、具体的な修正例を含めるよう指示する
7. Where スコア項目への質問の場合, the プロンプト shall スコアの算出根拠と改善アドバイスを含めるよう指示する
8. Where WCAG基準への質問の場合, the プロンプト shall 該当WCAG基準のSpindle解説ページURLと達成基準の説明を含めるよう指示する
