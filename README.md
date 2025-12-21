# a11y Checker with Playwright

Playwrightとaxe-coreを使用したWebアクセシビリティ自動テストプロジェクト

## 概要

このプロジェクトは、[axe-core](https://github.com/dequelabs/axe-core)ライブラリを使用してWebページのアクセシビリティを自動的にチェックします。WCAG 2.0/2.1の基準に基づいた検証が可能です。

## セットアップ

### 1. Playwrightのインストール

```bash
npm init playwright@latest
```

### 2. axe-coreライブラリの追加

```bash
npm i @axe-core/playwright
```

## 使用方法

### テストの実行

```bash
# 通常実行
npx playwright test

# UIモードで実行
npx playwright test --ui

# 特定のテストファイルを実行
npx playwright test tests/accessibility.spec.ts
```

## テストコードの例

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('accessibility test', async ({ page }) => {
  await page.goto('https://example.com/');

  const accessibilityScanResults = await new AxeBuilder({ page })
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});
```

## カスタマイズ

### 特定のルールを除外する

```typescript
const results = await new AxeBuilder({ page })
  .disableRules(['empty-heading'])
  .analyze();
```

### WCAG基準の指定

WCAG 2.0/2.1のレベルA・AAのみを検証する場合：

```typescript
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  .analyze();
```

## 検出される問題の例

- 空の見出しタグ（影響度：軽微）
- 見出しレベルの不適切な階層化（影響度：中程度）
- 画像のalt属性の欠落
- コントラスト比の不足

## Webアプリケーション（フロントエンド）

URLを入力してアクセシビリティ分析結果を表示するWebアプリケーションも用意されています。

### 起動方法

```bash
# 依存関係のインストール（初回のみ）
npm install
cd frontend && npm install && cd ..

# サーバーとフロントエンドを同時に起動
npm run dev
```

起動後、ブラウザで http://localhost:5173 にアクセスしてください。

### 個別起動

```bash
# バックエンドサーバーのみ起動（ポート3001）
npm run server

# フロントエンドのみ起動（ポート5173）
npm run dev:frontend
```

### 機能

- URLを入力して分析開始
- 違反・パス・要確認項目のタブ切り替え表示
- WCAG項番の表示
- 影響度（critical/serious/moderate/minor）のバッジ表示
- 認証サポート（Basic認証、Cookie認証、Bearer Token認証、フォームログイン）
- セッション管理機能（認証セッションの保存・再利用）

## 認証サポート

アクセシビリティ検証の対象となるWebサイトが認証を必要とする場合、以下の認証方式をサポートしています。

### 手動認証設定

- **Basic認証**: ユーザー名とパスワードを指定
- **Cookie認証**: Cookie文字列を直接指定
- **Bearer Token認証**: APIアクセストークンを指定
- **フォームログイン**: ログインフォームの要素セレクタとクレデンシャルを指定

### セッション管理機能

開発環境では、インタラクティブログイン機能を使用して認証セッションを記録・再利用できます。

1. 「ログイン記録」ボタンをクリック
2. 開いたブラウザで通常通りログイン
3. 「ログイン完了」ボタンでセッションをキャプチャ
4. セッション名とパスフレーズを設定して保存
5. 次回以降は保存したセッションを選択して認証

セッションはAES-256-GCMで暗号化されてローカルに保存されます。詳細は `docs/session-management.md` を参照してください。

## 注意事項

自動テストがWCAG違反のすべてを検出できるとは限りません。自動テストは補助的なツールであり、手動でのアクセシビリティ確認も併せて行うことを推奨します。

## 参考資料

- [Playwright公式ドキュメント](https://playwright.dev/)
- [axe-core/playwright](https://www.npmjs.com/package/@axe-core/playwright)
- [WCAG 2.1](https://www.w3.org/TR/WCAG21/)
- [参考記事: Playwrightでアクセシビリティ自動テスト](https://zenn.dev/collabostyle/articles/b100c772ab369d)
