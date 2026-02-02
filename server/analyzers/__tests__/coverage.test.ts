/**
 * WCAGカバレッジサービスのテスト
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 * - 全WCAG成功基準（1.1.1〜4.1.3）のマスターリストを定義
 * - 各基準のテスト状態（自動/半自動/手動/未テスト）を計算
 * - 各基準の結果（合格/違反/要確認/該当なし）を判定
 * - 検出に使用したツールを記録
 * - 適合レベル別（A/AA/AAA）カバレッジ率を計算
 * - カバレッジマトリクスをCSV形式に変換
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CoverageService,
  WCAG_CRITERIA_MASTER_LIST,
  type TestMethod,
  type TestResult,
  type CriterionStatus,
  type CoverageMatrix,
} from '../coverage';
import type { RuleResult, ToolSource, AccessibilityReport, PageResult } from '../types';

// テスト用のRuleResult作成ヘルパー
function createRuleResult(
  overrides: Partial<RuleResult> & { id: string; toolSource: ToolSource }
): RuleResult {
  return {
    description: 'Test description',
    impact: 'moderate',
    nodeCount: 1,
    helpUrl: 'https://example.com/help',
    wcagCriteria: [],
    nodes: [],
    ...overrides,
  };
}

// テスト用のAccessibilityReport作成ヘルパー
function createReport(pages: PageResult[]): AccessibilityReport {
  const totalViolations = pages.reduce((sum, p) => sum + p.violations.length, 0);
  const totalPasses = pages.reduce((sum, p) => sum + p.passes.length, 0);
  const totalIncomplete = pages.reduce((sum, p) => sum + p.incomplete.length, 0);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalViolations,
      totalPasses,
      totalIncomplete,
    },
    pages,
    toolsUsed: [],
  };
}

// テスト用のPageResult作成ヘルパー
function createPageResult(
  violations: RuleResult[],
  passes: RuleResult[] = [],
  incomplete: RuleResult[] = []
): PageResult {
  return {
    name: 'Test Page',
    url: 'https://example.com',
    violations,
    passes,
    incomplete,
  };
}

describe('CoverageService', () => {
  let service: CoverageService;

  beforeEach(() => {
    service = new CoverageService();
  });

  describe('WCAG_CRITERIA_MASTER_LIST', () => {
    it('全WCAG成功基準が定義されている', () => {
      // WCAG 2.1には50の成功基準がある
      // WCAG 2.2では9つ追加されて59
      expect(WCAG_CRITERIA_MASTER_LIST.length).toBeGreaterThanOrEqual(50);
    });

    it('各成功基準にcriterion、level、titleが含まれる', () => {
      for (const criterion of WCAG_CRITERIA_MASTER_LIST) {
        expect(criterion.criterion).toMatch(/^\d+\.\d+\.\d+$/);
        expect(['A', 'AA', 'AAA']).toContain(criterion.level);
        expect(criterion.title).toBeDefined();
        expect(criterion.title.length).toBeGreaterThan(0);
      }
    });

    it('レベルAの成功基準が含まれる', () => {
      const levelA = WCAG_CRITERIA_MASTER_LIST.filter(c => c.level === 'A');
      expect(levelA.length).toBeGreaterThan(0);
      expect(levelA.find(c => c.criterion === '1.1.1')).toBeDefined();
    });

    it('レベルAAの成功基準が含まれる', () => {
      const levelAA = WCAG_CRITERIA_MASTER_LIST.filter(c => c.level === 'AA');
      expect(levelAA.length).toBeGreaterThan(0);
      expect(levelAA.find(c => c.criterion === '1.4.3')).toBeDefined();
    });

    it('レベルAAAの成功基準が含まれる', () => {
      const levelAAA = WCAG_CRITERIA_MASTER_LIST.filter(c => c.level === 'AAA');
      expect(levelAAA.length).toBeGreaterThan(0);
      expect(levelAAA.find(c => c.criterion === '1.4.6')).toBeDefined();
    });

    it('WCAG 2.2の新基準が含まれる', () => {
      const wcag22Criteria = ['2.4.11', '2.4.12', '2.4.13', '2.5.7', '2.5.8', '3.2.6', '3.3.7', '3.3.8', '3.3.9'];
      for (const criterion of wcag22Criteria) {
        expect(WCAG_CRITERIA_MASTER_LIST.find(c => c.criterion === criterion)).toBeDefined();
      }
    });
  });

  describe('calculateCoverage', () => {
    describe('基本的なカバレッジ計算', () => {
      it('空のレポートでは全ての基準が未テストになる', () => {
        const report = createReport([createPageResult([], [], [])]);
        const matrix = service.calculateCoverage(report);

        expect(matrix.criteria.length).toBe(WCAG_CRITERIA_MASTER_LIST.length);
        for (const status of matrix.criteria) {
          expect(status.method).toBe('not-tested');
          expect(status.result).toBe('not-applicable');
        }
      });

      it('違反がある基準はfailとしてマークされる', () => {
        const violation = createRuleResult({
          id: 'image-alt',
          toolSource: 'axe-core',
          wcagCriteria: ['1.1.1'],
        });

        const report = createReport([createPageResult([violation])]);
        const matrix = service.calculateCoverage(report);

        const criterion = matrix.criteria.find(c => c.criterion === '1.1.1');
        expect(criterion).toBeDefined();
        expect(criterion!.result).toBe('fail');
        expect(criterion!.method).toBe('auto');
        expect(criterion!.tools).toContain('axe-core');
      });

      it('パスした基準はpassとしてマークされる', () => {
        const pass = createRuleResult({
          id: 'image-alt',
          toolSource: 'axe-core',
          wcagCriteria: ['1.1.1'],
        });

        const report = createReport([createPageResult([], [pass])]);
        const matrix = service.calculateCoverage(report);

        const criterion = matrix.criteria.find(c => c.criterion === '1.1.1');
        expect(criterion).toBeDefined();
        expect(criterion!.result).toBe('pass');
        expect(criterion!.method).toBe('auto');
      });

      it('incompleteがある基準はneeds-reviewとしてマークされる', () => {
        const incomplete = createRuleResult({
          id: 'color-contrast',
          toolSource: 'axe-core',
          wcagCriteria: ['1.4.3'],
        });

        const report = createReport([createPageResult([], [], [incomplete])]);
        const matrix = service.calculateCoverage(report);

        const criterion = matrix.criteria.find(c => c.criterion === '1.4.3');
        expect(criterion).toBeDefined();
        expect(criterion!.result).toBe('needs-review');
        expect(criterion!.method).toBe('auto');
      });

      it('違反がpassよりも優先される', () => {
        const violation = createRuleResult({
          id: 'image-alt',
          toolSource: 'axe-core',
          wcagCriteria: ['1.1.1'],
        });
        const pass = createRuleResult({
          id: 'image-alt-other',
          toolSource: 'pa11y',
          wcagCriteria: ['1.1.1'],
        });

        const report = createReport([createPageResult([violation], [pass])]);
        const matrix = service.calculateCoverage(report);

        const criterion = matrix.criteria.find(c => c.criterion === '1.1.1');
        expect(criterion!.result).toBe('fail');
      });

      it('needs-reviewがpassよりも優先される', () => {
        const incomplete = createRuleResult({
          id: 'color-contrast',
          toolSource: 'axe-core',
          wcagCriteria: ['1.4.3'],
        });
        const pass = createRuleResult({
          id: 'color-contrast-other',
          toolSource: 'pa11y',
          wcagCriteria: ['1.4.3'],
        });

        const report = createReport([createPageResult([], [pass], [incomplete])]);
        const matrix = service.calculateCoverage(report);

        const criterion = matrix.criteria.find(c => c.criterion === '1.4.3');
        expect(criterion!.result).toBe('needs-review');
      });
    });

    describe('複数エンジンからのツール記録', () => {
      it('複数のツールが同じ基準を検出した場合、全てのツールが記録される', () => {
        const axeViolation = createRuleResult({
          id: 'image-alt',
          toolSource: 'axe-core',
          wcagCriteria: ['1.1.1'],
        });
        const ibmViolation = createRuleResult({
          id: 'img_alt_null',
          toolSource: 'ibm',
          wcagCriteria: ['1.1.1'],
        });

        const report = createReport([createPageResult([axeViolation, ibmViolation])]);
        const matrix = service.calculateCoverage(report);

        const criterion = matrix.criteria.find(c => c.criterion === '1.1.1');
        expect(criterion!.tools).toContain('axe-core');
        expect(criterion!.tools).toContain('ibm');
      });
    });

    describe('適合レベル別カバレッジ率の計算', () => {
      it('レベルAのカバレッジ率を計算する', () => {
        const levelACriteria = WCAG_CRITERIA_MASTER_LIST.filter(c => c.level === 'A');
        const firstCriterion = levelACriteria[0];

        const pass = createRuleResult({
          id: 'test-rule',
          toolSource: 'axe-core',
          wcagCriteria: [firstCriterion.criterion],
        });

        const report = createReport([createPageResult([], [pass])]);
        const matrix = service.calculateCoverage(report);

        expect(matrix.summary.levelA.total).toBe(levelACriteria.length);
        expect(matrix.summary.levelA.covered).toBeGreaterThanOrEqual(1);
      });

      it('レベルAAのカバレッジ率を計算する', () => {
        const levelAACriteria = WCAG_CRITERIA_MASTER_LIST.filter(c => c.level === 'AA');

        const pass = createRuleResult({
          id: 'color-contrast',
          toolSource: 'axe-core',
          wcagCriteria: ['1.4.3'], // AA criterion
        });

        const report = createReport([createPageResult([], [pass])]);
        const matrix = service.calculateCoverage(report);

        expect(matrix.summary.levelAA.total).toBe(levelAACriteria.length);
        expect(matrix.summary.levelAA.covered).toBeGreaterThanOrEqual(1);
      });

      it('レベルAAAのカバレッジ率を計算する', () => {
        const levelAAACriteria = WCAG_CRITERIA_MASTER_LIST.filter(c => c.level === 'AAA');

        const pass = createRuleResult({
          id: 'contrast-enhanced',
          toolSource: 'axe-core',
          wcagCriteria: ['1.4.6'], // AAA criterion
        });

        const report = createReport([createPageResult([], [pass])]);
        const matrix = service.calculateCoverage(report);

        expect(matrix.summary.levelAAA.total).toBe(levelAAACriteria.length);
        expect(matrix.summary.levelAAA.covered).toBeGreaterThanOrEqual(1);
      });
    });

    describe('複数ページのレポート', () => {
      it('複数ページの結果を統合する', () => {
        const page1Violation = createRuleResult({
          id: 'image-alt',
          toolSource: 'axe-core',
          wcagCriteria: ['1.1.1'],
        });
        const page2Pass = createRuleResult({
          id: 'color-contrast',
          toolSource: 'axe-core',
          wcagCriteria: ['1.4.3'],
        });

        const report = createReport([
          createPageResult([page1Violation]),
          createPageResult([], [page2Pass]),
        ]);

        const matrix = service.calculateCoverage(report);

        const criterion111 = matrix.criteria.find(c => c.criterion === '1.1.1');
        const criterion143 = matrix.criteria.find(c => c.criterion === '1.4.3');

        expect(criterion111!.result).toBe('fail');
        expect(criterion143!.result).toBe('pass');
      });

      it('異なるページで同じ基準に異なる結果がある場合、違反が優先される', () => {
        const page1Pass = createRuleResult({
          id: 'image-alt',
          toolSource: 'axe-core',
          wcagCriteria: ['1.1.1'],
        });
        const page2Violation = createRuleResult({
          id: 'image-alt',
          toolSource: 'axe-core',
          wcagCriteria: ['1.1.1'],
        });

        const report = createReport([
          createPageResult([], [page1Pass]),
          createPageResult([page2Violation]),
        ]);

        const matrix = service.calculateCoverage(report);

        const criterion = matrix.criteria.find(c => c.criterion === '1.1.1');
        expect(criterion!.result).toBe('fail');
      });
    });
  });

  describe('exportCSV', () => {
    it('カバレッジマトリクスをCSV形式に変換する', () => {
      const violation = createRuleResult({
        id: 'image-alt',
        toolSource: 'axe-core',
        wcagCriteria: ['1.1.1'],
      });

      const report = createReport([createPageResult([violation])]);
      const matrix = service.calculateCoverage(report);
      const csv = service.exportCSV(matrix);

      expect(csv).toContain('成功基準');
      expect(csv).toContain('レベル');
      expect(csv).toContain('テスト方法');
      expect(csv).toContain('結果');
      expect(csv).toContain('検出ツール');
    });

    it('CSVのデータ行が正しい形式になる', () => {
      const violation = createRuleResult({
        id: 'image-alt',
        toolSource: 'axe-core',
        wcagCriteria: ['1.1.1'],
      });

      const report = createReport([createPageResult([violation])]);
      const matrix = service.calculateCoverage(report);
      const csv = service.exportCSV(matrix);

      const lines = csv.split('\n');
      // ヘッダー行
      expect(lines[0]).toContain('成功基準');

      // 1.1.1の行を探す
      const line111 = lines.find(l => l.includes('1.1.1'));
      expect(line111).toBeDefined();
      expect(line111).toContain('A');
      expect(line111).toContain('auto');
      expect(line111).toContain('fail');
      expect(line111).toContain('axe-core');
    });

    it('サマリー情報がCSVに含まれる', () => {
      const report = createReport([createPageResult([])]);
      const matrix = service.calculateCoverage(report);
      const csv = service.exportCSV(matrix);

      expect(csv).toContain('カバレッジサマリー');
      expect(csv).toContain('Level A');
      expect(csv).toContain('Level AA');
      expect(csv).toContain('Level AAA');
    });

    it('CSVに日本語タイトルが含まれる', () => {
      const violation = createRuleResult({
        id: 'image-alt',
        toolSource: 'axe-core',
        wcagCriteria: ['1.1.1'],
      });

      const report = createReport([createPageResult([violation])]);
      const matrix = service.calculateCoverage(report);
      const csv = service.exportCSV(matrix);

      // 1.1.1の行にタイトルが含まれる
      const line111 = csv.split('\n').find(l => l.includes('1.1.1'));
      expect(line111).toBeDefined();
      // タイトル列があることを確認
      const columns = line111!.split(',');
      expect(columns.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('半自動チェック結果の反映', () => {
    it('半自動チェック結果をカバレッジに反映できる', () => {
      const report = createReport([createPageResult([])]);

      // 半自動チェック結果をレポートに追加
      report.semiAutoResults = [
        {
          itemId: 'semi-1',
          ruleId: 'image-alt',
          wcagCriteria: ['1.1.1'],
          answer: 'appropriate',
          answeredAt: new Date().toISOString(),
        },
      ];

      const matrix = service.calculateCoverage(report);

      const criterion = matrix.criteria.find(c => c.criterion === '1.1.1');
      expect(criterion!.method).toBe('semi-auto');
      expect(criterion!.result).toBe('pass');
    });

    it('半自動チェックで不適切と回答された場合はfailになる', () => {
      const report = createReport([createPageResult([])]);

      report.semiAutoResults = [
        {
          itemId: 'semi-1',
          ruleId: 'image-alt',
          wcagCriteria: ['1.1.1'],
          answer: 'inappropriate',
          answeredAt: new Date().toISOString(),
        },
      ];

      const matrix = service.calculateCoverage(report);

      const criterion = matrix.criteria.find(c => c.criterion === '1.1.1');
      expect(criterion!.result).toBe('fail');
      expect(criterion!.method).toBe('semi-auto');
    });

    it('半自動チェックで判断不能の場合はneeds-reviewになる', () => {
      const report = createReport([createPageResult([])]);

      report.semiAutoResults = [
        {
          itemId: 'semi-1',
          ruleId: 'image-alt',
          wcagCriteria: ['1.1.1'],
          answer: 'cannot-determine',
          answeredAt: new Date().toISOString(),
        },
      ];

      const matrix = service.calculateCoverage(report);

      const criterion = matrix.criteria.find(c => c.criterion === '1.1.1');
      expect(criterion!.result).toBe('needs-review');
      expect(criterion!.method).toBe('semi-auto');
    });
  });
});
