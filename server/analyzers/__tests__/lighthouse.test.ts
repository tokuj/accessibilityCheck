/**
 * Lighthouse分析のユニットテスト
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// モック用の変数
let mockLighthouseOptions: Record<string, unknown> | null = null;
let mockChromeLauncherOptions: Record<string, unknown> | null = null;

// playwrightをモック
vi.mock('playwright', () => ({
  chromium: {
    executablePath: vi.fn().mockReturnValue('/mock/chromium/path'),
  },
}));

// lighthouseとchrome-launcherをモック
vi.mock('lighthouse', () => ({
  default: vi.fn().mockImplementation((_url: string, options: Record<string, unknown>) => {
    mockLighthouseOptions = options;
    return Promise.resolve({
      lhr: {
        categories: {
          performance: { score: 0.9 },
          accessibility: { score: 0.85, auditRefs: [] },
          'best-practices': { score: 0.8 },
          seo: { score: 0.75 },
        },
        audits: {},
      },
    });
  }),
}));

vi.mock('chrome-launcher', () => ({
  launch: vi.fn().mockImplementation((options: Record<string, unknown>) => {
    mockChromeLauncherOptions = options;
    return Promise.resolve({
      port: 9222,
      kill: vi.fn(),
    });
  }),
}));

// ../configをモック
vi.mock('../../config', () => ({
  getAdBlockingConfig: vi.fn().mockReturnValue({
    enabled: true,
    adSelectors: [
      'iframe[src*="ads"]',
      'iframe[src*="doubleclick"]',
      '.adsbygoogle',
    ],
    blockedUrlPatterns: [
      '*doubleclick.net/*',
      '*googlesyndication.com/*',
      '*adservice.google.*',
    ],
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
}));

describe('LighthouseAnalyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLighthouseOptions = null;
    mockChromeLauncherOptions = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LighthouseAnalyzerOptions型定義', () => {
    it('maxWaitForLoadオプションを持つ', async () => {
      const { LighthouseAnalyzerOptions } = await import('../lighthouse');
      const options: import('../lighthouse').LighthouseAnalyzerOptions = {
        maxWaitForLoad: 90000,
      };
      expect(options.maxWaitForLoad).toBe(90000);
    });

    it('maxWaitForFcpオプションを持つ', async () => {
      const options: import('../lighthouse').LighthouseAnalyzerOptions = {
        maxWaitForFcp: 60000,
      };
      expect(options.maxWaitForFcp).toBe(60000);
    });

    it('blockAdsオプションを持つ', async () => {
      const options: import('../lighthouse').LighthouseAnalyzerOptions = {
        blockAds: true,
      };
      expect(options.blockAds).toBe(true);
    });

    it('additionalBlockedPatternsオプションを持つ', async () => {
      const options: import('../lighthouse').LighthouseAnalyzerOptions = {
        additionalBlockedPatterns: ['*facebook.com/*', '*twitter.com/*'],
      };
      expect(options.additionalBlockedPatterns).toContain('*facebook.com/*');
      expect(options.additionalBlockedPatterns).toContain('*twitter.com/*');
    });

    it('全てのオプションを組み合わせることができる', async () => {
      const options: import('../lighthouse').LighthouseAnalyzerOptions = {
        maxWaitForLoad: 90000,
        maxWaitForFcp: 60000,
        blockAds: true,
        additionalBlockedPatterns: ['*custom-ad.com/*'],
        headers: { 'Authorization': 'Bearer token' },
      };

      expect(options.maxWaitForLoad).toBe(90000);
      expect(options.maxWaitForFcp).toBe(60000);
      expect(options.blockAds).toBe(true);
      expect(options.additionalBlockedPatterns).toEqual(['*custom-ad.com/*']);
      expect(options.headers).toEqual({ 'Authorization': 'Bearer token' });
    });
  });

  describe('analyzeWithLighthouse', () => {
    it('デフォルトでmaxWaitForLoadが90秒に設定される（Req 3.1）', async () => {
      const { analyzeWithLighthouse } = await import('../lighthouse');

      await analyzeWithLighthouse('https://example.com');

      expect(mockLighthouseOptions).not.toBeNull();
      expect(mockLighthouseOptions?.maxWaitForLoad).toBe(90000);
    });

    it('デフォルトでmaxWaitForFcpが60秒に設定される（Req 3.2）', async () => {
      const { analyzeWithLighthouse } = await import('../lighthouse');

      await analyzeWithLighthouse('https://example.com');

      expect(mockLighthouseOptions).not.toBeNull();
      expect(mockLighthouseOptions?.maxWaitForFcp).toBe(60000);
    });

    it('デフォルトで広告ドメインがblockedUrlPatternsでブロックされる（Req 3.3, 3.4）', async () => {
      const { analyzeWithLighthouse } = await import('../lighthouse');

      await analyzeWithLighthouse('https://example.com');

      expect(mockLighthouseOptions).not.toBeNull();
      expect(mockLighthouseOptions?.blockedUrlPatterns).toBeDefined();
      const patterns = mockLighthouseOptions?.blockedUrlPatterns as string[];
      expect(patterns).toContain('*doubleclick.net/*');
      expect(patterns).toContain('*googlesyndication.com/*');
    });

    it('blockAds: falseで広告ブロックを無効化できる', async () => {
      const { analyzeWithLighthouse } = await import('../lighthouse');

      await analyzeWithLighthouse('https://example.com', { blockAds: false });

      expect(mockLighthouseOptions).not.toBeNull();
      // blockedUrlPatternsがundefinedまたは空
      const patterns = mockLighthouseOptions?.blockedUrlPatterns as string[] | undefined;
      expect(patterns === undefined || patterns.length === 0).toBe(true);
    });

    it('additionalBlockedPatternsで追加パターンをブロックできる', async () => {
      const { analyzeWithLighthouse } = await import('../lighthouse');

      const additionalBlockedPatterns = ['*custom-tracking.com/*', '*analytics.io/*'];
      await analyzeWithLighthouse('https://example.com', { additionalBlockedPatterns });

      expect(mockLighthouseOptions).not.toBeNull();
      const patterns = mockLighthouseOptions?.blockedUrlPatterns as string[];
      expect(patterns).toContain('*custom-tracking.com/*');
      expect(patterns).toContain('*analytics.io/*');
    });

    it('maxWaitForLoadオプションで上書きできる', async () => {
      const { analyzeWithLighthouse } = await import('../lighthouse');

      await analyzeWithLighthouse('https://example.com', { maxWaitForLoad: 120000 });

      expect(mockLighthouseOptions).not.toBeNull();
      expect(mockLighthouseOptions?.maxWaitForLoad).toBe(120000);
    });

    it('maxWaitForFcpオプションで上書きできる', async () => {
      const { analyzeWithLighthouse } = await import('../lighthouse');

      await analyzeWithLighthouse('https://example.com', { maxWaitForFcp: 90000 });

      expect(mockLighthouseOptions).not.toBeNull();
      expect(mockLighthouseOptions?.maxWaitForFcp).toBe(90000);
    });

    it('認証オプションが引き継がれる', async () => {
      const { analyzeWithLighthouse } = await import('../lighthouse');

      const authOptions = {
        headers: { 'Authorization': 'Bearer token' },
      };
      await analyzeWithLighthouse('https://example.com', authOptions);

      expect(mockLighthouseOptions).not.toBeNull();
      expect(mockLighthouseOptions?.extraHeaders).toEqual({ 'Authorization': 'Bearer token' });
    });

    it('分析結果の構造が正しい', async () => {
      const { analyzeWithLighthouse } = await import('../lighthouse');

      const result = await analyzeWithLighthouse('https://example.com');

      expect(result).toHaveProperty('violations');
      expect(result).toHaveProperty('passes');
      expect(result).toHaveProperty('incomplete');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('scores');
      expect(typeof result.duration).toBe('number');
    });

    it('scoresにperformance, accessibility, bestPractices, seoが含まれる', async () => {
      const { analyzeWithLighthouse } = await import('../lighthouse');

      const result = await analyzeWithLighthouse('https://example.com');

      expect(result.scores).toHaveProperty('performance');
      expect(result.scores).toHaveProperty('accessibility');
      expect(result.scores).toHaveProperty('bestPractices');
      expect(result.scores).toHaveProperty('seo');
    });
  });

  describe('Lighthouse分類ロジック改善（Requirements 3.1, 3.2, 3.3）', () => {
    describe('タスク4.1: scoreDisplayModeによる適用外判定', () => {
      it('scoreDisplayModeがnotApplicableの場合はスキップされる', async () => {
        // lighthouseモックを再設定
        const lighthouse = await import('lighthouse');
        vi.mocked(lighthouse.default).mockImplementationOnce(() => {
          return Promise.resolve({
            lhr: {
              categories: {
                performance: { score: 0.9 },
                accessibility: {
                  score: 0.85,
                  auditRefs: [
                    { id: 'image-alt' },
                    { id: 'video-caption' },
                  ],
                },
                'best-practices': { score: 0.8 },
                seo: { score: 0.75 },
              },
              audits: {
                'image-alt': {
                  id: 'image-alt',
                  title: 'Image elements have alt text',
                  description: 'Images require alt text',
                  score: 1,
                  scoreDisplayMode: 'binary',
                },
                'video-caption': {
                  id: 'video-caption',
                  title: 'Video elements have captions',
                  description: 'Videos require captions',
                  score: null,
                  scoreDisplayMode: 'notApplicable',
                },
              },
            },
          });
        });

        const { analyzeWithLighthouse } = await import('../lighthouse');
        const result = await analyzeWithLighthouse('https://example.com');

        // notApplicableのauditはどのカテゴリにも含まれないこと
        const allResults = [...result.violations, ...result.passes, ...result.incomplete];
        const videoCaptionResult = allResults.find(r => r.id === 'video-caption');
        expect(videoCaptionResult).toBeUndefined();

        // image-altはpassesに含まれること
        const imageAltResult = result.passes.find(r => r.id === 'image-alt');
        expect(imageAltResult).toBeDefined();
      });

      it('score === null かつ scoreDisplayMode !== notApplicable の場合のみincomplete', async () => {
        const lighthouse = await import('lighthouse');
        vi.mocked(lighthouse.default).mockImplementationOnce(() => {
          return Promise.resolve({
            lhr: {
              categories: {
                performance: { score: 0.9 },
                accessibility: {
                  score: 0.85,
                  auditRefs: [
                    { id: 'manual-audit' },
                  ],
                },
                'best-practices': { score: 0.8 },
                seo: { score: 0.75 },
              },
              audits: {
                'manual-audit': {
                  id: 'manual-audit',
                  title: 'Manual audit required',
                  description: 'This audit requires manual verification',
                  score: null,
                  scoreDisplayMode: 'manual',
                },
              },
            },
          });
        });

        const { analyzeWithLighthouse } = await import('../lighthouse');
        const result = await analyzeWithLighthouse('https://example.com');

        // score === null かつ notApplicable以外なのでincompleteに含まれる
        const manualAudit = result.incomplete.find(r => r.id === 'manual-audit');
        expect(manualAudit).toBeDefined();
        expect(manualAudit?.classificationReason).toBe('manual-review');
      });
    });

    describe('タスク4.2: 中間スコアの分類閾値を0.5に変更', () => {
      it('0 < score < 0.5 は違反として分類される', async () => {
        const lighthouse = await import('lighthouse');
        vi.mocked(lighthouse.default).mockImplementationOnce(() => {
          return Promise.resolve({
            lhr: {
              categories: {
                performance: { score: 0.9 },
                accessibility: {
                  score: 0.85,
                  auditRefs: [
                    { id: 'color-contrast' },
                  ],
                },
                'best-practices': { score: 0.8 },
                seo: { score: 0.75 },
              },
              audits: {
                'color-contrast': {
                  id: 'color-contrast',
                  title: 'Color contrast',
                  description: 'Background and foreground colors have sufficient contrast',
                  score: 0.3,
                  scoreDisplayMode: 'numeric',
                  details: {
                    type: 'table',
                    items: [],
                  },
                },
              },
            },
          });
        });

        const { analyzeWithLighthouse } = await import('../lighthouse');
        const result = await analyzeWithLighthouse('https://example.com');

        // score < 0.5 なので違反として分類
        const colorContrast = result.violations.find(r => r.id === 'color-contrast');
        expect(colorContrast).toBeDefined();
        expect(colorContrast?.rawScore).toBe(0.3);
      });

      it('0.5 <= score < 1 は達成として分類される', async () => {
        const lighthouse = await import('lighthouse');
        vi.mocked(lighthouse.default).mockImplementationOnce(() => {
          return Promise.resolve({
            lhr: {
              categories: {
                performance: { score: 0.9 },
                accessibility: {
                  score: 0.85,
                  auditRefs: [
                    { id: 'link-name' },
                  ],
                },
                'best-practices': { score: 0.8 },
                seo: { score: 0.75 },
              },
              audits: {
                'link-name': {
                  id: 'link-name',
                  title: 'Links have discernible text',
                  description: 'Links must have discernible text',
                  score: 0.7,
                  scoreDisplayMode: 'numeric',
                  details: {
                    type: 'table',
                    items: [],
                  },
                },
              },
            },
          });
        });

        const { analyzeWithLighthouse } = await import('../lighthouse');
        const result = await analyzeWithLighthouse('https://example.com');

        // score >= 0.5 なので達成として分類
        const linkName = result.passes.find(r => r.id === 'link-name');
        expect(linkName).toBeDefined();
        expect(linkName?.rawScore).toBe(0.7);
      });

      it('score === 0 は違反として分類される', async () => {
        const lighthouse = await import('lighthouse');
        vi.mocked(lighthouse.default).mockImplementationOnce(() => {
          return Promise.resolve({
            lhr: {
              categories: {
                performance: { score: 0.9 },
                accessibility: {
                  score: 0.85,
                  auditRefs: [
                    { id: 'button-name' },
                  ],
                },
                'best-practices': { score: 0.8 },
                seo: { score: 0.75 },
              },
              audits: {
                'button-name': {
                  id: 'button-name',
                  title: 'Buttons have accessible names',
                  description: 'Buttons must have accessible names',
                  score: 0,
                  scoreDisplayMode: 'binary',
                },
              },
            },
          });
        });

        const { analyzeWithLighthouse } = await import('../lighthouse');
        const result = await analyzeWithLighthouse('https://example.com');

        const buttonName = result.violations.find(r => r.id === 'button-name');
        expect(buttonName).toBeDefined();
        expect(buttonName?.rawScore).toBe(0);
      });

      it('score === 1 は達成として分類される', async () => {
        const lighthouse = await import('lighthouse');
        vi.mocked(lighthouse.default).mockImplementationOnce(() => {
          return Promise.resolve({
            lhr: {
              categories: {
                performance: { score: 0.9 },
                accessibility: {
                  score: 0.85,
                  auditRefs: [
                    { id: 'html-has-lang' },
                  ],
                },
                'best-practices': { score: 0.8 },
                seo: { score: 0.75 },
              },
              audits: {
                'html-has-lang': {
                  id: 'html-has-lang',
                  title: 'HTML has lang attribute',
                  description: 'HTML element must have lang attribute',
                  score: 1,
                  scoreDisplayMode: 'binary',
                },
              },
            },
          });
        });

        const { analyzeWithLighthouse } = await import('../lighthouse');
        const result = await analyzeWithLighthouse('https://example.com');

        const htmlHasLang = result.passes.find(r => r.id === 'html-has-lang');
        expect(htmlHasLang).toBeDefined();
        expect(htmlHasLang?.rawScore).toBe(1);
      });

      it('rawScoreフィールドに元のスコアが記録される', async () => {
        const lighthouse = await import('lighthouse');
        vi.mocked(lighthouse.default).mockImplementationOnce(() => {
          return Promise.resolve({
            lhr: {
              categories: {
                performance: { score: 0.9 },
                accessibility: {
                  score: 0.85,
                  auditRefs: [
                    { id: 'test-audit' },
                  ],
                },
                'best-practices': { score: 0.8 },
                seo: { score: 0.75 },
              },
              audits: {
                'test-audit': {
                  id: 'test-audit',
                  title: 'Test audit',
                  description: 'Test description',
                  score: 0.65,
                  scoreDisplayMode: 'numeric',
                },
              },
            },
          });
        });

        const { analyzeWithLighthouse } = await import('../lighthouse');
        const result = await analyzeWithLighthouse('https://example.com');

        const testAudit = result.passes.find(r => r.id === 'test-audit');
        expect(testAudit?.rawScore).toBe(0.65);
      });

      it('classificationReasonがincomplete項目に記録される', async () => {
        const lighthouse = await import('lighthouse');
        vi.mocked(lighthouse.default).mockImplementationOnce(() => {
          return Promise.resolve({
            lhr: {
              categories: {
                performance: { score: 0.9 },
                accessibility: {
                  score: 0.85,
                  auditRefs: [
                    { id: 'informative-audit' },
                  ],
                },
                'best-practices': { score: 0.8 },
                seo: { score: 0.75 },
              },
              audits: {
                'informative-audit': {
                  id: 'informative-audit',
                  title: 'Informative audit',
                  description: 'Informative only',
                  score: null,
                  scoreDisplayMode: 'informative',
                },
              },
            },
          });
        });

        const { analyzeWithLighthouse } = await import('../lighthouse');
        const result = await analyzeWithLighthouse('https://example.com');

        const informativeAudit = result.incomplete.find(r => r.id === 'informative-audit');
        expect(informativeAudit).toBeDefined();
        expect(informativeAudit?.classificationReason).toBe('insufficient-data');
      });
    });

    describe('タスク4.3: audit.details.itemsからノード情報を抽出', () => {
      it('details.type === "table" の場合、items[].nodeからノード情報を抽出する', async () => {
        const lighthouse = await import('lighthouse');
        vi.mocked(lighthouse.default).mockImplementationOnce(() => {
          return Promise.resolve({
            lhr: {
              categories: {
                performance: { score: 0.9 },
                accessibility: {
                  score: 0.85,
                  auditRefs: [
                    { id: 'color-contrast' },
                  ],
                },
                'best-practices': { score: 0.8 },
                seo: { score: 0.75 },
              },
              audits: {
                'color-contrast': {
                  id: 'color-contrast',
                  title: 'Color contrast',
                  description: 'Test',
                  score: 0,
                  scoreDisplayMode: 'binary',
                  details: {
                    type: 'table',
                    items: [
                      {
                        node: {
                          selector: 'p.low-contrast',
                          snippet: '<p class="low-contrast" style="color: #999">Low contrast text</p>',
                          nodeLabel: 'Low contrast text',
                        },
                      },
                      {
                        node: {
                          selector: 'span.faded',
                          snippet: '<span class="faded">Faded text</span>',
                          nodeLabel: 'Faded text',
                        },
                      },
                    ],
                  },
                },
              },
            },
          });
        });

        const { analyzeWithLighthouse } = await import('../lighthouse');
        const result = await analyzeWithLighthouse('https://example.com');

        const colorContrast = result.violations.find(r => r.id === 'color-contrast');
        expect(colorContrast).toBeDefined();
        expect(colorContrast?.nodes).toHaveLength(2);
        expect(colorContrast?.nodes?.[0].target).toBe('p.low-contrast');
        expect(colorContrast?.nodes?.[0].html).toContain('<p class="low-contrast"');
        expect(colorContrast?.nodes?.[1].target).toBe('span.faded');
      });

      it('details.type === "list" の場合、itemsから直接ノード情報を抽出する', async () => {
        const lighthouse = await import('lighthouse');
        vi.mocked(lighthouse.default).mockImplementationOnce(() => {
          return Promise.resolve({
            lhr: {
              categories: {
                performance: { score: 0.9 },
                accessibility: {
                  score: 0.85,
                  auditRefs: [
                    { id: 'link-name' },
                  ],
                },
                'best-practices': { score: 0.8 },
                seo: { score: 0.75 },
              },
              audits: {
                'link-name': {
                  id: 'link-name',
                  title: 'Links have discernible text',
                  description: 'Test',
                  score: 0,
                  scoreDisplayMode: 'binary',
                  details: {
                    type: 'list',
                    items: [
                      {
                        selector: 'a.empty-link',
                        snippet: '<a class="empty-link" href="/page"></a>',
                        nodeLabel: '',
                      },
                    ],
                  },
                },
              },
            },
          });
        });

        const { analyzeWithLighthouse } = await import('../lighthouse');
        const result = await analyzeWithLighthouse('https://example.com');

        const linkName = result.violations.find(r => r.id === 'link-name');
        expect(linkName).toBeDefined();
        expect(linkName?.nodes).toHaveLength(1);
        expect(linkName?.nodes?.[0].target).toBe('a.empty-link');
        expect(linkName?.nodes?.[0].html).toContain('<a class="empty-link"');
      });

      it('HTML抜粋が200文字を超える場合は切り詰められる', async () => {
        const longHtml = '<div class="test">' + 'x'.repeat(250) + '</div>';
        const lighthouse = await import('lighthouse');
        vi.mocked(lighthouse.default).mockImplementationOnce(() => {
          return Promise.resolve({
            lhr: {
              categories: {
                performance: { score: 0.9 },
                accessibility: {
                  score: 0.85,
                  auditRefs: [
                    { id: 'aria-roles' },
                  ],
                },
                'best-practices': { score: 0.8 },
                seo: { score: 0.75 },
              },
              audits: {
                'aria-roles': {
                  id: 'aria-roles',
                  title: 'ARIA roles are valid',
                  description: 'Test',
                  score: 0,
                  scoreDisplayMode: 'binary',
                  details: {
                    type: 'table',
                    items: [
                      {
                        node: {
                          selector: 'div.test',
                          snippet: longHtml,
                          nodeLabel: 'Test',
                        },
                      },
                    ],
                  },
                },
              },
            },
          });
        });

        const { analyzeWithLighthouse } = await import('../lighthouse');
        const result = await analyzeWithLighthouse('https://example.com');

        const ariaRoles = result.violations.find(r => r.id === 'aria-roles');
        expect(ariaRoles?.nodes?.[0].html.length).toBeLessThanOrEqual(203); // 200 + "..."
      });

      it('nodeCountはノード配列の長さを反映する', async () => {
        const lighthouse = await import('lighthouse');
        vi.mocked(lighthouse.default).mockImplementationOnce(() => {
          return Promise.resolve({
            lhr: {
              categories: {
                performance: { score: 0.9 },
                accessibility: {
                  score: 0.85,
                  auditRefs: [
                    { id: 'image-alt' },
                  ],
                },
                'best-practices': { score: 0.8 },
                seo: { score: 0.75 },
              },
              audits: {
                'image-alt': {
                  id: 'image-alt',
                  title: 'Images have alt text',
                  description: 'Test',
                  score: 0,
                  scoreDisplayMode: 'binary',
                  details: {
                    type: 'table',
                    items: [
                      { node: { selector: 'img#1', snippet: '<img id="1">', nodeLabel: 'Image 1' } },
                      { node: { selector: 'img#2', snippet: '<img id="2">', nodeLabel: 'Image 2' } },
                      { node: { selector: 'img#3', snippet: '<img id="3">', nodeLabel: 'Image 3' } },
                    ],
                  },
                },
              },
            },
          });
        });

        const { analyzeWithLighthouse } = await import('../lighthouse');
        const result = await analyzeWithLighthouse('https://example.com');

        const imageAlt = result.violations.find(r => r.id === 'image-alt');
        expect(imageAlt?.nodeCount).toBe(3);
        expect(imageAlt?.nodes).toHaveLength(3);
      });

      it('details がない場合は nodes は空配列', async () => {
        const lighthouse = await import('lighthouse');
        vi.mocked(lighthouse.default).mockImplementationOnce(() => {
          return Promise.resolve({
            lhr: {
              categories: {
                performance: { score: 0.9 },
                accessibility: {
                  score: 0.85,
                  auditRefs: [
                    { id: 'bypass' },
                  ],
                },
                'best-practices': { score: 0.8 },
                seo: { score: 0.75 },
              },
              audits: {
                'bypass': {
                  id: 'bypass',
                  title: 'Skip links',
                  description: 'Page has skip links',
                  score: 0,
                  scoreDisplayMode: 'binary',
                  // detailsがない
                },
              },
            },
          });
        });

        const { analyzeWithLighthouse } = await import('../lighthouse');
        const result = await analyzeWithLighthouse('https://example.com');

        const bypass = result.violations.find(r => r.id === 'bypass');
        expect(bypass?.nodes).toEqual([]);
      });
    });
  });
});
