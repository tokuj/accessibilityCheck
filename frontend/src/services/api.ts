import type {
  AnalyzeRequest,
  AnalyzeResponse,
  SSEEvent,
  AccessibilityReport,
  LogEntry,
  SessionMetadata,
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
  onSessionExpired?: () => void;
}

/**
 * SSEストリーミング分析のオプション
 */
export interface SSEAnalyzeOptions {
  /** セッションID（セッションベース認証用） */
  sessionId?: string;
  /** セッションのパスフレーズ（セッションベース認証用） */
  passphrase?: string;
}

/**
 * SSEストリーミングでアクセシビリティ分析を実行
 */
export function analyzeUrlWithSSE(
  request: AnalyzeRequest,
  callbacks: SSECallbacks,
  options?: SSEAnalyzeOptions
): { cancel: () => void } {
  const baseUrl = API_BASE_URL || window.location.origin;
  const url = new URL(`${baseUrl}/api/analyze-stream`);
  url.searchParams.set('url', request.url);

  // セッションベース認証パラメータを追加
  if (options?.sessionId) {
    url.searchParams.set('sessionId', options.sessionId);
    if (options.passphrase) {
      url.searchParams.set('passphrase', options.passphrase);
    }
  }

  // 認証パラメータを追加（手動認証）
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

        case 'session_expired':
          callbacks.onSessionExpired?.();
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

// ============================================
// セッション管理API（Task 4）
// ============================================

/**
 * セッション一覧を取得
 */
export async function getSessions(): Promise<SessionMetadata[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sessions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const statusCode = response.status;
      if (statusCode >= 500) {
        throw new ApiError('server', getErrorMessage('server', statusCode), statusCode);
      }
      throw new ApiError('client', getErrorMessage('client', statusCode), statusCode);
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('timeout', getErrorMessage('timeout'));
    }
    throw new ApiError('network', getErrorMessage('network'));
  }
}

/**
 * セッションを削除
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const statusCode = response.status;
      if (statusCode === 404) {
        throw new ApiError('client', 'セッションが見つかりません', statusCode);
      }
      if (statusCode >= 500) {
        throw new ApiError('server', getErrorMessage('server', statusCode), statusCode);
      }
      throw new ApiError('client', getErrorMessage('client', statusCode), statusCode);
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('timeout', getErrorMessage('timeout'));
    }
    throw new ApiError('network', getErrorMessage('network'));
  }
}

/**
 * セッションを復号化して読み込み
 */
export async function loadSession(
  sessionId: string,
  passphrase: string
): Promise<{ storageState: unknown }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/load`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ passphrase }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const statusCode = response.status;
      if (statusCode === 401) {
        throw new ApiError('client', 'パスフレーズが正しくありません', statusCode);
      }
      if (statusCode === 404) {
        throw new ApiError('client', 'セッションが見つかりません', statusCode);
      }
      if (statusCode >= 500) {
        throw new ApiError('server', getErrorMessage('server', statusCode), statusCode);
      }
      throw new ApiError('client', getErrorMessage('client', statusCode), statusCode);
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('timeout', getErrorMessage('timeout'));
    }
    throw new ApiError('network', getErrorMessage('network'));
  }
}

// ============================================
// インタラクティブログインAPI（Task 9）
// ============================================

/**
 * ログインセッション
 */
export interface LoginSession {
  id: string;
  loginUrl: string;
  startedAt: string;
  status: 'waiting_for_login' | 'ready_to_capture' | 'captured' | 'cancelled';
}

/**
 * インタラクティブログインを開始
 */
export async function startInteractiveLogin(loginUrl: string): Promise<LoginSession> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/interactive-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ loginUrl }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const statusCode = response.status;
      if (statusCode === 400) {
        const body = await response.json();
        throw new ApiError('client', body.error || '無効なリクエストです', statusCode);
      }
      if (statusCode === 503) {
        const body = await response.json();
        throw new ApiError('server', body.error || 'headedブラウザはこの環境で利用できません', statusCode);
      }
      if (statusCode >= 500) {
        throw new ApiError('server', getErrorMessage('server', statusCode), statusCode);
      }
      throw new ApiError('client', getErrorMessage('client', statusCode), statusCode);
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('timeout', getErrorMessage('timeout'));
    }
    throw new ApiError('network', getErrorMessage('network'));
  }
}

/**
 * セッションをキャプチャして保存
 */
export async function captureSession(
  sessionName: string,
  passphrase: string
): Promise<SessionMetadata> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/capture-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionName, passphrase }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const statusCode = response.status;
      if (statusCode === 400) {
        const body = await response.json();
        throw new ApiError('client', body.error || '無効なリクエストです', statusCode);
      }
      if (statusCode === 404) {
        throw new ApiError('client', 'アクティブなログインセッションがありません', statusCode);
      }
      if (statusCode >= 500) {
        throw new ApiError('server', getErrorMessage('server', statusCode), statusCode);
      }
      throw new ApiError('client', getErrorMessage('client', statusCode), statusCode);
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('timeout', getErrorMessage('timeout'));
    }
    throw new ApiError('network', getErrorMessage('network'));
  }
}

/**
 * インタラクティブログインをキャンセル
 */
export async function cancelInteractiveLogin(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/interactive-login`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const statusCode = response.status;
      if (statusCode === 404) {
        // セッションがない場合は無視（既にキャンセル済み）
        return;
      }
      if (statusCode >= 500) {
        throw new ApiError('server', getErrorMessage('server', statusCode), statusCode);
      }
      throw new ApiError('client', getErrorMessage('client', statusCode), statusCode);
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('timeout', getErrorMessage('timeout'));
    }
    throw new ApiError('network', getErrorMessage('network'));
  }
}

/**
 * アクティブなログインセッションを取得
 */
export async function getActiveLoginSession(): Promise<LoginSession | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/interactive-login`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const statusCode = response.status;
      if (statusCode >= 500) {
        throw new ApiError('server', getErrorMessage('server', statusCode), statusCode);
      }
      throw new ApiError('client', getErrorMessage('client', statusCode), statusCode);
    }

    const data = await response.json();
    return data.session;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('timeout', getErrorMessage('timeout'));
    }
    throw new ApiError('network', getErrorMessage('network'));
  }
}
