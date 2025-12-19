/**
 * CORS設定モジュール
 * 環境変数ALLOWED_ORIGINSからCORS許可オリジンを読み取る
 */

export interface CorsConfig {
  origin: string[];
  credentials: boolean;
}

/**
 * 環境変数からCORS設定を取得する
 * - ALLOWED_ORIGINSが設定されている場合: カンマ区切りでパースして使用
 * - ALLOWED_ORIGINSが未設定または空の場合: デフォルトでlocalhost:5173を許可
 */
export function getCorsConfig(): CorsConfig {
  const allowedOrigins = process.env.ALLOWED_ORIGINS;

  // 未設定または空文字列の場合はデフォルト値を使用
  if (!allowedOrigins || allowedOrigins.trim() === '') {
    return {
      origin: ['http://localhost:5173'],
      credentials: true,
    };
  }

  // カンマ区切りでパースし、前後の空白をトリム
  const origins = allowedOrigins
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  return {
    origin: origins,
    credentials: true,
  };
}
