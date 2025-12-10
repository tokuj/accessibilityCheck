import pa11y from 'pa11y';
import type { AnalyzerResult, RuleResult, ImpactLevel } from './types';

export const PA11Y_VERSION = '9.0.1';

// Pa11y issue type to impact level mapping
function mapTypeToImpact(type: string): ImpactLevel | undefined {
  switch (type) {
    case 'error':
      return 'serious';
    case 'warning':
      return 'moderate';
    case 'notice':
      return 'minor';
    default:
      return undefined;
  }
}

// Extract WCAG criteria from Pa11y code (e.g., "WCAG2AA.Principle1.Guideline1_1.1_1_1")
function extractWcagFromCode(code: string): string[] {
  const criteria: string[] = [];

  // Match patterns like "1_1_1" in the code
  const match = code.match(/(\d)_(\d)_(\d+)/);
  if (match) {
    criteria.push(`${match[1]}.${match[2]}.${match[3]}`);
  }

  return criteria;
}

export async function analyzeWithPa11y(url: string): Promise<AnalyzerResult> {
  const startTime = Date.now();

  try {
    const results = await pa11y(url, {
      standard: 'WCAG2AA',
      timeout: 60000,
      wait: 1000,
      chromeLaunchConfig: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    const violations: RuleResult[] = results.issues
      .filter((issue) => issue.type === 'error')
      .map((issue) => ({
        id: issue.code,
        description: issue.message,
        impact: mapTypeToImpact(issue.type),
        nodeCount: 1, // Pa11y reports one issue per element
        helpUrl: `https://squizlabs.github.io/HTML_CodeSniffer/Standards/WCAG2/`,
        wcagCriteria: extractWcagFromCode(issue.code),
        toolSource: 'pa11y' as const,
      }));

    const incomplete: RuleResult[] = results.issues
      .filter((issue) => issue.type === 'warning' || issue.type === 'notice')
      .map((issue) => ({
        id: issue.code,
        description: issue.message,
        impact: mapTypeToImpact(issue.type),
        nodeCount: 1,
        helpUrl: `https://squizlabs.github.io/HTML_CodeSniffer/Standards/WCAG2/`,
        wcagCriteria: extractWcagFromCode(issue.code),
        toolSource: 'pa11y' as const,
      }));

    const duration = Date.now() - startTime;

    return {
      violations,
      passes: [], // Pa11y doesn't report passed checks
      incomplete,
      duration,
    };
  } catch (error) {
    console.error('Pa11y analysis error:', error);
    const duration = Date.now() - startTime;

    return {
      violations: [],
      passes: [],
      incomplete: [],
      duration,
    };
  }
}
