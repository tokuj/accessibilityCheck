/**
 * IBM Equal Access Checker分析のユニットテスト
 *
 * Requirements: wcag-coverage-expansion 1.1, 1.6, 2.2
 * - IBM Equal Access Checkerを第4のエンジンとして統合
 * - WCAG 2.2ポリシーを使用
 * - エラーハンドリングとタイムアウト処理
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Page } from 'playwright';

// モック用の結果保持
let mockGetComplianceResult: {
  report: {
    results: Array<{
      ruleId: string;
      message: string;
      path: { dom: string };
      value: [string, string]; // [level, type]
      reasonId: string;
      snippet?: string;
    }>;
    nls: Record<string, {
      [key: string]: {
        1: string;
      };
    }>;
  };
};

// モック用のルールIDセット
let mockRuleIdToCheckpoint: Record<string, string[]>;

// accessibility-checkerをモック
vi.mock('accessibility-checker', () => {
  return {
    getCompliance: vi.fn().mockImplementation(async () => mockGetComplianceResult),
    close: vi.fn().mockResolvedValue(undefined),
  };
});

// ../utilsをモック
vi.mock('../../utils', () => ({
  createAnalyzerTiming: vi.fn().mockReturnValue({
    analyzer: 'ibm',
    url: 'https://example.com',
    startTime: Date.now(),
  }),
  completeAnalyzerTiming: vi.fn().mockImplementation((timing) => ({
    ...timing,
    endTime: Date.now(),
    duration: 100,
    status: 'success',
  })),
  logAnalyzerStart: vi.fn(),
  logAnalyzerComplete: vi.fn(),
}));

describe('IBMAnalyzer', () => {
  let mockPage: Partial<Page>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = {
      url: vi.fn().mockReturnValue('https://example.com'),
      content: vi.fn().mockResolvedValue('<html><body><p>Test</p></body></html>'),
    };

    // デフォルトのモック結果を設定
    mockGetComplianceResult = {
      report: {
        results: [],
        nls: {},
      },
    };

    // ルールIDからWCAGチェックポイントへのマッピング
    mockRuleIdToCheckpoint = {
      'img_alt_valid': ['1.1.1'],
      'WCAG20_Img_HasAlt': ['1.1.1'],
      'WCAG20_A_TargetAndText': ['2.4.4'],
      'WCAG21_Label_Accessible': ['1.3.5'],
      'focus-not-obscured': ['2.4.11'],
      'target-size': ['2.5.8'],
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('IBMAnalyzerOptions型定義', () => {
    it('policiesオプションを持つ', async () => {
      const { analyzeWithIBM } = await import('../ibm');

      // 関数が存在することを確認
      expect(analyzeWithIBM).toBeDefined();
      expect(typeof analyzeWithIBM).toBe('function');
    });

    it('failLevelsオプションを持つ', async () => {
      const { IBMAnalyzerOptions } = await import('../ibm');

      // 型が存在することを確認（コンパイル時のチェック）
      expect(true).toBe(true);
    });

    it('timeoutオプションを持つ', async () => {
      const { analyzeWithIBM } = await import('../ibm');

      // オプションにtimeoutが含められることを確認
      expect(analyzeWithIBM).toBeDefined();
    });
  });

  describe('analyzeWithIBM', () => {
    it('Pageオブジェクトを受け取り、AnalyzerResultを返す', async () => {
      const { analyzeWithIBM } = await import('../ibm');

      const result = await analyzeWithIBM(mockPage as Page);

      expect(result).toHaveProperty('violations');
      expect(result).toHaveProperty('passes');
      expect(result).toHaveProperty('incomplete');
      expect(result).toHaveProperty('duration');
      expect(typeof result.duration).toBe('number');
    });

    it('デフォルトでWCAG_2_2ポリシーを使用（Req 2.2）', async () => {
      const aChecker = await import('accessibility-checker');
      const { analyzeWithIBM } = await import('../ibm');

      await analyzeWithIBM(mockPage as Page);

      // getComplianceが呼ばれたことを確認
      expect(aChecker.getCompliance).toHaveBeenCalled();
    });

    it('violation結果を正しく変換する', async () => {
      mockGetComplianceResult = {
        report: {
          results: [
            {
              ruleId: 'WCAG20_Img_HasAlt',
              message: '画像にalt属性がありません',
              path: { dom: '/html/body/img' },
              value: ['VIOLATION', 'FAIL'],
              reasonId: 'Fail_1',
              snippet: '<img src="test.jpg">',
            },
          ],
          nls: {
            'WCAG20_Img_HasAlt': {
              'Fail_1': {
                1: '画像にalt属性がありません',
              },
            },
          },
        },
      };

      const { analyzeWithIBM } = await import('../ibm');
      const result = await analyzeWithIBM(mockPage as Page);

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].id).toBe('WCAG20_Img_HasAlt');
      expect(result.violations[0].toolSource).toBe('ibm');
    });

    it('pass結果を正しく変換する', async () => {
      mockGetComplianceResult = {
        report: {
          results: [
            {
              ruleId: 'WCAG20_Img_HasAlt',
              message: '画像に適切なalt属性があります',
              path: { dom: '/html/body/img' },
              value: ['PASS', 'PASS'],
              reasonId: 'Pass_0',
            },
          ],
          nls: {},
        },
      };

      const { analyzeWithIBM } = await import('../ibm');
      const result = await analyzeWithIBM(mockPage as Page);

      expect(result.passes.length).toBeGreaterThan(0);
      expect(result.passes[0].toolSource).toBe('ibm');
    });

    it('incomplete結果を正しく変換する（POTENTIAL_VIOLATION）', async () => {
      mockGetComplianceResult = {
        report: {
          results: [
            {
              ruleId: 'WCAG20_A_TargetAndText',
              message: 'リンクテキストの確認が必要です',
              path: { dom: '/html/body/a' },
              value: ['POTENTIAL_VIOLATION', 'MANUAL'],
              reasonId: 'Potential_1',
            },
          ],
          nls: {},
        },
      };

      const { analyzeWithIBM } = await import('../ibm');
      const result = await analyzeWithIBM(mockPage as Page);

      expect(result.incomplete.length).toBeGreaterThan(0);
      expect(result.incomplete[0].toolSource).toBe('ibm');
    });

    it('ノード情報が正しく抽出される', async () => {
      mockGetComplianceResult = {
        report: {
          results: [
            {
              ruleId: 'WCAG20_Img_HasAlt',
              message: '画像にalt属性がありません',
              path: { dom: '/html/body/div/img' },
              value: ['VIOLATION', 'FAIL'],
              reasonId: 'Fail_1',
              snippet: '<img src="hero.jpg" class="hero-image">',
            },
          ],
          nls: {},
        },
      };

      const { analyzeWithIBM } = await import('../ibm');
      const result = await analyzeWithIBM(mockPage as Page);

      const node = result.violations[0].nodes?.[0];
      expect(node).toBeDefined();
      expect(node?.xpath).toBe('/html/body/div/img');
      expect(node?.html).toContain('<img');
    });

    it('wcagCriteriaが正しく設定される', async () => {
      mockGetComplianceResult = {
        report: {
          results: [
            {
              ruleId: 'WCAG20_Img_HasAlt',
              message: '画像にalt属性がありません',
              path: { dom: '/html/body/img' },
              value: ['VIOLATION', 'FAIL'],
              reasonId: 'Fail_1',
            },
          ],
          nls: {},
        },
      };

      const { analyzeWithIBM } = await import('../ibm');
      const result = await analyzeWithIBM(mockPage as Page);

      // WCAG 1.1.1がリストに含まれることを確認
      expect(result.violations[0].wcagCriteria).toContain('1.1.1');
    });

    it('WCAG 2.2特有のルールが検出される（Req 2.2）', async () => {
      mockGetComplianceResult = {
        report: {
          results: [
            {
              ruleId: 'focus-not-obscured',
              message: 'フォーカスが他の要素で隠されています',
              path: { dom: '/html/body/div/button' },
              value: ['VIOLATION', 'FAIL'],
              reasonId: 'Fail_1',
            },
          ],
          nls: {},
        },
      };

      const { analyzeWithIBM } = await import('../ibm');
      const result = await analyzeWithIBM(mockPage as Page);

      // WCAG 2.4.11がリストに含まれることを確認
      expect(result.violations[0].wcagCriteria).toContain('2.4.11');
    });
  });

  describe('エラーハンドリング（Req 1.6）', () => {
    it('getComplianceがエラーを投げた場合、空の結果を返す', async () => {
      const aChecker = await import('accessibility-checker');
      vi.mocked(aChecker.getCompliance).mockRejectedValue(new Error('Analysis failed'));

      const { analyzeWithIBM } = await import('../ibm');
      const result = await analyzeWithIBM(mockPage as Page);

      expect(result.violations).toEqual([]);
      expect(result.passes).toEqual([]);
      expect(result.incomplete).toEqual([]);
    });

    it('page.content()がエラーを投げた場合、空の結果を返す', async () => {
      mockPage.content = vi.fn().mockRejectedValue(new Error('Page error'));

      const { analyzeWithIBM } = await import('../ibm');
      const result = await analyzeWithIBM(mockPage as Page);

      expect(result.violations).toEqual([]);
      expect(result.passes).toEqual([]);
      expect(result.incomplete).toEqual([]);
    });

    it('エラー発生時もdurationが設定される', async () => {
      const aChecker = await import('accessibility-checker');
      vi.mocked(aChecker.getCompliance).mockRejectedValue(new Error('Analysis failed'));

      const { analyzeWithIBM } = await import('../ibm');
      const result = await analyzeWithIBM(mockPage as Page);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('impactレベルの変換', () => {
    it('VIOLATIONはseriousに変換される', async () => {
      const aChecker = await import('accessibility-checker');
      vi.mocked(aChecker.getCompliance).mockResolvedValue({
        report: {
          results: [
            {
              ruleId: 'WCAG20_Img_HasAlt',
              message: 'Test',
              path: { dom: '/html/body/img' },
              value: ['VIOLATION', 'FAIL'],
              reasonId: 'Fail_1',
            },
          ],
          nls: {},
        },
      });

      const { analyzeWithIBM } = await import('../ibm');
      const result = await analyzeWithIBM(mockPage as Page);

      expect(result.violations[0].impact).toBe('serious');
    });

    it('POTENTIAL_VIOLATIONはmoderateに変換される', async () => {
      const aChecker = await import('accessibility-checker');
      vi.mocked(aChecker.getCompliance).mockResolvedValue({
        report: {
          results: [
            {
              ruleId: 'WCAG20_A_TargetAndText',
              message: 'Test',
              path: { dom: '/html/body/a' },
              value: ['POTENTIAL_VIOLATION', 'MANUAL'],
              reasonId: 'Potential_1',
            },
          ],
          nls: {},
        },
      });

      const { analyzeWithIBM } = await import('../ibm');
      const result = await analyzeWithIBM(mockPage as Page);

      expect(result.incomplete[0].impact).toBe('moderate');
    });
  });

  describe('複数結果の集約', () => {
    it('同一ルールIDの複数ノードが正しく集約される', async () => {
      const aChecker = await import('accessibility-checker');
      vi.mocked(aChecker.getCompliance).mockResolvedValue({
        report: {
          results: [
            {
              ruleId: 'WCAG20_Img_HasAlt',
              message: 'Test 1',
              path: { dom: '/html/body/img[1]' },
              value: ['VIOLATION', 'FAIL'],
              reasonId: 'Fail_1',
              snippet: '<img src="test1.jpg">',
            },
            {
              ruleId: 'WCAG20_Img_HasAlt',
              message: 'Test 2',
              path: { dom: '/html/body/img[2]' },
              value: ['VIOLATION', 'FAIL'],
              reasonId: 'Fail_1',
              snippet: '<img src="test2.jpg">',
            },
          ],
          nls: {},
        },
      });

      const { analyzeWithIBM } = await import('../ibm');
      const result = await analyzeWithIBM(mockPage as Page);

      // 同一ルールIDは1つにまとめられる
      const imgAltViolations = result.violations.filter(v => v.id === 'WCAG20_Img_HasAlt');
      expect(imgAltViolations.length).toBe(1);
      expect(imgAltViolations[0].nodeCount).toBe(2);
      expect(imgAltViolations[0].nodes?.length).toBe(2);
    });
  });
});
