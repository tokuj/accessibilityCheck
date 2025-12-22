import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { PageProgressEvent, SSEEvent } from '../analyzers/sse-types';
import type { AccessibilityReport, PageResult } from '../analyzers/types';

// モックを設定
vi.mock('../analyzer', () => ({
  analyzeUrl: vi.fn(),
}));

// テスト対象関数をインポート（実装前にテストを書く）
import { analyzeMultipleUrls, type MultiAnalyzeOptions } from '../multi-url-analyzer';
import { analyzeUrl as analyzeUrlMock } from '../analyzer';

describe('複数URL順次分析機能', () => {
  let mockOnProgress: Mock;
  const mockAnalyzeUrl = analyzeUrlMock as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnProgress = vi.fn();
  });

  /**
   * ヘルパー: モックレポートを生成
   */
  function createMockReport(url: string, title: string): AccessibilityReport {
    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalViolations: 2,
        totalPasses: 10,
        totalIncomplete: 1,
      },
      pages: [
        {
          name: title,
          url,
          violations: [
            { id: 'color-contrast', description: 'Test', impact: 'serious', nodeCount: 1, helpUrl: '', wcagCriteria: [], toolSource: 'axe-core' },
            { id: 'image-alt', description: 'Test', impact: 'critical', nodeCount: 1, helpUrl: '', wcagCriteria: [], toolSource: 'axe-core' },
          ],
          passes: [],
          incomplete: [],
        },
      ],
      screenshot: 'data:image/png;base64,xxx',
      toolsUsed: [{ name: 'axe-core', version: '4.0', duration: 100 }],
    };
  }

  describe('基本的な複数URL分析', () => {
    it('複数URLを順次分析し、結果を集約する', async () => {
      const urls = ['https://example.com/page1', 'https://example.com/page2'];

      mockAnalyzeUrl
        .mockResolvedValueOnce(createMockReport(urls[0], 'Page 1'))
        .mockResolvedValueOnce(createMockReport(urls[1], 'Page 2'));

      const result = await analyzeMultipleUrls(urls, { onProgress: mockOnProgress });

      // 両方のURLが分析されている
      expect(mockAnalyzeUrl).toHaveBeenCalledTimes(2);
      expect(result.pages).toHaveLength(2);
      expect(result.pages[0].url).toBe(urls[0]);
      expect(result.pages[1].url).toBe(urls[1]);
    });

    it('単一URLでも正常に動作する（後方互換）', async () => {
      const urls = ['https://example.com/single'];

      mockAnalyzeUrl.mockResolvedValueOnce(createMockReport(urls[0], 'Single Page'));

      const result = await analyzeMultipleUrls(urls, { onProgress: mockOnProgress });

      expect(mockAnalyzeUrl).toHaveBeenCalledTimes(1);
      expect(result.pages).toHaveLength(1);
    });

    it('4URLまで受け付ける', async () => {
      const urls = [
        'https://example.com/1',
        'https://example.com/2',
        'https://example.com/3',
        'https://example.com/4',
      ];

      urls.forEach((url, i) => {
        mockAnalyzeUrl.mockResolvedValueOnce(createMockReport(url, `Page ${i + 1}`));
      });

      const result = await analyzeMultipleUrls(urls, { onProgress: mockOnProgress });

      expect(mockAnalyzeUrl).toHaveBeenCalledTimes(4);
      expect(result.pages).toHaveLength(4);
    });
  });

  describe('PageProgressEventの送信', () => {
    it('各ページ分析開始時にpage_progressイベント（started）を送信する', async () => {
      const urls = ['https://example.com/page1', 'https://example.com/page2'];

      mockAnalyzeUrl
        .mockResolvedValueOnce(createMockReport(urls[0], 'Page 1'))
        .mockResolvedValueOnce(createMockReport(urls[1], 'Page 2'));

      await analyzeMultipleUrls(urls, { onProgress: mockOnProgress });

      // page_progress (started) イベントが送信されていること
      const startedEvents = mockOnProgress.mock.calls
        .map(call => call[0] as SSEEvent)
        .filter((e): e is PageProgressEvent => e.type === 'page_progress' && e.status === 'started');

      expect(startedEvents).toHaveLength(2);
      expect(startedEvents[0].pageIndex).toBe(0);
      expect(startedEvents[0].totalPages).toBe(2);
      expect(startedEvents[0].pageUrl).toBe(urls[0]);
      expect(startedEvents[1].pageIndex).toBe(1);
      expect(startedEvents[1].totalPages).toBe(2);
      expect(startedEvents[1].pageUrl).toBe(urls[1]);
    });

    it('各ページ分析完了時にpage_progressイベント（completed）を送信する', async () => {
      const urls = ['https://example.com/page1'];

      mockAnalyzeUrl.mockResolvedValueOnce(createMockReport(urls[0], 'Page 1'));

      await analyzeMultipleUrls(urls, { onProgress: mockOnProgress });

      // page_progress (completed) イベントが送信されていること
      const completedEvents = mockOnProgress.mock.calls
        .map(call => call[0] as SSEEvent)
        .filter((e): e is PageProgressEvent => e.type === 'page_progress' && e.status === 'completed');

      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0].pageTitle).toBe('Page 1');
    });
  });

  describe('部分失敗時の継続処理', () => {
    it('1つのURL分析が失敗しても他のURLの分析を継続する', async () => {
      const urls = ['https://example.com/page1', 'https://example.com/page2', 'https://example.com/page3'];

      mockAnalyzeUrl
        .mockResolvedValueOnce(createMockReport(urls[0], 'Page 1'))
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValueOnce(createMockReport(urls[2], 'Page 3'));

      const result = await analyzeMultipleUrls(urls, { onProgress: mockOnProgress });

      // 3つ全てが試行されている
      expect(mockAnalyzeUrl).toHaveBeenCalledTimes(3);
      // 成功した2つ + 失敗した1つ
      expect(result.pages).toHaveLength(3);
      // 失敗したページにはエラー情報が含まれる
      expect(result.pages[1].error).toBeDefined();
      expect(result.pages[1].error?.message).toContain('Connection timeout');
    });

    it('失敗時にpage_progressイベント（failed）を送信する', async () => {
      const urls = ['https://example.com/fail'];

      mockAnalyzeUrl.mockRejectedValueOnce(new Error('Analysis failed'));

      const result = await analyzeMultipleUrls(urls, { onProgress: mockOnProgress });

      const failedEvents = mockOnProgress.mock.calls
        .map(call => call[0] as SSEEvent)
        .filter((e): e is PageProgressEvent => e.type === 'page_progress' && e.status === 'failed');

      expect(failedEvents).toHaveLength(1);
      expect(result.pages[0].error).toBeDefined();
    });
  });

  describe('認証情報の共有', () => {
    it('storageStateを全URLの分析で共有する', async () => {
      const urls = ['https://example.com/page1', 'https://example.com/page2'];
      const mockStorageState = {
        cookies: [{ name: 'session', value: 'abc', domain: 'example.com', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' as const }],
        origins: [],
      };

      mockAnalyzeUrl
        .mockResolvedValueOnce(createMockReport(urls[0], 'Page 1'))
        .mockResolvedValueOnce(createMockReport(urls[1], 'Page 2'));

      await analyzeMultipleUrls(urls, {
        onProgress: mockOnProgress,
        storageState: mockStorageState,
      });

      // 両方の呼び出しでstorageStateが渡されていること
      expect(mockAnalyzeUrl).toHaveBeenNthCalledWith(
        1,
        urls[0],
        undefined,
        expect.any(Function),
        mockStorageState
      );
      expect(mockAnalyzeUrl).toHaveBeenNthCalledWith(
        2,
        urls[1],
        undefined,
        expect.any(Function),
        mockStorageState
      );
    });
  });

  describe('結果の集約', () => {
    it('サマリー情報を全ページ合計で計算する', async () => {
      const urls = ['https://example.com/page1', 'https://example.com/page2'];

      const report1 = createMockReport(urls[0], 'Page 1');
      report1.summary = { totalViolations: 3, totalPasses: 10, totalIncomplete: 1 };

      const report2 = createMockReport(urls[1], 'Page 2');
      report2.summary = { totalViolations: 5, totalPasses: 8, totalIncomplete: 2 };

      mockAnalyzeUrl
        .mockResolvedValueOnce(report1)
        .mockResolvedValueOnce(report2);

      const result = await analyzeMultipleUrls(urls, { onProgress: mockOnProgress });

      // 合計値
      expect(result.summary.totalViolations).toBe(8); // 3 + 5
      expect(result.summary.totalPasses).toBe(18); // 10 + 8
      expect(result.summary.totalIncomplete).toBe(3); // 1 + 2
    });
  });
});
