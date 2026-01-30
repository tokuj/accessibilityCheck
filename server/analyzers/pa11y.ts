import pa11y from 'pa11y';
import type { AnalyzerResult, RuleResult, ImpactLevel, NodeInfo } from './types';
import { getAdBlockingConfig, getTimeoutConfig } from '../config';
import {
  createAnalyzerTiming,
  completeAnalyzerTiming,
  formatTimeoutError,
  logAnalyzerStart,
  logAnalyzerComplete,
} from '../utils';

export const PA11Y_VERSION = '9.0.1';

/** HTML抜粋の最大文字数 @requirement 1.3 */
const MAX_HTML_LENGTH = 200;

/**
 * Pa11y認証オプション
 */
export interface Pa11yAuthOptions {
  headers?: Record<string, string>;  // Cookie, Authorization等
  username?: string;  // Basic認証
  password?: string;  // Basic認証
}

/**
 * Pa11y分析オプション
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
export interface Pa11yAnalyzerOptions extends Pa11yAuthOptions {
  /** タイムアウト（ms、デフォルト: 90000） */
  timeout?: number;

  /** 安定化待機時間（ms、デフォルト: 3000） */
  wait?: number;

  /** 広告要素を非表示にするか（デフォルト: true） */
  hideAds?: boolean;

  /** 追加の非表示セレクタ */
  additionalHideElements?: readonly string[];
}

// Pa11y issue type to impact level mapping
function mapTypeToImpact(type: string): ImpactLevel | undefined {
  switch (type) {
    case 'error':
      return 'serious';
    case 'warning':
      return 'moderate';
    case 'notice':
      return 'minor';
    default:
      return undefined;
  }
}

// Extract WCAG criteria from Pa11y code (e.g., "WCAG2AA.Principle1.Guideline1_1.1_1_1")
function extractWcagFromCode(code: string): string[] {
  const criteria: string[] = [];

  // Match patterns like "1_1_1" in the code
  const match = code.match(/(\d)_(\d)_(\d+)/);
  if (match) {
    criteria.push(`${match[1]}.${match[2]}.${match[3]}`);
  }

  return criteria;
}

/**
 * Pa11yのissueからノード情報を抽出する
 * @requirement 1.3 - バックエンドでノード情報を抽出
 * @requirement 3.1 - issueオブジェクトからセレクタとコンテキストを抽出する
 */
function extractNodeInfo(selector?: string, context?: string): NodeInfo[] {
  // selectorをtargetとして使用（undefinedの場合は空文字列）
  const target = selector ?? '';

  // contextをhtmlとして使用（undefinedの場合は空文字列）
  let html = context ?? '';

  // HTML抜粋を200文字に切り詰める
  if (html.length > MAX_HTML_LENGTH) {
    html = html.substring(0, MAX_HTML_LENGTH - 3) + '...';
  }

  // Pa11yは1イシュー=1ノードのため、nodes配列は常に1要素
  return [
    {
      target,
      html,
      // Pa11yはfailureSummaryを持たない（axe-core固有のため）
    },
  ];
}

export async function analyzeWithPa11y(
  url: string,
  options?: Pa11yAnalyzerOptions
): Promise<AnalyzerResult> {
  const startTime = Date.now();

  // 設定を取得
  const adBlockingConfig = getAdBlockingConfig();
  const timeoutConfig = getTimeoutConfig();

  // デフォルト値の解決（hideAdsはundefinedの場合にtrueとなる）
  const hideAds = options?.hideAds !== false && adBlockingConfig.enabled;

  // Req 7.2: 分析開始ログを記録
  logAnalyzerStart('pa11y', url);
  const timing = createAnalyzerTiming('pa11y', url);

  try {
    // Pa11y設定を構築
    const pa11yOptions: Parameters<typeof pa11y>[1] = {
      standard: 'WCAG2AA',
      timeout: options?.timeout ?? timeoutConfig.pa11yTimeout,
      wait: options?.wait ?? timeoutConfig.pa11yWait,
      chromeLaunchConfig: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    };

    // 広告要素を非表示にする（Req 2.3, 2.4）
    if (hideAds || options?.additionalHideElements) {
      const hideSelectors: string[] = [];

      // 広告セレクタを追加
      if (hideAds) {
        hideSelectors.push(...adBlockingConfig.adSelectors);
      }

      // 追加セレクタを追加
      if (options?.additionalHideElements) {
        hideSelectors.push(...options.additionalHideElements);
      }

      if (hideSelectors.length > 0) {
        // Pa11yのhideElementsはカンマ区切りの文字列
        pa11yOptions.hideElements = hideSelectors.join(', ');
      }
    }

    // 認証ヘッダーを設定
    if (options?.headers && Object.keys(options.headers).length > 0) {
      pa11yOptions.headers = options.headers;
    }

    // Basic認証を設定（Pa11yはpage.settingsで設定）
    if (options?.username && options?.password) {
      pa11yOptions.page = {
        settings: {
          userName: options.username,
          password: options.password,
        },
      };
    }

    const results = await pa11y(url, pa11yOptions);

    // @requirement 1.3, 3.1: ノード情報を抽出して結果に含める
    const violations: RuleResult[] = results.issues
      .filter((issue) => issue.type === 'error')
      .map((issue) => ({
        id: issue.code,
        description: issue.message,
        impact: mapTypeToImpact(issue.type),
        nodeCount: 1, // Pa11y reports one issue per element
        helpUrl: `https://squizlabs.github.io/HTML_CodeSniffer/Standards/WCAG2/`,
        wcagCriteria: extractWcagFromCode(issue.code),
        toolSource: 'pa11y' as const,
        nodes: extractNodeInfo(
          (issue as { selector?: string }).selector,
          (issue as { context?: string }).context
        ),
      }));

    const incomplete: RuleResult[] = results.issues
      .filter((issue) => issue.type === 'warning' || issue.type === 'notice')
      .map((issue) => ({
        id: issue.code,
        description: issue.message,
        impact: mapTypeToImpact(issue.type),
        nodeCount: 1,
        helpUrl: `https://squizlabs.github.io/HTML_CodeSniffer/Standards/WCAG2/`,
        wcagCriteria: extractWcagFromCode(issue.code),
        toolSource: 'pa11y' as const,
        nodes: extractNodeInfo(
          (issue as { selector?: string }).selector,
          (issue as { context?: string }).context
        ),
      }));

    const duration = Date.now() - startTime;

    // Req 7.2, 7.3: 分析完了ログを記録（60秒超過警告を含む）
    const completedTiming = completeAnalyzerTiming(timing, 'success');
    logAnalyzerComplete(completedTiming);

    return {
      violations,
      passes: [], // Pa11y doesn't report passed checks
      incomplete,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    // Req 7.1, 7.4: タイムアウトエラーの詳細化
    const isTimeout = error instanceof Error && (
      error.message.includes('timeout') ||
      error.message.includes('Timeout') ||
      error.name === 'TimeoutError'
    );

    if (isTimeout) {
      const errorMessage = formatTimeoutError('pa11y', url, timeoutConfig.pa11yTimeout, duration);
      const completedTiming = completeAnalyzerTiming(timing, 'timeout');
      logAnalyzerComplete(completedTiming, errorMessage);
      console.error('Pa11y timeout:', errorMessage);
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const completedTiming = completeAnalyzerTiming(timing, 'error');
      logAnalyzerComplete(completedTiming, errorMessage);
      console.error('Pa11y analysis error:', error);
    }

    return {
      violations: [],
      passes: [],
      incomplete: [],
      duration,
    };
  }
}
