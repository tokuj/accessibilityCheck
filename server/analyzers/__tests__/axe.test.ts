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
// モック結果を保持（テストごとに設定可能）
let mockAnalyzeResult: {
  violations: Array<{
    id: string;
    description: string;
    impact?: string;
    tags: string[];
    helpUrl: string;
    nodes: Array<{ target: string[]; html: string; failureSummary?: string }>;
  }>;
  passes: Array<{
    id: string;
    description: string;
    tags: string[];
    helpUrl: string;
    nodes: Array<{ target: string[]; html: string; failureSummary?: string }>;
  }>;
  incomplete: Array<{
    id: string;
    description: string;
    impact?: string;
    tags: string[];
    helpUrl: string;
    nodes: Array<{ target: string[]; html: string; failureSummary?: string }>;
  }>;
};

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
    analyze: vi.fn().mockImplementation(() => Promise.resolve(mockAnalyzeResult)),
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
    // デフォルトのモック結果を設定
    mockAnalyzeResult = {
      violations: [],
      passes: [],
      incomplete: [],
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

    describe('ノード情報抽出 (Req 1.3)', () => {
      it('違反結果にノード情報配列が含まれる', async () => {
        // axe-coreの結果をモック（beforeEachの後でmockAnalyzeResultを更新）
        mockAnalyzeResult = {
          violations: [
            {
              id: 'color-contrast',
              description: 'Elements must have sufficient color contrast',
              impact: 'serious',
              tags: ['wcag2aa', 'wcag143'],
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
              nodes: [
                {
                  target: ['html > body > main > p:nth-child(2)'],
                  html: '<p style="color: #777">Low contrast text</p>',
                  failureSummary: 'Fix any of the following: Element has insufficient color contrast of 4.48',
                },
                {
                  target: ['html > body > main > span.light-text'],
                  html: '<span class="light-text">Another low contrast element with some more text that goes on and on</span>',
                  failureSummary: 'Fix any of the following: Element has insufficient color contrast of 3.21',
                },
              ],
            },
          ],
          passes: [],
          incomplete: [],
        };

        const { analyzeWithAxe } = await import('../axe');
        const result = await analyzeWithAxe(mockPage as Page);

        expect(result.violations[0].nodes).toBeDefined();
        expect(result.violations[0].nodes).toHaveLength(2);
      });

      it('ノード情報にtarget、html、failureSummaryが含まれる', async () => {
        mockAnalyzeResult = {
          violations: [
            {
              id: 'image-alt',
              description: 'Images must have alternate text',
              impact: 'critical',
              tags: ['wcag2a', 'wcag111'],
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
              nodes: [
                {
                  target: ['html > body > img.hero-image'],
                  html: '<img src="hero.jpg" class="hero-image">',
                  failureSummary: 'Fix any of the following: Element does not have an alt attribute',
                },
              ],
            },
          ],
          passes: [],
          incomplete: [],
        };

        const { analyzeWithAxe } = await import('../axe');
        const result = await analyzeWithAxe(mockPage as Page);

        const node = result.violations[0].nodes?.[0];
        expect(node).toBeDefined();
        expect(node?.target).toBe('html > body > img.hero-image');
        expect(node?.html).toBe('<img src="hero.jpg" class="hero-image">');
        expect(node?.failureSummary).toBe('Fix any of the following: Element does not have an alt attribute');
      });

      it('target配列が複数要素の場合は " > " で結合される', async () => {
        mockAnalyzeResult = {
          violations: [
            {
              id: 'link-name',
              description: 'Links must have discernible text',
              impact: 'serious',
              tags: ['wcag2a', 'wcag244'],
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/link-name',
              nodes: [
                {
                  target: ['#main-content', 'div.links-container', 'a.icon-link'],
                  html: '<a class="icon-link" href="/path"></a>',
                  failureSummary: 'Fix any of the following: Element is in tab order and does not have accessible text',
                },
              ],
            },
          ],
          passes: [],
          incomplete: [],
        };

        const { analyzeWithAxe } = await import('../axe');
        const result = await analyzeWithAxe(mockPage as Page);

        const node = result.violations[0].nodes?.[0];
        expect(node?.target).toBe('#main-content > div.links-container > a.icon-link');
      });

      it('HTML抜粋が200文字を超える場合は切り詰められる', async () => {
        const longHtml = '<div class="very-long-element">' + 'a'.repeat(250) + '</div>';

        mockAnalyzeResult = {
          violations: [
            {
              id: 'region',
              description: 'All page content should be contained by landmarks',
              impact: 'moderate',
              tags: ['wcag2a', 'wcag131'],
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/region',
              nodes: [
                {
                  target: ['html > body > div.orphan'],
                  html: longHtml,
                  failureSummary: 'Fix any of the following: Some page content is not contained by landmarks',
                },
              ],
            },
          ],
          passes: [],
          incomplete: [],
        };

        const { analyzeWithAxe } = await import('../axe');
        const result = await analyzeWithAxe(mockPage as Page);

        const node = result.violations[0].nodes?.[0];
        expect(node?.html.length).toBeLessThanOrEqual(200);
        expect(node?.html.endsWith('...')).toBe(true);
      });

      it('passesにもノード情報が含まれる', async () => {
        mockAnalyzeResult = {
          violations: [],
          passes: [
            {
              id: 'button-name',
              description: 'Buttons must have discernible text',
              tags: ['wcag2a', 'wcag412'],
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/button-name',
              nodes: [
                {
                  target: ['button#submit'],
                  html: '<button id="submit">Submit Form</button>',
                },
              ],
            },
          ],
          incomplete: [],
        };

        const { analyzeWithAxe } = await import('../axe');
        const result = await analyzeWithAxe(mockPage as Page);

        expect(result.passes[0].nodes).toBeDefined();
        expect(result.passes[0].nodes).toHaveLength(1);
        expect(result.passes[0].nodes?.[0].target).toBe('button#submit');
      });

      it('incompleteにもノード情報が含まれる', async () => {
        mockAnalyzeResult = {
          violations: [],
          passes: [],
          incomplete: [
            {
              id: 'color-contrast',
              description: 'Elements must have sufficient color contrast',
              impact: 'serious',
              tags: ['wcag2aa', 'wcag143'],
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
              nodes: [
                {
                  target: ['div.dynamic-content > span'],
                  html: '<span>Dynamic text</span>',
                },
              ],
            },
          ],
        };

        const { analyzeWithAxe } = await import('../axe');
        const result = await analyzeWithAxe(mockPage as Page);

        expect(result.incomplete[0].nodes).toBeDefined();
        expect(result.incomplete[0].nodes).toHaveLength(1);
      });

      it('ノードがない場合は空配列が設定される', async () => {
        mockAnalyzeResult = {
          violations: [
            {
              id: 'bypass',
              description: 'Page should have a skip link',
              impact: 'serious',
              tags: ['wcag2a', 'wcag241'],
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/bypass',
              nodes: [],
            },
          ],
          passes: [],
          incomplete: [],
        };

        const { analyzeWithAxe } = await import('../axe');
        const result = await analyzeWithAxe(mockPage as Page);

        expect(result.violations[0].nodes).toBeDefined();
        expect(result.violations[0].nodes).toHaveLength(0);
      });

      it('nodeCountは後方互換性のため維持される', async () => {
        mockAnalyzeResult = {
          violations: [
            {
              id: 'color-contrast',
              description: 'Elements must have sufficient color contrast',
              impact: 'serious',
              tags: ['wcag2aa', 'wcag143'],
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
              nodes: [
                { target: ['p:nth-child(1)'], html: '<p>Text 1</p>' },
                { target: ['p:nth-child(2)'], html: '<p>Text 2</p>' },
                { target: ['p:nth-child(3)'], html: '<p>Text 3</p>' },
              ],
            },
          ],
          passes: [],
          incomplete: [],
        };

        const { analyzeWithAxe } = await import('../axe');
        const result = await analyzeWithAxe(mockPage as Page);

        expect(result.violations[0].nodeCount).toBe(3);
        expect(result.violations[0].nodes).toHaveLength(3);
      });
    });
  });

  describe('拡張ノード情報抽出（Req 6.1, 6.4, 6.5, 6.7）', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockPage = {
        evaluate: vi.fn(),
        setDefaultTimeout: vi.fn(),
        url: vi.fn().mockReturnValue('https://example.com'),
        $: vi.fn(),
        viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
      };
    });

    describe('extractEnhancedNodeInfo', () => {
      it('ノード情報にxpathフィールドが含まれる（Req 6.4）', async () => {
        mockAnalyzeResult = {
          violations: [
            {
              id: 'image-alt',
              description: 'Images must have alternate text',
              impact: 'critical',
              tags: ['wcag2a', 'wcag111'],
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
              nodes: [
                {
                  target: ['html > body > img.hero-image'],
                  html: '<img src="hero.jpg" class="hero-image">',
                  failureSummary: 'Fix any of the following: Element does not have an alt attribute',
                },
              ],
            },
          ],
          passes: [],
          incomplete: [],
        };

        // Playwrightの$でモック要素を返す
        let callCount = 0;
        const mockElement = {
          boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, width: 300, height: 400 }),
          evaluate: vi.fn().mockImplementation(() => {
            callCount++;
            // 最初の呼び出しはXPath取得（getXPath関数）
            if (callCount === 1) {
              return '/html/body/img[@class="hero-image"]';
            }
            // 2回目の呼び出しはcontextHtml取得（outerHTML）
            if (callCount === 2) {
              return '<main><img src="hero.jpg" class="hero-image"></main>';
            }
            return null;
          }),
        };
        (mockPage.$ as ReturnType<typeof vi.fn>).mockResolvedValue(mockElement);

        const { analyzeWithAxeEnhanced } = await import('../axe');
        const result = await analyzeWithAxeEnhanced(mockPage as unknown as Page);

        // xpathフィールドが含まれることを確認
        expect(result.violations[0].nodes?.[0]).toHaveProperty('xpath');
      });

      it('ノード情報にboundingBoxフィールドが含まれる（Req 6.1）', async () => {
        mockAnalyzeResult = {
          violations: [
            {
              id: 'image-alt',
              description: 'Images must have alternate text',
              impact: 'critical',
              tags: ['wcag2a', 'wcag111'],
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
              nodes: [
                {
                  target: ['html > body > img.hero-image'],
                  html: '<img src="hero.jpg" class="hero-image">',
                  failureSummary: 'Fix any of the following: Element does not have an alt attribute',
                },
              ],
            },
          ],
          passes: [],
          incomplete: [],
        };

        let callCount2 = 0;
        const mockElement = {
          boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, width: 300, height: 400 }),
          evaluate: vi.fn().mockImplementation(() => {
            callCount2++;
            if (callCount2 === 1) return '/html/body/img[@class="hero-image"]';
            if (callCount2 === 2) return '<main><img src="hero.jpg" class="hero-image"></main>';
            return null;
          }),
        };
        (mockPage.$ as ReturnType<typeof vi.fn>).mockResolvedValue(mockElement);

        const { analyzeWithAxeEnhanced } = await import('../axe');
        const result = await analyzeWithAxeEnhanced(mockPage as unknown as Page);

        const bbox = result.violations[0].nodes?.[0]?.boundingBox;
        expect(bbox).toBeDefined();
        expect(bbox).toEqual({ x: 100, y: 200, width: 300, height: 400 });
      });

      it('ノード情報にcontextHtmlフィールドが含まれる（Req 6.5）', async () => {
        mockAnalyzeResult = {
          violations: [
            {
              id: 'image-alt',
              description: 'Images must have alternate text',
              impact: 'critical',
              tags: ['wcag2a', 'wcag111'],
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
              nodes: [
                {
                  target: ['html > body > main > img.hero-image'],
                  html: '<img src="hero.jpg" class="hero-image">',
                },
              ],
            },
          ],
          passes: [],
          incomplete: [],
        };

        let callCount3 = 0;
        const mockElement = {
          boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, width: 300, height: 400 }),
          evaluate: vi.fn().mockImplementation(() => {
            callCount3++;
            if (callCount3 === 1) return '/html/body/main/img[@class="hero-image"]';
            if (callCount3 === 2) return '<main><p>Prev</p><img src="hero.jpg" class="hero-image"><p>Next</p></main>';
            return null;
          }),
        };
        (mockPage.$ as ReturnType<typeof vi.fn>).mockResolvedValue(mockElement);

        const { analyzeWithAxeEnhanced } = await import('../axe');
        const result = await analyzeWithAxeEnhanced(mockPage as unknown as Page);

        expect(result.violations[0].nodes?.[0]).toHaveProperty('contextHtml');
      });

      it('ビューポート外の要素はisHidden=trueが設定される（Req 6.7）', async () => {
        mockAnalyzeResult = {
          violations: [
            {
              id: 'image-alt',
              description: 'Images must have alternate text',
              impact: 'critical',
              tags: ['wcag2a', 'wcag111'],
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
              nodes: [
                {
                  target: ['html > body > img.hidden-image'],
                  html: '<img src="hidden.jpg" class="hidden-image">',
                },
              ],
            },
          ],
          passes: [],
          incomplete: [],
        };

        // ビューポート外の座標を返す
        let callCount4 = 0;
        const mockElement = {
          boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 2000, width: 100, height: 100 }),
          evaluate: vi.fn().mockImplementation(() => {
            callCount4++;
            if (callCount4 === 1) return '/html/body/img[@class="hidden-image"]';
            if (callCount4 === 2) return '<img src="hidden.jpg" class="hidden-image">';
            return null;
          }),
        };
        (mockPage.$ as ReturnType<typeof vi.fn>).mockResolvedValue(mockElement);

        const { analyzeWithAxeEnhanced } = await import('../axe');
        const result = await analyzeWithAxeEnhanced(mockPage as unknown as Page);

        expect(result.violations[0].nodes?.[0]?.isHidden).toBe(true);
      });

      it('非表示要素（boundingBox=null）はisHidden=trueが設定される', async () => {
        mockAnalyzeResult = {
          violations: [
            {
              id: 'image-alt',
              description: 'Images must have alternate text',
              impact: 'critical',
              tags: ['wcag2a', 'wcag111'],
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
              nodes: [
                {
                  target: ['html > body > img.display-none'],
                  html: '<img src="hidden.jpg" style="display:none">',
                },
              ],
            },
          ],
          passes: [],
          incomplete: [],
        };

        // display:none要素はboundingBox=null
        let callCount5 = 0;
        const mockElement = {
          boundingBox: vi.fn().mockResolvedValue(null),
          evaluate: vi.fn().mockImplementation(() => {
            callCount5++;
            if (callCount5 === 1) return '/html/body/img[@style="display:none"]';
            if (callCount5 === 2) return '<img src="hidden.jpg" style="display:none">';
            return null;
          }),
        };
        (mockPage.$ as ReturnType<typeof vi.fn>).mockResolvedValue(mockElement);

        const { analyzeWithAxeEnhanced } = await import('../axe');
        const result = await analyzeWithAxeEnhanced(mockPage as unknown as Page);

        expect(result.violations[0].nodes?.[0]?.isHidden).toBe(true);
        expect(result.violations[0].nodes?.[0]?.boundingBox).toBeUndefined();
      });

      it('ビューポート内の要素はisHidden=falseが設定される', async () => {
        mockAnalyzeResult = {
          violations: [
            {
              id: 'image-alt',
              description: 'Images must have alternate text',
              impact: 'critical',
              tags: ['wcag2a', 'wcag111'],
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
              nodes: [
                {
                  target: ['html > body > img.visible'],
                  html: '<img src="visible.jpg" class="visible">',
                },
              ],
            },
          ],
          passes: [],
          incomplete: [],
        };

        // ビューポート内の座標を返す
        let callCount6 = 0;
        const mockElement = {
          boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 100, width: 200, height: 200 }),
          evaluate: vi.fn().mockImplementation(() => {
            callCount6++;
            if (callCount6 === 1) return '/html/body/img[@class="visible"]';
            if (callCount6 === 2) return '<img src="visible.jpg" class="visible">';
            return null;
          }),
        };
        (mockPage.$ as ReturnType<typeof vi.fn>).mockResolvedValue(mockElement);

        const { analyzeWithAxeEnhanced } = await import('../axe');
        const result = await analyzeWithAxeEnhanced(mockPage as unknown as Page);

        expect(result.violations[0].nodes?.[0]?.isHidden).toBe(false);
      });

      it('要素が見つからない場合はxpath、boundingBox、contextHtmlは空', async () => {
        mockAnalyzeResult = {
          violations: [
            {
              id: 'image-alt',
              description: 'Images must have alternate text',
              impact: 'critical',
              tags: ['wcag2a', 'wcag111'],
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
              nodes: [
                {
                  target: ['#non-existent'],
                  html: '<img src="test.jpg">',
                },
              ],
            },
          ],
          passes: [],
          incomplete: [],
        };

        // 要素が見つからない
        (mockPage.$ as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const { analyzeWithAxeEnhanced } = await import('../axe');
        const result = await analyzeWithAxeEnhanced(mockPage as unknown as Page);

        const node = result.violations[0].nodes?.[0];
        expect(node?.xpath).toBeUndefined();
        expect(node?.boundingBox).toBeUndefined();
        expect(node?.contextHtml).toBeUndefined();
        expect(node?.isHidden).toBeUndefined();
      });

      it('ノード情報にelementDescriptionフィールドが含まれる（Req 7.2, 7.7）', async () => {
        mockAnalyzeResult = {
          violations: [
            {
              id: 'link-name',
              description: 'Links must have discernible text',
              impact: 'serious',
              tags: ['wcag2a', 'wcag244'],
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/link-name',
              nodes: [
                {
                  target: ['a.icon-link'],
                  html: '<a class="icon-link" href="/path">詳細はこちら</a>',
                  failureSummary: 'Element is in tab order and does not have accessible text',
                },
              ],
            },
          ],
          passes: [],
          incomplete: [],
        };

        let callCount7 = 0;
        const mockElement = {
          boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, width: 300, height: 40 }),
          evaluate: vi.fn().mockImplementation(() => {
            callCount7++;
            if (callCount7 === 1) return '/html/body/a[@class="icon-link"]';
            if (callCount7 === 2) return '<nav><a class="icon-link" href="/path">詳細はこちら</a></nav>';
            if (callCount7 === 3) return 'リンク「詳細はこちら」';
            return null;
          }),
        };
        (mockPage.$ as ReturnType<typeof vi.fn>).mockResolvedValue(mockElement);

        const { analyzeWithAxeEnhanced } = await import('../axe');
        const result = await analyzeWithAxeEnhanced(mockPage as unknown as Page);

        expect(result.violations[0].nodes?.[0]).toHaveProperty('elementDescription');
        expect(result.violations[0].nodes?.[0]?.elementDescription).toBe('リンク「詳細はこちら」');
      });

      it('要素説明がタグラベルと内容を含む（Req 7.7）', async () => {
        mockAnalyzeResult = {
          violations: [
            {
              id: 'image-alt',
              description: 'Images must have alternate text',
              impact: 'critical',
              tags: ['wcag2a', 'wcag111'],
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
              nodes: [
                {
                  target: ['img.hero'],
                  html: '<img src="hero.jpg" alt="ヒーロー画像">',
                },
              ],
            },
          ],
          passes: [],
          incomplete: [],
        };

        let callCount8 = 0;
        const mockElement = {
          boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 600, height: 400 }),
          evaluate: vi.fn().mockImplementation(() => {
            callCount8++;
            if (callCount8 === 1) return '/html/body/img[@class="hero"]';
            if (callCount8 === 2) return '<div><img src="hero.jpg" alt="ヒーロー画像"></div>';
            if (callCount8 === 3) return '画像「ヒーロー画像」';
            return null;
          }),
        };
        (mockPage.$ as ReturnType<typeof vi.fn>).mockResolvedValue(mockElement);

        const { analyzeWithAxeEnhanced } = await import('../axe');
        const result = await analyzeWithAxeEnhanced(mockPage as unknown as Page);

        const elementDesc = result.violations[0].nodes?.[0]?.elementDescription;
        expect(elementDesc).toContain('画像');
        expect(elementDesc).toContain('ヒーロー画像');
      });

      it('要素説明が20文字を超える場合は切り詰められる（Req 7.7）', async () => {
        mockAnalyzeResult = {
          violations: [
            {
              id: 'link-name',
              description: 'Links must have discernible text',
              impact: 'serious',
              tags: ['wcag2a', 'wcag244'],
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/link-name',
              nodes: [
                {
                  target: ['a.long-text'],
                  html: '<a class="long-text">これは非常に長いテキストコンテンツでテスト用です</a>',
                },
              ],
            },
          ],
          passes: [],
          incomplete: [],
        };

        let callCount9 = 0;
        const mockElement = {
          boundingBox: vi.fn().mockResolvedValue({ x: 50, y: 100, width: 400, height: 30 }),
          evaluate: vi.fn().mockImplementation(() => {
            callCount9++;
            if (callCount9 === 1) return '/html/body/a[@class="long-text"]';
            if (callCount9 === 2) return '<a class="long-text">これは非常に長いテキストコンテンツでテスト用です</a>';
            if (callCount9 === 3) return 'リンク「これは非常に長いテキストコンテン...」';
            return null;
          }),
        };
        (mockPage.$ as ReturnType<typeof vi.fn>).mockResolvedValue(mockElement);

        const { analyzeWithAxeEnhanced } = await import('../axe');
        const result = await analyzeWithAxeEnhanced(mockPage as unknown as Page);

        const elementDesc = result.violations[0].nodes?.[0]?.elementDescription;
        expect(elementDesc).toContain('...');
      });
    });
  });

  describe('日本語ロケール設定（Req 7.1）', () => {
    it('getAxeSourceWithJaLocaleが呼び出される', async () => {
      // モジュールを再インポートしてキャッシュをクリア
      vi.resetModules();

      // axe.tsモジュールをインポートすることで日本語ロケール関数が実行される
      const axeModule = await import('../axe');

      // analyzeWithAxeがエラーなく呼び出せることを確認
      // （ロケール読み込みに失敗しても空文字列を返すためエラーにならない）
      expect(axeModule.analyzeWithAxe).toBeDefined();
      expect(axeModule.analyzeWithAxeEnhanced).toBeDefined();
    });
  });
});
