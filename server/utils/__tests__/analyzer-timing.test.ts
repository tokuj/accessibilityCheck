/**
 * 分析タイミングユーティリティのテスト
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createAnalyzerTiming,
  completeAnalyzerTiming,
  formatTimeoutError,
  formatStructuredLog,
  type AnalyzerTiming,
} from '../analyzer-timing';

describe('analyzer-timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-22T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createAnalyzerTiming', () => {
    it('should create timing object with start time', () => {
      const timing = createAnalyzerTiming('axe-core', 'https://example.com');

      expect(timing.tool).toBe('axe-core');
      expect(timing.url).toBe('https://example.com');
      expect(timing.startTime).toBe('2025-12-22T10:00:00.000Z');
      expect(timing.endTime).toBeUndefined();
      expect(timing.duration).toBeUndefined();
      expect(timing.status).toBe('running');
    });

    it('should handle all tool types', () => {
      const tools: Array<'axe-core' | 'pa11y' | 'lighthouse'> = ['axe-core', 'pa11y', 'lighthouse'];

      for (const tool of tools) {
        const timing = createAnalyzerTiming(tool, 'https://test.com');
        expect(timing.tool).toBe(tool);
      }
    });
  });

  describe('completeAnalyzerTiming', () => {
    it('should complete timing with success status', () => {
      const timing = createAnalyzerTiming('axe-core', 'https://example.com');

      vi.advanceTimersByTime(5000); // 5秒経過

      const completed = completeAnalyzerTiming(timing, 'success');

      expect(completed.status).toBe('success');
      expect(completed.endTime).toBe('2025-12-22T10:00:05.000Z');
      expect(completed.duration).toBe(5000);
    });

    it('should complete timing with timeout status', () => {
      const timing = createAnalyzerTiming('pa11y', 'https://example.com');

      vi.advanceTimersByTime(90000); // 90秒経過

      const completed = completeAnalyzerTiming(timing, 'timeout');

      expect(completed.status).toBe('timeout');
      expect(completed.duration).toBe(90000);
    });

    it('should complete timing with error status', () => {
      const timing = createAnalyzerTiming('lighthouse', 'https://example.com');

      vi.advanceTimersByTime(2000);

      const completed = completeAnalyzerTiming(timing, 'error');

      expect(completed.status).toBe('error');
      expect(completed.duration).toBe(2000);
    });
  });

  describe('formatTimeoutError', () => {
    it('should format page load timeout error', () => {
      const message = formatTimeoutError('page-load', 'https://example.com', 90000);

      expect(message).toContain('ページの読み込み');
      expect(message).toContain('タイムアウト');
      expect(message).toContain('90秒');
      expect(message).toContain('https://example.com');
    });

    it('should format axe-core timeout error', () => {
      const message = formatTimeoutError('axe-core', 'https://example.com', 120000);

      expect(message).toContain('axe-core');
      expect(message).toContain('タイムアウト');
      expect(message).toContain('120秒');
    });

    it('should format Pa11y timeout error', () => {
      const message = formatTimeoutError('pa11y', 'https://example.com', 90000);

      expect(message).toContain('Pa11y');
      expect(message).toContain('タイムアウト');
      expect(message).toContain('90秒');
    });

    it('should format Lighthouse timeout error', () => {
      const message = formatTimeoutError('lighthouse', 'https://example.com', 90000);

      expect(message).toContain('Lighthouse');
      expect(message).toContain('タイムアウト');
      expect(message).toContain('90秒');
    });

    it('should include elapsed time if provided', () => {
      const message = formatTimeoutError('axe-core', 'https://example.com', 120000, 115000);

      expect(message).toContain('経過時間');
      expect(message).toContain('115.0秒');
    });
  });

  describe('formatStructuredLog', () => {
    it('should format structured log for success', () => {
      const timing: AnalyzerTiming = {
        tool: 'axe-core',
        url: 'https://example.com',
        startTime: '2025-12-22T10:00:00.000Z',
        endTime: '2025-12-22T10:00:30.000Z',
        duration: 30000,
        status: 'success',
      };

      const log = formatStructuredLog(timing);

      expect(log).toContain('[axe-core]');
      expect(log).toContain('完了');
      expect(log).toContain('30.0秒');
      expect(log).toContain('https://example.com');
    });

    it('should format structured log for timeout', () => {
      const timing: AnalyzerTiming = {
        tool: 'pa11y',
        url: 'https://example.com',
        startTime: '2025-12-22T10:00:00.000Z',
        endTime: '2025-12-22T10:01:30.000Z',
        duration: 90000,
        status: 'timeout',
      };

      const log = formatStructuredLog(timing);

      expect(log).toContain('[pa11y]');
      expect(log).toContain('タイムアウト');
      expect(log).toContain('90.0秒');
    });

    it('should format structured log for error with error message', () => {
      const timing: AnalyzerTiming = {
        tool: 'lighthouse',
        url: 'https://example.com',
        startTime: '2025-12-22T10:00:00.000Z',
        endTime: '2025-12-22T10:00:05.000Z',
        duration: 5000,
        status: 'error',
      };

      const log = formatStructuredLog(timing, 'Connection refused');

      expect(log).toContain('[lighthouse]');
      expect(log).toContain('エラー');
      expect(log).toContain('Connection refused');
    });

    it('should include warning for slow analysis (> 60 seconds)', () => {
      const timing: AnalyzerTiming = {
        tool: 'axe-core',
        url: 'https://example.com',
        startTime: '2025-12-22T10:00:00.000Z',
        endTime: '2025-12-22T10:01:30.000Z',
        duration: 90000,
        status: 'success',
      };

      const log = formatStructuredLog(timing);

      expect(log).toContain('警告');
      expect(log).toContain('60秒超過');
    });

    it('should NOT include warning for fast analysis (< 60 seconds)', () => {
      const timing: AnalyzerTiming = {
        tool: 'axe-core',
        url: 'https://example.com',
        startTime: '2025-12-22T10:00:00.000Z',
        endTime: '2025-12-22T10:00:30.000Z',
        duration: 30000,
        status: 'success',
      };

      const log = formatStructuredLog(timing);

      expect(log).not.toContain('警告');
      expect(log).not.toContain('60秒超過');
    });
  });
});
