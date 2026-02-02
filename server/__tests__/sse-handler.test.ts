import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatSSEData, sendSSEEvent, parseAuthFromQuery, parseSessionFromQuery, parseUrlsFromQuery, parseOptionsFromQuery } from '../sse-handler';
import type { SSEEvent } from '../analyzers/sse-types';
import type { Response, Request } from 'express';
import { DEFAULT_ANALYSIS_OPTIONS } from '../analyzers/analysis-options';

describe('SSEハンドラー', () => {
  describe('formatSSEData', () => {
    it('SSEイベントをdata形式にフォーマットする', () => {
      const event: SSEEvent = {
        type: 'log',
        message: 'テストメッセージ',
        timestamp: '2025-12-20T23:30:00+09:00',
      };

      const formatted = formatSSEData(event);
      expect(formatted).toBe(`data: ${JSON.stringify(event)}\n\n`);
    });

    it('進捗イベントを正しくフォーマットする', () => {
      const event: SSEEvent = {
        type: 'progress',
        step: 1,
        total: 3,
        stepName: 'axe-core',
      };

      const formatted = formatSSEData(event);
      expect(formatted).toContain('"type":"progress"');
      expect(formatted).toContain('"step":1');
      expect(formatted.endsWith('\n\n')).toBe(true);
    });

    it('エラーイベントを正しくフォーマットする', () => {
      const event: SSEEvent = {
        type: 'error',
        message: 'エラーが発生しました',
        code: 'TIMEOUT',
      };

      const formatted = formatSSEData(event);
      expect(formatted).toContain('"type":"error"');
      expect(formatted).toContain('"code":"TIMEOUT"');
    });
  });

  describe('sendSSEEvent', () => {
    let mockRes: Partial<Response>;

    beforeEach(() => {
      mockRes = {
        write: vi.fn().mockReturnValue(true),
        flush: vi.fn(),
      };
    });

    it('レスポンスにSSEイベントを書き込む', () => {
      const event: SSEEvent = {
        type: 'progress',
        step: 1,
        total: 3,
        stepName: 'axe-core',
      };

      sendSSEEvent(mockRes as Response, event);

      expect(mockRes.write).toHaveBeenCalledWith(`data: ${JSON.stringify(event)}\n\n`);
    });

    it('ログイベントを送信できる', () => {
      const event: SSEEvent = {
        type: 'log',
        message: 'axe-core 分析開始...',
        timestamp: new Date().toISOString(),
      };

      sendSSEEvent(mockRes as Response, event);

      expect(mockRes.write).toHaveBeenCalled();
      const writtenData = (mockRes.write as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(writtenData).toContain('"type":"log"');
    });

    it('違反イベントを送信できる', () => {
      const event: SSEEvent = {
        type: 'violation',
        rule: 'color-contrast',
        impact: 'serious',
        count: 3,
      };

      sendSSEEvent(mockRes as Response, event);

      expect(mockRes.write).toHaveBeenCalled();
      const writtenData = (mockRes.write as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(writtenData).toContain('"rule":"color-contrast"');
    });
  });

  describe('parseAuthFromQuery', () => {
    it('認証タイプがnoneまたは未指定の場合はundefinedを返す', () => {
      const query: Request['query'] = { authType: 'none' };
      expect(parseAuthFromQuery(query)).toBeUndefined();

      const emptyQuery: Request['query'] = {};
      expect(parseAuthFromQuery(emptyQuery)).toBeUndefined();
    });

    it('Basic認証パラメータを正しくパースする', () => {
      const query: Request['query'] = {
        authType: 'basic',
        authUsername: 'testuser',
        authPassword: 'testpass',
      };

      const auth = parseAuthFromQuery(query);
      expect(auth).toEqual({
        type: 'basic',
        username: 'testuser',
        password: 'testpass',
      });
    });

    it('Bearer Token認証パラメータを正しくパースする', () => {
      const query: Request['query'] = {
        authType: 'bearer',
        authToken: 'jwt-token-here',
      };

      const auth = parseAuthFromQuery(query);
      expect(auth).toEqual({
        type: 'bearer',
        token: 'jwt-token-here',
      });
    });

    it('Cookie認証パラメータを正しくパースする', () => {
      const query: Request['query'] = {
        authType: 'cookie',
        authCookies: 'session=abc123',
      };

      const auth = parseAuthFromQuery(query);
      expect(auth).toEqual({
        type: 'cookie',
        cookies: 'session=abc123',
      });
    });
  });

  describe('parseSessionFromQuery', () => {
    it('セッションIDが未指定の場合はundefinedを返す', () => {
      const query: Request['query'] = {};
      expect(parseSessionFromQuery(query)).toBeUndefined();
    });

    it('セッションIDのみ指定された場合はセッション情報を返す', () => {
      const query: Request['query'] = {
        sessionId: 'session-123',
      };

      const session = parseSessionFromQuery(query);
      expect(session).toEqual({
        sessionId: 'session-123',
        passphrase: undefined,
      });
    });

    it('セッションIDとパスフレーズが指定された場合は両方を返す', () => {
      const query: Request['query'] = {
        sessionId: 'session-123',
        passphrase: 'my-secret',
      };

      const session = parseSessionFromQuery(query);
      expect(session).toEqual({
        sessionId: 'session-123',
        passphrase: 'my-secret',
      });
    });
  });

  describe('parseUrlsFromQuery', () => {
    it('単一のurl文字列パラメータを配列として返す', () => {
      const query: Request['query'] = {
        url: 'https://example.com',
      };

      const result = parseUrlsFromQuery(query);
      expect(result).toEqual({
        urls: ['https://example.com'],
        error: null,
      });
    });

    it('urls[]配列パラメータを正しく配列として返す', () => {
      const query: Request['query'] = {
        'urls[]': ['https://example.com/page1', 'https://example.com/page2'],
      };

      const result = parseUrlsFromQuery(query);
      expect(result).toEqual({
        urls: ['https://example.com/page1', 'https://example.com/page2'],
        error: null,
      });
    });

    it('単一のurls[]を配列に変換する', () => {
      const query: Request['query'] = {
        'urls[]': 'https://example.com/single',
      };

      const result = parseUrlsFromQuery(query);
      expect(result).toEqual({
        urls: ['https://example.com/single'],
        error: null,
      });
    });

    it('URLが未指定の場合はエラーを返す', () => {
      const query: Request['query'] = {};

      const result = parseUrlsFromQuery(query);
      expect(result.urls).toEqual([]);
      expect(result.error).toBe('URLが指定されていません');
    });

    it('無効なURL形式の場合はエラーを返す', () => {
      const query: Request['query'] = {
        url: 'not-a-valid-url',
      };

      const result = parseUrlsFromQuery(query);
      expect(result.urls).toEqual([]);
      expect(result.error).toContain('無効なURL形式');
    });

    it('配列内に無効なURLが含まれる場合はエラーを返す', () => {
      const query: Request['query'] = {
        'urls[]': ['https://example.com', 'invalid-url'],
      };

      const result = parseUrlsFromQuery(query);
      expect(result.urls).toEqual([]);
      expect(result.error).toContain('無効なURL形式');
    });

    it('URL数が0件の場合はエラーを返す', () => {
      const query: Request['query'] = {
        'urls[]': [],
      };

      const result = parseUrlsFromQuery(query);
      expect(result.urls).toEqual([]);
      expect(result.error).toBe('URLが指定されていません');
    });

    it('URL数が4件を超える場合はエラーを返す', () => {
      const query: Request['query'] = {
        'urls[]': [
          'https://example.com/1',
          'https://example.com/2',
          'https://example.com/3',
          'https://example.com/4',
          'https://example.com/5',
        ],
      };

      const result = parseUrlsFromQuery(query);
      expect(result.urls).toEqual([]);
      expect(result.error).toBe('URLは1件以上4件以下で指定してください');
    });

    it('4件以内のURLは正常に処理される', () => {
      const query: Request['query'] = {
        'urls[]': [
          'https://example.com/1',
          'https://example.com/2',
          'https://example.com/3',
          'https://example.com/4',
        ],
      };

      const result = parseUrlsFromQuery(query);
      expect(result.urls).toHaveLength(4);
      expect(result.error).toBeNull();
    });
  });

  describe('parseOptionsFromQuery', () => {
    /**
     * @requirement 15.1 - parseOptionsFromQuery関数を実装してクエリパラメータからオプションを取得
     */
    it('オプションが未指定の場合はundefinedを返す', () => {
      const query: Request['query'] = {};
      expect(parseOptionsFromQuery(query)).toBeUndefined();
    });

    it('options パラメータがJSON形式で指定された場合にパースする', () => {
      const options = {
        engines: {
          axeCore: true,
          pa11y: false,
          lighthouse: true,
          ibm: true,
          alfa: false,
          qualweb: false,
        },
        wcagVersion: '2.2',
        semiAutoCheck: false,
        responsiveTest: false,
        viewports: ['desktop'],
        waveApi: { enabled: false },
      };

      const query: Request['query'] = {
        options: JSON.stringify(options),
      };

      const result = parseOptionsFromQuery(query);
      expect(result).toBeDefined();
      expect(result?.engines.ibm).toBe(true);
      expect(result?.engines.pa11y).toBe(false);
      expect(result?.wcagVersion).toBe('2.2');
    });

    it('個別のエンジンオプションをパースする（engines.axeCore=true）', () => {
      const query: Request['query'] = {
        'engines.axeCore': 'true',
        'engines.pa11y': 'true',
        'engines.lighthouse': 'true',
        'engines.ibm': 'true',
        'engines.alfa': 'false',
        'engines.qualweb': 'false',
      };

      const result = parseOptionsFromQuery(query);
      expect(result).toBeDefined();
      expect(result?.engines.axeCore).toBe(true);
      expect(result?.engines.ibm).toBe(true);
      expect(result?.engines.alfa).toBe(false);
    });

    it('WCAGバージョンをパースする', () => {
      const query: Request['query'] = {
        'engines.axeCore': 'true',
        wcagVersion: '2.2',
      };

      const result = parseOptionsFromQuery(query);
      expect(result?.wcagVersion).toBe('2.2');
    });

    it('WAVE API設定をパースする', () => {
      const query: Request['query'] = {
        'engines.axeCore': 'true',
        'waveApi.enabled': 'true',
        'waveApi.apiKey': 'test-api-key-123',
      };

      const result = parseOptionsFromQuery(query);
      expect(result?.waveApi.enabled).toBe(true);
      expect(result?.waveApi.apiKey).toBe('test-api-key-123');
    });

    it('半自動チェックとレスポンシブテスト設定をパースする', () => {
      const query: Request['query'] = {
        'engines.axeCore': 'true',
        semiAutoCheck: 'true',
        responsiveTest: 'true',
      };

      const result = parseOptionsFromQuery(query);
      expect(result?.semiAutoCheck).toBe(true);
      expect(result?.responsiveTest).toBe(true);
    });

    it('ビューポート設定をパースする', () => {
      const query: Request['query'] = {
        'engines.axeCore': 'true',
        'viewports[]': ['mobile', 'tablet', 'desktop'],
      };

      const result = parseOptionsFromQuery(query);
      expect(result?.viewports).toEqual(['mobile', 'tablet', 'desktop']);
    });

    it('不正なJSONの場合はundefinedを返す', () => {
      const query: Request['query'] = {
        options: 'not-valid-json',
      };

      const result = parseOptionsFromQuery(query);
      expect(result).toBeUndefined();
    });
  });
});
