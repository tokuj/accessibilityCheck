# Requirements Document

## Introduction

本仕様書は、アクセシビリティレポートの品質向上を目的とした改善要件を定義する。現在のレポートには以下の課題がある：

1. **指摘箇所の不明確さ**: 違反が検出されても、具体的にどのHTML要素が問題なのかがわからない
2. **WCAG基準の分散**: 各ツール（axe-core、Pa11y、Lighthouse）が個別にWCAG違反を報告するため、同じWCAG項番に対する対応が重複・分散している
3. **Lighthouse「不明」項目の多さ**: Lighthouseのスコアが`null`または中間値の場合にincomplete扱いとなり、多くの項目が「不明」に分類されている
4. **タブ間の構造不一致**: 違反タブにはWCAGごとのAI対話ボタンがあるが、不明・達成タブにはない

これらの課題を解決し、ユーザーが効率的にアクセシビリティ改善を行えるレポートを提供する。

## Requirements

### Requirement 1: 指摘箇所の具体的な特定

**Objective:** As a 開発者, I want 違反箇所の具体的なHTML要素情報（セレクタ、HTML抜粋）をレポートで確認したい, so that どの要素を修正すべきか一目でわかる

#### Acceptance Criteria

1. When ユーザーが違反テーブルの行を展開する, the レポートUI shall その違反に該当する全ノードのCSSセレクタをリスト表示する
2. When ユーザーが特定のノードを選択する, the レポートUI shall そのノードのHTML抜粋（最大200文字）を表示する
3. The バックエンドAPI shall 各違反に対してaxe-coreから取得したノード情報（target配列、html属性）を返却する
4. When ノード数が10を超える場合, the レポートUI shall 最初の10件を表示し「さらに表示」ボタンで残りを展開可能にする
5. The レポートUI shall 不明タブ・達成タブでも同様にノード情報を表示する

### Requirement 2: WCAG基準でのアグリゲートレポート

**Objective:** As a アクセシビリティ担当者, I want 各WCAG項番ごとに全ツールの指摘を集約した一覧を確認したい, so that どのWCAG基準への対応が必要かを効率的に把握できる

#### Background

WCAG準拠レポートを作成する際、「どのWCAG基準に何件の違反があるか」を把握する必要がある。各ツール（axe-core、Pa11y、Lighthouse）が個別に報告するため、同じWCAG項番に対する指摘が分散している。これを集約することで、対応優先度の判断が容易になる。

#### Acceptance Criteria

1. The AI総評セクション shall WCAG項番別サマリーセクションを含む
2. When WCAG項番別サマリーを表示する, the レポートUI shall 各WCAG項番に対してaxe-core、Pa11y、Lighthouseそれぞれの検出件数を表示する
3. The WCAG項番別サマリー shall 違反件数の多い順にソートして表示する
4. When ユーザーがWCAG項番をクリックする, the レポートUI shall その項番に関連する全違反を違反テーブルで絞り込み表示する（特定のWCAG基準に集中して対応するため）
5. The WCAG項番別サマリー shall 各項番のWCAGレベル（A、AA、AAA）を表示する
6. The バックエンドAPI shall 全ツールの結果をWCAG項番でグルーピングした集約データを返却する

### Requirement 3: Lighthouse「不明」項目の削減

**Objective:** As a 開発者, I want Lighthouseの結果がより明確に分類されることを望む, so that 曖昧な「不明」項目が減り、対応すべき違反と対応済みの達成が明確になる

#### Acceptance Criteria

1. When Lighthouseのauditスコアが`null`の場合, the Lighthouseアナライザー shall 該当auditが「適用外」（notApplicable）かどうかを判定し、適用外の場合はレポートから除外する
2. When Lighthouseのauditスコアが0より大きく1未満の場合, the Lighthouseアナライザー shall スコアが0.5未満なら違反、0.5以上なら達成として分類する
3. The Lighthouseアナライザー shall 各auditの`scoreDisplayMode`を確認し、`notApplicable`の場合はレポートから除外する
4. When 「不明」として分類される項目がある場合, the レポートUI shall その理由（手動確認が必要、情報不足等）を表示する
5. The バックエンドAPI shall Lighthouseの生スコアと分類理由をレスポンスに含める

### Requirement 4: タブ間の構造統一

**Objective:** As a ユーザー, I want 違反・達成・不明の各タブで同じ機能が利用できることを望む, so that タブを切り替えても一貫した操作体験が得られる

#### Acceptance Criteria

1. The 不明タブ shall 違反タブと同様にWCAG項番ごとにAI対話ボタンを表示する
2. The 達成タブ shall 違反タブと同様にWCAG項番ごとにAI対話ボタンを表示する
3. The 全タブ shall 同一のテーブルカラム構成（ツール、ページ、ルールID、説明、影響度、ノード数、WCAG項番、詳細、AI）を持つ
4. When 達成タブに影響度がない項目がある場合, the 達成タブ shall 影響度カラムを「-」または空欄で表示する
5. The 全タブ shall ノード情報の展開表示機能を持つ（Requirement 1と連動）

### Requirement 5: 非機能要件

**Objective:** As a システム管理者, I want レポート改善がパフォーマンスやUXを損なわないことを確認したい, so that 既存ユーザーの体験が維持される

#### Acceptance Criteria

1. The レポートUI shall ノード情報の展開時に100ms以内でレンダリングを完了する
2. The バックエンドAPI shall ノード情報を含むレスポンスでも現行の応答時間（+10%以内）を維持する
3. While ノード情報が大量（100件以上）にある場合, the レポートUI shall 仮想スクロールまたはページネーションを適用する
4. The レポートUI shall モバイルデバイス（幅768px以下）でも全機能が利用可能である
5. If ノード情報の取得に失敗した場合, the レポートUI shall エラーメッセージを表示し、他の機能には影響を与えない

### Requirement 6: 問題箇所の視覚的特定

**Objective:** As a 開発者, I want 検出された問題がページ上のどこで発生しているかを視覚的に確認したい, so that ソースコードのどこを修正すべきか一目でわかる

#### Background

現状のCSSセレクタとHTML抜粋だけでは、開発者が実際にどの要素を修正すべきかを特定するのに時間がかかる。以下の情報が不足している：
- ページ上での問題箇所の視覚的な位置
- 問題要素のDOM上での正確な位置（XPath等）
- 問題要素の周辺コンテキスト
- スクリーンショット上でのマーキング

Playwrightとaxe-coreは以下の情報を返却可能であり、これらを活用する：
- **axe-core**: `nodes[].target`（CSSセレクタ配列）、`nodes[].html`（HTML抜粋）、`nodes[].any/all/none`（チェック結果詳細）
- **Playwright**: `element.boundingBox()`（要素の位置情報）、`page.screenshot()`（スクリーンショット）

#### Acceptance Criteria

1. The バックエンドAPI shall 各ノードのバウンディングボックス情報（x, y, width, height）を返却する
2. When ユーザーがノード情報を展開する, the レポートUI shall スクリーンショット上で問題箇所を赤枠でハイライト表示する
3. When 複数のノードがある場合, the レポートUI shall 各ノードに番号を振り、スクリーンショット上で対応する位置を番号付きマーカーで示す
4. The レポートUI shall CSSセレクタに加えてXPathも表示し、ワンクリックでコピー可能にする
5. When ユーザーがノードをクリックする, the レポートUI shall そのノードの周辺HTML（親要素と兄弟要素を含む）をコンテキストとして表示する
6. The レポートUI shall axe-coreの`failureSummary`を「修正方法」として具体的に表示する
7. If 要素がビューポート外または非表示の場合, the レポートUI shall その旨を明示し、CSSセレクタでの特定を促す

### Requirement 7: 問題箇所表示の改善

**Objective:** As a 日本語ユーザー, I want 問題箇所の情報が日本語で分かりやすく表示されることを望む, so that 複雑なCSSセレクタや英語のエラーメッセージを解読する手間なく、修正すべき箇所を特定できる

#### Background

現状のノード情報表示には以下の課題がある：
- **CSSセレクタの複雑さ**: Tailwindのユーティリティクラスや属性セレクタが混在し、開発者でも要素の特定が困難
  - 例: `.md\:max-w-\[max\(273px\,calc\(33\.3\%_-\(24px\*2\/3\)\)\)\][data-enter-time="200"]:nth-child(3)`
- **修正方法が英語**: axe-coreの`failureSummary`が英語で技術的な表現のため、日本語ユーザーには理解しにくい
  - 例: `Fix all of the following: Element is in tab order and does not have accessible text`
- **位置情報の欠如**: 要素がページ内のどこにあるか視覚的に不明

これらを解決し、直感的に問題箇所を特定できるようにする。

#### Acceptance Criteria

1. The axe-coreアナライザー shall 日本語ロケールを使用し、failureSummary・description・helpを日本語で出力する
2. The バックエンドAPI shall 各ノードに対して人間が読める要素説明（例：「リンク『詳細はこちら...』」）を生成して返却する
3. The レポートUI shall 要素説明をCSSセレクタより優先して大きく表示し、CSSセレクタは折りたたみ表示にする
4. When ユーザーが違反テーブルの行を展開する, the レポートUI shall スクリーンショットをHighlightedScreenshotコンポーネントで表示し、問題箇所をハイライトする
5. When ユーザーがスクリーンショット上のハイライトをクリックする, the レポートUI shall 対応するノード情報を選択状態にし、ノードリストでもハイライトする
6. The レポートUI shall 各ノードの位置情報（ページ上部・中央・下部、左・中央・右）をバッジで表示する
7. The 要素説明 shall タグ名を日本語ラベル（a→リンク、img→画像、button→ボタン等）で表示し、要素のテキスト内容を抽出して含める
