/**
 * URL処理ユーティリティ
 * Gemini Grounding APIのリダイレクトURLから実際のURLを抽出する
 */

/**
 * Gemini Grounding APIのリダイレクトURLから実際のURLを抽出する
 * リダイレクトURLの形式:
 * https://vertexaisearch.cloud.google.com/grounding-api-redirect/xxx?targetOriginUrl=<エンコードされたURL>
 *
 * @param redirectUrl - リダイレクトURL
 * @returns 抽出された元のURL、または抽出できない場合はnull
 */
export function extractOriginalUrl(redirectUrl: string): string | null {
  if (!redirectUrl) {
    return null;
  }

  try {
    const url = new URL(redirectUrl);
    const targetOriginUrl = url.searchParams.get('targetOriginUrl');
    if (targetOriginUrl) {
      return decodeURIComponent(targetOriginUrl);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * URLからホスト名を抽出する
 *
 * @param url - URL文字列
 * @returns ホスト名、またはURLが無効な場合は入力をそのまま返す
 */
export function extractHostname(url: string): string {
  if (!url) {
    return url;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Grounding APIのリダイレクトURLから表示用ドメインを取得する
 * targetOriginUrlパラメータがある場合はそこから実際のドメインを抽出し、
 * ない場合はリダイレクトURLのホスト名を返す
 *
 * @param redirectUrl - リダイレクトURLまたは通常のURL
 * @returns 表示用のドメイン名
 */
export function getDisplayDomain(redirectUrl: string): string {
  const originalUrl = extractOriginalUrl(redirectUrl);
  if (originalUrl) {
    return extractHostname(originalUrl);
  }
  return extractHostname(redirectUrl);
}
