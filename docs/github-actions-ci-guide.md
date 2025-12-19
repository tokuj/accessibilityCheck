# GitHub Actions アクセシビリティテスト CI ガイド

このドキュメントでは、GitHub Actionsを使用してPlaywrightアクセシビリティテストを自動実行する方法について説明します。

## 前提条件

以下の環境が必要です：

- **Node.js**: LTSバージョン（GitHub Actionsで自動設定されます）
- **npm**: Node.jsに同梱されているパッケージマネージャー
- **GitHub Actions**: リポジトリでGitHub Actionsが有効になっていること
- **package-lock.json**: リポジトリにコミットされていること（詳細は「ベストプラクティス」参照）

## セットアップ手順

### 1. ワークフローファイルの配置

このリポジトリでは、`.github/workflows/playwright.yml`にワークフローファイルが配置されています。

新規プロジェクトで導入する場合は、以下のファイルを作成してください：

```yaml
# .github/workflows/playwright.yml
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: lts/*
    - name: Install dependencies
      run: npm ci
    - name: Install Playwright Browsers
      run: npx playwright install --with-deps
    - name: Run Playwright tests
      run: npx playwright test
    - uses: actions/upload-artifact@v4
      if: ${{ !cancelled() }}
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 30
```

### 2. 必要なファイルの確認

以下のファイルがリポジトリにコミットされていることを確認してください：

- `package.json` - 依存関係の定義
- `package-lock.json` - 依存関係のロック（**必須**）
- `playwright.config.ts` - Playwrightの設定
- `tests/` - テストファイルディレクトリ

## ワークフロー設定の説明

### トリガー設定

```yaml
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
```

- **push**: `main`または`master`ブランチへのプッシュ時にテストを実行
- **pull_request**: `main`または`master`ブランチへのPR作成・更新時にテストを実行

### ジョブ構成

| ステップ | 説明 |
|---------|------|
| `actions/checkout@v4` | リポジトリをチェックアウト |
| `actions/setup-node@v4` | Node.js LTSをセットアップ |
| `npm ci` | `package-lock.json`から依存関係をインストール |
| `npx playwright install --with-deps` | Playwrightブラウザと依存関係をインストール |
| `npx playwright test` | Playwrightテストを実行 |
| `actions/upload-artifact@v4` | テストレポートをアーティファクトとして保存（30日間） |

### アーティファクト設定

```yaml
- uses: actions/upload-artifact@v4
  if: ${{ !cancelled() }}
  with:
    name: playwright-report
    path: playwright-report/
    retention-days: 30
```

- テスト成功・失敗に関わらず、レポートをアップロード
- 30日間保持

## テスト結果の確認方法

### PRステータスチェック

1. Pull Requestを作成または更新
2. PRページの「Checks」タブでワークフロー実行状況を確認
3. 緑のチェックマーク：テスト成功、赤のXマーク：テスト失敗

### アーティファクトからのレポート確認

1. GitHub Actionsの実行ページを開く
2. 「Artifacts」セクションで「playwright-report」をダウンロード
3. ZIPファイルを解凍し、`index.html`をブラウザで開く
4. 詳細なテスト結果と違反内容を確認

## トラブルシューティング

### npm ci エラー：「package-lock.json not found」

**症状**:
```
npm ERR! The `npm ci` command can only install with an existing package-lock.json
```

**原因**:
`package-lock.json`がリポジトリにコミットされていません。

**解決方法**:
1. `.gitignore`から`package-lock.json`を削除
2. ローカルで`npm install`を実行して`package-lock.json`を生成
3. `package-lock.json`をコミット
   ```bash
   git add package-lock.json
   git commit -m "chore: add package-lock.json for CI"
   git push
   ```

### Playwrightブラウザインストールエラー

**症状**:
```
Error: Failed to download Chromium
```

**原因**:
ネットワーク問題またはGitHub Actionsの一時的な障害

**解決方法**:
1. ワークフローを再実行（「Re-run jobs」ボタン）
2. 問題が継続する場合、GitHub Statusページ（https://www.githubstatus.com/）を確認

### テスト失敗：アクセシビリティ違反

**症状**:
```
Expected: []
Received: [{ id: "color-contrast", ... }]
```

**原因**:
テスト対象ページにWCAG違反が検出されました。

**解決方法**:
1. アーティファクトからレポートをダウンロード
2. 違反の詳細（違反ID、影響度、該当要素）を確認
3. axe-coreの[ヘルプドキュメント](https://dequeuniversity.com/rules/axe/)で修正方法を確認
4. ソースコードを修正し、再度PRを更新

## ベストプラクティス

### package-lock.jsonのコミット重要性

`package-lock.json`をリポジトリにコミットすることで：

1. **再現性の確保**: ローカルとCI環境で同一の依存関係バージョンを使用
2. **npm ciの利用**: `npm install`より高速で確実なインストール
3. **セキュリティ**: 依存関係のバージョン固定によるサプライチェーン攻撃リスクの軽減

### 依存関係更新時の手順

依存関係を更新する際は、必ず以下の手順に従ってください：

1. ローカルで`npm update`または`npm install <package>`を実行
2. `package.json`と`package-lock.json`の**両方**をコミット
   ```bash
   git add package.json package-lock.json
   git commit -m "chore: update dependencies"
   ```
3. PRを作成し、CIテストが成功することを確認

### テスト実行のベストプラクティス

- ローカルでテストを実行してからPRを作成
- テスト失敗時は、アーティファクトのレポートで詳細を確認
- アクセシビリティ違反は可能な限り修正してからマージ

## 関連ドキュメント

- [テスト実行ガイド](./accessibility-testing-guide.md)
- [WCAG準拠基準リファレンス](./wcag-reference.md)
- [デプロイメントガイド](./deployment-guide.md)
