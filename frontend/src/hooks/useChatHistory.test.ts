/**
 * useChatHistoryフックのテスト
 * @requirement 3.1-3.5 - 対話履歴管理
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatHistory } from './useChatHistory';
import type { ChatContext, ChatHistoryEntry } from '../utils/chat-storage';

describe('useChatHistory', () => {
  const mockContext: ChatContext = {
    type: 'violation',
    ruleId: 'color-contrast',
    wcagCriteria: ['1.4.3'],
    data: { description: 'コントラスト不足' },
    label: 'コントラスト',
  };

  // Grounding対応：referenceUrlsは配列
  const mockAnswer = {
    answer: 'テスト回答',
    referenceUrls: ['https://example.com'],
    generatedAt: '2026-01-25T12:00:00Z',
  };

  beforeEach(() => {
    // sessionStorageをクリア
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should return empty history initially', () => {
    const { result } = renderHook(() => useChatHistory(mockContext));

    expect(result.current.history).toEqual([]);
    expect(result.current.historyCount).toBe(0);
  });

  it('should add entry to history', () => {
    const { result } = renderHook(() => useChatHistory(mockContext));

    act(() => {
      result.current.addEntry('テスト質問', mockAnswer);
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].question).toBe('テスト質問');
    expect(result.current.history[0].answer).toBe('テスト回答');
    expect(result.current.historyCount).toBe(1);
  });

  it('should return correct historyCount', () => {
    const { result } = renderHook(() => useChatHistory(mockContext));

    act(() => {
      result.current.addEntry('質問1', mockAnswer);
    });
    act(() => {
      result.current.addEntry('質問2', mockAnswer);
    });
    act(() => {
      result.current.addEntry('質問3', mockAnswer);
    });

    expect(result.current.historyCount).toBe(3);
  });

  it('should reload history when context changes', () => {
    // 最初のコンテキストで履歴を追加
    const { result: result1 } = renderHook(() => useChatHistory(mockContext));
    act(() => {
      result1.current.addEntry('質問1', mockAnswer);
    });

    // 別のコンテキストで新しいフック
    const anotherContext: ChatContext = {
      type: 'score',
      data: { value: 80 },
      label: '総合スコア',
    };
    const { result: result2 } = renderHook(() => useChatHistory(anotherContext));

    // 別のコンテキストでは履歴が空
    expect(result2.current.history).toEqual([]);

    // 元のコンテキストに戻ると履歴がある
    const { result: result3 } = renderHook(() => useChatHistory(mockContext));
    expect(result3.current.history).toHaveLength(1);
  });

  it('should clear history', () => {
    const { result } = renderHook(() => useChatHistory(mockContext));

    act(() => {
      result.current.addEntry('質問1', mockAnswer);
      result.current.addEntry('質問2', mockAnswer);
    });

    expect(result.current.historyCount).toBe(2);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.history).toEqual([]);
    expect(result.current.historyCount).toBe(0);
  });

  it('should persist history to sessionStorage', () => {
    const { result } = renderHook(() => useChatHistory(mockContext));

    act(() => {
      result.current.addEntry('永続化テスト', mockAnswer);
    });

    // 新しいフックインスタンスでも履歴が取得できる
    const { result: result2 } = renderHook(() => useChatHistory(mockContext));
    expect(result2.current.history).toHaveLength(1);
    expect(result2.current.history[0].question).toBe('永続化テスト');
  });

  it('should truncate history to 20 entries when exceeding limit', () => {
    const { result } = renderHook(() => useChatHistory(mockContext));

    // 25件追加
    act(() => {
      for (let i = 1; i <= 25; i++) {
        result.current.addEntry(`質問${i}`, mockAnswer);
      }
    });

    // 20件に制限される
    expect(result.current.historyCount).toBe(20);
    // 古い履歴（質問1〜5）が削除され、質問6〜25が残る
    expect(result.current.history[0].question).toBe('質問6');
    expect(result.current.history[19].question).toBe('質問25');
  });

  it('should include referenceUrls in history entry (Grounding対応)', () => {
    const { result } = renderHook(() => useChatHistory(mockContext));

    act(() => {
      result.current.addEntry('参照URLテスト', mockAnswer);
    });

    expect(result.current.history[0].referenceUrls).toContain('https://example.com');
  });

  it('should generate unique id for each entry', () => {
    const { result } = renderHook(() => useChatHistory(mockContext));

    act(() => {
      result.current.addEntry('質問1', mockAnswer);
      result.current.addEntry('質問2', mockAnswer);
    });

    const ids = result.current.history.map((entry: ChatHistoryEntry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
