export type Impact = 'critical' | 'serious' | 'moderate' | 'minor';

export type ToolSource = 'axe-core' | 'pa11y' | 'lighthouse';

export interface RuleResult {
  id: string;
  description: string;
  impact?: Impact;
  nodeCount: number;
  helpUrl: string;
  wcagCriteria: string[];
  toolSource: ToolSource;
}

export interface PageResult {
  name: string;
  url: string;
  violations: RuleResult[];
  passes: RuleResult[];
  incomplete: RuleResult[];
}

export interface ToolInfo {
  name: string;
  version: string;
  duration: number;
}

export interface LighthouseScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  pwa?: number;
}

export interface AccessibilityReport {
  generatedAt: string;
  summary: {
    totalViolations: number;
    totalPasses: number;
    totalIncomplete: number;
  };
  pages: PageResult[];
  screenshot?: string;
  toolsUsed?: ToolInfo[];
  lighthouseScores?: LighthouseScores;
}

export interface AnalyzeRequest {
  url: string;
}

export interface AnalyzeResponse {
  status: 'completed' | 'error';
  report?: AccessibilityReport;
  error?: string;
}
