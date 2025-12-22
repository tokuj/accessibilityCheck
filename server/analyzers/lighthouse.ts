import type { LighthouseResult, RuleResult, LighthouseScores, ImpactLevel } from './types';
import { chromium } from 'playwright';
import { getAdBlockingConfig, getTimeoutConfig } from '../config';
import {
  createAnalyzerTiming,
  completeAnalyzerTiming,
  formatTimeoutError,
  logAnalyzerStart,
  logAnalyzerComplete,
} from '../utils';

export const LIGHTHOUSE_VERSION = '12.0.0';

/**
 * Lighthouse認証オプション
 */
export interface LighthouseAuthOptions {
  headers?: Record<string, string>;  // Cookie, Authorization等
}

/**
 * Lighthouse分析オプション
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export interface LighthouseAnalyzerOptions extends LighthouseAuthOptions {
  /** maxWaitForLoad（ms、デフォルト: 90000） */
  maxWaitForLoad?: number;

  /** maxWaitForFcp（ms、デフォルト: 60000） */
  maxWaitForFcp?: number;

  /** 広告をブロックするか（デフォルト: true） */
  blockAds?: boolean;

  /** 追加のブロックURLパターン */
  additionalBlockedPatterns?: readonly string[];
}

// Dynamic imports for ESM modules
async function loadLighthouse() {
  const lighthouse = await import('lighthouse');
  const chromeLauncher = await import('chrome-launcher');
  return { lighthouse: lighthouse.default, chromeLauncher };
}

// Map Lighthouse score impact to our impact levels
function mapScoreToImpact(score: number | null): ImpactLevel | undefined {
  if (score === null) return undefined;
  if (score < 0.5) return 'critical';
  if (score < 0.7) return 'serious';
  if (score < 0.9) return 'moderate';
  return 'minor';
}

// Extract WCAG criteria from Lighthouse audit ID
function extractWcagFromAuditId(id: string): string[] {
  // Lighthouse uses axe-core internally, audit IDs like 'color-contrast', 'image-alt'
  // Map common ones to WCAG criteria
  const wcagMap: Record<string, string[]> = {
    'color-contrast': ['1.4.3'],
    'image-alt': ['1.1.1'],
    'input-image-alt': ['1.1.1'],
    'link-name': ['2.4.4', '4.1.2'],
    'button-name': ['4.1.2'],
    'label': ['1.3.1', '4.1.2'],
    'html-has-lang': ['3.1.1'],
    'html-lang-valid': ['3.1.1'],
    'meta-viewport': ['1.4.4'],
    'document-title': ['2.4.2'],
    'bypass': ['2.4.1'],
    'heading-order': ['1.3.1'],
    'list': ['1.3.1'],
    'listitem': ['1.3.1'],
    'definition-list': ['1.3.1'],
    'dlitem': ['1.3.1'],
    'aria-allowed-attr': ['4.1.2'],
    'aria-hidden-body': ['4.1.2'],
    'aria-required-attr': ['4.1.2'],
    'aria-required-children': ['1.3.1'],
    'aria-required-parent': ['1.3.1'],
    'aria-roles': ['4.1.2'],
    'aria-valid-attr-value': ['4.1.2'],
    'aria-valid-attr': ['4.1.2'],
    'duplicate-id-aria': ['4.1.1'],
    'form-field-multiple-labels': ['1.3.1'],
    'frame-title': ['4.1.2'],
    'tabindex': ['2.4.3'],
    'td-headers-attr': ['1.3.1'],
    'th-has-data-cells': ['1.3.1'],
    'valid-lang': ['3.1.2'],
    'video-caption': ['1.2.2'],
  };

  return wcagMap[id] || [];
}

export async function analyzeWithLighthouse(
  url: string,
  options?: LighthouseAnalyzerOptions
): Promise<LighthouseResult> {
  const startTime = Date.now();

  // 設定を取得
  const adBlockingConfig = getAdBlockingConfig();
  const timeoutConfig = getTimeoutConfig();

  // デフォルト値の解決（blockAdsはundefinedの場合にtrueとなる）
  const blockAds = options?.blockAds !== false && adBlockingConfig.enabled;

  // Req 7.2: 分析開始ログを記録
  logAnalyzerStart('lighthouse', url);
  const timing = createAnalyzerTiming('lighthouse', url);

  const { lighthouse, chromeLauncher } = await loadLighthouse();
  let chrome: Awaited<ReturnType<typeof chromeLauncher.launch>> | null = null;

  try {
    // PlaywrightのChromiumパスを使用（Docker環境でも動作するよう）
    chrome = await chromeLauncher.launch({
      chromePath: chromium.executablePath(),
      chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
    });

    // Lighthouse設定を構築
    const lighthouseOptions: Parameters<typeof lighthouse>[1] = {
      logLevel: 'error' as const,
      output: 'json' as const,
      port: chrome.port,
      onlyCategories: ['accessibility', 'performance', 'best-practices', 'seo'],
      // タイムアウト設定（Req 3.1, 3.2）
      maxWaitForLoad: options?.maxWaitForLoad ?? timeoutConfig.lighthouseMaxWaitForLoad,
      maxWaitForFcp: options?.maxWaitForFcp ?? timeoutConfig.lighthouseMaxWaitForFcp,
    };

    // 広告ブロック設定（Req 3.3, 3.4）
    if (blockAds || options?.additionalBlockedPatterns) {
      const blockedPatterns: string[] = [];

      // 広告パターンを追加
      if (blockAds) {
        blockedPatterns.push(...adBlockingConfig.blockedUrlPatterns);
      }

      // 追加パターンを追加
      if (options?.additionalBlockedPatterns) {
        blockedPatterns.push(...options.additionalBlockedPatterns);
      }

      if (blockedPatterns.length > 0) {
        lighthouseOptions.blockedUrlPatterns = blockedPatterns;
      }
    }

    // 認証ヘッダーを設定
    if (options?.headers && Object.keys(options.headers).length > 0) {
      lighthouseOptions.extraHeaders = options.headers;
      // セッションを維持するためstorageResetを無効化
      lighthouseOptions.disableStorageReset = true;
    }

    const runnerResult = await lighthouse(url, lighthouseOptions);

    if (!runnerResult || !runnerResult.lhr) {
      throw new Error('Lighthouse did not return results');
    }

    const lhr = runnerResult.lhr;
    const categories = lhr.categories;

    // Extract scores
    const scores: LighthouseScores = {
      performance: Math.round((categories.performance?.score || 0) * 100),
      accessibility: Math.round((categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
      seo: Math.round((categories.seo?.score || 0) * 100),
      pwa: categories.pwa?.score !== null ? Math.round((categories.pwa?.score || 0) * 100) : undefined,
    };

    // Extract accessibility audit results
    const accessibilityAudits = categories.accessibility?.auditRefs || [];
    const violations: RuleResult[] = [];
    const passes: RuleResult[] = [];
    const incomplete: RuleResult[] = [];

    for (const auditRef of accessibilityAudits) {
      const audit = lhr.audits[auditRef.id];
      if (!audit) continue;

      const ruleResult: RuleResult = {
        id: audit.id,
        description: audit.title,
        impact: mapScoreToImpact(audit.score),
        nodeCount: audit.details && 'items' in audit.details ? (audit.details.items as unknown[]).length : 0,
        helpUrl: audit.description?.includes('http')
          ? audit.description.match(/https?:\/\/[^\s)]+/)?.[0] || ''
          : `https://web.dev/${audit.id}/`,
        wcagCriteria: extractWcagFromAuditId(audit.id),
        toolSource: 'lighthouse' as const,
      };

      if (audit.score === 0) {
        violations.push(ruleResult);
      } else if (audit.score === 1) {
        passes.push(ruleResult);
      } else if (audit.score === null || (audit.score > 0 && audit.score < 1)) {
        incomplete.push(ruleResult);
      }
    }

    const duration = Date.now() - startTime;

    // Req 7.2, 7.3: 分析完了ログを記録（60秒超過警告を含む）
    const completedTiming = completeAnalyzerTiming(timing, 'success');
    logAnalyzerComplete(completedTiming);

    return {
      violations,
      passes,
      incomplete,
      duration,
      scores,
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
      const errorMessage = formatTimeoutError('lighthouse', url, timeoutConfig.lighthouseMaxWaitForLoad, duration);
      const completedTiming = completeAnalyzerTiming(timing, 'timeout');
      logAnalyzerComplete(completedTiming, errorMessage);
      console.error('Lighthouse timeout:', errorMessage);
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const completedTiming = completeAnalyzerTiming(timing, 'error');
      logAnalyzerComplete(completedTiming, errorMessage);
      console.error('Lighthouse analysis error:', error);
    }

    return {
      violations: [],
      passes: [],
      incomplete: [],
      duration,
      scores: {
        performance: 0,
        accessibility: 0,
        bestPractices: 0,
        seo: 0,
      },
    };
  } finally {
    if (chrome) {
      await chrome.kill();
    }
  }
}
