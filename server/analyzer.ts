import { chromium } from 'playwright';
import type { AccessibilityReport, RuleResult, ToolInfo, LighthouseScores, AISummary, AnalyzerResult } from './analyzers/types';
import { analyzeWithAxeEnhanced, AXE_VERSION } from './analyzers/axe';
import { analyzeWithPa11y, PA11Y_VERSION } from './analyzers/pa11y';
import { analyzeWithLighthouse, LIGHTHOUSE_VERSION } from './analyzers/lighthouse';
import { analyzeWithIBM } from './analyzers/ibm';
import { analyzeWithAlfa } from './analyzers/alfa';
import { analyzeWithQualWeb } from './analyzers/qualweb';
import { analyzeWithWave } from './analyzers/wave';
import type { AnalysisOptions } from './analyzers/analysis-options';
import { DEFAULT_ANALYSIS_OPTIONS } from './analyzers/analysis-options';
import { DeduplicationService } from './analyzers/deduplication';
import { CustomRulesService, type CustomRuleViolation } from './analyzers/custom-rules';
import { SemiAutoCheckService, type SemiAutoItem } from './analyzers/semi-auto-check';
import { AuthManager } from './auth/manager';
import type { AuthConfig, StorageState } from './auth/types';
import { GeminiService, generateFallbackSummary } from './services/gemini';
import type { ProgressCallback, SSEEvent } from './analyzers/sse-types';
import { getTimeoutConfig } from './config';
import { setupAdBlocking, formatTimeoutError } from './utils';

// Re-export types for backward compatibility
export type { RuleResult, AccessibilityReport } from './analyzers/types';
export type { AuthConfig, StorageState } from './auth/types';
export type { ProgressCallback } from './analyzers/sse-types';
export type { AnalysisOptions } from './analyzers/analysis-options';
export { DEFAULT_ANALYSIS_OPTIONS, QUICK_ANALYSIS_PRESET, FULL_ANALYSIS_PRESET } from './analyzers/analysis-options';

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
  let pageTitle: string | undefined;

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

    // ページタイトル取得（Requirement 5.6）
    pageTitle = await page.title();
    console.log('[Analyzer] ページタイトル取得:', pageTitle || '(無題)');

    // Run axe-core
    const axeResult = await analyzeWithAxeEnhanced(page);
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

  // ページ名: タイトルがあればタイトル、なければホスト名をフォールバック
  const pageName = pageTitle || new URL(targetUrl).hostname;
  const totalDuration = toolsUsed.reduce((sum, t) => sum + t.duration, 0);
  emitLog(`  合計実行時間: ${(totalDuration / 1000).toFixed(1)}秒`, onProgress);

  // 4. AI総評生成（Lighthouse失敗時もaxe-core/pa11yデータで生成）
  let aiSummary: AISummary | undefined;
  emitProgress(4, 4, 'ai-summary', onProgress);
  emitLog('  [4/4] AI総評生成開始...', onProgress);
  try {
    // lighthouseScores はオプショナル（undefined可）
    const aiResult = await GeminiService.generateAISummary(allViolations, lighthouseScores);
    if (aiResult.success) {
      aiSummary = aiResult.value;
      emitLog('  [4/4] AI総評生成完了', onProgress);
    } else {
      emitLog(`  [4/4] AI総評生成失敗: ${aiResult.error.message}`, onProgress);
      aiSummary = generateFallbackSummary(allViolations);
      emitLog('  [4/4] フォールバック総評を使用', onProgress);
    }
  } catch (error) {
    emitLog(`  [4/4] AI総評生成エラー: ${error}`, onProgress);
    aiSummary = generateFallbackSummary(allViolations);
    emitLog('  [4/4] フォールバック総評を使用', onProgress);
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
        // 各ページにスクリーンショット、スコア、AI総評を含める
        screenshot,
        lighthouseScores,
        aiSummary,
      },
    ],
    // レポートレベルでも維持（後方互換性）
    screenshot,
    toolsUsed,
    lighthouseScores,
    aiSummary,
  };
}

/**
 * 分析オプションに基づいてアクセシビリティ分析を実行
 *
 * Requirements: wcag-coverage-expansion 1.5, 1.6, 2.1
 * - 分析オプションに基づいてエンジンの有効/無効を制御
 * - 並列実行の最適化（Promise.allSettledを使用）
 * - 各エンジンのエラーを個別にハンドリングし、他エンジンの処理を継続
 * - 進捗イベントに新エンジンのステータスを追加
 *
 * @param targetUrl 分析対象のURL
 * @param options 分析オプション
 * @param authConfig 認証設定
 * @param onProgress 進捗コールバック
 * @param externalStorageState 外部ストレージ状態
 */
export async function analyzeUrlWithOptions(
  targetUrl: string,
  options: AnalysisOptions = DEFAULT_ANALYSIS_OPTIONS,
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
  let pageTitle: string | undefined;
  let htmlContent: string | undefined;

  // 有効なエンジンの数を計算してtotal stepsを決定
  const engines = options.engines;
  const enabledEngineCount =
    (engines.axeCore ? 1 : 0) +
    (engines.pa11y ? 1 : 0) +
    (engines.lighthouse ? 1 : 0) +
    (engines.ibm ? 1 : 0) +
    (engines.alfa ? 1 : 0) +
    (engines.qualweb ? 1 : 0) +
    (options.waveApi.enabled && options.waveApi.apiKey ? 1 : 0);

  const totalSteps = enabledEngineCount + 1; // +1 for AI summary
  let currentStep = 0;

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
    emitLog('  認証処理を開始...', onProgress);
    const authResult = await authManager.authenticate();
    if (!authResult.success) {
      throw new Error(`認証に失敗しました: ${authResult.error}`);
    }
    if (authResult.browser && authResult.page) {
      formLoginBrowser = authResult.browser;
      formLoginPage = authResult.page;
      console.log('[Analyzer] フォームログイン済みブラウザを使用');
    }
    emitLog('  認証処理完了', onProgress);
  }

  // タイムアウト設定を取得
  const timeoutConfig = getTimeoutConfig();

  // ブラウザとページのセットアップ
  let browser: import('playwright').Browser;
  let page: import('playwright').Page;
  let alreadyNavigated = false;

  if (formLoginBrowser && formLoginPage) {
    browser = formLoginBrowser;
    page = formLoginPage;
    page.setDefaultTimeout(timeoutConfig.axeTimeout);
    const blockingResult = await setupAdBlocking(page);
    console.log(`[Analyzer] 広告ブロック設定完了 - パターン数: ${blockingResult.patterns.length}`);

    const currentOrigin = new URL(page.url()).origin;
    const targetOrigin = new URL(targetUrl).origin;

    if (currentOrigin === targetOrigin) {
      console.log('[Analyzer] SPAナビゲーション（フルリロードなし）:', targetUrl);
      await page.evaluate((url) => {
        window.history.pushState({}, '', url);
        window.dispatchEvent(new Event('popstate'));
      }, targetUrl);
      await page.waitForLoadState('networkidle');
      alreadyNavigated = true;
    } else {
      console.log('[Analyzer] 別オリジンへ移動（フルリロード）:', targetUrl);
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutConfig.pageLoadTimeout });
      try {
        await page.waitForFunction(
          () => (window as unknown as { firebase?: { auth?: () => { currentUser: unknown } } }).firebase?.auth?.().currentUser !== null,
          { timeout: 10000 }
        );
      } catch {
        await page.waitForLoadState('networkidle');
      }
      alreadyNavigated = true;
    }
  } else {
    browser = await chromium.launch();
    const contextOptions: Parameters<typeof browser.newContext>[0] = {
      viewport: { width: 1280, height: 720 },
    };

    const storageState = authManager.getStorageState();
    if (storageState) {
      contextOptions.storageState = storageState;
    }

    const httpCredentials = authManager.getHttpCredentials();
    if (httpCredentials) {
      contextOptions.httpCredentials = httpCredentials;
    }

    const authHeaders = authManager.getHeaders();
    if (Object.keys(authHeaders).length > 0) {
      contextOptions.extraHTTPHeaders = authHeaders;
    }

    const context = await browser.newContext(contextOptions);
    page = await context.newPage();
    page.setDefaultTimeout(timeoutConfig.axeTimeout);
    await setupAdBlocking(page);
  }

  try {
    if (!alreadyNavigated) {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: timeoutConfig.pageLoadTimeout });
    }

    // スクリーンショットとページタイトルを取得
    const screenshotBuffer = await page.screenshot({ type: 'png', fullPage: false });
    screenshot = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
    pageTitle = await page.title();
    htmlContent = await page.content();

    // === エンジン実行 ===
    // 1. axe-core（Playwrightページを使用）
    if (engines.axeCore) {
      currentStep++;
      emitProgress(currentStep, totalSteps, 'axe-core', onProgress);
      emitLog(`  [${currentStep}/${totalSteps}] axe-core 分析開始...`, onProgress);

      try {
        const axeResult = await analyzeWithAxeEnhanced(page);
        allViolations.push(...axeResult.violations);
        allPasses.push(...axeResult.passes);
        allIncomplete.push(...axeResult.incomplete);
        toolsUsed.push({ name: 'axe-core', version: AXE_VERSION, duration: axeResult.duration });
        emitLog(`  [${currentStep}/${totalSteps}] axe-core 完了: 違反${axeResult.violations.length}件 (${axeResult.duration}ms)`, onProgress);
        emitViolations(axeResult.violations, onProgress);
      } catch (error) {
        emitLog(`  [${currentStep}/${totalSteps}] axe-core エラー: ${error}`, onProgress);
        console.error('[Analyzer] axe-core error:', error);
      }
    }

    // 並列実行するエンジン群（Playwrightページが不要なもの、または別スレッドで実行可能なもの）
    interface EngineTask {
      name: string;
      enabled: boolean;
      execute: () => Promise<AnalyzerResult | null>;
    }

    const parallelTasks: EngineTask[] = [];

    // 2. Pa11y
    if (engines.pa11y) {
      parallelTasks.push({
        name: 'pa11y',
        enabled: true,
        execute: async () => {
          const pa11yAuthOptions = {
            headers: authManager.getHeaders(),
            username: authManager.getHttpCredentials()?.username,
            password: authManager.getHttpCredentials()?.password,
          };
          return analyzeWithPa11y(targetUrl, pa11yAuthOptions);
        },
      });
    }

    // 3. Lighthouse
    if (engines.lighthouse) {
      parallelTasks.push({
        name: 'lighthouse',
        enabled: true,
        execute: async () => {
          const lighthouseAuthOptions = { headers: authManager.getHeaders() };
          return analyzeWithLighthouse(targetUrl, lighthouseAuthOptions);
        },
      });
    }

    // 4. IBM Equal Access Checker
    if (engines.ibm) {
      parallelTasks.push({
        name: 'ibm',
        enabled: true,
        execute: async () => analyzeWithIBM(page),
      });
    }

    // 5. Siteimprove Alfa
    if (engines.alfa) {
      parallelTasks.push({
        name: 'alfa',
        enabled: true,
        execute: async () => analyzeWithAlfa(page),
      });
    }

    // 6. QualWeb
    if (engines.qualweb && htmlContent) {
      parallelTasks.push({
        name: 'qualweb',
        enabled: true,
        execute: async () => analyzeWithQualWeb(htmlContent!),
      });
    }

    // 7. WAVE API（APIキーがある場合のみ）
    if (options.waveApi.enabled && options.waveApi.apiKey) {
      parallelTasks.push({
        name: 'wave',
        enabled: true,
        execute: async () => analyzeWithWave(targetUrl, { apiKey: options.waveApi.apiKey! }),
      });
    }

    // 並列実行（Promise.allSettledを使用）
    if (parallelTasks.length > 0) {
      // 進捗イベントを送信
      for (const task of parallelTasks) {
        currentStep++;
        emitProgress(currentStep, totalSteps, task.name, onProgress);
        emitLog(`  [${currentStep}/${totalSteps}] ${task.name} 分析開始...`, onProgress);
      }

      // 並列実行
      const results = await Promise.allSettled(
        parallelTasks.map(task => task.execute())
      );

      // 結果を処理
      for (let i = 0; i < parallelTasks.length; i++) {
        const task = parallelTasks[i];
        const result = results[i];

        if (result.status === 'fulfilled' && result.value) {
          const analyzerResult = result.value;
          allViolations.push(...analyzerResult.violations);
          allPasses.push(...analyzerResult.passes);
          allIncomplete.push(...analyzerResult.incomplete);

          // Lighthouseの場合はスコアを取得
          if (task.name === 'lighthouse' && 'scores' in analyzerResult) {
            lighthouseScores = (analyzerResult as { scores: LighthouseScores }).scores;
          }

          // バージョン情報を設定
          const version = task.name === 'pa11y' ? PA11Y_VERSION
            : task.name === 'lighthouse' ? LIGHTHOUSE_VERSION
            : '1.0.0';

          toolsUsed.push({
            name: task.name,
            version,
            duration: analyzerResult.duration,
          });

          emitLog(`  ${task.name} 完了: 違反${analyzerResult.violations.length}件 (${analyzerResult.duration}ms)`, onProgress);
          emitViolations(analyzerResult.violations, onProgress);
        } else if (result.status === 'rejected') {
          emitLog(`  ${task.name} エラー: ${result.reason}`, onProgress);
          console.error(`[Analyzer] ${task.name} error:`, result.reason);
        }
      }
    }

  } catch (error) {
    await browser.close();
    if (error instanceof Error) {
      if (error.message.includes('Execution context was destroyed')) {
        throw new Error('ページが分析中にリダイレクトまたはナビゲーションを行いました。');
      }
      if (error.message.includes('Target closed') || error.message.includes('Target page, context or browser has been closed')) {
        throw new Error('ページへのアクセス中に接続が切断されました。');
      }
      if (error.name === 'TimeoutError') {
        throw new Error(formatTimeoutError('page-load', targetUrl, timeoutConfig.pageLoadTimeout));
      }
    }
    throw error;
  } finally {
    await browser.close().catch(() => {});
  }

  // 複数エンジンが有効な場合は重複排除を適用
  if (enabledEngineCount > 1) {
    emitLog('  重複排除処理を実行中...', onProgress);
    const deduplicationService = new DeduplicationService();

    // 各結果をAnalyzerResult形式で収集（既にtoolSourceがセットされている）
    // 注: 現在の実装では既に allViolations 等に直接追加されているため、
    // それらを使用して重複排除を行う
    const collectedResults: AnalyzerResult[] = [{
      violations: allViolations,
      passes: allPasses,
      incomplete: allIncomplete,
      duration: 0,
    }];

    const deduplicatedResult = deduplicationService.deduplicate(collectedResults);

    // 重複排除された結果で上書き
    allViolations = deduplicatedResult.violations;
    allPasses = deduplicatedResult.passes;
    allIncomplete = deduplicatedResult.incomplete;

    // エンジン別サマリーをログ出力
    const summaryParts: string[] = [];
    for (const [engine, counts] of Object.entries(deduplicatedResult.engineSummary)) {
      summaryParts.push(`${engine}: 違反${counts.violations}件`);
    }
    if (summaryParts.length > 0) {
      emitLog(`  エンジン別集計: ${summaryParts.join(', ')}`, onProgress);
    }

    emitLog(`  重複排除後: 違反${allViolations.length}件, パス${allPasses.length}件, 要確認${allIncomplete.length}件`, onProgress);
  }

  // カスタムルールの実行
  // @requirement 9.1 - axe-coreのカスタムルール機能を使用して追加ルールを実行する
  // @requirement 9.4 - カスタムルールの有効/無効を個別に設定できる
  if (options.customRules?.enabled && htmlContent) {
    emitLog('  カスタムルールを実行中...', onProgress);
    const startTime = Date.now();

    const customViolations = CustomRulesService.runAllChecks(htmlContent, {
      enableAmbiguousLink: options.customRules.enableAmbiguousLink,
      enableHeadingSkip: options.customRules.enableHeadingSkip,
      enableLongAlt: options.customRules.enableLongAlt,
      enableEmptyInteractive: options.customRules.enableEmptyInteractive,
      maxAltLength: options.customRules.maxAltLength,
    });

    // CustomRuleViolationをRuleResultに変換して追加
    // @requirement 9.3 - カスタムルールが違反を検出した場合、toolSource: 'custom'として報告
    const customRuleResults: RuleResult[] = customViolations.map((v: CustomRuleViolation) => ({
      id: v.ruleId,
      description: v.description,
      impact: v.impact,
      nodeCount: 1,
      helpUrl: v.helpUrl,
      wcagCriteria: v.wcagCriteria,
      toolSource: 'custom' as const,
      nodes: [{
        target: v.selector,
        html: v.html,
      }],
    }));

    allViolations.push(...customRuleResults);

    const duration = Date.now() - startTime;
    toolsUsed.push({
      name: 'custom-rules',
      version: '1.0.0',
      duration,
    });

    emitLog(`  カスタムルール完了: 違反${customViolations.length}件 (${duration}ms)`, onProgress);
  }

  // AI総評生成
  currentStep++;
  emitProgress(currentStep, totalSteps, 'ai-summary', onProgress);
  emitLog(`  [${currentStep}/${totalSteps}] AI総評生成開始...`, onProgress);

  let aiSummary: AISummary | undefined;
  try {
    const aiResult = await GeminiService.generateAISummary(allViolations, lighthouseScores);
    if (aiResult.success) {
      aiSummary = aiResult.value;
      emitLog(`  [${currentStep}/${totalSteps}] AI総評生成完了`, onProgress);
    } else {
      emitLog(`  [${currentStep}/${totalSteps}] AI総評生成失敗: ${aiResult.error.message}`, onProgress);
      aiSummary = generateFallbackSummary(allViolations);
    }
  } catch (error) {
    emitLog(`  [${currentStep}/${totalSteps}] AI総評生成エラー: ${error}`, onProgress);
    aiSummary = generateFallbackSummary(allViolations);
  }

  const pageName = pageTitle || new URL(targetUrl).hostname;
  const totalDuration = toolsUsed.reduce((sum, t) => sum + t.duration, 0);
  emitLog(`  合計実行時間: ${(totalDuration / 1000).toFixed(1)}秒`, onProgress);

  // 半自動チェック項目の抽出
  // @requirement wcag-coverage-expansion 5.1, 5.2, 16.1
  // - semiAutoCheckオプションが有効な場合にSemiAutoCheckServiceを呼び出す
  // - incomplete結果から半自動確認項目を抽出
  // - 抽出した項目をレポートに含める
  let semiAutoItems: SemiAutoItem[] | undefined;

  if (options.semiAutoCheck) {
    emitLog('  半自動チェック項目を抽出中...', onProgress);

    const semiAutoService = new SemiAutoCheckService();
    semiAutoItems = semiAutoService.extractItems(allViolations, allIncomplete);

    if (semiAutoItems.length > 0) {
      emitLog(`  半自動チェック項目: ${semiAutoItems.length}件`, onProgress);
    } else {
      emitLog('  半自動チェック項目はありません', onProgress);
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
        screenshot,
        lighthouseScores,
        aiSummary,
        semiAutoItems, // @requirement wcag-coverage-expansion 16.2
      },
    ],
    screenshot,
    toolsUsed,
    lighthouseScores,
    aiSummary,
    semiAutoItems, // @requirement wcag-coverage-expansion 16.2
  };
}

