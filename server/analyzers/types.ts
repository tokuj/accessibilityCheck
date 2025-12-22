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
  /** ページごとのLighthouseスコア */
  lighthouseScores?: LighthouseScores;
  /** ページのスクリーンショット（Base64エンコード） */
  screenshot?: string;
  /** ページごとのAI総評 */
  aiSummary?: AISummary;
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
  overallAssessment: string;           // 全体的な評価
  detectedIssues: DetectedIssue[];     // 構造化された問題詳細
  prioritizedImprovements: string[];   // 優先度順の改善ポイント
  specificRecommendations: string[];   // 具体的な推奨事項
  impactSummary: ImpactSummary;        // 影響度別の問題数
  generatedAt: string;                 // 生成日時
  isFallback?: boolean;                // フォールバック生成の場合true
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
  aiSummary?: AISummary;  // AI総評（オプショナル、後方互換性のため）
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
