/**
 * axe-core分析のユニットテスト
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Page } from 'playwright';
import type { AxeAnalyzerOptions } from '../axe';

// モック用のインスタンス参照
let mockAxeBuilderInstance: MockAxeBuilderType;

interface MockAxeBuilderType {
  withTags: ReturnType<typeof vi.fn>;
  exclude: ReturnType<typeof vi.fn>;
  setLegacyMode: ReturnType<typeof vi.fn>;
  disableRules: ReturnType<typeof vi.fn>;
  analyze: ReturnType<typeof vi.fn>;
}

// モックインスタンスを作成するヘルパー
function createMockAxeBuilderInstance(): MockAxeBuilderType {
  const instance: MockAxeBuilderType = {
    withTags: vi.fn(),
    exclude: vi.fn(),
    setLegacyMode: vi.fn(),
    disableRules: vi.fn(),
    analyze: vi.fn().mockResolvedValue({
      violations: [],
      passes: [],
      incomplete: [],
    }),
  };
  instance.withTags.mockReturnValue(instance);
  instance.exclude.mockReturnValue(instance);
  instance.setLegacyMode.mockReturnValue(instance);
  instance.disableRules.mockReturnValue(instance);
  return instance;
}

// @axe-core/playwrightをモック
vi.mock('@axe-core/playwright', () => {
  const MockAxeBuilder = function MockAxeBuilder() {
    mockAxeBuilderInstance = createMockAxeBuilderInstance();
    return mockAxeBuilderInstance;
  };
  return { default: MockAxeBuilder };
});

// ../configをモック
vi.mock('../../config', () => ({
  getAdBlockingConfig: vi.fn().mockReturnValue({
    enabled: true,
    adSelectors: [
      'iframe[src*="ads"]',
      'iframe[src*="doubleclick"]',
      '.adsbygoogle',
    ],
    blockedUrlPatterns: [],
    blockedMediaExtensions: [],
  }),
  getTimeoutConfig: vi.fn().mockReturnValue({
    pageLoadTimeout: 90000,
    axeTimeout: 120000,
    pa11yTimeout: 90000,
    pa11yWait: 3000,
    lighthouseMaxWaitForLoad: 90000,
    lighthouseMaxWaitForFcp: 60000,
  }),
  DEFAULT_AD_SELECTORS: [
    'iframe[src*="ads"]',
    'iframe[src*="doubleclick"]',
    '.adsbygoogle',
  ],
}));

describe('AxeAnalyzer', () => {
  let mockPage: Partial<Page>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = {
      evaluate: vi.fn(),
      setDefaultTimeout: vi.fn(),
      url: vi.fn().mockReturnValue('https://example.com'),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AxeAnalyzerOptions型定義', () => {
    it('legacyModeオプションを持つ', () => {
      const options: AxeAnalyzerOptions = {
        legacyMode: true,
      };
      expect(options.legacyMode).toBe(true);
    });

    it('excludeAdsオプションを持つ', () => {
      const options: AxeAnalyzerOptions = {
        excludeAds: true,
      };
      expect(options.excludeAds).toBe(true);
    });

    it('additionalExcludesオプションを持つ', () => {
      const options: AxeAnalyzerOptions = {
        additionalExcludes: ['.custom-ad', '#banner'],
      };
      expect(options.additionalExcludes).toContain('.custom-ad');
      expect(options.additionalExcludes).toContain('#banner');
    });

    it('disableColorContrastオプションを持つ', () => {
      const options: AxeAnalyzerOptions = {
        disableColorContrast: true,
      };
      expect(options.disableColorContrast).toBe(true);
    });

    it('全てのオプションを組み合わせることができる', () => {
      const options: AxeAnalyzerOptions = {
        legacyMode: true,
        excludeAds: true,
        additionalExcludes: ['.custom-ad'],
        disableColorContrast: true,
      };

      expect(options.legacyMode).toBe(true);
      expect(options.excludeAds).toBe(true);
      expect(options.additionalExcludes).toEqual(['.custom-ad']);
      expect(options.disableColorContrast).toBe(true);
    });

    it('オプションなしでも動作する', () => {
      const options: AxeAnalyzerOptions = {};
      expect(Object.keys(options).length).toBe(0);
    });
  });

  describe('analyzeWithAxe', () => {
    it('デフォルトでlegacyModeが有効（Req 1.1）', async () => {
      const { analyzeWithAxe } = await import('../axe');

      await analyzeWithAxe(mockPage as Page);

      // setLegacyModeがtrueで呼び出されたことを確認
      expect(mockAxeBuilderInstance.setLegacyMode).toHaveBeenCalledWith(true);
    });

    it('デフォルトで広告要素が除外される（Req 1.2, 1.3）', async () => {
      const { analyzeWithAxe } = await import('../axe');

      await analyzeWithAxe(mockPage as Page);

      // excludeが複数回呼び出されたことを確認
      expect(mockAxeBuilderInstance.exclude).toHaveBeenCalled();
    });

    it('excludeAds: falseで広告除外を無効化できる', async () => {
      const { analyzeWithAxe } = await import('../axe');

      await analyzeWithAxe(mockPage as Page, { excludeAds: false });

      // 広告セレクタでexcludeが呼ばれていないことを確認
      expect(mockAxeBuilderInstance.exclude).not.toHaveBeenCalledWith('iframe[src*="ads"]');
    });

    it('additionalExcludesで追加セレクタを除外できる', async () => {
      const { analyzeWithAxe } = await import('../axe');

      const additionalExcludes = ['.my-custom-ad', '#my-ad-container'];
      await analyzeWithAxe(mockPage as Page, { additionalExcludes });

      // 追加セレクタがexcludeに渡されたことを確認
      for (const selector of additionalExcludes) {
        expect(mockAxeBuilderInstance.exclude).toHaveBeenCalledWith(selector);
      }
    });

    it('disableColorContrast: trueでcolor-contrastルールを無効化できる（Req 1.5）', async () => {
      const { analyzeWithAxe } = await import('../axe');

      await analyzeWithAxe(mockPage as Page, { disableColorContrast: true });

      // color-contrastルールが無効化されたことを確認
      expect(mockAxeBuilderInstance.disableRules).toHaveBeenCalledWith('color-contrast');
    });

    it('disableColorContrast: falseの場合はcolor-contrastが無効化されない', async () => {
      const { analyzeWithAxe } = await import('../axe');

      await analyzeWithAxe(mockPage as Page, { disableColorContrast: false });

      // disableRulesにcolor-contrastが渡されていないことを確認
      expect(mockAxeBuilderInstance.disableRules).not.toHaveBeenCalledWith('color-contrast');
    });

    it('legacyMode: falseでlegacyModeを明示的に無効化できる', async () => {
      const { analyzeWithAxe } = await import('../axe');

      await analyzeWithAxe(mockPage as Page, { legacyMode: false });

      // setLegacyModeがfalseで呼び出されたことを確認
      expect(mockAxeBuilderInstance.setLegacyMode).toHaveBeenCalledWith(false);
    });

    it('分析結果の構造が正しい', async () => {
      const { analyzeWithAxe } = await import('../axe');

      const result = await analyzeWithAxe(mockPage as Page);

      expect(result).toHaveProperty('violations');
      expect(result).toHaveProperty('passes');
      expect(result).toHaveProperty('incomplete');
      expect(result).toHaveProperty('duration');
      expect(typeof result.duration).toBe('number');
    });
  });
});
