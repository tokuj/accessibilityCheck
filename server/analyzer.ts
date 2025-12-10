import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export interface RuleResult {
  id: string;
  description: string;
  impact?: 'critical' | 'serious' | 'moderate' | 'minor';
  nodeCount: number;
  helpUrl: string;
  wcagCriteria: string[];
}

export interface PageResult {
  name: string;
  url: string;
  violations: RuleResult[];
  passes: RuleResult[];
  incomplete: RuleResult[];
}

export interface AccessibilityReport {
  generatedAt: string;
  summary: {
    totalViolations: number;
    totalPasses: number;
    totalIncomplete: number;
  };
  pages: PageResult[];
}

function extractWcagCriteria(tags: string[]): string[] {
  const criteria: string[] = [];

  for (const tag of tags) {
    const match = tag.match(/^wcag(\d)(\d)(\d+)$/);
    if (match) {
      const criterion = `${match[1]}.${match[2]}.${match[3]}`;
      if (!criteria.includes(criterion)) {
        criteria.push(criterion);
      }
    }
  }

  return criteria.sort();
}

export async function analyzeUrl(targetUrl: string): Promise<AccessibilityReport> {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 });

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
    }));

    const passes: RuleResult[] = scanResults.passes.map((p) => ({
      id: p.id,
      description: p.description,
      nodeCount: p.nodes.length,
      helpUrl: p.helpUrl,
      wcagCriteria: extractWcagCriteria(p.tags),
    }));

    const incomplete: RuleResult[] = scanResults.incomplete.map((i) => ({
      id: i.id,
      description: i.description,
      impact: i.impact as 'critical' | 'serious' | 'moderate' | 'minor' | undefined,
      nodeCount: i.nodes.length,
      helpUrl: i.helpUrl,
      wcagCriteria: extractWcagCriteria(i.tags),
    }));

    const pageName = new URL(targetUrl).hostname;

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalViolations: violations.length,
        totalPasses: passes.length,
        totalIncomplete: incomplete.length,
      },
      pages: [
        {
          name: pageName,
          url: targetUrl,
          violations,
          passes,
          incomplete,
        },
      ],
    };
  } finally {
    await browser.close();
  }
}
