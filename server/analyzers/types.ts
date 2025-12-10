// Tool source identifier
export type ToolSource = 'axe-core' | 'pa11y' | 'lighthouse';

// Impact level for accessibility violations
export type ImpactLevel = 'critical' | 'serious' | 'moderate' | 'minor';

// Individual rule result from any analyzer
export interface RuleResult {
  id: string;
  description: string;
  impact?: ImpactLevel;
  nodeCount: number;
  helpUrl: string;
  wcagCriteria: string[];
  toolSource: ToolSource;
}

// Page-level analysis results
export interface PageResult {
  name: string;
  url: string;
  violations: RuleResult[];
  passes: RuleResult[];
  incomplete: RuleResult[];
}

// Tool execution info
export interface ToolInfo {
  name: string;
  version: string;
  duration: number; // milliseconds
}

// Lighthouse category scores
export interface LighthouseScores {
  performance: number;      // 0-100
  accessibility: number;    // 0-100
  bestPractices: number;    // 0-100
  seo: number;              // 0-100
  pwa?: number;             // 0-100 (undefined if not applicable)
}

// Complete accessibility report
export interface AccessibilityReport {
  generatedAt: string;
  summary: {
    totalViolations: number;
    totalPasses: number;
    totalIncomplete: number;
  };
  pages: PageResult[];
  screenshot?: string;
  toolsUsed: ToolInfo[];
  lighthouseScores?: LighthouseScores;
}

// Common analyzer interface
export interface AnalyzerResult {
  violations: RuleResult[];
  passes: RuleResult[];
  incomplete: RuleResult[];
  duration: number;
}

// Lighthouse specific result
export interface LighthouseResult extends AnalyzerResult {
  scores: LighthouseScores;
}

// Extract WCAG criteria from tags
export function extractWcagCriteria(tags: string[]): string[] {
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
