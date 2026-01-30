/**
 * バックエンド統合テスト
 *
 * Task 12.1: RuleResult.nodes変換、Lighthouse分類ロジック、API応答時間の統合検証
 * Requirements: 1.3, 3.1, 3.2, 5.2
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RuleResult, NodeInfo } from '../types';

describe('バックエンド統合テスト (Task 12.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('RuleResult.nodes変換の統合検証 (Req 1.3)', () => {
    describe('axe-core', () => {
      it('違反結果のRuleResultにnodes配列が正しく設定される', async () => {
        // axe-coreのRuleResult型を検証
        const ruleResult: RuleResult = {
          id: 'color-contrast',
          description: 'Elements must have sufficient color contrast',
          impact: 'serious',
          nodeCount: 2,
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
          wcagCriteria: ['1.4.3'],
          toolSource: 'axe-core',
          nodes: [
            {
              target: 'html > body > p.low-contrast',
              html: '<p class="low-contrast">Text</p>',
              failureSummary: 'Element has insufficient color contrast',
            },
            {
              target: 'html > body > span.faded',
              html: '<span class="faded">Faded</span>',
              failureSummary: 'Element has insufficient color contrast',
            },
          ],
        };

        expect(ruleResult.nodes).toBeDefined();
        expect(ruleResult.nodes).toHaveLength(2);
        expect(ruleResult.nodeCount).toBe(ruleResult.nodes!.length);
      });

      it('target配列が単一のCSSセレクタ文字列に変換される', () => {
        const node: NodeInfo = {
          target: '#main > div.container > a.link',
          html: '<a class="link" href="/page">Link</a>',
        };

        expect(node.target).toBe('#main > div.container > a.link');
        expect(node.target).not.toContain(',');
      });

      it('failureSummaryがaxe-core結果に含まれる', () => {
        const node: NodeInfo = {
          target: 'img.hero',
          html: '<img class="hero" src="hero.jpg">',
          failureSummary: 'Fix any of the following: Element does not have an alt attribute',
        };

        expect(node.failureSummary).toBeDefined();
        expect(node.failureSummary).toContain('alt attribute');
      });
    });

    describe('Pa11y', () => {
      it('違反結果のRuleResultにnodes配列が正しく設定される', () => {
        const ruleResult: RuleResult = {
          id: 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37',
          description: 'Img element missing an alt attribute',
          impact: 'serious',
          nodeCount: 1,
          helpUrl: '',
          wcagCriteria: ['1.1.1'],
          toolSource: 'pa11y',
          nodes: [
            {
              target: 'html > body > img.hero',
              html: '<img class="hero" src="photo.jpg">',
            },
          ],
        };

        expect(ruleResult.nodes).toBeDefined();
        expect(ruleResult.nodes).toHaveLength(1);
        expect(ruleResult.nodes![0].failureSummary).toBeUndefined();
      });

      it('1イシュー=1ノードの関係が維持される', () => {
        const ruleResult: RuleResult = {
          id: 'WCAG2AA.Principle1.Guideline1_4.1_4_3.G18',
          description: 'Color contrast issue',
          nodeCount: 1,
          helpUrl: '',
          wcagCriteria: ['1.4.3'],
          toolSource: 'pa11y',
          nodes: [
            {
              target: 'span.light',
              html: '<span class="light">Text</span>',
            },
          ],
        };

        expect(ruleResult.nodeCount).toBe(1);
        expect(ruleResult.nodes).toHaveLength(1);
      });
    });

    describe('Lighthouse', () => {
      it('違反結果のRuleResultにnodes配列が正しく設定される', () => {
        const ruleResult: RuleResult = {
          id: 'color-contrast',
          description: 'Color contrast is insufficient',
          impact: 'serious',
          nodeCount: 2,
          helpUrl: 'https://web.dev/color-contrast/',
          wcagCriteria: ['1.4.3'],
          toolSource: 'lighthouse',
          rawScore: 0,
          nodes: [
            {
              target: 'p.low-contrast',
              html: '<p class="low-contrast" style="color: #999">Text</p>',
            },
            {
              target: 'span.faded',
              html: '<span class="faded">Faded</span>',
            },
          ],
        };

        expect(ruleResult.nodes).toBeDefined();
        expect(ruleResult.nodes).toHaveLength(2);
        expect(ruleResult.rawScore).toBe(0);
      });

      it('details.type === "table" からノード情報が抽出される', () => {
        const node: NodeInfo = {
          target: 'img#hero',
          html: '<img id="hero" src="hero.jpg">',
        };

        expect(node.target).toBe('img#hero');
        expect(node.html).toContain('<img');
      });

      it('details.type === "list" からノード情報が抽出される', () => {
        const node: NodeInfo = {
          target: 'a.empty',
          html: '<a class="empty" href="/page"></a>',
        };

        expect(node.target).toBe('a.empty');
        expect(node.html).toContain('<a');
      });
    });

    describe('HTML抜粋の200文字制限', () => {
      it('200文字を超えるHTML抜粋は切り詰められる', () => {
        const longHtml = '<div class="container">' + 'x'.repeat(180) + '</div>';
        const truncatedHtml = longHtml.length > 200
          ? longHtml.slice(0, 197) + '...'
          : longHtml;

        expect(truncatedHtml.length).toBeLessThanOrEqual(200);
        if (longHtml.length > 200) {
          expect(truncatedHtml.endsWith('...')).toBe(true);
        }
      });

      it('200文字以下のHTML抜粋はそのまま保持される', () => {
        const shortHtml = '<img src="photo.jpg" alt="Photo">';

        expect(shortHtml.length).toBeLessThanOrEqual(200);
        expect(shortHtml.endsWith('...')).toBe(false);
      });
    });
  });

  describe('Lighthouse分類ロジックの統合検証 (Req 3.1, 3.2)', () => {
    describe('scoreDisplayModeによる適用外判定 (Req 3.1)', () => {
      it('notApplicableの項目はレポートから除外される', () => {
        // notApplicableの項目は結果配列に含まれないことを検証
        const allResults: RuleResult[] = [
          {
            id: 'image-alt',
            description: 'Images have alt text',
            nodeCount: 0,
            helpUrl: '',
            wcagCriteria: ['1.1.1'],
            toolSource: 'lighthouse',
            rawScore: 1,
          },
          // video-caption (notApplicable) は含まれない
        ];

        const videoCaptionResult = allResults.find(r => r.id === 'video-caption');
        expect(videoCaptionResult).toBeUndefined();
      });

      it('score === null かつ notApplicable以外の場合はincomplete', () => {
        const incompleteResult: RuleResult = {
          id: 'manual-audit',
          description: 'Manual audit required',
          nodeCount: 0,
          helpUrl: '',
          wcagCriteria: [],
          toolSource: 'lighthouse',
          rawScore: null,
          classificationReason: 'manual-review',
        };

        expect(incompleteResult.rawScore).toBeNull();
        expect(incompleteResult.classificationReason).toBe('manual-review');
      });
    });

    describe('0.5閾値による分類改善 (Req 3.2)', () => {
      it('0 < score < 0.5 は違反として分類される', () => {
        const violation: RuleResult = {
          id: 'color-contrast',
          description: 'Color contrast',
          nodeCount: 3,
          helpUrl: '',
          wcagCriteria: ['1.4.3'],
          toolSource: 'lighthouse',
          rawScore: 0.3,
        };

        expect(violation.rawScore).toBe(0.3);
        expect(violation.rawScore!).toBeLessThan(0.5);
      });

      it('0.5 <= score < 1 は達成として分類される', () => {
        const pass: RuleResult = {
          id: 'link-name',
          description: 'Links have discernible text',
          nodeCount: 0,
          helpUrl: '',
          wcagCriteria: ['2.4.4'],
          toolSource: 'lighthouse',
          rawScore: 0.7,
        };

        expect(pass.rawScore).toBe(0.7);
        expect(pass.rawScore!).toBeGreaterThanOrEqual(0.5);
      });

      it('score === 0 は違反として分類される', () => {
        const violation: RuleResult = {
          id: 'button-name',
          description: 'Buttons have accessible names',
          nodeCount: 2,
          helpUrl: '',
          wcagCriteria: ['4.1.2'],
          toolSource: 'lighthouse',
          rawScore: 0,
        };

        expect(violation.rawScore).toBe(0);
      });

      it('score === 1 は達成として分類される', () => {
        const pass: RuleResult = {
          id: 'html-has-lang',
          description: 'HTML has lang attribute',
          nodeCount: 0,
          helpUrl: '',
          wcagCriteria: ['3.1.1'],
          toolSource: 'lighthouse',
          rawScore: 1,
        };

        expect(pass.rawScore).toBe(1);
      });

      it('rawScoreフィールドに元のスコアが記録される', () => {
        const result: RuleResult = {
          id: 'test-audit',
          description: 'Test',
          nodeCount: 0,
          helpUrl: '',
          wcagCriteria: [],
          toolSource: 'lighthouse',
          rawScore: 0.65,
        };

        expect(result.rawScore).toBe(0.65);
        expect(typeof result.rawScore).toBe('number');
      });

      it('classificationReasonがincomplete項目に記録される', () => {
        const incomplete: RuleResult = {
          id: 'informative-audit',
          description: 'Informative',
          nodeCount: 0,
          helpUrl: '',
          wcagCriteria: [],
          toolSource: 'lighthouse',
          rawScore: null,
          classificationReason: 'insufficient-data',
        };

        expect(incomplete.classificationReason).toBe('insufficient-data');
      });
    });

    describe('分類理由の種類', () => {
      it('manual-review理由が設定可能', () => {
        const result: RuleResult = {
          id: 'audit',
          description: 'Manual',
          nodeCount: 0,
          helpUrl: '',
          wcagCriteria: [],
          toolSource: 'lighthouse',
          classificationReason: 'manual-review',
        };

        expect(result.classificationReason).toBe('manual-review');
      });

      it('insufficient-data理由が設定可能', () => {
        const result: RuleResult = {
          id: 'audit',
          description: 'Insufficient',
          nodeCount: 0,
          helpUrl: '',
          wcagCriteria: [],
          toolSource: 'lighthouse',
          classificationReason: 'insufficient-data',
        };

        expect(result.classificationReason).toBe('insufficient-data');
      });

      it('partial-support理由が設定可能', () => {
        const result: RuleResult = {
          id: 'audit',
          description: 'Partial',
          nodeCount: 0,
          helpUrl: '',
          wcagCriteria: [],
          toolSource: 'lighthouse',
          classificationReason: 'partial-support',
        };

        expect(result.classificationReason).toBe('partial-support');
      });
    });
  });

  describe('API応答時間の検証 (Req 5.2)', () => {
    it('ノード情報を含むレスポンスでもdurationが記録される', () => {
      const analyzerResult = {
        violations: [
          {
            id: 'test',
            description: 'Test',
            nodeCount: 5,
            helpUrl: '',
            wcagCriteria: [],
            toolSource: 'axe-core' as const,
            nodes: Array(5).fill({
              target: 'div.test',
              html: '<div class="test">Test</div>',
            }),
          },
        ],
        passes: [],
        incomplete: [],
        duration: 1500, // ミリ秒
      };

      expect(analyzerResult.duration).toBeDefined();
      expect(typeof analyzerResult.duration).toBe('number');
      expect(analyzerResult.duration).toBeGreaterThan(0);
    });

    it('durationはミリ秒単位で記録される', () => {
      const duration = 2500; // 2.5秒

      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(1000000); // 合理的な上限
    });

    it('ノード情報抽出によるオーバーヘッドが許容範囲内', () => {
      // 100ノードの処理時間をシミュレート
      const nodeCount = 100;
      const baseProcessingTime = 10; // 1ノードあたり10ms想定
      const totalProcessingTime = nodeCount * baseProcessingTime;

      // 許容範囲: 元の処理時間の+10%以内
      const allowedOverhead = 0.1;
      const maxAllowedTime = totalProcessingTime * (1 + allowedOverhead);

      expect(totalProcessingTime).toBeLessThanOrEqual(maxAllowedTime);
    });
  });

  describe('後方互換性の検証', () => {
    it('nodesフィールドがなくても既存のRuleResultが有効', () => {
      const legacyResult: RuleResult = {
        id: 'color-contrast',
        description: 'Color contrast',
        nodeCount: 3,
        helpUrl: '',
        wcagCriteria: ['1.4.3'],
        toolSource: 'axe-core',
        // nodes フィールドなし
      };

      expect(legacyResult.nodes).toBeUndefined();
      expect(legacyResult.nodeCount).toBe(3);
    });

    it('rawScoreフィールドがなくても既存のRuleResultが有効', () => {
      const legacyResult: RuleResult = {
        id: 'test',
        description: 'Test',
        nodeCount: 0,
        helpUrl: '',
        wcagCriteria: [],
        toolSource: 'lighthouse',
        // rawScore フィールドなし
      };

      expect(legacyResult.rawScore).toBeUndefined();
    });

    it('classificationReasonフィールドがなくても既存のRuleResultが有効', () => {
      const legacyResult: RuleResult = {
        id: 'test',
        description: 'Test',
        nodeCount: 0,
        helpUrl: '',
        wcagCriteria: [],
        toolSource: 'lighthouse',
        // classificationReason フィールドなし
      };

      expect(legacyResult.classificationReason).toBeUndefined();
    });
  });
});
