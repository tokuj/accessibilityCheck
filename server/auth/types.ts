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

// ============================================
// StorageStateManager関連の型定義
// ============================================

/**
 * Result型（成功または失敗）
 */
export type Result<T, E> =
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * セッションオプション
 */
export interface SessionOptions {
  /** 検証後に自動削除 */
  autoDestroy?: boolean;
  /** ISO 8601形式の有効期限 */
  expiresAt?: string;
}

/**
 * セッションメタデータ
 */
export interface SessionMetadata {
  /** セッションID（UUID） */
  id: string;
  /** セッション名 */
  name: string;
  /** 対象ドメイン */
  domain: string;
  /** 作成日時（ISO 8601） */
  createdAt: string;
  /** 更新日時（ISO 8601） */
  updatedAt: string;
  /** 有効期限（ISO 8601、オプション） */
  expiresAt?: string;
  /** スキーマバージョン */
  schemaVersion: number;
  /** 認証タイプ */
  authType: AuthType;
  /** 自動削除フラグ */
  autoDestroy: boolean;
}

/**
 * セッション保存エラー
 */
export type SaveError =
  | { type: 'encryption_failed'; message: string }
  | { type: 'io_error'; message: string }
  | { type: 'duplicate_name'; message: string }
  | { type: 'invalid_name'; message: string }
  | { type: 'limit_exceeded'; message: string };

/**
 * セッション読み込みエラー
 */
export type LoadError =
  | { type: 'not_found'; message: string }
  | { type: 'decryption_failed'; message: string }
  | { type: 'io_error'; message: string };

/**
 * セッション削除エラー
 */
export type DeleteError =
  | { type: 'not_found'; message: string }
  | { type: 'io_error'; message: string };

/**
 * セッションインデックスファイルの構造
 */
export interface SessionIndex {
  /** インデックススキーマバージョン */
  version: number;
  /** セッションメタデータ配列 */
  sessions: SessionMetadata[];
}

/**
 * 暗号化セッションファイルの復号化後の構造
 */
export interface EncryptedSessionPayload {
  /** ペイロードスキーマバージョン */
  version: number;
  /** Playwrightストレージステート */
  storageState: StorageState;
}

// ============================================
// InteractiveLogin関連の型定義 (Task 7)
// ============================================

/**
 * ログインセッション
 * headedブラウザでのインタラクティブログインの状態を管理
 */
export interface LoginSession {
  /** セッションID（UUID） */
  id: string;
  /** ログイン対象URL */
  loginUrl: string;
  /** 開始日時（ISO 8601） */
  startedAt: string;
  /** セッションの状態 */
  status: 'waiting_for_login' | 'ready_to_capture' | 'captured' | 'cancelled';
}

/**
 * ログインオプション
 */
export interface LoginOptions {
  /** タイムアウト（ミリ秒、デフォルト300000 = 5分） */
  timeout?: number;
  /** ブラウザタイプ（デフォルトchromium） */
  browserType?: 'chromium' | 'firefox' | 'webkit';
}

/**
 * ログインエラー
 */
export type LoginError =
  | { type: 'browser_launch_failed'; message: string }
  | { type: 'navigation_failed'; message: string }
  | { type: 'headless_environment'; message: string };

/**
 * キャプチャエラー
 */
export type CaptureError =
  | { type: 'session_not_found'; message: string }
  | { type: 'capture_failed'; message: string }
  | { type: 'save_failed'; message: string }
