import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatSSEData, sendSSEEvent, parseAuthFromQuery, parseSessionFromQuery } from '../sse-handler';
import type { SSEEvent } from '../analyzers/sse-types';
import type { Response, Request } from 'express';

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
});
