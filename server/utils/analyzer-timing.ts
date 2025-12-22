/**
 * 分析タイミングユーティリティモジュール
 *
 * 各分析ツール（axe-core、Pa11y、Lighthouse）の実行時間を計測し、
 * タイムアウト発生時の詳細なエラーメッセージとログを提供する。
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

/**
 * 分析ツールの種類
 */
export type AnalyzerToolType = 'axe-core' | 'pa11y' | 'lighthouse';

/**
 * タイムアウト発生箇所の種類
 */
export type TimeoutLocation = 'page-load' | 'axe-core' | 'pa11y' | 'lighthouse';

/**
 * 分析ステータス
 */
export type AnalyzerStatus = 'running' | 'success' | 'timeout' | 'error';

/**
 * 分析タイミング情報の型定義
 *
 * Requirement: 7.2
 */
export interface AnalyzerTiming {
  /** 分析ツール名 */
  tool: AnalyzerToolType;
  /** 対象URL */
  url: string;
  /** 開始時刻（ISO 8601形式） */
  startTime: string;
  /** 終了時刻（ISO 8601形式） */
  endTime?: string;
  /** 所要時間（ミリ秒） */
  duration?: number;
  /** ステータス */
  status: AnalyzerStatus;
}

/**
 * 分析タイミングオブジェクトを作成する
 *
 * @param tool - 分析ツール名
 * @param url - 対象URL
 * @returns 分析タイミングオブジェクト（開始状態）
 *
 * Requirement: 7.2
 */
export function createAnalyzerTiming(
  tool: AnalyzerToolType,
  url: string
): AnalyzerTiming {
  return {
    tool,
    url,
    startTime: new Date().toISOString(),
    status: 'running',
  };
}

/**
 * 分析タイミングを完了状態にする
 *
 * @param timing - 分析タイミングオブジェクト
 * @param status - 完了ステータス
 * @returns 完了した分析タイミングオブジェクト
 *
 * Requirement: 7.2
 */
export function completeAnalyzerTiming(
  timing: AnalyzerTiming,
  status: 'success' | 'timeout' | 'error'
): AnalyzerTiming {
  const endTime = new Date();
  const startTime = new Date(timing.startTime);
  const duration = endTime.getTime() - startTime.getTime();

  return {
    ...timing,
    endTime: endTime.toISOString(),
    duration,
    status,
  };
}

/**
 * タイムアウト箇所に応じたツール名を取得
 */
function getLocationLabel(location: TimeoutLocation): string {
  const labels: Record<TimeoutLocation, string> = {
    'page-load': 'ページの読み込み',
    'axe-core': 'axe-core分析',
    'pa11y': 'Pa11y分析',
    'lighthouse': 'Lighthouse分析',
  };
  return labels[location];
}

/**
 * タイムアウトエラーメッセージをフォーマットする
 *
 * @param location - タイムアウト発生箇所
 * @param url - 対象URL
 * @param timeoutMs - タイムアウト設定値（ミリ秒）
 * @param elapsedMs - 経過時間（ミリ秒、オプション）
 * @returns フォーマットされたエラーメッセージ
 *
 * Requirement: 7.1, 7.4
 */
export function formatTimeoutError(
  location: TimeoutLocation,
  url: string,
  timeoutMs: number,
  elapsedMs?: number
): string {
  const locationLabel = getLocationLabel(location);
  const timeoutSec = (timeoutMs / 1000).toFixed(0);

  let message = `${locationLabel}がタイムアウトしました（${timeoutSec}秒）。URL: ${url}`;

  if (elapsedMs !== undefined) {
    const elapsedSec = (elapsedMs / 1000).toFixed(1);
    message += ` [経過時間: ${elapsedSec}秒]`;
  }

  return message;
}

/**
 * 構造化ログをフォーマットする
 *
 * @param timing - 分析タイミング情報
 * @param errorMessage - エラーメッセージ（オプション）
 * @returns フォーマットされたログ文字列
 *
 * Requirement: 7.2, 7.3, 7.4
 */
export function formatStructuredLog(
  timing: AnalyzerTiming,
  errorMessage?: string
): string {
  const durationSec = timing.duration !== undefined
    ? (timing.duration / 1000).toFixed(1)
    : '?';

  const statusLabels: Record<AnalyzerStatus, string> = {
    running: '実行中',
    success: '完了',
    timeout: 'タイムアウト',
    error: 'エラー',
  };

  const statusLabel = statusLabels[timing.status];

  let log = `[${timing.tool}] ${statusLabel} - ${durationSec}秒 | URL: ${timing.url}`;

  // エラーメッセージがある場合は追加
  if (errorMessage) {
    log += ` | 詳細: ${errorMessage}`;
  }

  // Requirement 7.3: 60秒超過時に警告を追加
  if (timing.duration !== undefined && timing.duration > 60000 && timing.status !== 'timeout') {
    log += ' | 警告: 60秒超過';
  }

  return log;
}

/**
 * 分析開始ログを出力する
 *
 * @param tool - 分析ツール名
 * @param url - 対象URL
 *
 * Requirement: 7.2
 */
export function logAnalyzerStart(tool: AnalyzerToolType, url: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${tool}] 分析開始 | URL: ${url}`);
}

/**
 * 分析完了ログを出力する
 *
 * @param timing - 分析タイミング情報
 * @param errorMessage - エラーメッセージ（オプション）
 *
 * Requirement: 7.2, 7.3, 7.4
 */
export function logAnalyzerComplete(
  timing: AnalyzerTiming,
  errorMessage?: string
): void {
  const log = formatStructuredLog(timing, errorMessage);
  const timestamp = new Date().toISOString();

  // ステータスに応じてログレベルを変更
  if (timing.status === 'error' || timing.status === 'timeout') {
    console.error(`[${timestamp}] ${log}`);
  } else if (timing.duration !== undefined && timing.duration > 60000) {
    // Requirement 7.3: 60秒超過時は警告ログ
    console.warn(`[${timestamp}] ${log}`);
  } else {
    console.log(`[${timestamp}] ${log}`);
  }
}
