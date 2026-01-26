/**
 * チャットAPIクライアントのテスト
 * @requirement 2.1 - sendChatRequest関数のテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendChatRequest, ChatApiError, type ChatRequest, type ChatResponse } from './chat-api';

describe('chat-api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendChatRequest', () => {
    const validRequest: ChatRequest = {
      context: {
        type: 'violation',
        ruleId: 'color-contrast',
        wcagCriteria: ['1.4.3'],
        data: { description: 'コントラスト不足' },
        label: 'コントラスト',
      },
      question: 'どう修正すればいいですか？',
    };

    it('should return response on success', async () => {
      const mockResponse: ChatResponse = {
        answer: 'コントラスト比を4.5:1以上にしてください。',
        referenceUrls: ['https://a11y-guidelines.ameba.design/1/contrast-minimum/'],
        referenceLinks: [{ uri: 'https://a11y-guidelines.ameba.design/1/contrast-minimum/', title: 'ameba.design' }],
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await sendChatRequest(validRequest);

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validRequest),
        })
      );
    });

    it('should throw ChatApiError with type timeout on 408', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'タイムアウト' }), { status: 408 })
      );

      try {
        await sendChatRequest(validRequest);
        expect.fail('エラーがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatApiError);
        expect((error as ChatApiError).type).toBe('timeout');
        expect((error as ChatApiError).message).toContain('タイムアウト');
      }
    });

    it('should throw ChatApiError with type rate_limit and retryAfter on 429', async () => {
      const headers = new Headers();
      headers.set('Retry-After', '60');

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'レート制限' }), {
          status: 429,
          headers,
        })
      );

      try {
        await sendChatRequest(validRequest);
        expect.fail('エラーがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatApiError);
        expect((error as ChatApiError).type).toBe('rate_limit');
        expect((error as ChatApiError).retryAfter).toBe(60);
      }
    });

    it('should throw ChatApiError with type server on 500', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'サーバーエラー' }), { status: 500 })
      );

      try {
        await sendChatRequest(validRequest);
        expect.fail('エラーがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatApiError);
        expect((error as ChatApiError).type).toBe('server');
      }
    });

    it('should throw ChatApiError with type network on fetch error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      try {
        await sendChatRequest(validRequest);
        expect.fail('エラーがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatApiError);
        expect((error as ChatApiError).type).toBe('network');
      }
    });

    it('should throw ChatApiError with type timeout on AbortError', async () => {
      const abortError = new DOMException('Timeout', 'TimeoutError');
      vi.mocked(fetch).mockRejectedValueOnce(abortError);

      try {
        await sendChatRequest(validRequest);
        expect.fail('エラーがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatApiError);
        expect((error as ChatApiError).type).toBe('timeout');
      }
    });

    it('should use 30 second timeout', async () => {
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ answer: 'test', referenceUrl: '' }), { status: 200 })
      );

      await sendChatRequest(validRequest);

      expect(timeoutSpy).toHaveBeenCalledWith(30000);
    });
  });
});
