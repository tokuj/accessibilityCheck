import type { AccessibilityReport, RuleResult } from '../types/accessibility';

export interface CategoryScore {
  name: string;
  nameEn: string;
  score: number;
  passes: number;
  total: number;
}

export interface ScoreResult {
  totalScore: number;
  categories: CategoryScore[];
  summary: string;
}

const WCAG_CATEGORIES = [
  { prefix: '1.', name: '知覚可能', nameEn: 'Perceivable' },
  { prefix: '2.', name: '操作可能', nameEn: 'Operable' },
  { prefix: '3.', name: '理解可能', nameEn: 'Understandable' },
  { prefix: '4.', name: '堅牢性', nameEn: 'Robust' },
];

function getCategoryForCriteria(criteria: string): string | null {
  for (const cat of WCAG_CATEGORIES) {
    if (criteria.startsWith(cat.prefix)) {
      return cat.prefix;
    }
  }
  return null;
}

export function calculateScores(report: AccessibilityReport): ScoreResult {
  const allPasses: RuleResult[] = [];
  const allViolations: RuleResult[] = [];

  for (const page of report.pages) {
    allPasses.push(...page.passes);
    allViolations.push(...page.violations);
  }

  // Total score
  const totalItems = allPasses.length + allViolations.length;
  const totalScore = totalItems > 0
    ? Math.round((allPasses.length / totalItems) * 100)
    : 100;

  // Category scores
  const categoryStats: Record<string, { passes: number; violations: number }> = {};

  for (const cat of WCAG_CATEGORIES) {
    categoryStats[cat.prefix] = { passes: 0, violations: 0 };
  }

  for (const pass of allPasses) {
    for (const criteria of pass.wcagCriteria) {
      const cat = getCategoryForCriteria(criteria);
      if (cat && categoryStats[cat]) {
        categoryStats[cat].passes++;
      }
    }
  }

  for (const violation of allViolations) {
    for (const criteria of violation.wcagCriteria) {
      const cat = getCategoryForCriteria(criteria);
      if (cat && categoryStats[cat]) {
        categoryStats[cat].violations++;
      }
    }
  }

  const categories: CategoryScore[] = WCAG_CATEGORIES.map(cat => {
    const stats = categoryStats[cat.prefix];
    const total = stats.passes + stats.violations;
    const score = total > 0 ? Math.round((stats.passes / total) * 100) : 100;
    return {
      name: cat.name,
      nameEn: cat.nameEn,
      score,
      passes: stats.passes,
      total,
    };
  });

  // Generate summary
  const summary = generateSummary(totalScore, allViolations.length, categories);

  return {
    totalScore,
    categories,
    summary,
  };
}

function generateSummary(
  totalScore: number,
  violationCount: number,
  categories: CategoryScore[]
): string {
  const weakCategories = categories
    .filter(c => c.score < 80 && c.total > 0)
    .map(c => c.name);

  if (totalScore >= 95) {
    return '優れたアクセシビリティ対応です。ほとんどのWCAG基準をクリアしています。';
  } else if (totalScore >= 80) {
    if (weakCategories.length > 0) {
      return `全体的に良好なアクセシビリティ対応ですが、${weakCategories.join('、')}の改善が推奨されます。`;
    }
    return '全体的に良好なアクセシビリティ対応です。いくつかの改善点があります。';
  } else if (totalScore >= 60) {
    return `${violationCount}件の違反が検出されました。${weakCategories.join('、')}の領域で改善が必要です。`;
  } else {
    return `重大なアクセシビリティの問題が${violationCount}件検出されました。早急な対応が推奨されます。`;
  }
}

export function sortViolationsByImpact(violations: RuleResult[]): RuleResult[] {
  const impactOrder: Record<string, number> = {
    critical: 0,
    serious: 1,
    moderate: 2,
    minor: 3,
  };

  return [...violations].sort((a, b) => {
    const aOrder = impactOrder[a.impact || 'minor'] ?? 4;
    const bOrder = impactOrder[b.impact || 'minor'] ?? 4;
    return aOrder - bOrder;
  });
}
