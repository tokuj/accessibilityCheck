/**
 * 認証マネージャー
 * 各種認証方式に対応し、認証セッションを管理する
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type {
  AuthConfig,
  AuthResult,
  AuthSession,
  Cookie,
  StorageState,
} from './types';

/**
 * Cookie文字列をパースしてCookie配列に変換
 */
export function parseCookieString(cookieString: string, domain: string): Cookie[] {
  const cookies: Cookie[] = [];
  const pairs = cookieString.split(';').map((p) => p.trim()).filter(Boolean);

  for (const pair of pairs) {
    const [name, ...valueParts] = pair.split('=');
    const value = valueParts.join('=');
    if (name && value !== undefined) {
      cookies.push({
        name: name.trim(),
        value: value.trim(),
        domain,
        path: '/',
      });
    }
  }

  return cookies;
}

/**
 * URLからドメインを抽出
 */
export function extractDomain(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch {
    return '';
  }
}

/**
 * 認証なしの場合のセッションを返す
 */
function createEmptySession(): AuthSession {
  return {
    cookies: [],
    headers: {},
  };
}

/**
 * Cookie認証のセッションを作成
 */
function createCookieSession(config: AuthConfig, targetUrl: string): AuthResult {
  if (!config.cookies) {
    return { success: false, error: 'Cookie文字列が指定されていません' };
  }

  const domain = extractDomain(targetUrl);
  const cookies = parseCookieString(config.cookies, domain);

  const session: AuthSession = {
    cookies,
    headers: {
      Cookie: config.cookies,
    },
  };

  const storageState: StorageState = {
    cookies,
    origins: [],
  };

  return { success: true, session, storageState };
}

/**
 * Bearer Token認証のセッションを作成
 */
function createBearerSession(config: AuthConfig): AuthResult {
  if (!config.token) {
    return { success: false, error: 'トークンが指定されていません' };
  }

  const session: AuthSession = {
    cookies: [],
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  };

  return { success: true, session };
}

/**
 * Basic認証のセッションを作成
 */
function createBasicSession(config: AuthConfig): AuthResult {
  if (!config.username || !config.password) {
    return { success: false, error: 'ユーザー名またはパスワードが指定されていません' };
  }

  const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');

  const session: AuthSession = {
    cookies: [],
    headers: {
      Authorization: `Basic ${credentials}`,
    },
    httpCredentials: {
      username: config.username,
      password: config.password,
    },
  };

  return { success: true, session };
}

/**
 * フォームログインを実行してセッションを取得
 */
async function performFormLogin(config: AuthConfig, targetUrl: string): Promise<AuthResult> {
  if (!config.loginUrl || !config.usernameSelector || !config.passwordSelector ||
      !config.submitSelector || !config.username || !config.password) {
    return {
      success: false,
      error: 'フォームログインに必要な設定が不足しています（loginUrl, usernameSelector, passwordSelector, submitSelector, username, password）',
    };
  }

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // ログインページに移動
    await page.goto(config.loginUrl, { waitUntil: 'networkidle' });

    // ユーザー名を入力
    await page.fill(config.usernameSelector, config.username);

    // パスワードを入力
    await page.fill(config.passwordSelector, config.password);

    // 送信ボタンをクリック
    await page.click(config.submitSelector);

    // ログイン成功を待つ
    if (config.successUrlPattern) {
      await page.waitForURL(new RegExp(config.successUrlPattern), { timeout: 30000 });
    } else {
      // URLパターンが指定されていない場合はナビゲーション完了を待つ
      await page.waitForLoadState('networkidle');
    }

    // storageStateを保存
    const storageState = await context.storageState() as StorageState;

    // Cookieヘッダーを構築
    const cookieHeader = storageState.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');

    const session: AuthSession = {
      cookies: storageState.cookies,
      headers: {
        Cookie: cookieHeader,
      },
    };

    return { success: true, session, storageState };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `フォームログインに失敗しました: ${message}` };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 認証設定から認証セッションを作成
 */
export async function createAuthSession(
  config: AuthConfig | undefined,
  targetUrl: string
): Promise<AuthResult> {
  // 認証設定がない、またはタイプがnoneの場合
  if (!config || config.type === 'none') {
    return { success: true, session: createEmptySession() };
  }

  switch (config.type) {
    case 'cookie':
      return createCookieSession(config, targetUrl);

    case 'bearer':
      return createBearerSession(config);

    case 'basic':
      return createBasicSession(config);

    case 'form':
      return await performFormLogin(config, targetUrl);

    default:
      return { success: false, error: `未対応の認証タイプ: ${config.type}` };
  }
}

/**
 * 認証マネージャークラス
 */
export class AuthManager {
  private config: AuthConfig | undefined;
  private targetUrl: string;
  private session: AuthSession | null = null;
  private storageState: StorageState | null = null;

  constructor(config: AuthConfig | undefined, targetUrl: string) {
    this.config = config;
    this.targetUrl = targetUrl;
  }

  /**
   * 認証を実行してセッションを取得
   */
  async authenticate(): Promise<AuthResult> {
    const result = await createAuthSession(this.config, this.targetUrl);

    if (result.success && result.session) {
      this.session = result.session;
      this.storageState = result.storageState || null;
    }

    return result;
  }

  /**
   * 認証済みセッションを取得
   */
  getSession(): AuthSession | null {
    return this.session;
  }

  /**
   * Playwright用のstorageStateを取得
   */
  getStorageState(): StorageState | null {
    return this.storageState;
  }

  /**
   * HTTPヘッダーを取得（Pa11y, Lighthouse用）
   */
  getHeaders(): Record<string, string> {
    return this.session?.headers || {};
  }

  /**
   * Basic認証用のcredentialsを取得（Playwright用）
   */
  getHttpCredentials(): { username: string; password: string } | undefined {
    return this.session?.httpCredentials;
  }

  /**
   * 認証が必要かどうか
   */
  requiresAuth(): boolean {
    return !!this.config && this.config.type !== 'none';
  }
}
