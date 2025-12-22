/**
 * accessibility.spec.ts の設定テスト
 *
 * Requirements: 6.3, 6.4
 * - ページ読み込み戦略がdomcontentloadedで、2秒の安定化待機を行うこと
 * - setLegacyMode(true)と広告要素除外が適用されていること
 *
 * このテストでは、accessibility.spec.tsの静的構造をチェックします。
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('accessibility.spec.ts 設定', () => {
  const specFilePath = path.resolve(__dirname, '../accessibility.spec.ts');
  const specContent = fs.readFileSync(specFilePath, 'utf-8');

  describe('Requirement 6.3: ページ読み込み戦略', () => {
    it('domcontentloadedが使用されていること', () => {
      // waitUntil: 'domcontentloaded' が含まれていることを確認
      expect(specContent).toMatch(/waitUntil:\s*['"]domcontentloaded['"]/);
    });

    it('2秒の安定化待機が行われていること', () => {
      // page.waitForTimeout(2000) または setTimeout的な待機が含まれていること
      expect(specContent).toMatch(/waitForTimeout\s*\(\s*2000\s*\)/);
    });
  });

  describe('Requirement 6.4: axe-core最適化設定', () => {
    it('setLegacyMode(true)が適用されていること', () => {
      expect(specContent).toMatch(/\.setLegacyMode\s*\(\s*true\s*\)/);
    });

    it('広告要素の除外設定が含まれていること', () => {
      // .exclude()が広告関連セレクタに対して使用されていること
      // 少なくとも1つの広告関連セレクタが除外されていること
      const hasAdExclusion =
        specContent.includes('.exclude(') &&
        (specContent.includes('[class*="ad-"]') ||
          specContent.includes('.adsbygoogle') ||
          specContent.includes('iframe[src*="ads"]') ||
          specContent.includes('[id*="ad-"]') ||
          specContent.includes('advertisement') ||
          specContent.includes('ad-container') ||
          specContent.includes('DEFAULT_AD_SELECTORS'));

      expect(hasAdExclusion).toBe(true);
    });
  });
});
