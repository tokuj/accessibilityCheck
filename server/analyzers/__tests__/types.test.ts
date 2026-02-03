/**
 * 型定義のユニットテスト
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4 (wcag-coverage-expansion)
 * - ToolSource型の拡張
 * - RuleResultインターフェースの拡張
 */
import { describe, it, expect } from 'vitest';
import type {
  ToolSource,
  RuleResult,
  ImpactLevel,
} from '../types';

describe('ToolSource型', () => {
  describe('既存エンジンのサポート', () => {
    it('axe-coreを識別子として持つ', () => {
      const source: ToolSource = 'axe-core';
      expect(source).toBe('axe-core');
    });

    it('pa11yを識別子として持つ', () => {
      const source: ToolSource = 'pa11y';
      expect(source).toBe('pa11y');
    });

    it('lighthouseを識別子として持つ', () => {
      const source: ToolSource = 'lighthouse';
      expect(source).toBe('lighthouse');
    });
  });

  describe('新規エンジンのサポート (Req 1.1, 1.2, 1.3)', () => {
    it('ibmを識別子として持つ', () => {
      const source: ToolSource = 'ibm';
      expect(source).toBe('ibm');
    });

    it('alfaを識別子として持つ', () => {
      const source: ToolSource = 'alfa';
      expect(source).toBe('alfa');
    });

    it('qualwebを識別子として持つ', () => {
      const source: ToolSource = 'qualweb';
      expect(source).toBe('qualweb');
    });

    it('waveを識別子として持つ', () => {
      const source: ToolSource = 'wave';
      expect(source).toBe('wave');
    });

    it('customを識別子として持つ', () => {
      const source: ToolSource = 'custom';
      expect(source).toBe('custom');
    });
  });

  describe('ToolSource配列の操作', () => {
    it('複数のToolSourceを配列として扱える', () => {
      const sources: ToolSource[] = ['axe-core', 'ibm', 'alfa'];
      expect(sources).toHaveLength(3);
      expect(sources).toContain('axe-core');
      expect(sources).toContain('ibm');
      expect(sources).toContain('alfa');
    });
  });
});

describe('RuleResult拡張', () => {
  describe('既存フィールドの後方互換性', () => {
    it('既存フィールドを全て持つ', () => {
      const rule: RuleResult = {
        id: 'color-contrast',
        description: 'Elements must have sufficient color contrast',
        impact: 'serious',
        nodeCount: 3,
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
        wcagCriteria: ['1.4.3'],
        toolSource: 'axe-core',
      };

      expect(rule.id).toBe('color-contrast');
      expect(rule.description).toBeDefined();
      expect(rule.impact).toBe('serious');
      expect(rule.nodeCount).toBe(3);
      expect(rule.helpUrl).toBeDefined();
      expect(rule.wcagCriteria).toContain('1.4.3');
      expect(rule.toolSource).toBe('axe-core');
    });
  });

  describe('toolSourcesフィールド (Req 1.4)', () => {
    it('複数エンジンで検出された場合にtoolSources配列を持つ', () => {
      const rule: RuleResult = {
        id: 'image-alt',
        description: 'Images must have alternate text',
        impact: 'critical',
        nodeCount: 1,
        helpUrl: 'https://example.com/image-alt',
        wcagCriteria: ['1.1.1'],
        toolSource: 'axe-core',
        toolSources: ['axe-core', 'ibm', 'alfa'],
      };

      expect(rule.toolSources).toBeDefined();
      expect(rule.toolSources).toHaveLength(3);
      expect(rule.toolSources).toContain('axe-core');
      expect(rule.toolSources).toContain('ibm');
      expect(rule.toolSources).toContain('alfa');
    });

    it('toolSourcesはオプショナルである（後方互換性）', () => {
      const rule: RuleResult = {
        id: 'button-name',
        description: 'Buttons must have discernible text',
        nodeCount: 0,
        helpUrl: 'https://example.com/button-name',
        wcagCriteria: ['4.1.2'],
        toolSource: 'pa11y',
      };

      expect(rule.toolSources).toBeUndefined();
    });
  });

  describe('isExperimentalフィールド (WCAG 2.2実験的ルール)', () => {
    it('WCAG 2.2実験的ルールにisExperimental=trueを設定できる', () => {
      const rule: RuleResult = {
        id: 'focus-not-obscured',
        description: 'Focus is not obscured by other elements',
        impact: 'serious',
        nodeCount: 1,
        helpUrl: 'https://example.com/focus-not-obscured',
        wcagCriteria: ['2.4.11'],
        toolSource: 'ibm',
        isExperimental: true,
      };

      expect(rule.isExperimental).toBe(true);
    });

    it('isExperimentalはオプショナルである（後方互換性）', () => {
      const rule: RuleResult = {
        id: 'link-name',
        description: 'Links must have discernible text',
        nodeCount: 2,
        helpUrl: 'https://example.com/link-name',
        wcagCriteria: ['2.4.4'],
        toolSource: 'axe-core',
      };

      expect(rule.isExperimental).toBeUndefined();
    });

    it('安定したルールにisExperimental=falseを設定できる', () => {
      const rule: RuleResult = {
        id: 'heading-order',
        description: 'Heading levels should only increase by one',
        impact: 'moderate',
        nodeCount: 1,
        helpUrl: 'https://example.com/heading-order',
        wcagCriteria: ['1.3.1'],
        toolSource: 'alfa',
        isExperimental: false,
      };

      expect(rule.isExperimental).toBe(false);
    });
  });

  describe('新規ToolSourceを持つRuleResult', () => {
    it('ibmをtoolSourceとして持つRuleResultを作成できる', () => {
      const rule: RuleResult = {
        id: 'WCAG21_Label_Accessible',
        description: 'Interactive components must have accessible labels',
        impact: 'critical',
        nodeCount: 1,
        helpUrl: 'https://www.ibm.com/able/requirements',
        wcagCriteria: ['1.3.1', '4.1.2'],
        toolSource: 'ibm',
      };

      expect(rule.toolSource).toBe('ibm');
    });

    it('alfaをtoolSourceとして持つRuleResultを作成できる', () => {
      const rule: RuleResult = {
        id: 'R2',
        description: 'Img element has accessible name',
        impact: 'serious',
        nodeCount: 2,
        helpUrl: 'https://siteimprove.com/rules/R2',
        wcagCriteria: ['1.1.1'],
        toolSource: 'alfa',
      };

      expect(rule.toolSource).toBe('alfa');
    });

    it('qualwebをtoolSourceとして持つRuleResultを作成できる', () => {
      const rule: RuleResult = {
        id: 'QW-ACT-R1',
        description: 'HTML page has lang attribute',
        impact: 'critical',
        nodeCount: 1,
        helpUrl: 'https://qualweb.di.fc.ul.pt/rules/QW-ACT-R1',
        wcagCriteria: ['3.1.1'],
        toolSource: 'qualweb',
      };

      expect(rule.toolSource).toBe('qualweb');
    });

    it('waveをtoolSourceとして持つRuleResultを作成できる', () => {
      const rule: RuleResult = {
        id: 'alt_missing',
        description: 'Missing alternative text',
        impact: 'critical',
        nodeCount: 1,
        helpUrl: 'https://wave.webaim.org/api/docs?format=json',
        wcagCriteria: ['1.1.1'],
        toolSource: 'wave',
      };

      expect(rule.toolSource).toBe('wave');
    });

    it('customをtoolSourceとして持つRuleResultを作成できる', () => {
      const rule: RuleResult = {
        id: 'ambiguous-link-text',
        description: 'Link text should be descriptive',
        impact: 'minor',
        nodeCount: 5,
        helpUrl: 'https://example.com/custom-rules/ambiguous-link',
        wcagCriteria: ['2.4.4'],
        toolSource: 'custom',
      };

      expect(rule.toolSource).toBe('custom');
    });
  });

  describe('複合ケース', () => {
    it('全ての新規フィールドを持つRuleResultを作成できる', () => {
      const rule: RuleResult = {
        id: 'focus-appearance',
        description: 'Focus indicator meets minimum requirements',
        impact: 'serious',
        nodeCount: 3,
        helpUrl: 'https://siteimprove.com/rules/focus-appearance',
        wcagCriteria: ['2.4.13'],
        toolSource: 'alfa',
        toolSources: ['alfa', 'ibm'],
        isExperimental: true,
        nodes: [
          {
            target: 'button#submit',
            html: '<button id="submit">Submit</button>',
          },
        ],
      };

      expect(rule.toolSource).toBe('alfa');
      expect(rule.toolSources).toEqual(['alfa', 'ibm']);
      expect(rule.isExperimental).toBe(true);
      expect(rule.nodes).toHaveLength(1);
    });
  });
});
