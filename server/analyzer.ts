import { chromium } from 'playwright';
import type { AccessibilityReport, RuleResult, ToolInfo, LighthouseScores, AISummary } from './analyzers/types';
import { analyzeWithAxe, AXE_VERSION } from './analyzers/axe';
import { analyzeWithPa11y, PA11Y_VERSION } from './analyzers/pa11y';
import { analyzeWithLighthouse, LIGHTHOUSE_VERSION } from './analyzers/lighthouse';
import { AuthManager } from './auth/manager';
import type { AuthConfig, StorageState } from './auth/types';
import { GeminiService } from './services/gemini';
import type { ProgressCallback, SSEEvent } from './analyzers/sse-types';
import { getTimeoutConfig } from './config';
import { setupAdBlocking, formatTimeoutError } from './utils';

// Re-export types for backward compatibility
export type { RuleResult, AccessibilityReport } from './analyzers/types';
export type { AuthConfig, StorageState } from './auth/types';
export type { ProgressCallback } from './analyzers/sse-types';

export interface PageResult {
  name: string;
  url: string;
  violations: RuleResult[];
  passes: RuleResult[];
  incomplete: RuleResult[];
}

/**
 * ヘルパー関数: ログを console.log と onProgress の両方に送信
 */
function emitLog(message: string, onProgress?: ProgressCallback): void {
  console.log(message);
  if (onProgress) {
    onProgress({
      type: 'log',
      message,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * ヘルパー関数: 進捗イベントを送信
 */
function emitProgress(step: number, total: number, stepName: string, onProgress?: ProgressCallback): void {
  if (onProgress) {
    onProgress({
      type: 'progress',
      step,
      total,
      stepName,
    });
  }
}

/**
 * ヘルパー関数: 違反検出イベントを送信
 */
function emitViolations(violations: RuleResult[], onProgress?: ProgressCallback): void {
  if (onProgress && violations.length > 0) {
    // 影響度ごとにグループ化して通知
    const impactCounts = violations.reduce((acc, v) => {
      const impact = v.impact || 'minor';
      acc[impact] = (acc[impact] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    for (const [impact, count] of Object.entries(impactCounts)) {
      onProgress({
        type: 'violation',
        rule: `${count} violations`,
        impact: impact as 'critical' | 'serious' | 'moderate' | 'minor',
        count,
      });
    }
  }
}

export async function analyzeUrl(
  targetUrl: string,
  authConfig?: AuthConfig,
  onProgress?: ProgressCallback,
  externalStorageState?: StorageState
): Promise<AccessibilityReport> {
  const toolsUsed: ToolInfo[] = [];
  let allViolations: RuleResult[] = [];
  let allPasses: RuleResult[] = [];
  let allIncomplete: RuleResult[] = [];
  let lighthouseScores: LighthouseScores | undefined;
  let screenshot: string | undefined;

  // 認証マネージャーを初期化
  const authManager = new AuthManager(authConfig, targetUrl);

  // フォームログインで使用するブラウザ（ある場合）
  let formLoginBrowser: import('playwright').Browser | null = null;
  let formLoginPage: import('playwright').Page | null = null;

  // 外部から渡されたstorageStateがある場合はそれを設定
  if (externalStorageState) {
    authManager.setStorageState(externalStorageState);
    emitLog('  セッションベース認証を使用', onProgress);
  } else if (authManager.requiresAuth()) {
    // 認証が必要な場合、認証を実行
    emitLog('  認証処理を開始...', onProgress);
    const authResult = await authManager.authenticate();
    if (!authResult.success) {
      throw new Error(`認証に失敗しました: ${authResult.error}`);
    }
    // フォームログインの場合、ブラウザとページを取得
    if (authResult.browser && authResult.page) {
      formLoginBrowser = authResult.browser;
      formLoginPage = authResult.page;
      console.log('[Analyzer] フォームログイン済みブラウザを使用');
    }
    emitLog('  認証処理完了', onProgress);
  }

  // 1. axe-core analysis with Playwright
  emitProgress(1, 4, 'axe-core', onProgress);
  emitLog('  [1/4] axe-core 分析開始...', onProgress);

  // タイムアウト設定を取得
  const timeoutConfig = getTimeoutConfig();

  // フォームログインのブラウザがある場合はそれを使用、なければ新規起動
  let browser: import('playwright').Browser;
  let page: import('playwright').Page;
  let needsNewBrowser = true;
  let alreadyNavigated = false;  // フォームログイン後に既にナビゲーション済みかどうか

  if (formLoginBrowser && formLoginPage) {
    // フォームログイン済みブラウザを使用（IndexedDB認証を保持）
    browser = formLoginBrowser;
    page = formLoginPage;
    needsNewBrowser = false;

    // Req 1.4: ページ作成時にデフォルトタイムアウトを設定
    page.setDefaultTimeout(timeoutConfig.axeTimeout);

    // Req 5.1: リソースブロック機能を適用（広告リクエストをブロック）
    const blockingResult = await setupAdBlocking(page);
    console.log(`[Analyzer] 広告ブロック設定完了 - パターン数: ${blockingResult.patterns.length}`);

    // 同一オリジンかチェック
    const currentOrigin = new URL(page.url()).origin;
    const targetOrigin = new URL(targetUrl).origin;

    if (currentOrigin === targetOrigin) {
      // 同一オリジン: SPAナビゲーション（フルリロードなし = Firebase認証を維持）
      console.log('[Analyzer] SPAナビゲーション（フルリロードなし）:', targetUrl);
      await page.evaluate((url) => {
        window.history.pushState({}, '', url);
        window.dispatchEvent(new Event('popstate'));
      }, targetUrl);
      // ルーターがコンテンツを更新するのを待つ
      await page.waitForLoadState('networkidle');
      console.log('[Analyzer] SPAナビゲーション完了, URL:', page.url());
      alreadyNavigated = true;
    } else {
      // 別オリジン: page.goto() + Firebase認証復元待ち
      console.log('[Analyzer] 別オリジンへ移動（フルリロード）:', targetUrl);
      // Req 4.4: ページ読み込みタイムアウトを90秒に延長
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutConfig.pageLoadTimeout });
      // Firebase認証の復元を待つ
      try {
        await page.waitForFunction(
          () => (window as unknown as { firebase?: { auth?: () => { currentUser: unknown } } }).firebase?.auth?.().currentUser !== null,
          { timeout: 10000 }
        );
        console.log('[Analyzer] Firebase認証復元確認');
      } catch {
        // Firebase が露出していない場合は networkidle で妥協
        console.log('[Analyzer] Firebase認証確認不可、networkidleで待機');
        await page.waitForLoadState('networkidle');
      }
      console.log('[Analyzer] 別オリジンナビゲーション完了, URL:', page.url());
      alreadyNavigated = true;
    }
  } else {
    // 新しいブラウザを起動
    browser = await chromium.launch();

    // Playwright contextに認証情報を適用
    const contextOptions: Parameters<typeof browser.newContext>[0] = {
      viewport: { width: 1280, height: 720 },
    };

    // storageStateを適用（Cookie/localStorageを復元）
    const storageState = authManager.getStorageState();
    if (storageState) {
      contextOptions.storageState = storageState;
      console.log('[Analyzer] storageState適用 - cookies数:', storageState.cookies?.length || 0);
      console.log('[Analyzer] storageState適用 - origins数:', storageState.origins?.length || 0);
    } else {
      console.log('[Analyzer] storageStateなし');
    }

    // Basic認証のcredentialsを適用
    const httpCredentials = authManager.getHttpCredentials();
    if (httpCredentials) {
      contextOptions.httpCredentials = httpCredentials;
    }

    // 認証ヘッダーを適用
    const authHeaders = authManager.getHeaders();
    if (Object.keys(authHeaders).length > 0) {
      contextOptions.extraHTTPHeaders = authHeaders;
    }

    const context = await browser.newContext(contextOptions);
    page = await context.newPage();

    // Req 1.4: ページ作成時にデフォルトタイムアウトを設定
    page.setDefaultTimeout(timeoutConfig.axeTimeout);

    // Req 5.1: リソースブロック機能を適用（広告リクエストをブロック）
    const blockingResult = await setupAdBlocking(page);
    console.log(`[Analyzer] 広告ブロック設定完了 - パターン数: ${blockingResult.patterns.length}`);
  }

  try {
    // フォームログインで既にナビゲーション済みの場合はスキップ
    if (!alreadyNavigated) {
      // Req 4.4: ページ読み込みタイムアウトを90秒に延長
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: timeoutConfig.pageLoadTimeout });
      console.log('[Analyzer] ターゲットURL読み込み完了:', page.url());
    }

    // Capture screenshot
    const screenshotBuffer = await page.screenshot({
      type: 'png',
      fullPage: false,
    });
    screenshot = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;

    // Run axe-core
    const axeResult = await analyzeWithAxe(page);
    allViolations.push(...axeResult.violations);
    allPasses.push(...axeResult.passes);
    allIncomplete.push(...axeResult.incomplete);
    toolsUsed.push({
      name: 'axe-core',
      version: AXE_VERSION,
      duration: axeResult.duration,
    });
    emitLog(`  [1/4] axe-core 完了: 違反${axeResult.violations.length}件, パス${axeResult.passes.length}件 (${axeResult.duration}ms)`, onProgress);
    emitViolations(axeResult.violations, onProgress);
  } catch (error) {
    await browser.close();
    if (error instanceof Error) {
      // コンテキスト破棄エラー（ページがナビゲーションを行った場合）
      if (error.message.includes('Execution context was destroyed')) {
        throw new Error('ページが分析中にリダイレクトまたはナビゲーションを行いました。静的なページURLを指定してください。');
      }
      // ターゲットが閉じられたエラー
      if (error.message.includes('Target closed') || error.message.includes('Target page, context or browser has been closed')) {
        throw new Error('ページへのアクセス中に接続が切断されました。URLを確認してください。');
      }
      // Req 7.1: タイムアウトエラーの詳細化
      if (error.name === 'TimeoutError') {
        const errorMessage = formatTimeoutError('page-load', targetUrl, timeoutConfig.pageLoadTimeout);
        throw new Error(errorMessage);
      }
    }
    throw error;
  } finally {
    await browser.close().catch(() => {}); // 既に閉じている場合はエラーを無視
  }

  // 2. Pa11y analysis
  emitProgress(2, 4, 'pa11y', onProgress);
  emitLog('  [2/4] Pa11y 分析開始...', onProgress);
  try {
    // Pa11yに認証情報を渡す
    const pa11yAuthOptions = {
      headers: authManager.getHeaders(),
      username: authManager.getHttpCredentials()?.username,
      password: authManager.getHttpCredentials()?.password,
    };
    const pa11yResult = await analyzeWithPa11y(targetUrl, pa11yAuthOptions);
    allViolations.push(...pa11yResult.violations);
    allIncomplete.push(...pa11yResult.incomplete);
    toolsUsed.push({
      name: 'pa11y',
      version: PA11Y_VERSION,
      duration: pa11yResult.duration,
    });
    emitLog(`  [2/4] Pa11y 完了: 違反${pa11yResult.violations.length}件, 要確認${pa11yResult.incomplete.length}件 (${pa11yResult.duration}ms)`, onProgress);
    emitViolations(pa11yResult.violations, onProgress);
  } catch (error) {
    emitLog(`  [2/4] Pa11y エラー: ${error}`, onProgress);
    toolsUsed.push({
      name: 'pa11y',
      version: PA11Y_VERSION,
      duration: 0,
    });
  }

  // 3. Lighthouse analysis
  emitProgress(3, 4, 'lighthouse', onProgress);
  emitLog('  [3/4] Lighthouse 分析開始...', onProgress);
  try {
    // Lighthouseに認証ヘッダーを渡す
    const lighthouseAuthOptions = {
      headers: authManager.getHeaders(),
    };
    const lighthouseResult = await analyzeWithLighthouse(targetUrl, lighthouseAuthOptions);
    allViolations.push(...lighthouseResult.violations);
    allPasses.push(...lighthouseResult.passes);
    allIncomplete.push(...lighthouseResult.incomplete);
    lighthouseScores = lighthouseResult.scores;
    toolsUsed.push({
      name: 'lighthouse',
      version: LIGHTHOUSE_VERSION,
      duration: lighthouseResult.duration,
    });
    emitLog(`  [3/4] Lighthouse 完了: スコア Performance=${lighthouseResult.scores.performance}, A11y=${lighthouseResult.scores.accessibility} (${lighthouseResult.duration}ms)`, onProgress);
    emitViolations(lighthouseResult.violations, onProgress);
  } catch (error) {
    emitLog(`  [3/4] Lighthouse エラー: ${error}`, onProgress);
    toolsUsed.push({
      name: 'lighthouse',
      version: LIGHTHOUSE_VERSION,
      duration: 0,
    });
  }

  const pageName = new URL(targetUrl).hostname;
  const totalDuration = toolsUsed.reduce((sum, t) => sum + t.duration, 0);
  emitLog(`  合計実行時間: ${(totalDuration / 1000).toFixed(1)}秒`, onProgress);

  // 4. AI総評生成（Gemini成功時のみ表示、フォールバックなし）
  let aiSummary: AISummary | undefined;
  if (lighthouseScores) {
    emitProgress(4, 4, 'ai-summary', onProgress);
    emitLog('  [4/4] AI総評生成開始...', onProgress);
    try {
      const aiResult = await GeminiService.generateAISummary(allViolations, lighthouseScores);
      if (aiResult.success) {
        aiSummary = aiResult.value;
        emitLog('  [4/4] AI総評生成完了', onProgress);
      } else {
        emitLog(`  [4/4] AI総評生成失敗: ${aiResult.error.message}`, onProgress);
        // フォールバックなし - aiSummaryはundefinedのまま
      }
    } catch (error) {
      emitLog(`  [4/4] AI総評生成エラー: ${error}`, onProgress);
      // フォールバックなし - aiSummaryはundefinedのまま
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalViolations: allViolations.length,
      totalPasses: allPasses.length,
      totalIncomplete: allIncomplete.length,
    },
    pages: [
      {
        name: pageName,
        url: targetUrl,
        violations: allViolations,
        passes: allPasses,
        incomplete: allIncomplete,
      },
    ],
    screenshot,
    toolsUsed,
    lighthouseScores,
    aiSummary,
  };
}

