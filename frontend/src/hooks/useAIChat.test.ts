/**
 * useAIChatフックのテスト（Grounding対応）
 * @requirement 2.1, 5.1-5.5 - 対話状態・API呼び出し管理
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIChat } from './useAIChat';
import * as chatApi from '../services/chat-api';
import type { ChatContext } from '../utils/chat-storage';

// chat-apiモジュールをモック
vi.mock('../services/chat-api', () => ({
  sendChatRequest: vi.fn(),
  sendInitialMessageRequest: vi.fn(),
  ChatApiError: class ChatApiError extends Error {
    type: string;
    retryAfter?: number;
    constructor(type: string, message: string, retryAfter?: number) {
      super(message);
      this.name = 'ChatApiError';
      this.type = type;
      this.retryAfter = retryAfter;
    }
  },
}));

describe('useAIChat', () => {
  const mockContext: ChatContext = {
    type: 'violation',
    ruleId: 'color-contrast',
    wcagCriteria: ['1.4.3'],
    data: { description: 'コントラスト不足' },
    label: 'コントラスト',
  };

  // Grounding対応：referenceUrlsとreferenceLinksを含む
  const mockResponse = {
    answer: 'コントラスト比を4.5:1以上にしてください。',
    referenceUrls: ['https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html'],
    referenceLinks: [{ uri: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html', title: 'w3.org' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should set isLoading true while sending', async () => {
    let resolvePromise: (value: typeof mockResponse) => void;
    const pendingPromise = new Promise<typeof mockResponse>((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(chatApi.sendChatRequest).mockReturnValue(pendingPromise);

    const { result } = renderHook(() => useAIChat(mockContext));

    expect(result.current.isLoading).toBe(false);

    act(() => {
      result.current.sendQuestion('質問');
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolvePromise!(mockResponse);
      await pendingPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should set lastAnswer on success (Grounding対応)', async () => {
    vi.mocked(chatApi.sendChatRequest).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAIChat(mockContext));

    await act(async () => {
      await result.current.sendQuestion('質問');
    });

    expect(result.current.lastAnswer).toBeDefined();
    expect(result.current.lastAnswer?.answer).toBe('コントラスト比を4.5:1以上にしてください。');
    expect(result.current.lastAnswer?.referenceUrls).toContain(
      'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html'
    );
  });

  it('should set error on failure', async () => {
    const mockError = new chatApi.ChatApiError('server', 'サーバーエラー');
    vi.mocked(chatApi.sendChatRequest).mockRejectedValue(mockError);

    const { result } = renderHook(() => useAIChat(mockContext));

    await act(async () => {
      await result.current.sendQuestion('質問');
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.type).toBe('server');
    expect(result.current.error?.message).toBe('サーバーエラー');
  });

  it('should retry with previous question', async () => {
    const mockError = new chatApi.ChatApiError('server', 'サーバーエラー');
    vi.mocked(chatApi.sendChatRequest).mockRejectedValueOnce(mockError);
    vi.mocked(chatApi.sendChatRequest).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useAIChat(mockContext));

    // 最初の呼び出しは失敗
    await act(async () => {
      await result.current.sendQuestion('リトライテスト質問');
    });

    expect(result.current.error).toBeDefined();

    // リトライ
    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.lastAnswer?.answer).toBe('コントラスト比を4.5:1以上にしてください。');
    expect(chatApi.sendChatRequest).toHaveBeenCalledTimes(2);
    expect(chatApi.sendChatRequest).toHaveBeenLastCalledWith({
      context: mockContext,
      question: 'リトライテスト質問',
    });
  });

  it('should add entry to history on success', async () => {
    vi.mocked(chatApi.sendChatRequest).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAIChat(mockContext));

    await act(async () => {
      await result.current.sendQuestion('履歴テスト質問');
    });

    // 履歴に追加されていることを確認
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].question).toBe('履歴テスト質問');
    expect(result.current.history[0].answer).toBe('コントラスト比を4.5:1以上にしてください。');
  });

  it('should clear error', async () => {
    const mockError = new chatApi.ChatApiError('server', 'サーバーエラー');
    vi.mocked(chatApi.sendChatRequest).mockRejectedValue(mockError);

    const { result } = renderHook(() => useAIChat(mockContext));

    await act(async () => {
      await result.current.sendQuestion('質問');
    });

    expect(result.current.error).toBeDefined();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should handle rate limit error with retryAfter', async () => {
    const mockError = new chatApi.ChatApiError('rate_limit', 'レート制限', 60);
    vi.mocked(chatApi.sendChatRequest).mockRejectedValue(mockError);

    const { result } = renderHook(() => useAIChat(mockContext));

    await act(async () => {
      await result.current.sendQuestion('質問');
    });

    expect(result.current.error?.type).toBe('rate_limit');
    expect(result.current.error?.retryAfter).toBe(60);
  });

  it('should not send question when already loading', async () => {
    let resolvePromise: (value: typeof mockResponse) => void;
    const pendingPromise = new Promise<typeof mockResponse>((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(chatApi.sendChatRequest).mockReturnValue(pendingPromise);

    const { result } = renderHook(() => useAIChat(mockContext));

    // 最初の送信
    act(() => {
      result.current.sendQuestion('質問1');
    });

    expect(result.current.isLoading).toBe(true);

    // ローディング中に追加送信を試みる
    act(() => {
      result.current.sendQuestion('質問2');
    });

    // 1回しか呼ばれていない
    expect(chatApi.sendChatRequest).toHaveBeenCalledTimes(1);

    // クリーンアップ
    await act(async () => {
      resolvePromise!(mockResponse);
      await pendingPromise;
    });
  });

  it('should not retry when no previous question exists', async () => {
    const { result } = renderHook(() => useAIChat(mockContext));

    await act(async () => {
      await result.current.retry();
    });

    expect(chatApi.sendChatRequest).not.toHaveBeenCalled();
  });
});
