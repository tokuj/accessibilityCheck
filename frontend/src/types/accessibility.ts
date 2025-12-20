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

// AI総評の影響度サマリー
export interface ImpactSummary {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}

// 検出された問題の詳細（構造化された改善提案）
export interface DetectedIssue {
  ruleId: string;           // ルールID（例: color-contrast）
  whatIsHappening: string;  // 何が起きているか
  whatIsNeeded: string;     // 修正に必要なもの
  howToFix: string;         // どう修正するか
}

// AI総評（Gemini Flash生成）
export interface AISummary {
  overallAssessment: string;
  detectedIssues: DetectedIssue[];
  prioritizedImprovements: string[];
  specificRecommendations: string[];
  impactSummary: ImpactSummary;
  generatedAt: string;
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
  aiSummary?: AISummary;
}

// 認証タイプ
export type AuthType = 'none' | 'cookie' | 'bearer' | 'basic' | 'form';

// 認証設定
export interface AuthConfig {
  type: AuthType;
  // Cookie認証 - "name=value; name2=value2" 形式
  cookies?: string;
  // Bearer Token認証
  token?: string;
  // Basic認証
  username?: string;
  password?: string;
  // フォームログイン
  loginUrl?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
  successUrlPattern?: string;
}

export interface AnalyzeRequest {
  url: string;
  auth?: AuthConfig;
}

export interface AnalyzeResponse {
  status: 'completed' | 'error';
  report?: AccessibilityReport;
  error?: string;
}
