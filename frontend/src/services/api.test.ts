import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeUrl, ApiError } from './api';

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
});
