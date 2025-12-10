export type Impact = 'critical' | 'serious' | 'moderate' | 'minor';

export interface RuleResult {
  id: string;
  description: string;
  impact?: Impact;
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

export interface AnalyzeRequest {
  url: string;
}

export interface AnalyzeResponse {
  status: 'completed' | 'error';
  report?: AccessibilityReport;
  error?: string;
}
