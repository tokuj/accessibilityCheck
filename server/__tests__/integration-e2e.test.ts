/**
 * 統合テスト - エンドツーエンド動作確認
 *
 * タスク10: 統合とエンドツーエンド動作確認
 * - 10.1: 単一URL分析の後方互換性確認
 * - 10.2: 複数URL分析のエンドツーエンドテスト
 * - 10.3: エラーハンドリングの確認
 *
 * Requirements: 1.1, 1.3, 2.2, 3.1, 3.2, 4.1, 4.4, 4.6, 5.2, 5.3, 5.5
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { PageProgressEvent, SSEEvent, ProgressEvent } from '../analyzers/sse-types';
import type { AccessibilityReport } from '../analyzers/types';

// モックを設定
vi.mock('../analyzer', () => ({
  analyzeUrl: vi.fn(),
}));

import { analyzeMultipleUrls } from '../multi-url-analyzer';
import { analyzeUrl as analyzeUrlMock } from '../analyzer';

/**
 * ヘルパー: モックレポートを生成
 */
function createMockReport(url: string, title: string, violations: number = 2): AccessibilityReport {
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalViolations: violations,
      totalPasses: 10,
      totalIncomplete: 1,
    },
    pages: [
      {
        name: title,
        url,
        violations: Array.from({ length: violations }, (_, i) => ({
          id: `violation-${i}`,
          description: `Violation ${i}`,
          impact: i % 2 === 0 ? 'serious' : 'critical',
          nodeCount: 1,
          helpUrl: '',
          wcagCriteria: [],
          toolSource: 'axe-core',
        })),
        passes: [],
        incomplete: [],
      },
    ],
    screenshot: 'data:image/png;base64,xxx',
    toolsUsed: [{ name: 'axe-core', version: '4.0', duration: 100 }],
    lighthouseScores: { performance: 90, accessibility: 85, bestPractices: 80, seo: 75 },
  };
}

describe('タスク10: 統合とエンドツーエンド動作確認', () => {
  let mockOnProgress: Mock;
  const mockAnalyzeUrl = analyzeUrlMock as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnProgress = vi.fn();
  });

  describe('10.1: 単一URL分析の後方互換性確認 (Requirement 4.6)', () => {
    it('従来どおり単一URLで分析できる', async () => {
      const url = 'https://example.com/single-page';
      mockAnalyzeUrl.mockResolvedValueOnce(createMockReport(url, 'Single Page'));

      const result = await analyzeMultipleUrls([url], { onProgress: mockOnProgress });

      // 単一URLが正常に分析されている
      expect(mockAnalyzeUrl).toHaveBeenCalledTimes(1);
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].url).toBe(url);
      expect(result.pages[0].name).toBe('Single Page');
    });

    it('認証設定が正しく渡される', async () => {
      const url = 'https://example.com/auth-page';
      const authConfig = { type: 'basic' as const, username: 'user', password: 'pass' };

      mockAnalyzeUrl.mockResolvedValueOnce(createMockReport(url, 'Auth Page'));

      await analyzeMultipleUrls([url], {
        onProgress: mockOnProgress,
        authConfig,
      });

      // 認証設定が渡されている
      expect(mockAnalyzeUrl).toHaveBeenCalledWith(
        url,
        authConfig,
        expect.any(Function),
        undefined
      );
    });

    it('storageStateが正しく渡される', async () => {
      const url = 'https://example.com/session-page';
      const storageState = {
        cookies: [{ name: 'session', value: 'abc', domain: 'example.com', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' as const }],
        origins: [],
      };

      mockAnalyzeUrl.mockResolvedValueOnce(createMockReport(url, 'Session Page'));

      await analyzeMultipleUrls([url], {
        onProgress: mockOnProgress,
        storageState,
      });

      // storageStateが渡されている
      expect(mockAnalyzeUrl).toHaveBeenCalledWith(
        url,
        undefined,
        expect.any(Function),
        storageState
      );
    });

    it('レポート形式が従来と互換性がある', async () => {
      const url = 'https://example.com/report';
      mockAnalyzeUrl.mockResolvedValueOnce(createMockReport(url, 'Report Page', 3));

      const result = await analyzeMultipleUrls([url], { onProgress: mockOnProgress });

      // レポート構造が正しい
      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('pages');
      expect(result).toHaveProperty('screenshot');
      expect(result).toHaveProperty('toolsUsed');
      expect(result).toHaveProperty('lighthouseScores');

      // サマリーが正しく計算されている
      expect(result.summary.totalViolations).toBe(3);
      expect(result.summary.totalPasses).toBe(10);
      expect(result.summary.totalIncomplete).toBe(1);
    });

    it('進捗イベントがpage_progressとして送信される', async () => {
      const url = 'https://example.com/progress';
      mockAnalyzeUrl.mockResolvedValueOnce(createMockReport(url, 'Progress Page'));

      await analyzeMultipleUrls([url], { onProgress: mockOnProgress });

      // page_progressイベントが送信されている
      const pageProgressEvents = mockOnProgress.mock.calls
        .map(call => call[0] as SSEEvent)
        .filter((e): e is PageProgressEvent => e.type === 'page_progress');

      expect(pageProgressEvents.length).toBeGreaterThanOrEqual(2); // started + completed
    });
  });

  describe('10.2: 複数URL分析のエンドツーエンドテスト (Requirements: 1.1, 1.3, 3.1, 3.2, 4.1, 4.4, 5.2, 5.3)', () => {
    it('4つのURLを入力し、順次分析が完了する', async () => {
      const urls = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3',
        'https://example.com/page4',
      ];

      urls.forEach((url, i) => {
        mockAnalyzeUrl.mockResolvedValueOnce(createMockReport(url, `Page ${i + 1}`, i + 1));
      });

      const result = await analyzeMultipleUrls(urls, { onProgress: mockOnProgress });

      // 4つ全てが分析されている
      expect(mockAnalyzeUrl).toHaveBeenCalledTimes(4);
      expect(result.pages).toHaveLength(4);

      // 各ページの結果が正しい
      result.pages.forEach((page, i) => {
        expect(page.url).toBe(urls[i]);
        expect(page.name).toBe(`Page ${i + 1}`);
        expect(page.violations).toHaveLength(i + 1);
      });
    });

    it('分析中画面でページ進捗が正しく表示される', async () => {
      const urls = ['https://example.com/page1', 'https://example.com/page2'];

      urls.forEach((url, i) => {
        mockAnalyzeUrl.mockResolvedValueOnce(createMockReport(url, `Page ${i + 1}`));
      });

      await analyzeMultipleUrls(urls, { onProgress: mockOnProgress });

      // page_progressイベントが正しく送信されている
      const pageProgressEvents = mockOnProgress.mock.calls
        .map(call => call[0] as SSEEvent)
        .filter((e): e is PageProgressEvent => e.type === 'page_progress');

      // 各ページに対してstarted + completedが送信される
      expect(pageProgressEvents.filter(e => e.status === 'started')).toHaveLength(2);
      expect(pageProgressEvents.filter(e => e.status === 'completed')).toHaveLength(2);

      // pageIndex, totalPagesが正しい
      const startedEvents = pageProgressEvents.filter(e => e.status === 'started');
      expect(startedEvents[0].pageIndex).toBe(0);
      expect(startedEvents[0].totalPages).toBe(2);
      expect(startedEvents[1].pageIndex).toBe(1);
      expect(startedEvents[1].totalPages).toBe(2);
    });

    it('分析完了後、サマリーが全ページ合計で計算される', async () => {
      const urls = ['https://example.com/page1', 'https://example.com/page2'];

      const report1 = createMockReport(urls[0], 'Page 1');
      report1.summary = { totalViolations: 5, totalPasses: 20, totalIncomplete: 2 };

      const report2 = createMockReport(urls[1], 'Page 2');
      report2.summary = { totalViolations: 3, totalPasses: 15, totalIncomplete: 1 };

      mockAnalyzeUrl
        .mockResolvedValueOnce(report1)
        .mockResolvedValueOnce(report2);

      const result = await analyzeMultipleUrls(urls, { onProgress: mockOnProgress });

      // 合計値が正しい
      expect(result.summary.totalViolations).toBe(8); // 5 + 3
      expect(result.summary.totalPasses).toBe(35); // 20 + 15
      expect(result.summary.totalIncomplete).toBe(3); // 2 + 1
    });

    it('レポート画面でタブ切り替えが機能する（各ページのデータが独立）', async () => {
      const urls = ['https://example.com/page1', 'https://example.com/page2'];

      const report1 = createMockReport(urls[0], 'Page 1', 2);
      const report2 = createMockReport(urls[1], 'Page 2', 5);

      mockAnalyzeUrl
        .mockResolvedValueOnce(report1)
        .mockResolvedValueOnce(report2);

      const result = await analyzeMultipleUrls(urls, { onProgress: mockOnProgress });

      // 各ページのデータが独立している
      expect(result.pages[0].name).toBe('Page 1');
      expect(result.pages[0].violations).toHaveLength(2);

      expect(result.pages[1].name).toBe('Page 2');
      expect(result.pages[1].violations).toHaveLength(5);
    });

    it('認証情報が全URLで共有される', async () => {
      const urls = ['https://example.com/page1', 'https://example.com/page2'];
      const storageState = {
        cookies: [{ name: 'auth', value: 'token', domain: 'example.com', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' as const }],
        origins: [],
      };

      urls.forEach((url, i) => {
        mockAnalyzeUrl.mockResolvedValueOnce(createMockReport(url, `Page ${i + 1}`));
      });

      await analyzeMultipleUrls(urls, { onProgress: mockOnProgress, storageState });

      // 両方の呼び出しでstorageStateが渡されている
      expect(mockAnalyzeUrl).toHaveBeenNthCalledWith(1, urls[0], undefined, expect.any(Function), storageState);
      expect(mockAnalyzeUrl).toHaveBeenNthCalledWith(2, urls[1], undefined, expect.any(Function), storageState);
    });
  });

  describe('10.3: エラーハンドリングの確認 (Requirements: 2.2, 5.5)', () => {
    it('1URLの分析が失敗しても他のURLが継続して分析される', async () => {
      const urls = ['https://example.com/page1', 'https://example.com/page2', 'https://example.com/page3'];

      mockAnalyzeUrl
        .mockResolvedValueOnce(createMockReport(urls[0], 'Page 1'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce(createMockReport(urls[2], 'Page 3'));

      const result = await analyzeMultipleUrls(urls, { onProgress: mockOnProgress });

      // 3つ全てが試行されている
      expect(mockAnalyzeUrl).toHaveBeenCalledTimes(3);

      // 結果は3ページ（成功2 + 失敗1）
      expect(result.pages).toHaveLength(3);

      // 成功したページは正常
      expect(result.pages[0].name).toBe('Page 1');
      expect(result.pages[0].error).toBeUndefined();

      // 失敗したページにはエラー情報がある
      expect(result.pages[1].error).toBeDefined();
      expect(result.pages[1].error?.message).toContain('Connection refused');
      expect(result.pages[1].error?.code).toBe('ANALYSIS_ERROR');

      // 3番目のページも正常に分析されている
      expect(result.pages[2].name).toBe('Page 3');
      expect(result.pages[2].error).toBeUndefined();
    });

    it('失敗したページでもpage_progress (failed)イベントが送信される', async () => {
      const urls = ['https://example.com/fail'];

      mockAnalyzeUrl.mockRejectedValueOnce(new Error('Timeout'));

      await analyzeMultipleUrls(urls, { onProgress: mockOnProgress });

      // failedイベントが送信されている
      const failedEvents = mockOnProgress.mock.calls
        .map(call => call[0] as SSEEvent)
        .filter((e): e is PageProgressEvent => e.type === 'page_progress' && e.status === 'failed');

      expect(failedEvents).toHaveLength(1);
      expect(failedEvents[0].pageIndex).toBe(0);
      expect(failedEvents[0].pageUrl).toBe(urls[0]);
    });

    it('タイムアウトエラーが適切に処理される', async () => {
      const urls = ['https://example.com/slow-page'];

      const timeoutError = new Error('Timeout 90000ms exceeded');
      timeoutError.name = 'TimeoutError';
      mockAnalyzeUrl.mockRejectedValueOnce(timeoutError);

      const result = await analyzeMultipleUrls(urls, { onProgress: mockOnProgress });

      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].error).toBeDefined();
      expect(result.pages[0].error?.message).toContain('Timeout');
    });

    it('全てのURLが失敗した場合も正常にレポートが返される', async () => {
      const urls = ['https://example.com/page1', 'https://example.com/page2'];

      mockAnalyzeUrl
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'));

      const result = await analyzeMultipleUrls(urls, { onProgress: mockOnProgress });

      // 2ページ分の結果がある（全てエラー）
      expect(result.pages).toHaveLength(2);
      expect(result.pages[0].error).toBeDefined();
      expect(result.pages[1].error).toBeDefined();

      // サマリーは0
      expect(result.summary.totalViolations).toBe(0);
      expect(result.summary.totalPasses).toBe(0);
      expect(result.summary.totalIncomplete).toBe(0);
    });

    it('部分失敗時もサマリーは成功ページのみで計算される', async () => {
      const urls = ['https://example.com/page1', 'https://example.com/page2'];

      const report1 = createMockReport(urls[0], 'Page 1');
      report1.summary = { totalViolations: 5, totalPasses: 20, totalIncomplete: 2 };

      mockAnalyzeUrl
        .mockResolvedValueOnce(report1)
        .mockRejectedValueOnce(new Error('Failed'));

      const result = await analyzeMultipleUrls(urls, { onProgress: mockOnProgress });

      // 成功ページのみでサマリーが計算されている
      expect(result.summary.totalViolations).toBe(5);
      expect(result.summary.totalPasses).toBe(20);
      expect(result.summary.totalIncomplete).toBe(2);
    });
  });
});
