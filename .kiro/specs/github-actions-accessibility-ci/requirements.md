# Requirements Document

## Introduction
GitHub ActionsのCI/CDパイプラインが`npm ci`コマンドの実行時に失敗している問題を修正し、フロントエンドのアクセシビリティチェックをGitHub Actionsで自動実行できるようにする。また、他の開発者が導入・運用できるよう、導入ドキュメントを作成する。

### 問題の根本原因
`package-lock.json`が`.gitignore`に含まれているため、リポジトリにコミットされず、GitHub Actionsで`npm ci`が失敗している。

## Requirements

### Requirement 1: package-lock.jsonのバージョン管理
**Objective:** 開発者として、`package-lock.json`をリポジトリで管理したい。これにより、CI/CD環境で確実に依存関係をインストールできる。

#### Acceptance Criteria
1. The CI System shall have access to `package-lock.json` in the repository for reproducible builds.
2. When `npm ci` is executed in GitHub Actions, the CI System shall install dependencies without errors.
3. The .gitignore shall not exclude `package-lock.json` from version control.

### Requirement 2: GitHub Actionsワークフローの修正
**Objective:** CI管理者として、GitHub ActionsでPlaywrightテストが正常に実行されることを確認したい。これにより、PRごとにアクセシビリティチェックが自動実行される。

#### Acceptance Criteria
1. When a pull request is created or updated, the GitHub Actions Workflow shall execute Playwright accessibility tests.
2. When a commit is pushed to main or master branch, the GitHub Actions Workflow shall execute Playwright accessibility tests.
3. If the Playwright tests fail, the GitHub Actions Workflow shall report the failure status to the pull request.
4. The GitHub Actions Workflow shall upload test reports as artifacts with 30-day retention.

### Requirement 3: フロントエンドアクセシビリティテストの確認
**Objective:** QAエンジニアとして、フロントエンド（React SPA）のアクセシビリティチェックがCI/CDパイプラインで実行されることを確認したい。これにより、WCAG準拠状況を自動で検証できる。

#### Acceptance Criteria
1. The Playwright Test Suite shall include accessibility tests for the frontend application using axe-core.
2. The Accessibility Tests shall validate against WCAG 2.0/2.1 Level A and AA criteria.
3. When accessibility violations are detected, the Test Results shall include specific violation details and remediation guidance.
4. The GitHub Actions Workflow shall execute all accessibility tests defined in `tests/accessibility.spec.ts`.

### Requirement 4: 導入ドキュメントの作成
**Objective:** 新規参画の開発者として、GitHub Actionsでのアクセシビリティチェックの導入手順を理解したい。これにより、新規プロジェクトへの適用やトラブルシューティングが容易になる。

#### Acceptance Criteria
1. The Documentation shall describe prerequisites for running accessibility tests in GitHub Actions.
2. The Documentation shall include step-by-step setup instructions for the CI/CD pipeline.
3. The Documentation shall explain the GitHub Actions workflow configuration.
4. The Documentation shall provide troubleshooting guidance for common issues including the `npm ci` error.
5. The Documentation shall be written in Japanese and placed in the `docs/` directory.

### Requirement 5: ローカル環境との整合性
**Objective:** 開発者として、ローカル環境とCI環境で同一の依存関係バージョンを使用したい。これにより、「ローカルでは動くがCIでは失敗する」問題を防止できる。

#### Acceptance Criteria
1. The package-lock.json shall ensure identical dependency versions between local and CI environments.
2. When dependencies are updated locally, the Developer shall commit both `package.json` and `package-lock.json`.
3. The Documentation shall explain the importance of committing `package-lock.json` for CI reproducibility.

