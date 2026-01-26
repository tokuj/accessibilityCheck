/**
 * useChatHistoryフック
 * 項目ごとの対話履歴管理（sessionStorage）
 * @requirement 3.1-3.5 - 対話履歴管理
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  type ChatContext,
  type ChatHistoryEntry,
  type ReferenceLink,
  generateContextKey,
  getHistory,
  saveHistory,
} from '../utils/chat-storage';

/**
 * ChatAnswerの型定義（Grounding対応）
 */
export interface ChatAnswer {
  answer: string;
  referenceUrls?: string[];  // 後方互換性のため維持
  referenceLinks?: ReferenceLink[];  // 新しい形式（ドメイン情報を含む）
  generatedAt: string;
  isInitialMessage?: boolean;
}

/**
 * useChatHistoryの返却値
 */
export interface UseChatHistoryResult {
  history: ChatHistoryEntry[];
  historyCount: number;
  addEntry: (question: string, answer: ChatAnswer) => void;
  clearHistory: () => void;
}

/**
 * 一意のIDを生成
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 対話履歴を管理するカスタムフック
 * @param context - 対話コンテキスト
 */
export function useChatHistory(context: ChatContext): UseChatHistoryResult {
  // コンテキストキーをメモ化
  const contextKey = useMemo(() => generateContextKey(context), [context]);

  // 履歴状態
  const [history, setHistory] = useState<ChatHistoryEntry[]>([]);

  // コンテキスト変更時に履歴を再読み込み
  useEffect(() => {
    const loadedHistory = getHistory(contextKey);
    setHistory(loadedHistory);
  }, [contextKey]);

  // 履歴にエントリを追加
  const addEntry = useCallback(
    (question: string, answer: ChatAnswer) => {
      const newEntry: ChatHistoryEntry = {
        id: generateId(),
        question,
        answer: answer.answer,
        referenceUrls: answer.referenceUrls,
        referenceLinks: answer.referenceLinks,
        timestamp: new Date().toISOString(),
        isInitialMessage: answer.isInitialMessage,
      };

      setHistory((prev) => {
        const newHistory = [...prev, newEntry];
        saveHistory(contextKey, newHistory);
        // saveHistoryで20件に制限されるが、stateも同期させる
        return newHistory.length > 20
          ? newHistory.slice(newHistory.length - 20)
          : newHistory;
      });
    },
    [contextKey]
  );

  // 履歴をクリア
  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory(contextKey, []);
  }, [contextKey]);

  return {
    history,
    historyCount: history.length,
    addEntry,
    clearHistory,
  };
}
