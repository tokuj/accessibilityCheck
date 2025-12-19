import type { AnalyzeRequest, AnalyzeResponse } from '../types/accessibility';

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
