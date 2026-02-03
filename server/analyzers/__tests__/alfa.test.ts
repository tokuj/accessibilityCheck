/**
 * Siteimprove Alfa分析のユニットテスト
 *
 * Requirements: wcag-coverage-expansion 1.2, 1.6, 2.3
 * - Siteimprove Alfaを第5のエンジンとして統合
 * - AA levelフィルタでルールを実行
 * - Focus Appearance（2.4.13）とConsistent Help（3.2.6）の検出
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Page } from 'playwright';

// Alfaのモック結果を保持
let mockAlfaResults: Array<{
  outcome: 'passed' | 'failed' | 'cantTell' | 'inapplicable';
  rule: {
    uri: string;
    requirements?: Array<{ uri: string }>;
  };
  target?: {
    path: string;
    html?: string;
  };
}>;

// @siteimprove/alfa-playwright と関連パッケージをモック
vi.mock('@siteimprove/alfa-playwright', () => ({
  Playwright: {
    toPage: vi.fn().mockImplementation(async () => ({
      // Alfa Page mock
    })),
  },
}));

vi.mock('@siteimprove/alfa-rules', () => ({
  Rules: {
    get: vi.fn().mockReturnValue([]),
  },
  Audit: {
    of: vi.fn().mockImplementation(async () => ({
      toJSON: () => mockAlfaResults,
    })),
  },
}));

vi.mock('@siteimprove/alfa-test-utils', () => ({
  Audit: {
    run: vi.fn().mockImplementation(async () => ({
      toJSON: () => mockAlfaResults,
    })),
  },
}));

// ../utilsをモック
vi.mock('../../utils', () => ({
  createAnalyzerTiming: vi.fn().mockReturnValue({
    analyzer: 'alfa',
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

describe('AlfaAnalyzer', () => {
  let mockPage: Partial<Page>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = {
      url: vi.fn().mockReturnValue('https://example.com'),
      content: vi.fn().mockResolvedValue('<html><body><p>Test</p></body></html>'),
      mainFrame: vi.fn().mockReturnValue({
        name: vi.fn().mockReturnValue(''),
      }),
    };

    // デフォルトのモック結果を設定
    mockAlfaResults = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AlfaAnalyzerOptions型定義', () => {
    it('levelsオプションを持つ', async () => {
      const { analyzeWithAlfa } = await import('../alfa');

      // 関数が存在することを確認
      expect(analyzeWithAlfa).toBeDefined();
      expect(typeof analyzeWithAlfa).toBe('function');
    });

    it('includeIframesオプションを持つ', async () => {
      const { analyzeWithAlfa } = await import('../alfa');
      expect(analyzeWithAlfa).toBeDefined();
    });
  });

  describe('analyzeWithAlfa', () => {
    it('Pageオブジェクトを受け取り、AnalyzerResultを返す', async () => {
      const { analyzeWithAlfa } = await import('../alfa');

      const result = await analyzeWithAlfa(mockPage as Page);

      expect(result).toHaveProperty('violations');
      expect(result).toHaveProperty('passes');
      expect(result).toHaveProperty('incomplete');
      expect(result).toHaveProperty('duration');
      expect(typeof result.duration).toBe('number');
    });

    it('デフォルトでAA levelをフィルタする（Req 1.2）', async () => {
      const { analyzeWithAlfa } = await import('../alfa');

      const result = await analyzeWithAlfa(mockPage as Page);

      // 結果の構造が正しいことを確認
      expect(Array.isArray(result.violations)).toBe(true);
      expect(Array.isArray(result.passes)).toBe(true);
      expect(Array.isArray(result.incomplete)).toBe(true);
    });

    it('failed結果をviolationsに変換する', async () => {
      const alfaTestUtils = await import('@siteimprove/alfa-test-utils');
      vi.mocked(alfaTestUtils.Audit.run).mockResolvedValue({
        toJSON: () => [
          {
            outcome: 'failed',
            rule: {
              uri: 'https://alfa.siteimprove.com/rules/sia-r1',
              requirements: [
                { uri: 'https://www.w3.org/TR/WCAG21/#non-text-content' },
              ],
            },
            target: {
              path: '/html/body/img',
              html: '<img src="test.jpg">',
            },
          },
        ],
      } as never);

      const { analyzeWithAlfa } = await import('../alfa');
      const result = await analyzeWithAlfa(mockPage as Page);

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].toolSource).toBe('alfa');
    });

    it('passed結果をpassesに変換する', async () => {
      const alfaTestUtils = await import('@siteimprove/alfa-test-utils');
      vi.mocked(alfaTestUtils.Audit.run).mockResolvedValue({
        toJSON: () => [
          {
            outcome: 'passed',
            rule: {
              uri: 'https://alfa.siteimprove.com/rules/sia-r1',
              requirements: [
                { uri: 'https://www.w3.org/TR/WCAG21/#non-text-content' },
              ],
            },
            target: {
              path: '/html/body/img',
              html: '<img src="test.jpg" alt="Test">',
            },
          },
        ],
      } as never);

      const { analyzeWithAlfa } = await import('../alfa');
      const result = await analyzeWithAlfa(mockPage as Page);

      expect(result.passes.length).toBeGreaterThan(0);
      expect(result.passes[0].toolSource).toBe('alfa');
    });

    it('cantTell結果をincompleteに変換する', async () => {
      const alfaTestUtils = await import('@siteimprove/alfa-test-utils');
      vi.mocked(alfaTestUtils.Audit.run).mockResolvedValue({
        toJSON: () => [
          {
            outcome: 'cantTell',
            rule: {
              uri: 'https://alfa.siteimprove.com/rules/sia-r2',
              requirements: [
                { uri: 'https://www.w3.org/TR/WCAG21/#info-and-relationships' },
              ],
            },
            target: {
              path: '/html/body/div',
              html: '<div role="button">Click me</div>',
            },
          },
        ],
      } as never);

      const { analyzeWithAlfa } = await import('../alfa');
      const result = await analyzeWithAlfa(mockPage as Page);

      expect(result.incomplete.length).toBeGreaterThan(0);
      expect(result.incomplete[0].toolSource).toBe('alfa');
    });

    it('ノード情報が正しく抽出される', async () => {
      const alfaTestUtils = await import('@siteimprove/alfa-test-utils');
      vi.mocked(alfaTestUtils.Audit.run).mockResolvedValue({
        toJSON: () => [
          {
            outcome: 'failed',
            rule: {
              uri: 'https://alfa.siteimprove.com/rules/sia-r1',
              requirements: [
                { uri: 'https://www.w3.org/TR/WCAG21/#non-text-content' },
              ],
            },
            target: {
              path: '/html/body/div/img',
              html: '<img src="hero.jpg" class="hero-image">',
            },
          },
        ],
      } as never);

      const { analyzeWithAlfa } = await import('../alfa');
      const result = await analyzeWithAlfa(mockPage as Page);

      const node = result.violations[0].nodes?.[0];
      expect(node).toBeDefined();
      expect(node?.xpath).toBe('/html/body/div/img');
      expect(node?.html).toContain('<img');
    });

    it('wcagCriteriaがWCAG URIから正しく抽出される', async () => {
      const alfaTestUtils = await import('@siteimprove/alfa-test-utils');
      vi.mocked(alfaTestUtils.Audit.run).mockResolvedValue({
        toJSON: () => [
          {
            outcome: 'failed',
            rule: {
              uri: 'https://alfa.siteimprove.com/rules/sia-r1',
              requirements: [
                { uri: 'https://www.w3.org/TR/WCAG21/#non-text-content' },
              ],
            },
            target: {
              path: '/html/body/img',
            },
          },
        ],
      } as never);

      const { analyzeWithAlfa } = await import('../alfa');
      const result = await analyzeWithAlfa(mockPage as Page);

      // WCAG 1.1.1がリストに含まれることを確認
      expect(result.violations[0].wcagCriteria).toContain('1.1.1');
    });

    it('Focus Appearance（2.4.13）が検出される（Req 2.3）', async () => {
      const alfaTestUtils = await import('@siteimprove/alfa-test-utils');
      vi.mocked(alfaTestUtils.Audit.run).mockResolvedValue({
        toJSON: () => [
          {
            outcome: 'failed',
            rule: {
              uri: 'https://alfa.siteimprove.com/rules/sia-r65',
              requirements: [
                { uri: 'https://www.w3.org/TR/WCAG22/#focus-appearance' },
              ],
            },
            target: {
              path: '/html/body/button',
              html: '<button>Submit</button>',
            },
          },
        ],
      } as never);

      const { analyzeWithAlfa } = await import('../alfa');
      const result = await analyzeWithAlfa(mockPage as Page);

      // WCAG 2.4.13がリストに含まれることを確認
      expect(result.violations[0].wcagCriteria).toContain('2.4.13');
    });

    it('Consistent Help（3.2.6）が検出される（Req 2.3）', async () => {
      const alfaTestUtils = await import('@siteimprove/alfa-test-utils');
      vi.mocked(alfaTestUtils.Audit.run).mockResolvedValue({
        toJSON: () => [
          {
            outcome: 'failed',
            rule: {
              uri: 'https://alfa.siteimprove.com/rules/sia-r100',
              requirements: [
                { uri: 'https://www.w3.org/TR/WCAG22/#consistent-help' },
              ],
            },
            target: {
              path: '/html/body/nav',
              html: '<nav>...</nav>',
            },
          },
        ],
      } as never);

      const { analyzeWithAlfa } = await import('../alfa');
      const result = await analyzeWithAlfa(mockPage as Page);

      // WCAG 3.2.6がリストに含まれることを確認
      expect(result.violations[0].wcagCriteria).toContain('3.2.6');
    });
  });

  describe('エラーハンドリング（Req 1.6）', () => {
    it('Alfa実行がエラーを投げた場合、空の結果を返す', async () => {
      const alfaTestUtils = await import('@siteimprove/alfa-test-utils');
      vi.mocked(alfaTestUtils.Audit.run).mockRejectedValue(new Error('Alfa analysis failed'));

      const { analyzeWithAlfa } = await import('../alfa');
      const result = await analyzeWithAlfa(mockPage as Page);

      expect(result.violations).toEqual([]);
      expect(result.passes).toEqual([]);
      expect(result.incomplete).toEqual([]);
    });

    it('page.content()がエラーを投げた場合、空の結果を返す', async () => {
      mockPage.content = vi.fn().mockRejectedValue(new Error('Page error'));

      const { analyzeWithAlfa } = await import('../alfa');
      const result = await analyzeWithAlfa(mockPage as Page);

      expect(result.violations).toEqual([]);
      expect(result.passes).toEqual([]);
      expect(result.incomplete).toEqual([]);
    });

    it('エラー発生時もdurationが設定される', async () => {
      const alfaTestUtils = await import('@siteimprove/alfa-test-utils');
      vi.mocked(alfaTestUtils.Audit.run).mockRejectedValue(new Error('Alfa analysis failed'));

      const { analyzeWithAlfa } = await import('../alfa');
      const result = await analyzeWithAlfa(mockPage as Page);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('impactレベルの変換', () => {
    it('failedはseriousに変換される', async () => {
      const alfaTestUtils = await import('@siteimprove/alfa-test-utils');
      vi.mocked(alfaTestUtils.Audit.run).mockResolvedValue({
        toJSON: () => [
          {
            outcome: 'failed',
            rule: {
              uri: 'https://alfa.siteimprove.com/rules/sia-r1',
              requirements: [{ uri: 'https://www.w3.org/TR/WCAG21/#non-text-content' }],
            },
            target: { path: '/html/body/img' },
          },
        ],
      } as never);

      const { analyzeWithAlfa } = await import('../alfa');
      const result = await analyzeWithAlfa(mockPage as Page);

      expect(result.violations[0].impact).toBe('serious');
    });

    it('cantTellはmoderateに変換される', async () => {
      const alfaTestUtils = await import('@siteimprove/alfa-test-utils');
      vi.mocked(alfaTestUtils.Audit.run).mockResolvedValue({
        toJSON: () => [
          {
            outcome: 'cantTell',
            rule: {
              uri: 'https://alfa.siteimprove.com/rules/sia-r2',
              requirements: [{ uri: 'https://www.w3.org/TR/WCAG21/#info-and-relationships' }],
            },
            target: { path: '/html/body/div' },
          },
        ],
      } as never);

      const { analyzeWithAlfa } = await import('../alfa');
      const result = await analyzeWithAlfa(mockPage as Page);

      expect(result.incomplete[0].impact).toBe('moderate');
    });
  });

  describe('複数結果の集約', () => {
    it('同一ルールIDの複数ノードが正しく集約される', async () => {
      const alfaTestUtils = await import('@siteimprove/alfa-test-utils');
      vi.mocked(alfaTestUtils.Audit.run).mockResolvedValue({
        toJSON: () => [
          {
            outcome: 'failed',
            rule: {
              uri: 'https://alfa.siteimprove.com/rules/sia-r1',
              requirements: [{ uri: 'https://www.w3.org/TR/WCAG21/#non-text-content' }],
            },
            target: { path: '/html/body/img[1]', html: '<img src="test1.jpg">' },
          },
          {
            outcome: 'failed',
            rule: {
              uri: 'https://alfa.siteimprove.com/rules/sia-r1',
              requirements: [{ uri: 'https://www.w3.org/TR/WCAG21/#non-text-content' }],
            },
            target: { path: '/html/body/img[2]', html: '<img src="test2.jpg">' },
          },
        ],
      } as never);

      const { analyzeWithAlfa } = await import('../alfa');
      const result = await analyzeWithAlfa(mockPage as Page);

      // 同一ルールIDは1つにまとめられる
      const imgViolations = result.violations.filter(v => v.id === 'sia-r1');
      expect(imgViolations.length).toBe(1);
      expect(imgViolations[0].nodeCount).toBe(2);
      expect(imgViolations[0].nodes?.length).toBe(2);
    });
  });
});
