/**
 * フォーム解析API呼び出し関数（Task 3.2）
 *
 * POST /api/auth/analyze-form を呼び出し、解析結果を返す
 */

import type {
  FormAnalysisResult,
  AnalyzeFormResponse,
  FormAnalysisError,
} from '../types/form-analyzer';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const REQUEST_TIMEOUT_MS = 60000; // 60秒（解析処理は時間がかかる）

/**
 * フォーム解析API専用エラークラス
 */
export class FormAnalyzerApiError extends Error {
  errorType: FormAnalysisError['type'];

  constructor(errorType: FormAnalysisError['type'], message: string) {
    super(message);
    this.name = 'FormAnalyzerApiError';
    this.errorType = errorType;
  }
}

/**
 * ログインフォームを解析する
 *
 * @param url 解析対象のログインページURL
 * @returns 解析結果
 * @throws FormAnalyzerApiError 解析失敗時
 */
export async function analyzeForm(url: string): Promise<FormAnalysisResult> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/auth/analyze-form`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // タイムアウトエラー
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new FormAnalyzerApiError(
        'timeout',
        '解析がタイムアウトしました。ページの読み込みに時間がかかっている可能性があります。'
      );
    }
    // ネットワークエラー
    throw new FormAnalyzerApiError(
      'network_error',
      'サーバーに接続できません。ネットワーク接続を確認してください。'
    );
  }

  // レスポンスをパース
  const data: AnalyzeFormResponse = await response.json();

  // APIがエラーを返した場合
  if (!data.success || data.error) {
    const errorType = (data.error?.type as FormAnalysisError['type']) || 'analysis_failed';
    const errorMessage = data.error?.message || '解析に失敗しました';
    throw new FormAnalyzerApiError(errorType, errorMessage);
  }

  // 結果がない場合
  if (!data.result) {
    throw new FormAnalyzerApiError(
      'analysis_failed',
      '解析結果が取得できませんでした'
    );
  }

  return data.result;
}
