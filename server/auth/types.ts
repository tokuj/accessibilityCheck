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
  /** フォームログイン時に使用したブラウザ（IndexedDB対応用） */
  browser?: import('playwright').Browser;
  /** フォームログイン時に使用したコンテキスト */
  context?: import('playwright').BrowserContext;
  /** フォームログイン時に使用したページ */
  page?: import('playwright').Page;
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
  | { type: 'save_failed'; message: string };

// ============================================
// FormAnalyzer関連の型定義 (Task 1.1)
// ============================================

/**
 * フォームフィールド候補
 * 解析で検出された入力フィールドやボタンの情報
 */
export interface FormFieldCandidate {
  /** CSSセレクタ */
  selector: string;
  /** ラベル要素のテキスト（存在する場合） */
  label: string | null;
  /** placeholder属性の値（存在する場合） */
  placeholder: string | null;
  /** name属性の値（存在する場合） */
  name: string | null;
  /** id属性の値（存在する場合） */
  id: string | null;
  /** type属性の値（email, password, submit等） */
  type: string;
  /** 検出の信頼度スコア（0.0〜1.0） */
  confidence: number;
}

/**
 * フォーム解析結果
 * ログインページから検出されたフォーム要素一覧
 */
export interface FormAnalysisResult {
  /** ユーザー名入力フィールドの候補 */
  usernameFields: FormFieldCandidate[];
  /** パスワード入力フィールドの候補 */
  passwordFields: FormFieldCandidate[];
  /** 送信ボタンの候補 */
  submitButtons: FormFieldCandidate[];
  /** 全体の信頼度 */
  confidence: 'high' | 'medium' | 'low';
}

/**
 * 選択されたフォームセレクタ
 * ユーザーが確定した各要素のセレクタ
 */
export interface SelectedFormSelectors {
  /** ユーザー名フィールドのセレクタ */
  usernameSelector: string;
  /** パスワードフィールドのセレクタ */
  passwordSelector: string;
  /** 送信ボタンのセレクタ */
  submitSelector: string;
}

/**
 * フォーム解析エラー（フロントエンド向け）
 * UIで表示するエラーの種別とメッセージ
 */
export type FormAnalysisError =
  | { type: 'invalid_url'; message: string }
  | { type: 'network_error'; message: string }
  | { type: 'timeout'; message: string }
  | { type: 'no_form_found'; message: string }
  | { type: 'analysis_failed'; message: string };

/**
 * 解析オプション
 * フォーム解析時の設定
 */
export interface AnalyzeOptions {
  /** タイムアウト（ミリ秒、デフォルト30000） */
  timeout?: number;
}

/**
 * 解析エラー（バックエンド向け）
 * サービス層で発生するエラーの種別
 */
export type AnalyzeError =
  | { type: 'navigation_failed'; message: string }
  | { type: 'timeout'; message: string }
  | { type: 'no_form_found'; message: string };
