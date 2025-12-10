import { chromium } from 'playwright';
import type { AccessibilityReport, RuleResult, ToolInfo, LighthouseScores } from './analyzers/types';
import { analyzeWithAxe, AXE_VERSION } from './analyzers/axe';
import { analyzeWithPa11y, PA11Y_VERSION } from './analyzers/pa11y';
import { analyzeWithLighthouse, LIGHTHOUSE_VERSION } from './analyzers/lighthouse';
import { AuthManager } from './auth/manager';
import type { AuthConfig } from './auth/types';

// Re-export types for backward compatibility
export type { RuleResult, AccessibilityReport } from './analyzers/types';
export type { AuthConfig } from './auth/types';

export interface PageResult {
  name: string;
  url: string;
  violations: RuleResult[];
  passes: RuleResult[];
  incomplete: RuleResult[];
}

export async function analyzeUrl(
  targetUrl: string,
  authConfig?: AuthConfig
): Promise<AccessibilityReport> {
  const toolsUsed: ToolInfo[] = [];
  let allViolations: RuleResult[] = [];
  let allPasses: RuleResult[] = [];
  let allIncomplete: RuleResult[] = [];
  let lighthouseScores: LighthouseScores | undefined;
  let screenshot: string | undefined;

  // 認証マネージャーを初期化
  const authManager = new AuthManager(authConfig, targetUrl);

  // 認証が必要な場合、認証を実行
  if (authManager.requiresAuth()) {
    console.log('  認証処理を開始...');
    const authResult = await authManager.authenticate();
    if (!authResult.success) {
      throw new Error(`認証に失敗しました: ${authResult.error}`);
    }
    console.log('  認証処理完了');
  }

  // 1. axe-core analysis with Playwright
  console.log('  [1/3] axe-core 分析開始...');
  const browser = await chromium.launch();

  // Playwright contextに認証情報を適用
  const contextOptions: Parameters<typeof browser.newContext>[0] = {
    viewport: { width: 1280, height: 720 },
  };

  // storageStateを適用（Cookie/localStorageを復元）
  const storageState = authManager.getStorageState();
  if (storageState) {
    contextOptions.storageState = storageState;
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
  const page = await context.newPage();

  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 });

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
    console.log(`  [1/3] axe-core 完了: 違反${axeResult.violations.length}件, パス${axeResult.passes.length}件 (${axeResult.duration}ms)`);
  } catch (error) {
    await browser.close();
    // タイムアウトエラーの場合、ユーザーフレンドリーなメッセージに変換
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error('ページの読み込みがタイムアウトしました。認証が必要なページの場合は、ロックアイコンから認証設定を行ってください。');
    }
    throw error;
  } finally {
    await browser.close().catch(() => {}); // 既に閉じている場合はエラーを無視
  }

  // 2. Pa11y analysis
  console.log('  [2/3] Pa11y 分析開始...');
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
    console.log(`  [2/3] Pa11y 完了: 違反${pa11yResult.violations.length}件, 要確認${pa11yResult.incomplete.length}件 (${pa11yResult.duration}ms)`);
  } catch (error) {
    console.error('  [2/3] Pa11y エラー:', error);
    toolsUsed.push({
      name: 'pa11y',
      version: PA11Y_VERSION,
      duration: 0,
    });
  }

  // 3. Lighthouse analysis
  console.log('  [3/3] Lighthouse 分析開始...');
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
    console.log(`  [3/3] Lighthouse 完了: スコア Performance=${lighthouseResult.scores.performance}, A11y=${lighthouseResult.scores.accessibility} (${lighthouseResult.duration}ms)`);
  } catch (error) {
    console.error('  [3/3] Lighthouse エラー:', error);
    toolsUsed.push({
      name: 'lighthouse',
      version: LIGHTHOUSE_VERSION,
      duration: 0,
    });
  }

  const pageName = new URL(targetUrl).hostname;
  const totalDuration = toolsUsed.reduce((sum, t) => sum + t.duration, 0);
  console.log(`  合計実行時間: ${(totalDuration / 1000).toFixed(1)}秒`);

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
  };
}
