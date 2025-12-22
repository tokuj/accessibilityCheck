/**
 * 広告ブロックユーティリティモジュール
 *
 * Playwrightページへの広告リクエストブロック機能を提供する。
 * ページ読み込み時点で広告リソースをブロックし、分析パフォーマンスを向上させる。
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import type { Page, Route, Request } from 'playwright';
import {
  getAdBlockingConfig,
  DEFAULT_BLOCKED_URL_PATTERNS,
  DEFAULT_BLOCKED_MEDIA_EXTENSIONS,
} from '../config';

/**
 * 広告ブロック結果の型定義
 */
export interface AdBlockingResult {
  /** ブロックしたリクエスト数（初期値は0、ハンドラ呼び出しで更新） */
  blockedCount: number;
  /** ブロック対象パターン */
  patterns: readonly string[];
}

/**
 * 広告ブロック設定オプション
 */
export interface AdBlockingOptions {
  /** メディアファイルをブロックするか（デフォルト: false） */
  blockMedia?: boolean;
  /** 追加のブロックURLパターン */
  customPatterns?: readonly string[];
}

/**
 * URLがブロック対象パターンにマッチするかチェック
 *
 * @param url - チェック対象のURL
 * @param patterns - ブロックパターンリスト
 * @returns マッチする場合true
 */
function matchesPattern(url: string, patterns: readonly string[]): boolean {
  const urlLower = url.toLowerCase();

  for (const pattern of patterns) {
    // パターンを正規表現に変換
    // * は任意の文字列にマッチ
    // ** は任意のパスにマッチ
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // 特殊文字をエスケープ
      .replace(/\*\*/g, '<<DOUBLE_STAR>>') // **を一時的に置換
      .replace(/\*/g, '[^/]*') // *は/以外の任意文字
      .replace(/<<DOUBLE_STAR>>/g, '.*'); // **は任意文字

    const regex = new RegExp(regexPattern, 'i');

    if (regex.test(urlLower)) {
      return true;
    }
  }

  return false;
}

/**
 * URLがメディアファイルかどうかチェック
 *
 * @param url - チェック対象のURL
 * @param extensions - ブロック対象の拡張子リスト
 * @returns メディアファイルの場合true
 */
function isMediaFile(url: string, extensions: readonly string[]): boolean {
  const urlLower = url.toLowerCase();

  // クエリパラメータを除去してパス部分を取得
  const urlPath = urlLower.split('?')[0];

  for (const ext of extensions) {
    if (urlPath.endsWith(ext.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Playwrightページに広告ブロックを設定する
 *
 * page.route()を使用して広告関連URLへのリクエストをabortする。
 * ブロックしたリクエスト数はログに記録される。
 *
 * @param page - Playwrightページインスタンス
 * @param options - ブロック設定オプション
 * @returns ブロック結果（パターンと初期カウント）
 *
 * @example
 * ```typescript
 * const result = await setupAdBlocking(page, { blockMedia: true });
 * console.log(`ブロック対象パターン: ${result.patterns.length}件`);
 * ```
 */
export async function setupAdBlocking(
  page: Page,
  options: AdBlockingOptions = {}
): Promise<AdBlockingResult> {
  const config = getAdBlockingConfig();
  const { blockMedia = false, customPatterns = [] } = options;

  // ブロック対象パターンを構築
  const allPatterns: readonly string[] = [
    ...DEFAULT_BLOCKED_URL_PATTERNS,
    ...customPatterns,
  ];

  // メディア拡張子
  const mediaExtensions = blockMedia ? DEFAULT_BLOCKED_MEDIA_EXTENSIONS : [];

  // 結果オブジェクト（ブロックカウントはクロージャで更新）
  const result: AdBlockingResult = {
    blockedCount: 0,
    patterns: allPatterns,
  };

  // 広告ブロックが無効の場合はスキップ
  if (!config.enabled) {
    console.log('[AdBlocking] 広告ブロック無効（DISABLE_AD_BLOCKING=true）');
    return result;
  }

  // ブロック対象パターンをログに出力
  console.log(`[AdBlocking] ブロック対象パターン: ${allPatterns.length}件`);
  if (blockMedia) {
    console.log(`[AdBlocking] メディアファイルブロック有効: ${mediaExtensions.length}種類`);
  }

  // page.route()ハンドラを設定
  await page.route('**/*', async (route: Route, request: Request) => {
    const url = request.url();

    // 広告パターンにマッチするかチェック
    if (matchesPattern(url, allPatterns)) {
      result.blockedCount++;
      console.log(`[AdBlocking] ブロック (#${result.blockedCount}): ${url.substring(0, 100)}...`);
      await route.abort();
      return;
    }

    // メディアファイルをチェック（オプション有効時）
    if (blockMedia && isMediaFile(url, mediaExtensions)) {
      result.blockedCount++;
      console.log(`[AdBlocking] メディアブロック (#${result.blockedCount}): ${url.substring(0, 100)}...`);
      await route.abort();
      return;
    }

    // 通常リクエストは継続
    await route.continue();
  });

  return result;
}

/**
 * 広告ブロックユーティリティをエクスポート
 */
export default {
  setupAdBlocking,
};
