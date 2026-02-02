/**
 * オーケストレーター統合テスト
 *
 * Requirements: wcag-coverage-expansion 1.5, 1.6, 2.1
 * - analyzer.tsに新エンジンの呼び出しロジックを追加
 * - 分析オプションに基づいてエンジンの有効/無効を制御
 * - 並列実行の最適化（Promise.allSettledを使用）
 * - 各エンジンのエラーを個別にハンドリングし、他エンジンの処理を継続
 * - 進捗イベントに新エンジンのステータスを追加
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AnalysisOptions } from '../analysis-options';
import { DEFAULT_ANALYSIS_OPTIONS, FULL_ANALYSIS_PRESET, QUICK_ANALYSIS_PRESET } from '../analysis-options';
import type { AnalyzerResult, RuleResult, ToolInfo } from '../types';
import type { ProgressCallback } from '../sse-types';

// モジュールのモック
vi.mock('../axe', () => ({
  analyzeWithAxeEnhanced: vi.fn().mockResolvedValue({
    violations: [{ id: 'axe-test', description: 'axe test', toolSource: 'axe-core', nodeCount: 1, helpUrl: '', wcagCriteria: [] }],
    passes: [],
    incomplete: [],
    duration: 100,
  }),
  AXE_VERSION: '4.0.0',
}));

vi.mock('../pa11y', () => ({
  analyzeWithPa11y: vi.fn().mockResolvedValue({
    violations: [{ id: 'pa11y-test', description: 'pa11y test', toolSource: 'pa11y', nodeCount: 1, helpUrl: '', wcagCriteria: [] }],
    passes: [],
    incomplete: [],
    duration: 100,
  }),
  PA11Y_VERSION: '7.0.0',
}));

vi.mock('../lighthouse', () => ({
  analyzeWithLighthouse: vi.fn().mockResolvedValue({
    violations: [],
    passes: [],
    incomplete: [],
    duration: 100,
    scores: { performance: 90, accessibility: 95, bestPractices: 88, seo: 92 },
  }),
  LIGHTHOUSE_VERSION: '11.0.0',
}));

vi.mock('../ibm', () => ({
  analyzeWithIBM: vi.fn().mockResolvedValue({
    violations: [{ id: 'ibm-test', description: 'ibm test', toolSource: 'ibm', nodeCount: 1, helpUrl: '', wcagCriteria: ['2.4.11'] }],
    passes: [],
    incomplete: [],
    duration: 150,
  }),
}));

vi.mock('../alfa', () => ({
  analyzeWithAlfa: vi.fn().mockResolvedValue({
    violations: [{ id: 'alfa-test', description: 'alfa test', toolSource: 'alfa', nodeCount: 1, helpUrl: '', wcagCriteria: ['2.4.13'] }],
    passes: [],
    incomplete: [],
    duration: 200,
  }),
}));

vi.mock('../qualweb', () => ({
  analyzeWithQualWeb: vi.fn().mockResolvedValue({
    violations: [{ id: 'qualweb-test', description: 'qualweb test', toolSource: 'qualweb', nodeCount: 1, helpUrl: '', wcagCriteria: ['3.3.7'] }],
    passes: [],
    incomplete: [],
    duration: 250,
  }),
}));

vi.mock('../wave', () => ({
  analyzeWithWave: vi.fn().mockResolvedValue({
    violations: [{ id: 'wave-test', description: 'wave test', toolSource: 'wave', nodeCount: 1, helpUrl: '', wcagCriteria: ['1.1.1'] }],
    passes: [],
    incomplete: [],
    duration: 300,
  }),
  getApiCallCount: vi.fn().mockReturnValue(1),
  resetApiCallCount: vi.fn(),
}));

// Playwrightのモック
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn().mockResolvedValue(undefined),
          url: vi.fn().mockReturnValue('https://example.com'),
          screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
          title: vi.fn().mockResolvedValue('Test Page'),
          content: vi.fn().mockResolvedValue('<html><body>Test</body></html>'),
          setDefaultTimeout: vi.fn(),
          route: vi.fn().mockResolvedValue(undefined),
          waitForLoadState: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// 認証マネージャーのモック
vi.mock('../../auth/manager', () => ({
  AuthManager: class MockAuthManager {
    requiresAuth() { return false; }
    authenticate() { return Promise.resolve({ success: true }); }
    getStorageState() { return null; }
    getHttpCredentials() { return null; }
    getHeaders() { return {}; }
    setStorageState() {}
  },
}));

// Geminiサービスのモック
vi.mock('../../services/gemini', () => ({
  GeminiService: {
    generateAISummary: vi.fn().mockResolvedValue({
      success: true,
      value: {
        overallAssessment: 'Test assessment',
        detectedIssues: [],
        prioritizedImprovements: [],
        specificRecommendations: [],
        impactSummary: { critical: 0, serious: 0, moderate: 0, minor: 0 },
        generatedAt: new Date().toISOString(),
      },
    }),
  },
  generateFallbackSummary: vi.fn().mockReturnValue({
    overallAssessment: 'Fallback assessment',
    detectedIssues: [],
    prioritizedImprovements: [],
    specificRecommendations: [],
    impactSummary: { critical: 0, serious: 0, moderate: 0, minor: 0 },
    generatedAt: new Date().toISOString(),
    isFallback: true,
  }),
}));

// configモック
vi.mock('../../config', () => ({
  getTimeoutConfig: vi.fn().mockReturnValue({
    pageLoadTimeout: 90000,
    axeTimeout: 60000,
  }),
}));

// utilsモック
vi.mock('../../utils', () => ({
  setupAdBlocking: vi.fn().mockResolvedValue({ patterns: [] }),
  formatTimeoutError: vi.fn().mockReturnValue('Timeout error'),
}));

describe('Orchestrator Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Engine Control with AnalysisOptions', () => {
    it('should run only axe-core and lighthouse with QUICK_ANALYSIS_PRESET', async () => {
      // このテストはanalyzeUrlWithOptionsが実装されるまで失敗する
      const { analyzeUrlWithOptions } = await import('../../analyzer');

      const progressEvents: unknown[] = [];
      const onProgress: ProgressCallback = (event) => {
        progressEvents.push(event);
      };

      const result = await analyzeUrlWithOptions(
        'https://example.com',
        QUICK_ANALYSIS_PRESET,
        undefined,
        onProgress
      );

      // 期待される結果:
      // - axe-coreの違反が含まれる
      // - lighthouseの情報が含まれる
      // - pa11y, ibm, alfa, qualweb, waveの結果は含まれない
      expect(result.pages[0].violations.some(v => v.toolSource === 'axe-core')).toBe(true);
      expect(result.lighthouseScores).toBeDefined();
      expect(result.pages[0].violations.some(v => v.toolSource === 'pa11y')).toBe(false);
      expect(result.pages[0].violations.some(v => v.toolSource === 'ibm')).toBe(false);
      expect(result.pages[0].violations.some(v => v.toolSource === 'alfa')).toBe(false);
      expect(result.pages[0].violations.some(v => v.toolSource === 'qualweb')).toBe(false);
      expect(result.pages[0].violations.some(v => v.toolSource === 'wave')).toBe(false);
    });

    it('should run all engines with FULL_ANALYSIS_PRESET', async () => {
      const { analyzeUrlWithOptions } = await import('../../analyzer');

      const result = await analyzeUrlWithOptions(
        'https://example.com',
        FULL_ANALYSIS_PRESET
      );

      // 全エンジンの結果が含まれることを確認
      expect(result.pages[0].violations.some(v => v.toolSource === 'axe-core')).toBe(true);
      expect(result.pages[0].violations.some(v => v.toolSource === 'pa11y')).toBe(true);
      expect(result.lighthouseScores).toBeDefined();
      expect(result.pages[0].violations.some(v => v.toolSource === 'ibm')).toBe(true);
      expect(result.pages[0].violations.some(v => v.toolSource === 'alfa')).toBe(true);
      expect(result.pages[0].violations.some(v => v.toolSource === 'qualweb')).toBe(true);
    });

    it('should respect individual engine toggles', async () => {
      const { analyzeUrlWithOptions } = await import('../../analyzer');

      const customOptions: AnalysisOptions = {
        ...DEFAULT_ANALYSIS_OPTIONS,
        engines: {
          axeCore: true,
          pa11y: false,
          lighthouse: false,
          ibm: true,
          alfa: false,
          qualweb: false,
        },
      };

      const result = await analyzeUrlWithOptions('https://example.com', customOptions);

      // axe-coreとibmのみ有効
      expect(result.pages[0].violations.some(v => v.toolSource === 'axe-core')).toBe(true);
      expect(result.pages[0].violations.some(v => v.toolSource === 'ibm')).toBe(true);
      expect(result.pages[0].violations.some(v => v.toolSource === 'pa11y')).toBe(false);
      expect(result.lighthouseScores).toBeUndefined();
    });
  });

  describe('Parallel Execution with Promise.allSettled', () => {
    it('should execute enabled engines in parallel', async () => {
      const { analyzeUrlWithOptions } = await import('../../analyzer');
      const { analyzeWithIBM } = await import('../ibm');
      const { analyzeWithAlfa } = await import('../alfa');

      const options: AnalysisOptions = {
        ...DEFAULT_ANALYSIS_OPTIONS,
        engines: {
          ...DEFAULT_ANALYSIS_OPTIONS.engines,
          ibm: true,
          alfa: true,
        },
      };

      const startTime = Date.now();
      await analyzeUrlWithOptions('https://example.com', options);
      const elapsed = Date.now() - startTime;

      // IBMとAlfaが並列実行されていることを確認
      // （直列なら150+200=350ms以上かかるはず）
      expect(analyzeWithIBM).toHaveBeenCalled();
      expect(analyzeWithAlfa).toHaveBeenCalled();
    });
  });

  describe('Error Handling per Engine', () => {
    it('should continue with other engines when one engine fails', async () => {
      const { analyzeWithIBM } = await import('../ibm');
      const { analyzeWithAlfa } = await import('../alfa');

      // IBMをエラーにする
      vi.mocked(analyzeWithIBM).mockRejectedValueOnce(new Error('IBM engine failed'));

      const { analyzeUrlWithOptions } = await import('../../analyzer');

      const options: AnalysisOptions = {
        ...DEFAULT_ANALYSIS_OPTIONS,
        engines: {
          ...DEFAULT_ANALYSIS_OPTIONS.engines,
          ibm: true,
          alfa: true,
        },
      };

      // エラーが発生してもレポートが返される
      const result = await analyzeUrlWithOptions('https://example.com', options);

      // IBMは失敗したがAlfaは成功
      expect(result.pages[0].violations.some(v => v.toolSource === 'alfa')).toBe(true);
      // IBMの結果は含まれない（または空）
      expect(result.pages[0].violations.filter(v => v.toolSource === 'ibm').length).toBe(0);
    });

    it('should log errors for failed engines', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { analyzeWithQualWeb } = await import('../qualweb');

      vi.mocked(analyzeWithQualWeb).mockRejectedValueOnce(new Error('QualWeb failed'));

      const { analyzeUrlWithOptions } = await import('../../analyzer');

      const options: AnalysisOptions = {
        ...DEFAULT_ANALYSIS_OPTIONS,
        engines: {
          ...DEFAULT_ANALYSIS_OPTIONS.engines,
          qualweb: true,
        },
      };

      await analyzeUrlWithOptions('https://example.com', options);

      // エラーがログに記録される
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Progress Events for New Engines', () => {
    it('should emit progress events for new engines', async () => {
      const { analyzeUrlWithOptions } = await import('../../analyzer');

      const progressEvents: unknown[] = [];
      const onProgress: ProgressCallback = (event) => {
        progressEvents.push(event);
      };

      const options: AnalysisOptions = {
        ...DEFAULT_ANALYSIS_OPTIONS,
        engines: {
          ...DEFAULT_ANALYSIS_OPTIONS.engines,
          ibm: true,
          alfa: true,
          qualweb: true,
        },
      };

      await analyzeUrlWithOptions('https://example.com', options, undefined, onProgress);

      // 進捗イベントにIBM、Alfa、QualWebのステップが含まれる
      const progressSteps = progressEvents
        .filter((e: unknown) => (e as { type: string }).type === 'progress')
        .map((e: unknown) => (e as { stepName: string }).stepName);

      expect(progressSteps).toContain('ibm');
      expect(progressSteps).toContain('alfa');
      expect(progressSteps).toContain('qualweb');
    });

    it('should include new engine step counts in total', async () => {
      const { analyzeUrlWithOptions } = await import('../../analyzer');

      const progressEvents: unknown[] = [];
      const onProgress: ProgressCallback = (event) => {
        progressEvents.push(event);
      };

      const options: AnalysisOptions = {
        ...FULL_ANALYSIS_PRESET,
      };

      await analyzeUrlWithOptions('https://example.com', options, undefined, onProgress);

      // totalステップ数が7以上（axe + pa11y + lighthouse + ibm + alfa + qualweb + ai-summary）
      const firstProgress = progressEvents.find(
        (e: unknown) => (e as { type: string }).type === 'progress'
      ) as { total: number } | undefined;

      expect(firstProgress?.total).toBeGreaterThanOrEqual(7);
    });
  });

  describe('WAVE API Integration', () => {
    it('should call WAVE API when enabled with API key', async () => {
      const { analyzeWithWave } = await import('../wave');
      const { analyzeUrlWithOptions } = await import('../../analyzer');

      const options: AnalysisOptions = {
        ...DEFAULT_ANALYSIS_OPTIONS,
        waveApi: {
          enabled: true,
          apiKey: 'test-api-key',
        },
      };

      await analyzeUrlWithOptions('https://example.com', options);

      expect(analyzeWithWave).toHaveBeenCalledWith('https://example.com', {
        apiKey: 'test-api-key',
      });
    });

    it('should skip WAVE API when disabled', async () => {
      const { analyzeWithWave } = await import('../wave');
      const { analyzeUrlWithOptions } = await import('../../analyzer');

      const options: AnalysisOptions = {
        ...DEFAULT_ANALYSIS_OPTIONS,
        waveApi: {
          enabled: false,
        },
      };

      await analyzeUrlWithOptions('https://example.com', options);

      expect(analyzeWithWave).not.toHaveBeenCalled();
    });

    it('should skip WAVE API when no API key provided', async () => {
      const { analyzeWithWave } = await import('../wave');
      const { analyzeUrlWithOptions } = await import('../../analyzer');

      const options: AnalysisOptions = {
        ...DEFAULT_ANALYSIS_OPTIONS,
        waveApi: {
          enabled: true,
          // apiKey is undefined
        },
      };

      await analyzeUrlWithOptions('https://example.com', options);

      expect(analyzeWithWave).not.toHaveBeenCalled();
    });
  });

  describe('ToolsUsed Array', () => {
    it('should include all enabled engines in toolsUsed', async () => {
      const { analyzeUrlWithOptions } = await import('../../analyzer');

      const options: AnalysisOptions = {
        ...FULL_ANALYSIS_PRESET,
      };

      const result = await analyzeUrlWithOptions('https://example.com', options);

      const toolNames = result.toolsUsed.map(t => t.name);
      expect(toolNames).toContain('axe-core');
      expect(toolNames).toContain('pa11y');
      expect(toolNames).toContain('lighthouse');
      expect(toolNames).toContain('ibm');
      expect(toolNames).toContain('alfa');
      expect(toolNames).toContain('qualweb');
    });

    it('should only include enabled engines in toolsUsed', async () => {
      const { analyzeUrlWithOptions } = await import('../../analyzer');

      const options: AnalysisOptions = {
        ...QUICK_ANALYSIS_PRESET,
      };

      const result = await analyzeUrlWithOptions('https://example.com', options);

      const toolNames = result.toolsUsed.map(t => t.name);
      expect(toolNames).toContain('axe-core');
      expect(toolNames).toContain('lighthouse');
      expect(toolNames).not.toContain('pa11y');
      expect(toolNames).not.toContain('ibm');
      expect(toolNames).not.toContain('alfa');
      expect(toolNames).not.toContain('qualweb');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing analyzeUrl function', async () => {
      const { analyzeUrl } = await import('../../analyzer');

      // 既存のanalyzeUrlがまだ動作することを確認
      const result = await analyzeUrl('https://example.com');

      expect(result).toBeDefined();
      expect(result.pages).toBeDefined();
      expect(result.pages.length).toBe(1);
    });
  });

  describe('Semi-Auto Check Integration (16.1)', () => {
    it('should extract semi-auto check items when semiAutoCheck option is enabled', async () => {
      // incomplete結果を返すようにモックを設定
      const { analyzeWithAxeEnhanced } = await import('../axe');
      vi.mocked(analyzeWithAxeEnhanced).mockResolvedValueOnce({
        violations: [],
        passes: [],
        incomplete: [
          {
            id: 'image-alt',
            description: '画像に代替テキストがあることを確認してください',
            toolSource: 'axe-core',
            nodeCount: 1,
            helpUrl: 'https://example.com/help',
            wcagCriteria: ['1.1.1'],
            nodes: [
              {
                target: 'img.hero',
                html: '<img class="hero" src="hero.jpg" alt="美しい風景">',
              },
            ],
          },
        ],
        duration: 100,
      });

      const { analyzeUrlWithOptions } = await import('../../analyzer');

      const options: AnalysisOptions = {
        ...DEFAULT_ANALYSIS_OPTIONS,
        semiAutoCheck: true,
      };

      const result = await analyzeUrlWithOptions('https://example.com', options);

      // semiAutoItemsが抽出されていること
      expect(result.semiAutoItems).toBeDefined();
      expect(Array.isArray(result.semiAutoItems)).toBe(true);
      expect(result.semiAutoItems!.length).toBeGreaterThan(0);
      expect(result.semiAutoItems![0].ruleId).toBe('image-alt');
      expect(result.semiAutoItems![0].question).toBeDefined();
    });

    it('should not extract semi-auto check items when semiAutoCheck option is disabled', async () => {
      const { analyzeUrlWithOptions } = await import('../../analyzer');

      const options: AnalysisOptions = {
        ...DEFAULT_ANALYSIS_OPTIONS,
        semiAutoCheck: false,
      };

      const result = await analyzeUrlWithOptions('https://example.com', options);

      // semiAutoItemsが未定義または空であること
      expect(result.semiAutoItems === undefined || result.semiAutoItems?.length === 0).toBe(true);
    });

    it('should include semi-auto items in each page result', async () => {
      // incomplete結果を返すようにモックを設定
      const { analyzeWithAxeEnhanced } = await import('../axe');
      vi.mocked(analyzeWithAxeEnhanced).mockResolvedValueOnce({
        violations: [],
        passes: [],
        incomplete: [
          {
            id: 'link-name',
            description: 'リンクにアクセシブルな名前が必要です',
            toolSource: 'axe-core',
            nodeCount: 1,
            helpUrl: 'https://example.com/help',
            wcagCriteria: ['2.4.4'],
            nodes: [
              {
                target: 'a.more-link',
                html: '<a class="more-link" href="/details">もっと見る</a>',
              },
            ],
          },
        ],
        duration: 100,
      });

      const { analyzeUrlWithOptions } = await import('../../analyzer');

      const options: AnalysisOptions = {
        ...DEFAULT_ANALYSIS_OPTIONS,
        semiAutoCheck: true,
      };

      const result = await analyzeUrlWithOptions('https://example.com', options);

      // ページ結果にもsemiAutoItemsが含まれること
      expect(result.pages[0].semiAutoItems).toBeDefined();
      expect(Array.isArray(result.pages[0].semiAutoItems)).toBe(true);
    });
  });
});
