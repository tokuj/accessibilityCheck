# Implementation Plan

## Tasks

- [ ] 1. .gitignoreの設定修正
- [ ] 1.1 package-lock.jsonをバージョン管理対象に含める
  - `.gitignore`ファイルから`package-lock.json`の除外設定を削除する
  - 他の除外設定（node_modules、環境ファイルなど）には影響を与えないよう注意
  - 変更後、`git status`でpackage-lock.jsonが追跡対象になることを確認
  - _Requirements: 1.1, 1.3_

- [ ] 1.2 ルートおよびフロントエンドのpackage-lock.jsonをステージング
  - ルートディレクトリの`package-lock.json`をgitにステージング
  - `frontend/package-lock.json`もgitにステージング
  - 両ファイルが正しくステージングされていることを確認
  - _Requirements: 1.2, 5.1_

- [ ] 2. (P) 導入ドキュメントの作成
- [ ] 2.1 (P) GitHub Actions CIガイドドキュメントの作成
  - `docs/github-actions-ci-guide.md`を新規作成
  - 前提条件セクション：Node.js、npm、GitHub Actions環境について記載
  - セットアップ手順セクション：リポジトリでのワークフロー設定方法を記載
  - ワークフロー設定の説明セクション：トリガー（PR作成、main/masterへのpush）、ジョブ構成、各ステップの役割を解説
  - テスト結果の確認方法セクション：PRのステータスチェック、アーティファクトからのレポートダウンロード方法を記載
  - トラブルシューティングセクション：`npm ci`エラー、Playwrightブラウザインストールエラー、テスト失敗時の対応を記載
  - ベストプラクティスセクション：`package-lock.json`のコミット重要性、依存関係更新時の手順を記載
  - 日本語で記述
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.2, 5.3_

- [ ] 2.2 (P) ドキュメントインデックスの更新
  - `docs/README.md`のドキュメント一覧にGitHub Actions CIガイドを追加
  - 既存のテーブル形式に従って行を追加
  - _Requirements: 4.5_

- [ ] 3. 既存テスト構成の確認
- [ ] 3.1 アクセシビリティテストのWCAG準拠設定を確認
  - `tests/accessibility.spec.ts`がWCAG 2.0/2.1 Level A/AAタグ（wcag2a, wcag2aa, wcag21a, wcag21aa）を使用していることを確認
  - axe-coreによる違反検出時に詳細（違反ID、説明、影響度、ヘルプURL）が出力されることを確認
  - テストが複数ページを対象としていることを確認
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3.2 GitHub Actionsワークフロー設定を確認
  - `.github/workflows/playwright.yml`がPR作成・更新時およびmain/masterへのpush時にトリガーされることを確認
  - テスト失敗時にGitHubステータスに反映されることを確認（GitHub Actionsのデフォルト動作）
  - テストレポートがアーティファクトとして30日間保持される設定を確認
  - `tests/accessibility.spec.ts`が実行対象に含まれることを確認
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.4_

- [ ] 4. 統合検証
- [ ] 4.1 ローカル環境での動作確認
  - `.gitignore`変更後、`package-lock.json`が追跡対象になることを確認
  - `npm ci`がローカルで正常に動作することを確認
  - Playwrightテストがローカルで実行できることを確認
  - _Requirements: 1.2, 5.1_

- [ ] 4.2 変更内容のコミットとPR作成
  - `.gitignore`の変更、`package-lock.json`の追加、ドキュメントの追加をコミット
  - PRを作成してGitHub Actionsが起動することを確認
  - ワークフローが正常に完了（または既知の理由で失敗）することを確認
  - アーティファクトからテストレポートをダウンロードして内容を確認
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4_

## Requirements Coverage

| Requirement | Task(s) |
|-------------|---------|
| 1.1 | 1.1 |
| 1.2 | 1.2, 4.1, 4.2 |
| 1.3 | 1.1 |
| 2.1 | 3.2, 4.2 |
| 2.2 | 3.2, 4.2 |
| 2.3 | 3.2, 4.2 |
| 2.4 | 3.2, 4.2 |
| 3.1 | 3.1 |
| 3.2 | 3.1 |
| 3.3 | 3.1 |
| 3.4 | 3.2 |
| 4.1 | 2.1 |
| 4.2 | 2.1 |
| 4.3 | 2.1 |
| 4.4 | 2.1 |
| 4.5 | 2.1, 2.2 |
| 5.1 | 1.2, 4.1 |
| 5.2 | 2.1 |
| 5.3 | 2.1 |

