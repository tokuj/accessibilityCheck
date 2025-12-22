/**
 * タイムアウト設定モジュール
 *
 * 各分析ツール（axe-core、Pa11y、Lighthouse）およびページ読み込みの
 * タイムアウト値を一元管理する。環境変数による上書きをサポート。
 *
 * Requirements: 4.2, 4.4
 */

/**
 * タイムアウト設定の型定義
 */
export interface TimeoutConfig {
  /** ページ読み込みタイムアウト（ms） */
  readonly pageLoadTimeout: number;

  /** axe-core分析タイムアウト（ms） */
  readonly axeTimeout: number;

  /** Pa11yタイムアウト（ms） */
  readonly pa11yTimeout: number;

  /** Pa11y安定化待機時間（ms） */
  readonly pa11yWait: number;

  /** Lighthouse maxWaitForLoad（ms） */
  readonly lighthouseMaxWaitForLoad: number;

  /** Lighthouse maxWaitForFcp（ms） */
  readonly lighthouseMaxWaitForFcp: number;
}

/**
 * デフォルトのタイムアウト値
 *
 * 広告が多いサイトでも安定して動作するよう、従来より長めに設定
 */
export const DEFAULT_TIMEOUTS: Readonly<TimeoutConfig> = Object.freeze({
  pageLoadTimeout: 90000, // 90秒
  axeTimeout: 120000, // 120秒
  pa11yTimeout: 90000, // 90秒
  pa11yWait: 3000, // 3秒
  lighthouseMaxWaitForLoad: 90000, // 90秒
  lighthouseMaxWaitForFcp: 60000, // 60秒
});

/**
 * 環境変数から数値を安全にパースする
 * @param envVar - 環境変数の値
 * @param defaultValue - パース失敗時のデフォルト値
 * @returns パースされた数値またはデフォルト値
 */
function parseEnvNumber(envVar: string | undefined, defaultValue: number): number {
  if (!envVar) {
    return defaultValue;
  }

  const parsed = parseInt(envVar, 10);

  // NaNまたは負の値の場合はデフォルト値を使用
  if (isNaN(parsed) || parsed < 0) {
    return defaultValue;
  }

  return parsed;
}

/**
 * タイムアウト設定を取得する
 *
 * 環境変数で個別のタイムアウト値を上書き可能：
 * - AXE_TIMEOUT_MS: axe-coreタイムアウト
 * - PA11Y_TIMEOUT_MS: Pa11yタイムアウト
 * - LIGHTHOUSE_TIMEOUT_MS: Lighthouse maxWaitForLoad
 * - PAGE_LOAD_TIMEOUT_MS: ページ読み込みタイムアウト
 *
 * @returns タイムアウト設定
 */
export function getTimeoutConfig(): TimeoutConfig {
  return {
    pageLoadTimeout: parseEnvNumber(
      process.env.PAGE_LOAD_TIMEOUT_MS,
      DEFAULT_TIMEOUTS.pageLoadTimeout
    ),
    axeTimeout: parseEnvNumber(process.env.AXE_TIMEOUT_MS, DEFAULT_TIMEOUTS.axeTimeout),
    pa11yTimeout: parseEnvNumber(process.env.PA11Y_TIMEOUT_MS, DEFAULT_TIMEOUTS.pa11yTimeout),
    pa11yWait: DEFAULT_TIMEOUTS.pa11yWait, // 環境変数による上書きは不要
    lighthouseMaxWaitForLoad: parseEnvNumber(
      process.env.LIGHTHOUSE_TIMEOUT_MS,
      DEFAULT_TIMEOUTS.lighthouseMaxWaitForLoad
    ),
    lighthouseMaxWaitForFcp: DEFAULT_TIMEOUTS.lighthouseMaxWaitForFcp, // 環境変数による上書きは不要
  };
}
