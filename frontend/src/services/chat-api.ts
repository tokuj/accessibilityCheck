/**
 * インラインAI対話機能のチャットAPIクライアント
 * バックエンド /api/chat へのHTTPリクエストを行う（Grounding対応）
 */

import type { ChatContext } from '../utils/chat-storage';

// APIベースURL
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// リクエストタイムアウト（30秒）
const REQUEST_TIMEOUT_MS = 30000;

/**
 * チャットAPIエラーの種別
 */
export type ChatApiErrorType = 'timeout' | 'rate_limit' | 'server' | 'network';

/**
 * チャットAPIエラークラス
 */
export class ChatApiError extends Error {
  type: ChatApiErrorType;
  retryAfter?: number;

  constructor(type: ChatApiErrorType, message: string, retryAfter?: number) {
    super(message);
    this.name = 'ChatApiError';
    this.type = type;
    this.retryAfter = retryAfter;
  }
}

/**
 * チャットリクエストの型定義
 */
export interface ChatRequest {
  context: ChatContext;
  question: string;
}

/**
 * 初期メッセージリクエストの型定義
 */
export interface InitialMessageRequest {
  context: ChatContext;
}

/**
 * 参照リンクの型定義（Grounding対応：ドメイン情報を含む）
 */
export interface ReferenceLink {
  uri: string;
  domain?: string;
  title?: string;
}

/**
 * チャットレスポンスの型定義（Grounding対応）
 */
export interface ChatResponse {
  answer: string;
  referenceUrls: string[];  // 後方互換性のため維持
  referenceLinks: ReferenceLink[];  // 新しい形式（ドメイン情報を含む）
}

/**
 * エラーメッセージを取得
 */
function getErrorMessage(type: ChatApiErrorType, retryAfter?: number): string {
  switch (type) {
    case 'timeout':
      return 'AIサービスへのリクエストがタイムアウトしました。しばらく経ってから再度お試しください。';
    case 'rate_limit':
      if (retryAfter) {
        return `リクエストが多すぎます。${retryAfter}秒後にお試しください。`;
      }
      return 'リクエストが多すぎます。しばらく経ってから再度お試しください。';
    case 'server':
      return 'サーバーエラーが発生しました。しばらく経ってから再度お試しください。';
    case 'network':
      return 'ネットワーク接続を確認してください。';
    default:
      return '予期しないエラーが発生しました。';
  }
}

/**
 * HTTPエラーを処理
 */
function handleHttpError(response: Response): never {
  const statusCode = response.status;

  // タイムアウト（408）
  if (statusCode === 408) {
    throw new ChatApiError('timeout', getErrorMessage('timeout'));
  }

  // レート制限（429）
  if (statusCode === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
    throw new ChatApiError('rate_limit', getErrorMessage('rate_limit', retryAfter), retryAfter);
  }

  // サーバーエラー（5xx）
  if (statusCode >= 500) {
    throw new ChatApiError('server', getErrorMessage('server'));
  }

  // その他のクライアントエラー（4xx）
  throw new ChatApiError('server', getErrorMessage('server'));
}

/**
 * チャットリクエストを送信
 * @param request - チャットリクエスト
 * @returns チャットレスポンス
 * @throws ChatApiError
 */
export async function sendChatRequest(request: ChatRequest): Promise<ChatResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // タイムアウトエラーの判定
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ChatApiError('timeout', getErrorMessage('timeout'));
    }
    // ネットワークエラーの判定
    throw new ChatApiError('network', getErrorMessage('network'));
  }

  // HTTPステータスエラーの処理
  if (!response.ok) {
    handleHttpError(response);
  }

  return response.json();
}

/**
 * 初期メッセージ（ユーザーインパクト説明）を取得
 * @param request - 初期メッセージリクエスト
 * @returns チャットレスポンス
 * @throws ChatApiError
 * @requirement 10.1-10.4 - 初期メッセージ（ユーザーインパクト提示）
 */
export async function sendInitialMessageRequest(request: InitialMessageRequest): Promise<ChatResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/chat/initial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // タイムアウトエラーの判定
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ChatApiError('timeout', getErrorMessage('timeout'));
    }
    // ネットワークエラーの判定
    throw new ChatApiError('network', getErrorMessage('network'));
  }

  // HTTPステータスエラーの処理
  if (!response.ok) {
    handleHttpError(response);
  }

  return response.json();
}
