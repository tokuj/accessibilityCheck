# アクセシビリティテスト ドキュメント

## 概要

このプロジェクトは、Playwright と axe-core を使用してインテージ公式サイト（https://www.intage.co.jp/）のアクセシビリティを自動テストします。

## ドキュメント一覧

| ドキュメント | 説明 |
|-------------|------|
| [テスト実行ガイド](./accessibility-testing-guide.md) | セットアップから実行、結果の確認方法まで |
| [WCAG準拠基準リファレンス](./wcag-reference.md) | WCAG 2.1 Level AA の基準と違反パターン |
| [WCAG網羅性と改善戦略](./wcag-coverage-strategy.md) | 現在の網羅性と網羅性を上げる施策 |
| [GitHub Actions CIガイド](./github-actions-ci-guide.md) | GitHub ActionsでのアクセシビリティテストCI/CD設定ガイド |

## クイックスタート

```bash
# アクセシビリティテストを実行
npm run test:a11y

# UIモードで実行（対話的デバッグ）
npm run test:a11y:ui

# HTMLレポートを表示
npm run test:report
```

## テスト対象ページ

| ページ名 | URL |
|---------|-----|
| トップページ | https://www.intage.co.jp/ |
| 会社情報 | https://www.intage.co.jp/company/ |
| サービス | https://www.intage.co.jp/service/ |
| お問い合わせ | https://www.intage.co.jp/contact/ |
| ニュース | https://www.intage.co.jp/news/ |

## 使用技術

- **Playwright**: ブラウザ自動化テストフレームワーク
- **axe-core**: アクセシビリティテストエンジン
- **WCAG 2.1 Level AA**: 検証基準
