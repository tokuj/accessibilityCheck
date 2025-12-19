import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('GitHub Actions CIガイドドキュメント検証', () => {
  const docsDir = path.join(process.cwd(), 'docs');
  const guidePath = path.join(docsDir, 'github-actions-ci-guide.md');
  let guideContent: string;

  test.beforeAll(() => {
    // ドキュメントファイルが存在することを確認
    expect(fs.existsSync(guidePath), 'github-actions-ci-guide.md should exist').toBe(true);
    guideContent = fs.readFileSync(guidePath, 'utf-8');
  });

  test('ドキュメントファイルが存在すること', () => {
    expect(fs.existsSync(guidePath)).toBe(true);
  });

  test('前提条件セクションが含まれていること', () => {
    expect(guideContent).toContain('## 前提条件');
    expect(guideContent).toMatch(/Node\.js/i);
    expect(guideContent).toMatch(/npm/i);
    expect(guideContent).toMatch(/GitHub Actions/i);
  });

  test('セットアップ手順セクションが含まれていること', () => {
    expect(guideContent).toMatch(/## セットアップ|## 設定手順/);
  });

  test('ワークフロー設定の説明セクションが含まれていること', () => {
    expect(guideContent).toMatch(/## ワークフロー|workflow/i);
    expect(guideContent).toContain('playwright.yml');
  });

  test('テスト結果の確認方法セクションが含まれていること', () => {
    expect(guideContent).toMatch(/テスト結果|確認方法|アーティファクト/);
  });

  test('トラブルシューティングセクションが含まれていること', () => {
    expect(guideContent).toContain('## トラブルシューティング');
    expect(guideContent).toContain('npm ci');
    expect(guideContent).toMatch(/package-lock\.json/);
  });

  test('ベストプラクティスセクションが含まれていること', () => {
    expect(guideContent).toMatch(/## ベストプラクティス|## 推奨事項/);
    expect(guideContent).toMatch(/package-lock\.json.*コミット|コミット.*package-lock\.json/s);
  });

  test('日本語で記述されていること', () => {
    // 日本語の文字が含まれていることを確認
    expect(guideContent).toMatch(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/);
  });

  test('docs/README.mdにガイドへのリンクが追加されていること', () => {
    const readmePath = path.join(docsDir, 'README.md');
    const readmeContent = fs.readFileSync(readmePath, 'utf-8');
    expect(readmeContent).toContain('github-actions-ci-guide.md');
  });
});
