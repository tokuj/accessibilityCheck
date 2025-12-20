import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatSSEData, sendSSEEvent } from './sse-handler';
import type { SSEEvent } from './analyzers/sse-types';
import type { Response } from 'express';

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
});
