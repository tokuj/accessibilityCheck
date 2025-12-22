import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  SSEEvent,
  LogEvent,
  ProgressEvent,
  ViolationEvent,
  CompleteEvent,
  ErrorEvent,
  ProgressCallback,
  PageProgressEvent,
} from './sse-types';

describe('SSEイベント型定義', () => {
  describe('LogEvent', () => {
    it('ログイベントの構造が正しい', () => {
      const event: LogEvent = {
        type: 'log',
        message: 'axe-core 分析開始...',
        timestamp: '2025-12-20T23:30:00+09:00',
      };

      expect(event.type).toBe('log');
      expect(event.message).toBe('axe-core 分析開始...');
      expect(event.timestamp).toBeDefined();
    });
  });

  describe('ProgressEvent', () => {
    it('進捗イベントの構造が正しい', () => {
      const event: ProgressEvent = {
        type: 'progress',
        step: 1,
        total: 3,
        stepName: 'axe-core',
      };

      expect(event.type).toBe('progress');
      expect(event.step).toBe(1);
      expect(event.total).toBe(3);
      expect(event.stepName).toBe('axe-core');
    });
  });

  describe('ViolationEvent', () => {
    it('違反検出イベントの構造が正しい', () => {
      const event: ViolationEvent = {
        type: 'violation',
        rule: 'color-contrast',
        impact: 'serious',
        count: 3,
      };

      expect(event.type).toBe('violation');
      expect(event.rule).toBe('color-contrast');
      expect(event.impact).toBe('serious');
      expect(event.count).toBe(3);
    });
  });

  describe('CompleteEvent', () => {
    it('完了イベントの構造が正しい', () => {
      const event: CompleteEvent = {
        type: 'complete',
        report: {
          generatedAt: '2025-12-20T23:30:00+09:00',
          summary: {
            totalViolations: 5,
            totalPasses: 10,
            totalIncomplete: 2,
          },
          pages: [],
          toolsUsed: [],
        },
      };

      expect(event.type).toBe('complete');
      expect(event.report.summary.totalViolations).toBe(5);
    });
  });

  describe('ErrorEvent', () => {
    it('エラーイベントの構造が正しい', () => {
      const event: ErrorEvent = {
        type: 'error',
        message: 'ページの読み込みに失敗しました',
        code: 'TIMEOUT',
      };

      expect(event.type).toBe('error');
      expect(event.message).toBe('ページの読み込みに失敗しました');
      expect(event.code).toBe('TIMEOUT');
    });
  });

  describe('PageProgressEvent', () => {
    it('ページ進捗イベントの構造が正しい', () => {
      const event: PageProgressEvent = {
        type: 'page_progress',
        pageIndex: 1,
        totalPages: 4,
        pageUrl: 'https://example.com/page2',
        pageTitle: 'Page 2 Title',
        status: 'started',
      };

      expect(event.type).toBe('page_progress');
      expect(event.pageIndex).toBe(1);
      expect(event.totalPages).toBe(4);
      expect(event.pageUrl).toBe('https://example.com/page2');
      expect(event.pageTitle).toBe('Page 2 Title');
      expect(event.status).toBe('started');
    });

    it('全てのステータスを受け入れる', () => {
      const statuses: PageProgressEvent['status'][] = ['started', 'analyzing', 'completed', 'failed'];

      statuses.forEach((status) => {
        const event: PageProgressEvent = {
          type: 'page_progress',
          pageIndex: 0,
          totalPages: 1,
          pageUrl: 'https://example.com',
          pageTitle: 'Test',
          status,
        };
        expect(event.status).toBe(status);
      });
    });
  });

  describe('SSEEvent union type', () => {
    it('SSEEventは全イベント型のユニオンである', () => {
      const logEvent: SSEEvent = { type: 'log', message: 'test', timestamp: '' };
      const progressEvent: SSEEvent = { type: 'progress', step: 1, total: 3, stepName: 'test' };
      const violationEvent: SSEEvent = { type: 'violation', rule: 'test', impact: 'minor', count: 1 };
      const errorEvent: SSEEvent = { type: 'error', message: 'error', code: 'ERROR' };
      const pageProgressEvent: SSEEvent = {
        type: 'page_progress',
        pageIndex: 0,
        totalPages: 2,
        pageUrl: 'https://example.com',
        pageTitle: 'Test Page',
        status: 'started',
      };

      expect(logEvent.type).toBe('log');
      expect(progressEvent.type).toBe('progress');
      expect(violationEvent.type).toBe('violation');
      expect(errorEvent.type).toBe('error');
      expect(pageProgressEvent.type).toBe('page_progress');
    });
  });

  describe('ProgressCallback', () => {
    it('ProgressCallbackはSSEEventを受け取る関数型である', () => {
      const callback: ProgressCallback = (event: SSEEvent) => {
        // SSEEventを受け取って処理する
        expect(event.type).toBeDefined();
      };

      callback({ type: 'log', message: 'test', timestamp: '' });
    });
  });
});
