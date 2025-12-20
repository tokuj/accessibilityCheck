import type { AccessibilityReport, ImpactLevel } from './types';

/**
 * SSEログイベント
 * 分析中の一般的なログメッセージを送信
 */
export interface LogEvent {
  type: 'log';
  message: string;
  timestamp: string;
}

/**
 * SSE進捗イベント
 * 分析ステップの進捗状況を送信
 */
export interface ProgressEvent {
  type: 'progress';
  step: number;
  total: number;
  stepName: string;
}

/**
 * SSE違反検出イベント
 * 違反が検出されたときに送信
 */
export interface ViolationEvent {
  type: 'violation';
  rule: string;
  impact: ImpactLevel;
  count: number;
}

/**
 * SSE完了イベント
 * 分析完了時にレポートを送信
 */
export interface CompleteEvent {
  type: 'complete';
  report: AccessibilityReport;
}

/**
 * SSEエラーイベント
 * エラー発生時に送信
 */
export interface ErrorEvent {
  type: 'error';
  message: string;
  code: string;
}

/**
 * 全SSEイベントのユニオン型
 */
export type SSEEvent = LogEvent | ProgressEvent | ViolationEvent | CompleteEvent | ErrorEvent;

/**
 * 進捗コールバック関数の型
 * analyzer.tsから進捗を通知するために使用
 */
export type ProgressCallback = (event: SSEEvent) => void;
