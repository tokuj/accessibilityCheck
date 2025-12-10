import type { Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import type { AnalyzerResult, RuleResult } from './types';
import { extractWcagCriteria } from './types';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export const AXE_VERSION = '4.11.0'; // @axe-core/playwright version

export async function analyzeWithAxe(page: Page): Promise<AnalyzerResult> {
  const startTime = Date.now();

  const scanResults = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze();

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

  return {
    violations,
    passes,
    incomplete,
    duration,
  };
}
