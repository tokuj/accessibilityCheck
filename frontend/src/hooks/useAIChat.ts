/**
 * useAIChatフック
 * API呼び出しと対話状態管理（Grounding対応、初期メッセージ対応）
 * @requirement 2.1, 5.1-5.5 - 対話状態・API呼び出し管理
 * @requirement 10.1-10.4 - 初期メッセージ（ユーザーインパクト提示）
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  sendChatRequest,
  sendInitialMessageRequest,
  ChatApiError,
  type ChatApiErrorType,
  type ReferenceLink,
} from '../services/chat-api';
import type { ChatContext, ChatHistoryEntry } from '../utils/chat-storage';
import { useChatHistory, type ChatAnswer } from './useChatHistory';

/**
 * エラー情報の型定義
 */
export interface ChatError {
  type: ChatApiErrorType;
  message: string;
  retryAfter?: number;
}

/**
 * 最後の回答の型定義（Grounding対応）
 */
export interface LastAnswer {
  answer: string;
  referenceUrls?: string[];  // 後方互換性のため維持
  referenceLinks?: ReferenceLink[];  // 新しい形式（ドメイン情報を含む）
}

/**
 * useAIChatの返却値
 */
export interface UseAIChatResult {
  isLoading: boolean;
  error: ChatError | null;
  lastAnswer: LastAnswer | null;
  history: ChatHistoryEntry[];
  initialMessage: string | null;
  isLoadingInitialMessage: boolean;
  sendQuestion: (question: string) => Promise<void>;
  retry: () => Promise<void>;
  clearError: () => void;
  fetchInitialMessage: () => Promise<void>;
}

/**
 * AI対話機能のカスタムフック
 * @param context - 対話コンテキスト
 */
export function useAIChat(context: ChatContext): UseAIChatResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [lastAnswer, setLastAnswer] = useState<LastAnswer | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [initialMessage, setInitialMessage] = useState<string | null>(null);
  const [isLoadingInitialMessage, setIsLoadingInitialMessage] = useState(false);
  const initialMessageFetchedRef = useRef(false);

  const { history, addEntry } = useChatHistory(context);

  /**
   * 質問を送信する
   */
  const sendQuestion = useCallback(
    async (question: string) => {
      // ローディング中は無視
      if (isLoading) {
        return;
      }

      setIsLoading(true);
      setError(null);
      setLastQuestion(question);

      try {
        const response = await sendChatRequest({
          context,
          question,
        });

        const answer: ChatAnswer = {
          answer: response.answer,
          referenceUrls: response.referenceUrls,
          referenceLinks: response.referenceLinks,
          generatedAt: new Date().toISOString(),
        };

        setLastAnswer({
          answer: response.answer,
          referenceUrls: response.referenceUrls,
          referenceLinks: response.referenceLinks,
        });

        addEntry(question, answer);
      } catch (e) {
        if (e instanceof ChatApiError) {
          setError({
            type: e.type,
            message: e.message,
            retryAfter: e.retryAfter,
          });
        } else {
          setError({
            type: 'server',
            message: '予期しないエラーが発生しました。',
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [context, isLoading, addEntry]
  );

  /**
   * 前回の質問をリトライする
   */
  const retry = useCallback(async () => {
    if (lastQuestion) {
      await sendQuestion(lastQuestion);
    }
  }, [lastQuestion, sendQuestion]);

  /**
   * エラーをクリアする
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * 初期メッセージ（ユーザーインパクト説明）を取得する
   */
  const fetchInitialMessage = useCallback(async () => {
    // 既に取得済みの場合はスキップ
    if (initialMessageFetchedRef.current || initialMessage) {
      return;
    }

    initialMessageFetchedRef.current = true;
    setIsLoadingInitialMessage(true);

    try {
      const response = await sendInitialMessageRequest({ context });
      setInitialMessage(response.answer);

      // 初期メッセージも履歴に追加
      const answer: ChatAnswer = {
        answer: response.answer,
        referenceUrls: response.referenceUrls,
        referenceLinks: response.referenceLinks,
        generatedAt: new Date().toISOString(),
        isInitialMessage: true,
      };
      addEntry('この項目を満たさない場合、どのようなユーザーがどう困りますか？', answer);
    } catch (e) {
      // 初期メッセージの取得失敗は致命的ではないので、エラー表示しない
      console.error('Failed to fetch initial message:', e);
    } finally {
      setIsLoadingInitialMessage(false);
    }
  }, [context, initialMessage, addEntry]);

  // コンテキストが変わったら初期メッセージフラグをリセット
  useEffect(() => {
    initialMessageFetchedRef.current = false;
    setInitialMessage(null);
  }, [context]);

  return {
    isLoading,
    error,
    lastAnswer,
    history,
    initialMessage,
    isLoadingInitialMessage,
    sendQuestion,
    retry,
    clearError,
    fetchInitialMessage,
  };
}
