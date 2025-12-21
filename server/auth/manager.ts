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
  console.log('[FormLogin] 開始 - config:', {
    loginUrl: config.loginUrl,
    usernameSelector: config.usernameSelector,
    passwordSelector: config.passwordSelector,
    submitSelector: config.submitSelector,
    username: config.username ? '(設定あり)' : '(未設定)',
    password: config.password ? '(設定あり)' : '(未設定)',
    successUrlPattern: config.successUrlPattern,
    targetUrl,
  });

  if (!config.loginUrl || !config.usernameSelector || !config.passwordSelector ||
      !config.submitSelector || !config.username || !config.password) {
    console.log('[FormLogin] エラー: 必須設定が不足');
    return {
      success: false,
      error: 'フォームログインに必要な設定が不足しています（loginUrl, usernameSelector, passwordSelector, submitSelector, username, password）',
    };
  }

  let browser: Browser | null = null;

  try {
    console.log('[FormLogin] ブラウザ起動中...');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // ログインページに移動
    console.log('[FormLogin] ログインページに移動:', config.loginUrl);
    await page.goto(config.loginUrl, { waitUntil: 'networkidle' });
    console.log('[FormLogin] ページ読み込み完了, URL:', page.url());

    // ユーザー名を入力
    console.log('[FormLogin] ユーザー名入力 - セレクタ:', config.usernameSelector);
    await page.fill(config.usernameSelector, config.username);
    console.log('[FormLogin] ユーザー名入力完了');

    // パスワードを入力
    console.log('[FormLogin] パスワード入力 - セレクタ:', config.passwordSelector);
    await page.fill(config.passwordSelector, config.password);
    console.log('[FormLogin] パスワード入力完了');

    // 送信ボタンをクリック
    console.log('[FormLogin] 送信ボタンクリック - セレクタ:', config.submitSelector);
    const submitButton = page.locator(config.submitSelector);
    const submitCount = await submitButton.count();
    console.log('[FormLogin] 送信ボタン検出数:', submitCount);
    if (submitCount === 0) {
      // ページのHTMLをログに出力（デバッグ用）
      const html = await page.content();
      console.log('[FormLogin] 送信ボタンが見つかりません。ページHTML（最初の2000文字）:', html.substring(0, 2000));
    }
    await page.click(config.submitSelector);
    console.log('[FormLogin] 送信ボタンクリック完了');

    // ログイン成功を待つ
    console.log('[FormLogin] ログイン成功判定開始...');

    if (config.successUrlPattern) {
      // 方法1: successUrlPattern が指定されている場合はそれを使う
      console.log('[FormLogin] successUrlPattern で判定:', config.successUrlPattern);
      await page.waitForURL(new RegExp(config.successUrlPattern), { timeout: 30000 });
    } else {
      // 方法2: ログインフォームが消えるのを待つ（URL変化の有無に関わらず動作）
      console.log('[FormLogin] ログインフォーム消失で判定');
      console.log('[FormLogin] 監視セレクタ - username:', config.usernameSelector, ', password:', config.passwordSelector);

      try {
        // ユーザー名欄とパスワード欄の両方が消えるまで待つ
        await Promise.race([
          // フォームが消える（SPA/従来サイト両対応）
          Promise.all([
            page.locator(config.usernameSelector).waitFor({ state: 'detached', timeout: 30000 }),
            page.locator(config.passwordSelector).waitFor({ state: 'detached', timeout: 30000 }),
          ]),
          // または hidden になる（同一ページでモーダルが閉じるパターン）
          Promise.all([
            page.locator(config.usernameSelector).waitFor({ state: 'hidden', timeout: 30000 }),
            page.locator(config.passwordSelector).waitFor({ state: 'hidden', timeout: 30000 }),
          ]),
        ]);
        console.log('[FormLogin] ログインフォーム消失を確認');
      } catch (e) {
        // フォームが消えない = ログイン失敗
        console.log('[FormLogin] ログインフォームが消えませんでした');
        throw new Error('ログインフォームが消えませんでした。認証情報を確認してください。');
      }
    }
    console.log('[FormLogin] ログイン成功判定完了, URL:', page.url());

    // ストレージへの書き込み完了を待つ（Cookie/localStorage）
    console.log('[FormLogin] ストレージ書き込み完了を待機中...');
    await context.storageState();

    // IndexedDB書き込み完了を待つ（Firebase等の非同期認証用）
    // storageState()はIndexedDBを待たないため、追加の待機が必要
    console.log('[FormLogin] IndexedDB書き込み完了を待機中（2秒）...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('[FormLogin] ストレージ書き込み完了');

    // storageStateを保存
    const storageState = await context.storageState() as StorageState;

    // デバッグ: storageStateの内容をログ出力
    console.log('[FormLogin] storageState - cookies数:', storageState.cookies.length);
    console.log('[FormLogin] storageState - cookies:', storageState.cookies.map(c => c.name));
    console.log('[FormLogin] storageState - origins数:', storageState.origins?.length || 0);
    if (storageState.origins && storageState.origins.length > 0) {
      storageState.origins.forEach((origin) => {
        console.log('[FormLogin] storageState - origin:', origin.origin, 'localStorage keys:', origin.localStorage?.map(item => item.name) || []);
      });
    }

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

    console.log('[FormLogin] 成功 - セッション取得完了（ブラウザは閉じずに返す）');
    // ブラウザを閉じずに返す（IndexedDB認証対応）
    return { success: true, session, storageState, browser, context, page };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log('[FormLogin] エラー:', message);
    // エラー時はブラウザを閉じる
    if (browser) {
      await browser.close();
    }
    return { success: false, error: `フォームログインに失敗しました: ${message}` };
  }
  // finallyでブラウザを閉じない - 呼び出し元で管理
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
   * 外部から取得したstorageStateを設定する
   * セッションベース認証で使用
   */
  setStorageState(storageState: StorageState): void {
    this.storageState = storageState;

    // CookieヘッダーをセッションとしてもStorageStateから生成
    const cookieHeader = storageState.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');

    this.session = {
      cookies: storageState.cookies,
      headers: cookieHeader ? { Cookie: cookieHeader } : {},
    };
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
