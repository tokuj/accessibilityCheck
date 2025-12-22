import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * インテージ公式サイト アクセシビリティテスト
 * WCAG 2.1 Level AA 準拠チェック
 *
 * タイムアウト対策として以下を適用:
 * - domcontentloaded + 2秒待機 (Requirements: 6.3)
 * - setLegacyMode(true) + 広告要素除外 (Requirements: 6.4)
 */

// テスト対象ページの定義
const TEST_PAGES = [
  { name: 'トップページ', url: 'https://www.intage.co.jp/' },
  { name: '会社情報', url: 'https://www.intage.co.jp/company/' },
  { name: 'サービス', url: 'https://www.intage.co.jp/service/' },
  { name: 'お問い合わせ', url: 'https://www.intage.co.jp/contact/' },
  { name: 'ニュース', url: 'https://www.intage.co.jp/news/' },
];

// WCAG AA準拠タグ
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * 広告関連CSSセレクタ
 * axe-coreの.exclude()で除外するセレクタリスト
 * Requirements: 6.4
 */
const AD_SELECTORS = [
  'iframe[src*="ads"]',
  'iframe[src*="doubleclick"]',
  'iframe[src*="googlesyndication"]',
  '[class*="ad-"]',
  '[class*="ads-"]',
  '.adsbygoogle',
  '.ad-container',
  '.advertisement',
  '[id*="ad-"]',
  '[id*="ads-"]',
  '[data-ad-slot]',
  '[data-ad-client]',
];

/**
 * AxeBuilderに広告除外設定を適用する
 * @param builder - AxeBuilderインスタンス
 * @returns 設定済みのAxeBuilder
 */
function applyAdExclusions(builder: AxeBuilder): AxeBuilder {
  for (const selector of AD_SELECTORS) {
    builder = builder.exclude(selector);
  }
  return builder;
}

test.describe('インテージ公式サイト アクセシビリティテスト', () => {
  // 各ページごとのアクセシビリティテスト
  for (const targetPage of TEST_PAGES) {
    test(`${targetPage.name} - WCAG 2.1 AA準拠チェック`, async ({ page }) => {
      // ページ読み込み: domcontentloadedで高速化 (Requirements: 6.3)
      await page.goto(targetPage.url, { waitUntil: 'domcontentloaded' });

      // 2秒の安定化待機 (Requirements: 6.3)
      await page.waitForTimeout(2000);

      // アクセシビリティスキャン実行
      let axeBuilder = new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .setLegacyMode(true); // クロスオリジンiframeのペナルティを回避 (Requirements: 6.4)

      // 広告要素を除外 (Requirements: 6.4)
      axeBuilder = applyAdExclusions(axeBuilder);

      const accessibilityScanResults = await axeBuilder.analyze();

      // 違反がある場合は詳細を出力
      if (accessibilityScanResults.violations.length > 0) {
        console.log(`\n========================================`);
        console.log(`[${targetPage.name}] アクセシビリティ違反検出`);
        console.log(`URL: ${targetPage.url}`);
        console.log(`========================================\n`);

        accessibilityScanResults.violations.forEach((violation, index) => {
          console.log(`${index + 1}. ${violation.id}`);
          console.log(`   説明: ${violation.description}`);
          console.log(`   影響度: ${violation.impact}`);
          console.log(`   対象要素数: ${violation.nodes.length}`);
          console.log(`   ヘルプ: ${violation.helpUrl}`);
          console.log('');
        });
      }

      // 違反がないことを確認
      expect(accessibilityScanResults.violations).toEqual([]);
    });
  }

  // サードパーティ要素を除外したテスト（オプション）
  test('トップページ - サードパーティ要素除外版', async ({ page }) => {
    // ページ読み込み: domcontentloadedで高速化 (Requirements: 6.3)
    await page.goto('https://www.intage.co.jp/', { waitUntil: 'domcontentloaded' });

    // 2秒の安定化待機 (Requirements: 6.3)
    await page.waitForTimeout(2000);

    let axeBuilder = new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .setLegacyMode(true) // クロスオリジンiframeのペナルティを回避 (Requirements: 6.4)
      .exclude('iframe') // 外部iframeを除外
      .exclude('[data-third-party]'); // サードパーティ属性を持つ要素を除外

    // 広告要素を除外 (Requirements: 6.4)
    axeBuilder = applyAdExclusions(axeBuilder);

    const accessibilityScanResults = await axeBuilder.analyze();

    // 違反がある場合は詳細を出力
    if (accessibilityScanResults.violations.length > 0) {
      console.log(`\n[トップページ - サードパーティ除外] 違反数: ${accessibilityScanResults.violations.length}`);
    }

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
