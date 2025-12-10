/**
 * 認証関連の型定義
 */

// 認証タイプ
export type AuthType = 'none' | 'cookie' | 'bearer' | 'basic' | 'form';

/**
 * 認証設定
 */
export interface AuthConfig {
  type: AuthType;

  // Cookie認証 - "name=value; name2=value2" 形式
  cookies?: string;

  // Bearer Token認証
  token?: string;

  // Basic認証
  username?: string;
  password?: string;

  // フォームログイン
  loginUrl?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
  successUrlPattern?: string;  // ログイン成功後のURL正規表現パターン
}

/**
 * 認証セッション - 認証後の状態を保持
 */
export interface AuthSession {
  // Playwright storageState互換の形式
  cookies: Cookie[];
  localStorage?: LocalStorageEntry[];

  // HTTPヘッダー（Cookie, Authorization等）
  headers: Record<string, string>;

  // Basic認証用credentials
  httpCredentials?: {
    username: string;
    password: string;
  };
}

/**
 * Cookie型（Playwright互換）
 */
export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * localStorage エントリ
 */
export interface LocalStorageEntry {
  name: string;
  value: string;
}

/**
 * Playwright storageState形式
 */
export interface StorageState {
  cookies: Cookie[];
  origins: {
    origin: string;
    localStorage: LocalStorageEntry[];
  }[];
}

/**
 * 認証結果
 */
export interface AuthResult {
  success: boolean;
  session?: AuthSession;
  storageState?: StorageState;
  error?: string;
}
