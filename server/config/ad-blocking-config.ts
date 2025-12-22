/**
 * 広告ブロック設定モジュール
 *
 * アクセシビリティテスト時に広告要素を除外するための設定を一元管理する。
 * 広告はテスト安定性に影響を与えるため、デフォルトで有効。
 *
 * Requirements: 4.1, 4.3
 */

/**
 * 広告ブロック設定の型定義
 */
export interface AdBlockingConfig {
  /** 広告ブロックが有効かどうか */
  readonly enabled: boolean;

  /** axe-core/Pa11yで除外するCSSセレクタ */
  readonly adSelectors: readonly string[];

  /** Lighthouse/PlaywrightでブロックするURLパターン */
  readonly blockedUrlPatterns: readonly string[];

  /** ブロックするメディアファイル拡張子 */
  readonly blockedMediaExtensions: readonly string[];
}

/**
 * 広告関連CSSセレクタのデフォルトリスト
 *
 * axe-coreの.exclude()やPa11yのhideElementsで使用
 */
export const DEFAULT_AD_SELECTORS: readonly string[] = Object.freeze([
  // 広告iframe
  'iframe[src*="ads"]',
  'iframe[src*="doubleclick"]',
  'iframe[src*="googlesyndication"]',

  // class属性ベース
  '[class*="ad-"]',
  '[class*="ads-"]',
  '.adsbygoogle',
  '.ad-container',
  '.advertisement',

  // id属性ベース
  '[id*="ad-"]',
  '[id*="ads-"]',

  // data属性ベース
  '[data-ad-slot]',
  '[data-ad-client]',
]);

/**
 * 広告関連URLパターンのデフォルトリスト
 *
 * LighthouseのblockedUrlPatternsやPlaywrightのpage.route()で使用
 */
export const DEFAULT_BLOCKED_URL_PATTERNS: readonly string[] = Object.freeze([
  // 主要広告ネットワーク
  '*doubleclick.net/*',
  '*googlesyndication.com/*',
  '*adservice.google.*',
  '*googleadservices.com/*',
  '*amazon-adsystem.com/*',
  '*ads.yahoo.com/*',

  // 汎用パターン
  '**/*ads*/**',
]);

/**
 * ブロック対象のメディアファイル拡張子
 *
 * 大きなメディアファイルをブロックしてページ読み込みを高速化
 */
export const DEFAULT_BLOCKED_MEDIA_EXTENSIONS: readonly string[] = Object.freeze([
  '.mp4',
  '.webm',
  '.avi',
  '.mov',
  '.wmv',
  '.flv',
  '.mkv',
]);

/**
 * 広告ブロック設定を取得する
 *
 * 環境変数で無効化可能：
 * - DISABLE_AD_BLOCKING=true または DISABLE_AD_BLOCKING=1
 *
 * @returns 広告ブロック設定
 */
export function getAdBlockingConfig(): AdBlockingConfig {
  const disableValue = process.env.DISABLE_AD_BLOCKING;
  const isDisabled = disableValue === 'true' || disableValue === '1';

  return {
    enabled: !isDisabled,
    adSelectors: DEFAULT_AD_SELECTORS,
    blockedUrlPatterns: DEFAULT_BLOCKED_URL_PATTERNS,
    blockedMediaExtensions: DEFAULT_BLOCKED_MEDIA_EXTENSIONS,
  };
}
