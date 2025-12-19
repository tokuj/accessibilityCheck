import type { LighthouseResult, RuleResult, LighthouseScores, ImpactLevel } from './types';
import { chromium } from 'playwright';

export const LIGHTHOUSE_VERSION = '12.0.0';

/**
 * Lighthouse認証オプション
 */
export interface LighthouseAuthOptions {
  headers?: Record<string, string>;  // Cookie, Authorization等
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
  authOptions?: LighthouseAuthOptions
): Promise<LighthouseResult> {
  const startTime = Date.now();

  const { lighthouse, chromeLauncher } = await loadLighthouse();
  let chrome: Awaited<ReturnType<typeof chromeLauncher.launch>> | null = null;

  try {
    // PlaywrightのChromiumパスを使用（Docker環境でも動作するよう）
    chrome = await chromeLauncher.launch({
      chromePath: chromium.executablePath(),
      chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
    });

    // Lighthouse設定を構築
    const options: Parameters<typeof lighthouse>[1] = {
      logLevel: 'error' as const,
      output: 'json' as const,
      port: chrome.port,
      onlyCategories: ['accessibility', 'performance', 'best-practices', 'seo'],
    };

    // 認証ヘッダーを設定
    if (authOptions?.headers && Object.keys(authOptions.headers).length > 0) {
      options.extraHeaders = authOptions.headers;
      // セッションを維持するためstorageResetを無効化
      options.disableStorageReset = true;
    }

    const runnerResult = await lighthouse(url, options);

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

    return {
      violations,
      passes,
      incomplete,
      duration,
      scores,
    };
  } catch (error) {
    console.error('Lighthouse analysis error:', error);
    const duration = Date.now() - startTime;

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
