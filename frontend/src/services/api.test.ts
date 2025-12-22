import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeUrl, ApiError, analyzeMultipleUrlsWithSSE } from './api';

describe('api.ts', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('タイムアウト処理', () => {
    it('300秒（300000ms）のタイムアウトが設定されること', async () => {
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      await analyzeUrl({ url: 'https://example.com' });

      expect(timeoutSpy).toHaveBeenCalledWith(300000);
    });

    it('タイムアウト発生時にApiErrorがスローされること', async () => {
      const timeoutError = new DOMException('Timeout', 'TimeoutError');
      vi.mocked(fetch).mockRejectedValue(timeoutError);

      try {
        await analyzeUrl({ url: 'https://example.com' });
        expect.fail('エラーがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).type).toBe('timeout');
        expect((error as ApiError).message).toContain('タイムアウト');
      }
    });
  });

  describe('ネットワークエラー処理', () => {
    it('ネットワークエラー発生時にApiErrorがスローされること', async () => {
      const networkError = new TypeError('Failed to fetch');
      vi.mocked(fetch).mockRejectedValue(networkError);

      try {
        await analyzeUrl({ url: 'https://example.com' });
        expect.fail('エラーがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).type).toBe('network');
        expect((error as ApiError).message).toContain('サーバーに接続できません');
      }
    });
  });

  describe('HTTPステータスエラー処理', () => {
    it('4xxエラー時にクライアントエラーとしてApiErrorがスローされること', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('Bad Request', { status: 400, statusText: 'Bad Request' })
      );

      try {
        await analyzeUrl({ url: 'https://example.com' });
        expect.fail('エラーがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).type).toBe('client');
        expect((error as ApiError).statusCode).toBe(400);
      }
    });

    it('5xxエラー時にサーバーエラーとしてApiErrorがスローされること', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' })
      );

      try {
        await analyzeUrl({ url: 'https://example.com' });
        expect.fail('エラーがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).type).toBe('server');
        expect((error as ApiError).statusCode).toBe(500);
        expect((error as ApiError).message).toContain('サーバーエラー');
      }
    });
  });

  describe('成功時の処理', () => {
    it('正常なレスポンスが返されること', async () => {
      const mockResponse = {
        url: 'https://example.com',
        axe: { violations: [] },
        pa11y: { issues: [] },
        lighthouse: { score: 100 },
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await analyzeUrl({ url: 'https://example.com' });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('analyzeMultipleUrlsWithSSE', () => {
    let mockEventSource: {
      onmessage: ((event: MessageEvent) => void) | null;
      onerror: (() => void) | null;
      close: () => void;
    };

    let EventSourceMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockEventSource = {
        onmessage: null,
        onerror: null,
        close: vi.fn(),
      };
      // EventSourceをクラスとしてモック
      EventSourceMock = vi.fn().mockImplementation(function() {
        return mockEventSource;
      });
      vi.stubGlobal('EventSource', EventSourceMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('複数URLをクエリパラメータに設定すること', () => {
      const urls = ['https://example.com/page1', 'https://example.com/page2', 'https://example.com/page3'];
      analyzeMultipleUrlsWithSSE(
        { urls },
        {}
      );

      expect(EventSourceMock).toHaveBeenCalledTimes(1);
      const calledUrl = EventSourceMock.mock.calls[0][0];

      // URLオブジェクトとしてパース
      const parsedUrl = new URL(calledUrl);

      // 複数URLがurls[]パラメータとして設定されていることを確認
      const urlParams = parsedUrl.searchParams.getAll('urls[]');
      expect(urlParams).toHaveLength(3);
      expect(urlParams).toContain('https://example.com/page1');
      expect(urlParams).toContain('https://example.com/page2');
      expect(urlParams).toContain('https://example.com/page3');
    });

    it('認証パラメータも一緒に設定されること', () => {
      const urls = ['https://example.com/page1', 'https://example.com/page2'];
      analyzeMultipleUrlsWithSSE(
        { urls, auth: { type: 'basic', username: 'user', password: 'pass' } },
        {}
      );

      const calledUrl = EventSourceMock.mock.calls[0][0];
      const parsedUrl = new URL(calledUrl);

      expect(parsedUrl.searchParams.get('authType')).toBe('basic');
      expect(parsedUrl.searchParams.get('authUsername')).toBe('user');
      expect(parsedUrl.searchParams.get('authPassword')).toBe('pass');
    });

    it('セッションパラメータも一緒に設定されること', () => {
      const urls = ['https://example.com/page1'];
      analyzeMultipleUrlsWithSSE(
        { urls },
        {},
        { sessionId: 'sess-123', passphrase: 'secret' }
      );

      const calledUrl = EventSourceMock.mock.calls[0][0];
      const parsedUrl = new URL(calledUrl);

      expect(parsedUrl.searchParams.get('sessionId')).toBe('sess-123');
      expect(parsedUrl.searchParams.get('passphrase')).toBe('secret');
    });

    it('cancel関数でEventSourceをクローズできること', () => {
      const urls = ['https://example.com/page1'];
      const { cancel } = analyzeMultipleUrlsWithSSE({ urls }, {});

      cancel();

      expect(mockEventSource.close).toHaveBeenCalled();
    });

    it('page_progressイベントを受信してonPageProgressコールバックを呼び出すこと', () => {
      const urls = ['https://example.com/page1', 'https://example.com/page2'];
      const onPageProgress = vi.fn();

      analyzeMultipleUrlsWithSSE(
        { urls },
        { onPageProgress }
      );

      // page_progressイベントをシミュレート
      const event = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'page_progress',
          pageIndex: 0,
          totalPages: 2,
          pageUrl: 'https://example.com/page1',
          pageTitle: 'ページ1',
          status: 'started',
        }),
      });
      mockEventSource.onmessage?.(event);

      expect(onPageProgress).toHaveBeenCalledWith({
        pageIndex: 0,
        totalPages: 2,
        pageUrl: 'https://example.com/page1',
        pageTitle: 'ページ1',
        status: 'started',
      });
    });

    it('page_progressイベントでログも出力されること', () => {
      const urls = ['https://example.com/page1'];
      const onLog = vi.fn();

      analyzeMultipleUrlsWithSSE(
        { urls },
        { onLog }
      );

      // page_progressイベントをシミュレート
      const event = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'page_progress',
          pageIndex: 0,
          totalPages: 2,
          pageUrl: 'https://example.com/page1',
          pageTitle: 'ページ1',
          status: 'started',
        }),
      });
      mockEventSource.onmessage?.(event);

      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'progress',
          message: expect.stringContaining('ページ1'),
        })
      );
    });
  });
});
