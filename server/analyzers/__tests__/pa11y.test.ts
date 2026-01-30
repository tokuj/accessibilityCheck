/**
 * Pa11y分析のユニットテスト
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// pa11yモジュールをモック
const mockPa11y = vi.fn();
vi.mock('pa11y', () => ({
  default: mockPa11y,
}));

// ../configをモック
vi.mock('../../config', () => ({
  getAdBlockingConfig: vi.fn().mockReturnValue({
    enabled: true,
    adSelectors: [
      'iframe[src*="ads"]',
      'iframe[src*="doubleclick"]',
      '.adsbygoogle',
      '[class*="ad-"]',
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
    '[class*="ad-"]',
  ],
}));

describe('Pa11yAnalyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトのモック結果
    mockPa11y.mockResolvedValue({
      issues: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Pa11yAnalyzerOptions型定義', () => {
    it('timeoutオプションを持つ', async () => {
      const { Pa11yAnalyzerOptions } = await import('../pa11y');
      const options: import('../pa11y').Pa11yAnalyzerOptions = {
        timeout: 90000,
      };
      expect(options.timeout).toBe(90000);
    });

    it('waitオプションを持つ', async () => {
      const options: import('../pa11y').Pa11yAnalyzerOptions = {
        wait: 3000,
      };
      expect(options.wait).toBe(3000);
    });

    it('hideAdsオプションを持つ', async () => {
      const options: import('../pa11y').Pa11yAnalyzerOptions = {
        hideAds: true,
      };
      expect(options.hideAds).toBe(true);
    });

    it('additionalHideElementsオプションを持つ', async () => {
      const options: import('../pa11y').Pa11yAnalyzerOptions = {
        additionalHideElements: ['.custom-ad', '#banner'],
      };
      expect(options.additionalHideElements).toContain('.custom-ad');
      expect(options.additionalHideElements).toContain('#banner');
    });

    it('全てのオプションを組み合わせることができる', async () => {
      const options: import('../pa11y').Pa11yAnalyzerOptions = {
        timeout: 90000,
        wait: 3000,
        hideAds: true,
        additionalHideElements: ['.custom-ad'],
        headers: { 'Authorization': 'Bearer token' },
        username: 'user',
        password: 'pass',
      };

      expect(options.timeout).toBe(90000);
      expect(options.wait).toBe(3000);
      expect(options.hideAds).toBe(true);
      expect(options.additionalHideElements).toEqual(['.custom-ad']);
      expect(options.headers).toEqual({ 'Authorization': 'Bearer token' });
    });
  });

  describe('analyzeWithPa11y', () => {
    it('デフォルトでタイムアウトが90秒に設定される（Req 2.1）', async () => {
      const { analyzeWithPa11y } = await import('../pa11y');

      await analyzeWithPa11y('https://example.com');

      expect(mockPa11y).toHaveBeenCalled();
      const callArgs = mockPa11y.mock.calls[0][1];
      expect(callArgs.timeout).toBe(90000);
    });

    it('デフォルトでwaitが3秒に設定される（Req 2.2）', async () => {
      const { analyzeWithPa11y } = await import('../pa11y');

      await analyzeWithPa11y('https://example.com');

      expect(mockPa11y).toHaveBeenCalled();
      const callArgs = mockPa11y.mock.calls[0][1];
      expect(callArgs.wait).toBe(3000);
    });

    it('デフォルトで広告要素がhideElementsで非表示になる（Req 2.3, 2.4）', async () => {
      const { analyzeWithPa11y } = await import('../pa11y');

      await analyzeWithPa11y('https://example.com');

      expect(mockPa11y).toHaveBeenCalled();
      const callArgs = mockPa11y.mock.calls[0][1];
      expect(callArgs.hideElements).toBeDefined();
      expect(callArgs.hideElements).toContain('iframe[src*="ads"]');
      expect(callArgs.hideElements).toContain('.adsbygoogle');
    });

    it('hideAds: falseで広告非表示を無効化できる', async () => {
      const { analyzeWithPa11y } = await import('../pa11y');

      await analyzeWithPa11y('https://example.com', { hideAds: false });

      expect(mockPa11y).toHaveBeenCalled();
      const callArgs = mockPa11y.mock.calls[0][1];
      // hideAds=falseの場合、広告セレクタがhideElementsに含まれない
      // hideElementsがundefinedまたは広告セレクタを含まない
      expect(callArgs.hideElements).toBeUndefined();
    });

    it('additionalHideElementsで追加セレクタを非表示にできる', async () => {
      const { analyzeWithPa11y } = await import('../pa11y');

      const additionalHideElements = ['.my-custom-ad', '#my-ad-container'];
      await analyzeWithPa11y('https://example.com', { additionalHideElements });

      expect(mockPa11y).toHaveBeenCalled();
      const callArgs = mockPa11y.mock.calls[0][1];
      // 追加セレクタがhideElementsに含まれることを確認
      expect(callArgs.hideElements).toContain('.my-custom-ad');
      expect(callArgs.hideElements).toContain('#my-ad-container');
    });

    it('timeoutオプションで上書きできる', async () => {
      const { analyzeWithPa11y } = await import('../pa11y');

      await analyzeWithPa11y('https://example.com', { timeout: 120000 });

      expect(mockPa11y).toHaveBeenCalled();
      const callArgs = mockPa11y.mock.calls[0][1];
      expect(callArgs.timeout).toBe(120000);
    });

    it('waitオプションで上書きできる', async () => {
      const { analyzeWithPa11y } = await import('../pa11y');

      await analyzeWithPa11y('https://example.com', { wait: 5000 });

      expect(mockPa11y).toHaveBeenCalled();
      const callArgs = mockPa11y.mock.calls[0][1];
      expect(callArgs.wait).toBe(5000);
    });

    it('認証オプションが引き継がれる', async () => {
      const { analyzeWithPa11y } = await import('../pa11y');

      const authOptions = {
        headers: { 'Authorization': 'Bearer token' },
        username: 'user',
        password: 'pass',
      };
      await analyzeWithPa11y('https://example.com', authOptions);

      expect(mockPa11y).toHaveBeenCalled();
      const callArgs = mockPa11y.mock.calls[0][1];
      expect(callArgs.headers).toEqual({ 'Authorization': 'Bearer token' });
      expect(callArgs.page?.settings?.userName).toBe('user');
      expect(callArgs.page?.settings?.password).toBe('pass');
    });

    it('分析結果の構造が正しい', async () => {
      const { analyzeWithPa11y } = await import('../pa11y');

      const result = await analyzeWithPa11y('https://example.com');

      expect(result).toHaveProperty('violations');
      expect(result).toHaveProperty('passes');
      expect(result).toHaveProperty('incomplete');
      expect(result).toHaveProperty('duration');
      expect(typeof result.duration).toBe('number');
    });

    it('issuesがerrorの場合はviolationsに含まれる', async () => {
      mockPa11y.mockResolvedValue({
        issues: [
          {
            type: 'error',
            code: 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37',
            message: 'Img element missing an alt attribute.',
          },
        ],
      });

      const { analyzeWithPa11y } = await import('../pa11y');
      const result = await analyzeWithPa11y('https://example.com');

      expect(result.violations.length).toBe(1);
      expect(result.violations[0].toolSource).toBe('pa11y');
    });

    it('issuesがwarningの場合はincompleteに含まれる', async () => {
      mockPa11y.mockResolvedValue({
        issues: [
          {
            type: 'warning',
            code: 'WCAG2AA.Principle1.Guideline1_4.1_4_3.G18',
            message: 'This element has insufficient contrast.',
          },
        ],
      });

      const { analyzeWithPa11y } = await import('../pa11y');
      const result = await analyzeWithPa11y('https://example.com');

      expect(result.incomplete.length).toBe(1);
      expect(result.incomplete[0].toolSource).toBe('pa11y');
    });
  });

  describe('ノード情報抽出 (Req 1.3, 3.1)', () => {
    it('違反結果にノード情報配列が含まれる', async () => {
      mockPa11y.mockResolvedValue({
        issues: [
          {
            type: 'error',
            code: 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37',
            message: 'Img element missing an alt attribute.',
            selector: 'html > body > img.hero-image',
            context: '<img src="hero.jpg" class="hero-image">',
          },
        ],
      });

      const { analyzeWithPa11y } = await import('../pa11y');
      const result = await analyzeWithPa11y('https://example.com');

      expect(result.violations[0].nodes).toBeDefined();
      expect(result.violations[0].nodes).toHaveLength(1);
    });

    it('ノード情報にtargetとhtmlが含まれる', async () => {
      mockPa11y.mockResolvedValue({
        issues: [
          {
            type: 'error',
            code: 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37',
            message: 'Img element missing an alt attribute.',
            selector: 'html > body > img.hero-image',
            context: '<img src="hero.jpg" class="hero-image">',
          },
        ],
      });

      const { analyzeWithPa11y } = await import('../pa11y');
      const result = await analyzeWithPa11y('https://example.com');

      const node = result.violations[0].nodes?.[0];
      expect(node).toBeDefined();
      expect(node?.target).toBe('html > body > img.hero-image');
      expect(node?.html).toBe('<img src="hero.jpg" class="hero-image">');
    });

    it('Pa11yはfailureSummaryを持たない（axe-core固有のため）', async () => {
      mockPa11y.mockResolvedValue({
        issues: [
          {
            type: 'error',
            code: 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37',
            message: 'Img element missing an alt attribute.',
            selector: 'html > body > img',
            context: '<img src="photo.jpg">',
          },
        ],
      });

      const { analyzeWithPa11y } = await import('../pa11y');
      const result = await analyzeWithPa11y('https://example.com');

      const node = result.violations[0].nodes?.[0];
      expect(node?.failureSummary).toBeUndefined();
    });

    it('1イシュー=1ノードのため、nodes配列は常に1要素', async () => {
      mockPa11y.mockResolvedValue({
        issues: [
          {
            type: 'error',
            code: 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37',
            message: 'Img element missing an alt attribute.',
            selector: 'img:nth-child(1)',
            context: '<img src="a.jpg">',
          },
          {
            type: 'error',
            code: 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37',
            message: 'Img element missing an alt attribute.',
            selector: 'img:nth-child(2)',
            context: '<img src="b.jpg">',
          },
        ],
      });

      const { analyzeWithPa11y } = await import('../pa11y');
      const result = await analyzeWithPa11y('https://example.com');

      // 各違反は個別のRuleResultとして報告される
      expect(result.violations.length).toBe(2);
      expect(result.violations[0].nodes).toHaveLength(1);
      expect(result.violations[1].nodes).toHaveLength(1);
    });

    it('HTML抜粋（context）が200文字を超える場合は切り詰められる', async () => {
      const longContext = '<div class="very-long-element">' + 'a'.repeat(250) + '</div>';

      mockPa11y.mockResolvedValue({
        issues: [
          {
            type: 'error',
            code: 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37',
            message: 'Some accessibility violation.',
            selector: 'html > body > div.orphan',
            context: longContext,
          },
        ],
      });

      const { analyzeWithPa11y } = await import('../pa11y');
      const result = await analyzeWithPa11y('https://example.com');

      const node = result.violations[0].nodes?.[0];
      expect(node?.html.length).toBeLessThanOrEqual(200);
      expect(node?.html.endsWith('...')).toBe(true);
    });

    it('incompleteにもノード情報が含まれる', async () => {
      mockPa11y.mockResolvedValue({
        issues: [
          {
            type: 'warning',
            code: 'WCAG2AA.Principle1.Guideline1_4.1_4_3.G18',
            message: 'This element has insufficient contrast.',
            selector: 'span.light-text',
            context: '<span class="light-text">Low contrast</span>',
          },
        ],
      });

      const { analyzeWithPa11y } = await import('../pa11y');
      const result = await analyzeWithPa11y('https://example.com');

      expect(result.incomplete[0].nodes).toBeDefined();
      expect(result.incomplete[0].nodes).toHaveLength(1);
      expect(result.incomplete[0].nodes?.[0].target).toBe('span.light-text');
    });

    it('selectorがundefinedの場合は空文字列を使用', async () => {
      mockPa11y.mockResolvedValue({
        issues: [
          {
            type: 'error',
            code: 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37',
            message: 'Some accessibility violation.',
            selector: undefined,
            context: '<img src="photo.jpg">',
          },
        ],
      });

      const { analyzeWithPa11y } = await import('../pa11y');
      const result = await analyzeWithPa11y('https://example.com');

      const node = result.violations[0].nodes?.[0];
      expect(node?.target).toBe('');
    });

    it('contextがundefinedの場合は空文字列を使用', async () => {
      mockPa11y.mockResolvedValue({
        issues: [
          {
            type: 'error',
            code: 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37',
            message: 'Some accessibility violation.',
            selector: 'html > body > img',
            context: undefined,
          },
        ],
      });

      const { analyzeWithPa11y } = await import('../pa11y');
      const result = await analyzeWithPa11y('https://example.com');

      const node = result.violations[0].nodes?.[0];
      expect(node?.html).toBe('');
    });

    it('nodeCountは後方互換性のため維持される', async () => {
      mockPa11y.mockResolvedValue({
        issues: [
          {
            type: 'error',
            code: 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37',
            message: 'Img element missing an alt attribute.',
            selector: 'html > body > img',
            context: '<img src="photo.jpg">',
          },
        ],
      });

      const { analyzeWithPa11y } = await import('../pa11y');
      const result = await analyzeWithPa11y('https://example.com');

      // Pa11yは1イシュー=1ノードなのでnodeCountは常に1
      expect(result.violations[0].nodeCount).toBe(1);
      expect(result.violations[0].nodes).toHaveLength(1);
    });
  });
});
