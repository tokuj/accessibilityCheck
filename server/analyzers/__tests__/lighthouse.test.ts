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
});
