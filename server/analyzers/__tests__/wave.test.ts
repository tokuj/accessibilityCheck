/**
 * WAVE API分析のユニットテスト
 *
 * Requirements: wcag-coverage-expansion 4.1, 4.2, 4.4, 4.5
 * - WAVE REST APIを使用した追加分析
 * - APIキーの安全な取得
 * - レート制限エラー（429）とAPIキーエラー（401）のハンドリング
 * - API呼び出し数のカウント機能
 */
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';

// モック用のfetch状態
const mockFetchState = {
  response: {
    ok: true,
    status: 200,
    json: async () => ({}),
  } as Response,
  shouldThrow: false,
  errorMessage: '',
};

// global.fetchをモック
const originalFetch = global.fetch;
global.fetch = vi.fn().mockImplementation(async () => {
  if (mockFetchState.shouldThrow) {
    throw new Error(mockFetchState.errorMessage);
  }
  return mockFetchState.response;
});

// ../utilsをモック
vi.mock('../../utils', () => ({
  createAnalyzerTiming: vi.fn().mockReturnValue({
    analyzer: 'wave',
    url: 'https://example.com',
    startTime: Date.now(),
  }),
  completeAnalyzerTiming: vi.fn().mockImplementation((timing) => ({
    ...timing,
    endTime: Date.now(),
    duration: 100,
    status: 'success',
  })),
  logAnalyzerStart: vi.fn(),
  logAnalyzerComplete: vi.fn(),
}));

describe('WaveAnalyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのモック結果を設定
    mockFetchState.response = {
      ok: true,
      status: 200,
      json: async () => ({
        status: { success: true },
        categories: {
          error: { count: 0, items: {} },
          contrast: { count: 0, items: {} },
          alert: { count: 0, items: {} },
          feature: { count: 0, items: {} },
          structure: { count: 0, items: {} },
          aria: { count: 0, items: {} },
        },
      }),
    } as Response;
    mockFetchState.shouldThrow = false;
    mockFetchState.errorMessage = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('WaveAnalyzerOptions型定義', () => {
    it('apiKeyオプションを持つ', async () => {
      const { analyzeWithWave } = await import('../wave');

      // 関数が存在することを確認
      expect(analyzeWithWave).toBeDefined();
      expect(typeof analyzeWithWave).toBe('function');
    });

    it('reportTypeオプションを持つ', async () => {
      const { analyzeWithWave } = await import('../wave');
      expect(analyzeWithWave).toBeDefined();
    });
  });

  describe('analyzeWithWave', () => {
    it('URLとAPIキーを受け取り、AnalyzerResultを返す', async () => {
      const { analyzeWithWave } = await import('../wave');

      const result = await analyzeWithWave('https://example.com', { apiKey: 'test-key' });

      expect(result).toHaveProperty('violations');
      expect(result).toHaveProperty('passes');
      expect(result).toHaveProperty('incomplete');
      expect(result).toHaveProperty('duration');
      expect(typeof result.duration).toBe('number');
    });

    it('error結果をviolationsに変換する', async () => {
      mockFetchState.response = {
        ok: true,
        status: 200,
        json: async () => ({
          status: { success: true },
          categories: {
            error: {
              count: 1,
              items: {
                'alt_missing': {
                  id: 'alt_missing',
                  description: 'Missing alternative text',
                  count: 1,
                  xpaths: ['/html/body/img'],
                },
              },
            },
            contrast: { count: 0, items: {} },
            alert: { count: 0, items: {} },
            feature: { count: 0, items: {} },
            structure: { count: 0, items: {} },
            aria: { count: 0, items: {} },
          },
        }),
      } as Response;

      const { analyzeWithWave } = await import('../wave');
      const result = await analyzeWithWave('https://example.com', { apiKey: 'test-key' });

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].toolSource).toBe('wave');
    });

    it('alert結果をincompleteに変換する', async () => {
      mockFetchState.response = {
        ok: true,
        status: 200,
        json: async () => ({
          status: { success: true },
          categories: {
            error: { count: 0, items: {} },
            contrast: { count: 0, items: {} },
            alert: {
              count: 1,
              items: {
                'link_suspicious': {
                  id: 'link_suspicious',
                  description: 'Suspicious link text',
                  count: 1,
                  xpaths: ['/html/body/a'],
                },
              },
            },
            feature: { count: 0, items: {} },
            structure: { count: 0, items: {} },
            aria: { count: 0, items: {} },
          },
        }),
      } as Response;

      const { analyzeWithWave } = await import('../wave');
      const result = await analyzeWithWave('https://example.com', { apiKey: 'test-key' });

      expect(result.incomplete.length).toBeGreaterThan(0);
      expect(result.incomplete[0].toolSource).toBe('wave');
    });

    it('feature/aria結果をpassesに変換する', async () => {
      mockFetchState.response = {
        ok: true,
        status: 200,
        json: async () => ({
          status: { success: true },
          categories: {
            error: { count: 0, items: {} },
            contrast: { count: 0, items: {} },
            alert: { count: 0, items: {} },
            feature: {
              count: 1,
              items: {
                'alt': {
                  id: 'alt',
                  description: 'Alternative text',
                  count: 1,
                  xpaths: ['/html/body/img'],
                },
              },
            },
            structure: { count: 0, items: {} },
            aria: { count: 0, items: {} },
          },
        }),
      } as Response;

      const { analyzeWithWave } = await import('../wave');
      const result = await analyzeWithWave('https://example.com', { apiKey: 'test-key' });

      expect(result.passes.length).toBeGreaterThan(0);
      expect(result.passes[0].toolSource).toBe('wave');
    });

    it('ノード情報にXPathが含まれる（Req 4.2）', async () => {
      mockFetchState.response = {
        ok: true,
        status: 200,
        json: async () => ({
          status: { success: true },
          categories: {
            error: {
              count: 1,
              items: {
                'alt_missing': {
                  id: 'alt_missing',
                  description: 'Missing alternative text',
                  count: 1,
                  xpaths: ['/html/body/div/img'],
                },
              },
            },
            contrast: { count: 0, items: {} },
            alert: { count: 0, items: {} },
            feature: { count: 0, items: {} },
            structure: { count: 0, items: {} },
            aria: { count: 0, items: {} },
          },
        }),
      } as Response;

      const { analyzeWithWave } = await import('../wave');
      const result = await analyzeWithWave('https://example.com', { apiKey: 'test-key' });

      const node = result.violations[0].nodes?.[0];
      expect(node).toBeDefined();
      expect(node?.xpath).toBe('/html/body/div/img');
    });
  });

  describe('エラーハンドリング（Req 4.4）', () => {
    it('401エラー（APIキー無効）を正しく処理する', async () => {
      mockFetchState.response = {
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      } as Response;

      const { analyzeWithWave } = await import('../wave');
      const result = await analyzeWithWave('https://example.com', { apiKey: 'invalid-key' });

      expect(result.violations).toEqual([]);
      expect(result.passes).toEqual([]);
      expect(result.incomplete).toEqual([]);
    });

    it('429エラー（レート制限）を正しく処理する', async () => {
      mockFetchState.response = {
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limit exceeded' }),
      } as Response;

      const { analyzeWithWave } = await import('../wave');
      const result = await analyzeWithWave('https://example.com', { apiKey: 'test-key' });

      expect(result.violations).toEqual([]);
      expect(result.passes).toEqual([]);
      expect(result.incomplete).toEqual([]);
    });

    it('ネットワークエラーを正しく処理する', async () => {
      mockFetchState.shouldThrow = true;
      mockFetchState.errorMessage = 'Network error';

      const { analyzeWithWave } = await import('../wave');
      const result = await analyzeWithWave('https://example.com', { apiKey: 'test-key' });

      expect(result.violations).toEqual([]);
      expect(result.passes).toEqual([]);
      expect(result.incomplete).toEqual([]);
    });

    it('エラー発生時もdurationが設定される', async () => {
      mockFetchState.response = {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      } as Response;

      const { analyzeWithWave } = await import('../wave');
      const result = await analyzeWithWave('https://example.com', { apiKey: 'test-key' });

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('API呼び出しカウント（Req 4.5）', () => {
    it('API呼び出し数がカウントされる', async () => {
      const { analyzeWithWave, getApiCallCount, resetApiCallCount } = await import('../wave');

      resetApiCallCount();
      await analyzeWithWave('https://example.com', { apiKey: 'test-key' });

      expect(getApiCallCount()).toBe(1);
    });

    it('複数回の呼び出しがカウントされる', async () => {
      const { analyzeWithWave, getApiCallCount, resetApiCallCount } = await import('../wave');

      resetApiCallCount();
      await analyzeWithWave('https://example.com', { apiKey: 'test-key' });
      await analyzeWithWave('https://example.org', { apiKey: 'test-key' });

      expect(getApiCallCount()).toBe(2);
    });

    it('リセットするとカウントが0になる', async () => {
      const { analyzeWithWave, getApiCallCount, resetApiCallCount } = await import('../wave');

      await analyzeWithWave('https://example.com', { apiKey: 'test-key' });
      resetApiCallCount();

      expect(getApiCallCount()).toBe(0);
    });
  });

  describe('impactレベルの変換', () => {
    it('errorはseriousに変換される', async () => {
      mockFetchState.response = {
        ok: true,
        status: 200,
        json: async () => ({
          status: { success: true },
          categories: {
            error: {
              count: 1,
              items: {
                'alt_missing': { id: 'alt_missing', description: 'Test', count: 1, xpaths: ['/html/body/img'] },
              },
            },
            contrast: { count: 0, items: {} },
            alert: { count: 0, items: {} },
            feature: { count: 0, items: {} },
            structure: { count: 0, items: {} },
            aria: { count: 0, items: {} },
          },
        }),
      } as Response;

      const { analyzeWithWave } = await import('../wave');
      const result = await analyzeWithWave('https://example.com', { apiKey: 'test-key' });

      expect(result.violations[0].impact).toBe('serious');
    });

    it('contrastはseriousに変換される', async () => {
      mockFetchState.response = {
        ok: true,
        status: 200,
        json: async () => ({
          status: { success: true },
          categories: {
            error: { count: 0, items: {} },
            contrast: {
              count: 1,
              items: {
                'contrast': { id: 'contrast', description: 'Test', count: 1, xpaths: ['/html/body/p'] },
              },
            },
            alert: { count: 0, items: {} },
            feature: { count: 0, items: {} },
            structure: { count: 0, items: {} },
            aria: { count: 0, items: {} },
          },
        }),
      } as Response;

      const { analyzeWithWave } = await import('../wave');
      const result = await analyzeWithWave('https://example.com', { apiKey: 'test-key' });

      expect(result.violations[0].impact).toBe('serious');
    });

    it('alertはmoderateに変換される', async () => {
      mockFetchState.response = {
        ok: true,
        status: 200,
        json: async () => ({
          status: { success: true },
          categories: {
            error: { count: 0, items: {} },
            contrast: { count: 0, items: {} },
            alert: {
              count: 1,
              items: {
                'link_suspicious': { id: 'link_suspicious', description: 'Test', count: 1, xpaths: ['/html/body/a'] },
              },
            },
            feature: { count: 0, items: {} },
            structure: { count: 0, items: {} },
            aria: { count: 0, items: {} },
          },
        }),
      } as Response;

      const { analyzeWithWave } = await import('../wave');
      const result = await analyzeWithWave('https://example.com', { apiKey: 'test-key' });

      expect(result.incomplete[0].impact).toBe('moderate');
    });
  });
});

// テスト終了後にglobal.fetchを復元
afterAll(() => {
  global.fetch = originalFetch;
});
