# Research & Design Decisions

## Summary
- **Feature**: `github-actions-accessibility-ci`
- **Discovery Scope**: Extension（既存システムへの修正・拡張）
- **Key Findings**:
  - ルートの`.gitignore`が`package-lock.json`を除外しているため、GitHub Actionsで`npm ci`が失敗
  - フロントエンドディレクトリには独自の`package-lock.json`があり、`.gitignore`には含まれていない
  - 既存のアクセシビリティテスト（`tests/accessibility.spec.ts`）は外部サイトを対象としており、axe-coreとPlaywrightを使用

## Research Log

### npm ci エラーの根本原因
- **Context**: GitHub Actionsでの依存関係インストール失敗
- **Sources Consulted**:
  - ルートの`.gitignore` ファイル
  - `package-lock.json`のGit追跡状態
  - npm公式ドキュメント
- **Findings**:
  - ルートの`.gitignore`の3行目に`package-lock.json`が含まれている
  - `npm ci`は`package-lock.json`が必須（lockfileVersion >= 1）
  - ローカルには`package-lock.json`が存在するがGitで追跡されていない
- **Implications**: `.gitignore`から`package-lock.json`を削除し、リポジトリにコミットする必要がある

### フロントエンドの依存関係管理
- **Context**: フロントエンドのCI対応状況確認
- **Sources Consulted**:
  - `frontend/package-lock.json`
  - `frontend/.gitignore`
- **Findings**:
  - フロントエンドには独自の`package-lock.json`が存在
  - フロントエンドの`.gitignore`には`package-lock.json`は含まれていない
  - モノレポ構成ではないが、ルートとフロントエンドで別々の`package.json`/`package-lock.json`を管理
- **Implications**: ルートの`.gitignore`を修正すれば、両方の`package-lock.json`がリポジトリに含まれる

### 既存のアクセシビリティテスト構成
- **Context**: 既存テストの確認
- **Sources Consulted**:
  - `tests/accessibility.spec.ts`
  - `playwright.config.ts`
- **Findings**:
  - 外部サイト（intage.co.jp）を対象としたテスト
  - WCAG 2.1 Level AA準拠チェック（wcag2a, wcag2aa, wcag21a, wcag21aa）
  - axe-coreの@axe-core/playwrightパッケージを使用
  - 3ブラウザ（chromium, firefox, webkit）でテスト可能
  - CI環境用の設定あり（forbidOnly, retries, workers）
- **Implications**: 既存のテスト構成はCI対応済み、`package-lock.json`の問題を解決すれば動作する

### 既存ドキュメント構成
- **Context**: 導入ドキュメントの配置場所確認
- **Sources Consulted**:
  - `docs/`ディレクトリ
- **Findings**:
  - `docs/accessibility-testing-guide.md`が既に存在
  - WCAG関連のリファレンスドキュメントも複数存在
  - 日本語でドキュメント作成されている
- **Implications**: 既存のドキュメント構造に従い、GitHub Actions固有のガイドを追加

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 現状維持（npm ci） | `.gitignore`を修正し`npm ci`を使用 | 高速、再現性が高い、キャッシュ活用可能 | なし | **推奨** |
| npm installに変更 | ワークフローで`npm install`を使用 | lockfileがなくても動作 | 再現性が低い、ビルドごとに異なるバージョンがインストールされる可能性 | 非推奨 |

## Design Decisions

### Decision: package-lock.jsonをバージョン管理に含める
- **Context**: GitHub Actionsで`npm ci`が失敗している
- **Alternatives Considered**:
  1. `.gitignore`から`package-lock.json`を削除
  2. GitHub Actionsワークフローで`npm install`を使用
- **Selected Approach**: `.gitignore`から`package-lock.json`を削除し、リポジトリにコミット
- **Rationale**:
  - `npm ci`は`npm install`より高速で、再現性が高い
  - CI環境とローカル環境で同一バージョンの依存関係を保証
  - npmの公式ベストプラクティスに準拠
- **Trade-offs**:
  - リポジトリサイズが増加（約200KB）
  - 依存関係更新時にコンフリクトの可能性
- **Follow-up**: コミット後にGitHub Actionsが正常に動作することを確認

### Decision: ドキュメント追加場所
- **Context**: 導入ドキュメントの配置
- **Alternatives Considered**:
  1. `docs/`ディレクトリに新規ファイル作成
  2. 既存の`docs/accessibility-testing-guide.md`にセクション追加
  3. `README.md`に追加
- **Selected Approach**: `docs/github-actions-ci-guide.md`として新規ファイル作成
- **Rationale**:
  - CI/CD固有の情報は独立したドキュメントとして管理
  - 既存のドキュメント構造（機能別ファイル）に準拠
  - `docs/README.md`のドキュメント一覧に追加可能
- **Trade-offs**: ファイル数が増加
- **Follow-up**: `docs/README.md`のドキュメント一覧を更新

## Risks & Mitigations
- **Risk 1**: package-lock.jsonのコンフリクト → 依存関係更新時は必ず`npm install`後にコミット、PRでのマージ戦略を明確化
- **Risk 2**: 外部サイトへのテストがCI環境で失敗する可能性 → タイムアウト設定とリトライ設定を活用（既にplaywright.configで対応済み）
- **Risk 3**: ブラウザのダウンロード時間が長い → GitHubのキャッシュ機能を活用可能（将来の最適化として）

## References
- [npm ci vs npm install](https://docs.npmjs.com/cli/v10/commands/npm-ci) — npm公式ドキュメント
- [Playwright GitHub Actions](https://playwright.dev/docs/ci-intro) — Playwright CI設定ガイド
- [axe-core/playwright](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright) — アクセシビリティテストライブラリ
