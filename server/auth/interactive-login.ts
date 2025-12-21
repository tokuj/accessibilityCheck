/**
 * InteractiveLogin サービス
 * headedブラウザでのユーザー手動ログインとセッションキャプチャ
 *
 * Task 7: InteractiveLoginサービス実装
 * Requirements: 1.1-1.3, 2.5, 3.3, 4.3
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import crypto from 'node:crypto';
import type {
  LoginSession,
  LoginOptions,
  LoginError,
  CaptureError,
  SessionMetadata,
  StorageState,
  Result,
} from './types';
import { StorageStateManager, storageStateManager } from './storage-state-manager';

/** デフォルトタイムアウト（5分） */
export const DEFAULT_TIMEOUT = 300000;

/**
 * URLが有効かどうかを検証する
 * @param url 検証対象のURL
 * @returns 有効な場合true
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // HTTP/HTTPSスキームのみ許可（セキュリティ要件4.3）
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * headedブラウザが許可されているかどうかを確認
 * @returns 許可されている場合true
 */
function isHeadedBrowserAllowed(): boolean {
  return process.env.ALLOW_HEADED_BROWSER === 'true';
}

/**
 * InteractiveLogin サービスクラス
 * headedブラウザでのインタラクティブログインを管理
 */
export class InteractiveLoginService {
  private activeSession: LoginSession | null = null;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private storageStateManager: StorageStateManager;

  /**
   * コンストラクタ
   * @param manager StorageStateManagerインスタンス（DI用）
   */
  constructor(manager: StorageStateManager = storageStateManager) {
    this.storageStateManager = manager;
  }

  /**
   * インタラクティブログインを開始する
   * @param loginUrl ログイン対象のURL
   * @param options ログインオプション
   * @returns ログインセッション（成功時）またはエラー
   */
  async startLogin(
    loginUrl: string,
    options: LoginOptions = {}
  ): Promise<Result<LoginSession, LoginError>> {
    // headedブラウザ環境チェック
    if (!isHeadedBrowserAllowed()) {
      return {
        success: false,
        error: {
          type: 'headless_environment',
          message:
            'headedブラウザはこの環境で利用できません。ALLOW_HEADED_BROWSER=true を設定してください。',
        },
      };
    }

    // URL検証
    if (!isValidUrl(loginUrl)) {
      return {
        success: false,
        error: {
          type: 'navigation_failed',
          message: '無効なURLです。HTTP/HTTPSスキームのURLを指定してください。',
        },
      };
    }

    // 既存のアクティブセッションチェック
    if (this.activeSession !== null) {
      return {
        success: false,
        error: {
          type: 'browser_launch_failed',
          message:
            '既にアクティブなセッションが存在します。先にキャンセルしてください。',
        },
      };
    }

    const timeout = options.timeout ?? DEFAULT_TIMEOUT;

    try {
      // headedモードでブラウザを起動
      this.browser = await chromium.launch({
        headless: false,
      });

      // 新しいコンテキストを作成
      this.context = await this.browser.newContext();

      // 新しいページを作成してログインURLに移動
      this.page = await this.context.newPage();
      await this.page.goto(loginUrl);

      // セッションを作成
      const session: LoginSession = {
        id: crypto.randomUUID(),
        loginUrl,
        startedAt: new Date().toISOString(),
        status: 'waiting_for_login',
      };

      this.activeSession = session;

      // タイムアウトを設定
      this.timeoutId = setTimeout(() => {
        this.cancelLogin(session.id).catch(console.error);
      }, timeout);

      return {
        success: true,
        value: session,
      };
    } catch (error) {
      // エラー時はクリーンアップ
      await this.cleanup();

      return {
        success: false,
        error: {
          type: 'browser_launch_failed',
          message: `ブラウザの起動に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * セッションをキャプチャして保存する
   * @param loginSessionId ログインセッションID
   * @param sessionName 保存するセッション名
   * @param passphrase 暗号化パスフレーズ
   * @returns 保存されたセッションメタデータ（成功時）またはエラー
   */
  async captureSession(
    loginSessionId: string,
    sessionName: string,
    passphrase: string
  ): Promise<Result<SessionMetadata, CaptureError>> {
    // セッション存在チェック
    if (
      !this.activeSession ||
      this.activeSession.id !== loginSessionId
    ) {
      return {
        success: false,
        error: {
          type: 'session_not_found',
          message: `ログインセッション「${loginSessionId}」が見つかりません`,
        },
      };
    }

    if (!this.context) {
      return {
        success: false,
        error: {
          type: 'capture_failed',
          message: 'ブラウザコンテキストが存在しません',
        },
      };
    }

    try {
      // storageStateをキャプチャ
      const storageState = (await this.context.storageState()) as StorageState;

      // StorageStateManagerで保存
      const saveResult = await this.storageStateManager.save(
        sessionName,
        storageState,
        passphrase,
        {}
      );

      if (!saveResult.success) {
        return {
          success: false,
          error: {
            type: 'save_failed',
            message: saveResult.error.message,
          },
        };
      }

      // セッション状態を更新
      this.activeSession.status = 'captured';

      // クリーンアップ
      await this.cleanup();

      return {
        success: true,
        value: saveResult.value,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'capture_failed',
          message: `セッションのキャプチャに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * ログインセッションをキャンセルする
   * @param loginSessionId ログインセッションID
   */
  async cancelLogin(loginSessionId: string): Promise<void> {
    if (this.activeSession && this.activeSession.id === loginSessionId) {
      this.activeSession.status = 'cancelled';
      await this.cleanup();
    }
  }

  /**
   * アクティブなセッションを取得する
   * @returns アクティブセッション（存在しない場合null）
   */
  getActiveSession(): LoginSession | null {
    return this.activeSession;
  }

  /**
   * リソースをクリーンアップする
   */
  private async cleanup(): Promise<void> {
    // タイムアウトをクリア
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // ブラウザをクローズ
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // クローズエラーは無視
      }
      this.browser = null;
    }

    this.context = null;
    this.page = null;
    this.activeSession = null;
  }
}

/**
 * InteractiveLoginServiceのデフォルトインスタンス
 */
export const interactiveLoginService = new InteractiveLoginService();
