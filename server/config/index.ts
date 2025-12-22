/**
 * 設定モジュールのエントリーポイント
 *
 * タイムアウト設定と広告ブロック設定を一元的にエクスポート
 */

export {
  getTimeoutConfig,
  DEFAULT_TIMEOUTS,
  type TimeoutConfig,
} from './timeout-config';

export {
  getAdBlockingConfig,
  DEFAULT_AD_SELECTORS,
  DEFAULT_BLOCKED_URL_PATTERNS,
  DEFAULT_BLOCKED_MEDIA_EXTENSIONS,
  type AdBlockingConfig,
} from './ad-blocking-config';
