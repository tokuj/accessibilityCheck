/**
 * 重複排除サービスのテスト
 *
 * Requirements: 1.4, 6.1, 6.2, 6.3, 6.4, 6.5
 * - CSSセレクタの正規化
 * - WCAG成功基準による一致判定
 * - 違反内容の類似度計算
 * - 同一違反を統合し、検出元エンジンをリストとして保持
 * - 異なる重要度の場合は最高重要度を採用
 * - エンジン別検出数サマリーを生成
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DeduplicationService,
  normalizeSelector,
  calculateSimilarity,
  type DeduplicationOptions,
  type DeduplicatedResult,
} from '../deduplication';
import type { RuleResult, ToolSource, AnalyzerResult, ImpactLevel } from '../types';

// テスト用のRuleResult作成ヘルパー
function createRuleResult(
  overrides: Partial<RuleResult> & { id: string; toolSource: ToolSource }
): RuleResult {
  return {
    description: 'Test description',
    impact: 'moderate' as ImpactLevel,
    nodeCount: 1,
    helpUrl: 'https://example.com/help',
    wcagCriteria: ['1.1.1'],
    nodes: [{ target: 'div', html: '<div></div>' }],
    ...overrides,
  };
}

// テスト用のAnalyzerResult作成ヘルパー
function createAnalyzerResult(
  violations: RuleResult[],
  passes: RuleResult[] = [],
  incomplete: RuleResult[] = []
): AnalyzerResult {
  return {
    violations,
    passes,
    incomplete,
    duration: 100,
  };
}

describe('DeduplicationService', () => {
  let service: DeduplicationService;

  beforeEach(() => {
    service = new DeduplicationService();
  });

  describe('normalizeSelector', () => {
    it('空白を正規化する', () => {
      const input = 'div  >   p.class';
      const result = normalizeSelector(input);
      expect(result).toBe('div > p.class');
    });

    it('前後の空白を削除する', () => {
      const input = '  div > p  ';
      const result = normalizeSelector(input);
      expect(result).toBe('div > p');
    });

    it('複雑なセレクタを正規化する', () => {
      const input = 'html  >  body  >  div#main  >  p.content';
      const result = normalizeSelector(input);
      expect(result).toBe('html > body > div#main > p.content');
    });

    it('属性セレクタを正規化する', () => {
      const input = 'a[href="test"]  >  span';
      const result = normalizeSelector(input);
      expect(result).toBe('a[href="test"] > span');
    });
  });

  describe('calculateSimilarity', () => {
    it('同一文字列の類似度は1.0', () => {
      const result = calculateSimilarity('hello world', 'hello world');
      expect(result).toBe(1.0);
    });

    it('完全に異なる文字列の類似度は0.0', () => {
      const result = calculateSimilarity('abc', 'xyz');
      expect(result).toBe(0.0);
    });

    it('類似した文字列は中間の類似度を返す', () => {
      const result = calculateSimilarity('hello world', 'hello world!');
      expect(result).toBeGreaterThan(0.8);
      expect(result).toBeLessThan(1.0);
    });

    it('空文字列の場合は0.0を返す', () => {
      expect(calculateSimilarity('', 'test')).toBe(0.0);
      expect(calculateSimilarity('test', '')).toBe(0.0);
      expect(calculateSimilarity('', '')).toBe(1.0);
    });
  });

  describe('deduplicate', () => {
    describe('基本的な重複排除', () => {
      it('同一ルールID・同一セレクタの違反を統合する', () => {
        const axeViolation = createRuleResult({
          id: 'color-contrast',
          toolSource: 'axe-core',
          description: 'Elements must have sufficient color contrast',
          wcagCriteria: ['1.4.3'],
          nodes: [{ target: 'div.content', html: '<div class="content"></div>' }],
        });

        const ibmViolation = createRuleResult({
          id: 'color-contrast',
          toolSource: 'ibm',
          description: 'Color contrast must be sufficient',
          wcagCriteria: ['1.4.3'],
          nodes: [{ target: 'div.content', html: '<div class="content"></div>' }],
        });

        const results: AnalyzerResult[] = [
          createAnalyzerResult([axeViolation]),
          createAnalyzerResult([ibmViolation]),
        ];

        const deduped = service.deduplicate(results);

        expect(deduped.violations).toHaveLength(1);
        expect(deduped.violations[0].toolSources).toEqual(['axe-core', 'ibm']);
      });

      it('異なるルールIDの違反は統合しない', () => {
        const axeViolation = createRuleResult({
          id: 'color-contrast',
          toolSource: 'axe-core',
          wcagCriteria: ['1.4.3'],
        });

        const ibmViolation = createRuleResult({
          id: 'image-alt',
          toolSource: 'ibm',
          wcagCriteria: ['1.1.1'],
        });

        const results: AnalyzerResult[] = [
          createAnalyzerResult([axeViolation]),
          createAnalyzerResult([ibmViolation]),
        ];

        const deduped = service.deduplicate(results);

        expect(deduped.violations).toHaveLength(2);
      });

      it('異なるセレクタの違反は統合しない', () => {
        const axeViolation = createRuleResult({
          id: 'color-contrast',
          toolSource: 'axe-core',
          wcagCriteria: ['1.4.3'],
          nodes: [{ target: 'div.header', html: '<div class="header"></div>' }],
        });

        const ibmViolation = createRuleResult({
          id: 'color-contrast',
          toolSource: 'ibm',
          wcagCriteria: ['1.4.3'],
          nodes: [{ target: 'div.footer', html: '<div class="footer"></div>' }],
        });

        const results: AnalyzerResult[] = [
          createAnalyzerResult([axeViolation]),
          createAnalyzerResult([ibmViolation]),
        ];

        const deduped = service.deduplicate(results);

        expect(deduped.violations).toHaveLength(2);
      });
    });

    describe('WCAG成功基準による一致判定', () => {
      it('同一WCAG基準の違反を統合する（ルールIDが異なっても）', () => {
        const axeViolation = createRuleResult({
          id: 'link-name',
          toolSource: 'axe-core',
          description: 'Links must have discernible text',
          wcagCriteria: ['2.4.4', '4.1.2'],
          nodes: [{ target: 'a.nav-link', html: '<a class="nav-link"></a>' }],
        });

        const alfaViolation = createRuleResult({
          id: 'r11',
          toolSource: 'alfa',
          description: 'Link has accessible name',
          wcagCriteria: ['2.4.4', '4.1.2'],
          nodes: [{ target: 'a.nav-link', html: '<a class="nav-link"></a>' }],
        });

        const results: AnalyzerResult[] = [
          createAnalyzerResult([axeViolation]),
          createAnalyzerResult([alfaViolation]),
        ];

        const deduped = service.deduplicate(results);

        expect(deduped.violations).toHaveLength(1);
        expect(deduped.violations[0].toolSources).toEqual(['axe-core', 'alfa']);
      });
    });

    describe('重要度の統合', () => {
      it('異なる重要度の場合、最高重要度を採用する', () => {
        const axeViolation = createRuleResult({
          id: 'color-contrast',
          toolSource: 'axe-core',
          impact: 'moderate',
          wcagCriteria: ['1.4.3'],
          nodes: [{ target: 'div.content', html: '<div></div>' }],
        });

        const ibmViolation = createRuleResult({
          id: 'color-contrast',
          toolSource: 'ibm',
          impact: 'critical',
          wcagCriteria: ['1.4.3'],
          nodes: [{ target: 'div.content', html: '<div></div>' }],
        });

        const results: AnalyzerResult[] = [
          createAnalyzerResult([axeViolation]),
          createAnalyzerResult([ibmViolation]),
        ];

        const deduped = service.deduplicate(results);

        expect(deduped.violations).toHaveLength(1);
        expect(deduped.violations[0].impact).toBe('critical');
      });

      it('重要度の優先順位: critical > serious > moderate > minor', () => {
        const violations = [
          createRuleResult({
            id: 'test-rule',
            toolSource: 'axe-core',
            impact: 'minor',
            wcagCriteria: ['1.1.1'],
            nodes: [{ target: 'div', html: '<div></div>' }],
          }),
          createRuleResult({
            id: 'test-rule',
            toolSource: 'ibm',
            impact: 'serious',
            wcagCriteria: ['1.1.1'],
            nodes: [{ target: 'div', html: '<div></div>' }],
          }),
          createRuleResult({
            id: 'test-rule',
            toolSource: 'alfa',
            impact: 'moderate',
            wcagCriteria: ['1.1.1'],
            nodes: [{ target: 'div', html: '<div></div>' }],
          }),
        ];

        const results: AnalyzerResult[] = violations.map(v => createAnalyzerResult([v]));

        const deduped = service.deduplicate(results);

        expect(deduped.violations).toHaveLength(1);
        expect(deduped.violations[0].impact).toBe('serious');
      });
    });

    describe('エンジン別検出数サマリー', () => {
      it('エンジン別の違反数とパス数を集計する', () => {
        const axeViolations = [
          createRuleResult({ id: 'rule1', toolSource: 'axe-core', wcagCriteria: ['1.1.1'] }),
          createRuleResult({ id: 'rule2', toolSource: 'axe-core', wcagCriteria: ['1.4.3'] }),
        ];
        const axePasses = [
          createRuleResult({ id: 'rule3', toolSource: 'axe-core', wcagCriteria: ['2.4.4'] }),
        ];

        const ibmViolations = [
          createRuleResult({ id: 'rule1', toolSource: 'ibm', wcagCriteria: ['1.1.1'] }),
        ];

        const results: AnalyzerResult[] = [
          createAnalyzerResult(axeViolations, axePasses),
          createAnalyzerResult(ibmViolations),
        ];

        const deduped = service.deduplicate(results);

        expect(deduped.engineSummary['axe-core']).toEqual({ violations: 2, passes: 1 });
        expect(deduped.engineSummary['ibm']).toEqual({ violations: 1, passes: 0 });
      });
    });

    describe('passes と incomplete の重複排除', () => {
      it('passesの重複も排除する', () => {
        const axePass = createRuleResult({
          id: 'image-alt',
          toolSource: 'axe-core',
          wcagCriteria: ['1.1.1'],
          nodes: [{ target: 'img.logo', html: '<img alt="Logo">' }],
        });

        const ibmPass = createRuleResult({
          id: 'image-alt',
          toolSource: 'ibm',
          wcagCriteria: ['1.1.1'],
          nodes: [{ target: 'img.logo', html: '<img alt="Logo">' }],
        });

        const results: AnalyzerResult[] = [
          createAnalyzerResult([], [axePass]),
          createAnalyzerResult([], [ibmPass]),
        ];

        const deduped = service.deduplicate(results);

        expect(deduped.passes).toHaveLength(1);
        expect(deduped.passes[0].toolSources).toEqual(['axe-core', 'ibm']);
      });

      it('incompleteの重複も排除する', () => {
        const axeIncomplete = createRuleResult({
          id: 'color-contrast',
          toolSource: 'axe-core',
          wcagCriteria: ['1.4.3'],
          nodes: [{ target: 'p.text', html: '<p></p>' }],
        });

        const alfaIncomplete = createRuleResult({
          id: 'color-contrast',
          toolSource: 'alfa',
          wcagCriteria: ['1.4.3'],
          nodes: [{ target: 'p.text', html: '<p></p>' }],
        });

        const results: AnalyzerResult[] = [
          createAnalyzerResult([], [], [axeIncomplete]),
          createAnalyzerResult([], [], [alfaIncomplete]),
        ];

        const deduped = service.deduplicate(results);

        expect(deduped.incomplete).toHaveLength(1);
        expect(deduped.incomplete[0].toolSources).toEqual(['axe-core', 'alfa']);
      });
    });

    describe('ノード情報の統合', () => {
      it('複数エンジンのノード情報を統合する', () => {
        const axeViolation = createRuleResult({
          id: 'color-contrast',
          toolSource: 'axe-core',
          wcagCriteria: ['1.4.3'],
          nodes: [
            { target: 'div.header', html: '<div class="header"></div>' },
          ],
          nodeCount: 1,
        });

        const ibmViolation = createRuleResult({
          id: 'color-contrast',
          toolSource: 'ibm',
          wcagCriteria: ['1.4.3'],
          nodes: [
            { target: 'div.header', html: '<div class="header"></div>' },
            { target: 'div.footer', html: '<div class="footer"></div>' },
          ],
          nodeCount: 2,
        });

        const results: AnalyzerResult[] = [
          createAnalyzerResult([axeViolation]),
          createAnalyzerResult([ibmViolation]),
        ];

        const deduped = service.deduplicate(results);

        expect(deduped.violations).toHaveLength(1);
        // ノードは統合されているべき（重複排除）
        expect(deduped.violations[0].nodes?.length).toBe(2);
        expect(deduped.violations[0].nodeCount).toBe(2);
      });
    });

    describe('オプション設定', () => {
      it('selectorThresholdオプションを使用する', () => {
        const options: DeduplicationOptions = {
          selectorThreshold: 1.0, // 完全一致のみ
        };

        const v1 = createRuleResult({
          id: 'test',
          toolSource: 'axe-core',
          wcagCriteria: ['1.1.1'],
          nodes: [{ target: 'div.content', html: '<div></div>' }],
        });

        const v2 = createRuleResult({
          id: 'test',
          toolSource: 'ibm',
          wcagCriteria: ['1.1.1'],
          nodes: [{ target: 'div.content', html: '<div></div>' }],
        });

        const results: AnalyzerResult[] = [
          createAnalyzerResult([v1]),
          createAnalyzerResult([v2]),
        ];

        const deduped = service.deduplicate(results, options);

        expect(deduped.violations).toHaveLength(1);
      });

      it('descriptionThresholdオプションを使用する', () => {
        const options: DeduplicationOptions = {
          descriptionThreshold: 0.9,
        };

        const v1 = createRuleResult({
          id: 'test',
          toolSource: 'axe-core',
          description: 'Elements must have sufficient color contrast',
          wcagCriteria: ['1.4.3'],
          nodes: [{ target: 'div', html: '<div></div>' }],
        });

        const v2 = createRuleResult({
          id: 'test',
          toolSource: 'ibm',
          description: 'Elements must have sufficient color contrast ratio',
          wcagCriteria: ['1.4.3'],
          nodes: [{ target: 'div', html: '<div></div>' }],
        });

        const results: AnalyzerResult[] = [
          createAnalyzerResult([v1]),
          createAnalyzerResult([v2]),
        ];

        const deduped = service.deduplicate(results, options);

        // 類似度が0.9を超えるので統合される
        expect(deduped.violations).toHaveLength(1);
      });
    });

    describe('空の入力', () => {
      it('空の結果配列を処理できる', () => {
        const results: AnalyzerResult[] = [];

        const deduped = service.deduplicate(results);

        expect(deduped.violations).toHaveLength(0);
        expect(deduped.passes).toHaveLength(0);
        expect(deduped.incomplete).toHaveLength(0);
        expect(deduped.engineSummary).toEqual({});
      });

      it('空の違反配列を処理できる', () => {
        const results: AnalyzerResult[] = [
          createAnalyzerResult([]),
          createAnalyzerResult([]),
        ];

        const deduped = service.deduplicate(results);

        expect(deduped.violations).toHaveLength(0);
      });
    });
  });
});
