import type { Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import type { AnalyzerResult, RuleResult } from './types';
import { extractWcagCriteria } from './types';
import { getAdBlockingConfig } from '../config';
import {
  createAnalyzerTiming,
  completeAnalyzerTiming,
  logAnalyzerStart,
  logAnalyzerComplete,
} from '../utils';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export const AXE_VERSION = '4.11.0'; // @axe-core/playwright version

/**
 * axe-core分析オプションの型定義
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */
export interface AxeAnalyzerOptions {
  /** legacyModeを有効にするか（デフォルト: true） */
  legacyMode?: boolean;

  /** 広告要素を除外するか（デフォルト: true） */
  excludeAds?: boolean;

  /** 追加の除外セレクタ */
  additionalExcludes?: readonly string[];

  /** color-contrastルールを無効化するか（デフォルト: false） */
  disableColorContrast?: boolean;
}

/**
 * axe-coreを使用してアクセシビリティ分析を実行する
 *
 * @param page - Playwrightページインスタンス
 * @param options - 分析オプション
 * @returns 分析結果
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */
export async function analyzeWithAxe(
  page: Page,
  options: AxeAnalyzerOptions = {}
): Promise<AnalyzerResult> {
  const startTime = Date.now();
  const adBlockingConfig = getAdBlockingConfig();
  const url = page.url();

  // Req 7.2: 分析開始ログを記録
  logAnalyzerStart('axe-core', url);
  const timing = createAnalyzerTiming('axe-core', url);

  // オプションのデフォルト値を設定
  const {
    legacyMode = true,
    excludeAds = true,
    additionalExcludes = [],
    disableColorContrast = false,
  } = options;

  // AxeBuilderを構築
  let axeBuilder = new AxeBuilder({ page }).withTags(WCAG_TAGS);

  // Req 1.1: setLegacyMode(true)をデフォルトで有効にする
  axeBuilder = axeBuilder.setLegacyMode(legacyMode);

  // Req 1.2, 1.3: 広告関連セレクタを除外する
  if (excludeAds && adBlockingConfig.enabled) {
    for (const selector of adBlockingConfig.adSelectors) {
      axeBuilder = axeBuilder.exclude(selector);
    }
  }

  // 追加の除外セレクタを適用
  for (const selector of additionalExcludes) {
    axeBuilder = axeBuilder.exclude(selector);
  }

  // Req 1.5: color-contrastルールの無効化オプション
  if (disableColorContrast) {
    axeBuilder = axeBuilder.disableRules('color-contrast');
  }

  const scanResults = await axeBuilder.analyze();

  const violations: RuleResult[] = scanResults.violations.map((v) => ({
    id: v.id,
    description: v.description,
    impact: v.impact as 'critical' | 'serious' | 'moderate' | 'minor' | undefined,
    nodeCount: v.nodes.length,
    helpUrl: v.helpUrl,
    wcagCriteria: extractWcagCriteria(v.tags),
    toolSource: 'axe-core' as const,
  }));

  const passes: RuleResult[] = scanResults.passes.map((p) => ({
    id: p.id,
    description: p.description,
    nodeCount: p.nodes.length,
    helpUrl: p.helpUrl,
    wcagCriteria: extractWcagCriteria(p.tags),
    toolSource: 'axe-core' as const,
  }));

  const incomplete: RuleResult[] = scanResults.incomplete.map((i) => ({
    id: i.id,
    description: i.description,
    impact: i.impact as 'critical' | 'serious' | 'moderate' | 'minor' | undefined,
    nodeCount: i.nodes.length,
    helpUrl: i.helpUrl,
    wcagCriteria: extractWcagCriteria(i.tags),
    toolSource: 'axe-core' as const,
  }));

  const duration = Date.now() - startTime;

  // Req 7.2, 7.3: 分析完了ログを記録（60秒超過警告を含む）
  const completedTiming = completeAnalyzerTiming(timing, 'success');
  logAnalyzerComplete(completedTiming);

  return {
    violations,
    passes,
    incomplete,
    duration,
  };
}
