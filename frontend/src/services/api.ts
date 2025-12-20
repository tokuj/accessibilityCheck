import type {
  AnalyzeRequest,
  AnalyzeResponse,
  SSEEvent,
  AccessibilityReport,
  AuthConfig,
  LogEntry,
} from '../types/accessibility';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const REQUEST_TIMEOUT_MS = 300000; // 5分

// エラー種別の型定義
export type ApiErrorType = 'timeout' | 'network' | 'server' | 'client';

// カスタムエラークラス
export class ApiError extends Error {
  type: ApiErrorType;
  statusCode?: number;

  constructor(type: ApiErrorType, message: string, statusCode?: number) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.statusCode = statusCode;
  }
}

// エラーメッセージの生成
function getErrorMessage(type: ApiErrorType, statusCode?: number): string {
  switch (type) {
    case 'timeout':
      return '分析がタイムアウトしました。ページの読み込みに時間がかかっている可能性があります。';
    case 'network':
      return 'サーバーに接続できません。ネットワーク接続を確認してください。';
    case 'server':
      return 'サーバーエラーが発生しました。しばらく経ってから再度お試しください。';
    case 'client':
      if (statusCode === 400) {
        return '無効なリクエストです。URLを確認してください。';
      } else if (statusCode === 404) {
        return 'ページが見つかりません。';
      }
      return `クライアントエラーが発生しました（${statusCode}）。`;
    default:
      return '予期しないエラーが発生しました。';
  }
}

export async function analyzeUrl(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/analyze`, {
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
      throw new ApiError('timeout', getErrorMessage('timeout'));
    }
    // ネットワークエラーの判定
    if (error instanceof TypeError) {
      throw new ApiError('network', getErrorMessage('network'));
    }
    // その他のエラー
    throw new ApiError('network', getErrorMessage('network'));
  }

  // HTTPステータスエラーの処理
  if (!response.ok) {
    const statusCode = response.status;
    if (statusCode >= 500) {
      throw new ApiError('server', getErrorMessage('server', statusCode), statusCode);
    } else if (statusCode >= 400) {
      throw new ApiError('client', getErrorMessage('client', statusCode), statusCode);
    }
  }

  return response.json();
}

/**
 * SSEイベントのコールバック型
 */
export interface SSECallbacks {
  onLog?: (log: LogEntry) => void;
  onProgress?: (step: number, total: number, stepName: string) => void;
  onComplete?: (report: AccessibilityReport) => void;
  onError?: (message: string) => void;
}

/**
 * SSEストリーミングでアクセシビリティ分析を実行
 */
export function analyzeUrlWithSSE(
  request: AnalyzeRequest,
  callbacks: SSECallbacks
): { cancel: () => void } {
  const url = new URL(`${API_BASE_URL}/api/analyze-stream`);
  url.searchParams.set('url', request.url);

  // 認証パラメータを追加
  if (request.auth) {
    url.searchParams.set('authType', request.auth.type);
    if (request.auth.username) url.searchParams.set('authUsername', request.auth.username);
    if (request.auth.password) url.searchParams.set('authPassword', request.auth.password);
    if (request.auth.token) url.searchParams.set('authToken', request.auth.token);
    if (request.auth.cookies) url.searchParams.set('authCookies', request.auth.cookies);
    if (request.auth.loginUrl) url.searchParams.set('authLoginUrl', request.auth.loginUrl);
    if (request.auth.usernameSelector) url.searchParams.set('authUsernameSelector', request.auth.usernameSelector);
    if (request.auth.passwordSelector) url.searchParams.set('authPasswordSelector', request.auth.passwordSelector);
    if (request.auth.submitSelector) url.searchParams.set('authSubmitSelector', request.auth.submitSelector);
    if (request.auth.successUrlPattern) url.searchParams.set('authSuccessUrlPattern', request.auth.successUrlPattern);
  }

  const eventSource = new EventSource(url.toString());

  eventSource.onmessage = (event) => {
    try {
      const data: SSEEvent = JSON.parse(event.data);

      switch (data.type) {
        case 'log':
          callbacks.onLog?.({
            timestamp: data.timestamp,
            type: 'info',
            message: data.message,
          });
          break;

        case 'progress':
          callbacks.onProgress?.(data.step, data.total, data.stepName);
          callbacks.onLog?.({
            timestamp: new Date().toISOString(),
            type: 'progress',
            message: `[${data.step}/${data.total}] ${data.stepName}`,
          });
          break;

        case 'violation':
          callbacks.onLog?.({
            timestamp: new Date().toISOString(),
            type: 'violation',
            message: `違反検出: ${data.rule} (${data.impact}) - ${data.count}件`,
          });
          break;

        case 'complete':
          callbacks.onComplete?.(data.report);
          eventSource.close();
          break;

        case 'error':
          callbacks.onError?.(data.message);
          callbacks.onLog?.({
            timestamp: new Date().toISOString(),
            type: 'error',
            message: data.message,
          });
          eventSource.close();
          break;
      }
    } catch {
      // JSONパースエラーは無視
    }
  };

  eventSource.onerror = () => {
    callbacks.onError?.('サーバーとの接続が切断されました');
    eventSource.close();
  };

  return {
    cancel: () => {
      eventSource.close();
    },
  };
}
