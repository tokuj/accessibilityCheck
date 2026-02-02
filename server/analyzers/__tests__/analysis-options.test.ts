/**
 * 分析オプション型のユニットテスト
 *
 * Requirements: wcag-coverage-expansion 8.1, 8.2, 8.3, 8.4
 * - エンジン選択オプション
 * - WCAGバージョン選択
 * - 半自動チェック設定
 * - レスポンシブテスト設定
 * - プリセット定義
 */
import { describe, it, expect } from 'vitest';
import type { AnalysisOptions, EngineOptions, WaveApiOptions } from '../analysis-options';
import {
  DEFAULT_ANALYSIS_OPTIONS,
  QUICK_ANALYSIS_PRESET,
  FULL_ANALYSIS_PRESET,
} from '../analysis-options';

describe('EngineOptions型', () => {
  it('全てのエンジンの有効/無効を設定できる', () => {
    const engines: EngineOptions = {
      axeCore: true,
      pa11y: true,
      lighthouse: true,
      ibm: false,
      alfa: false,
      qualweb: false,
    };

    expect(engines.axeCore).toBe(true);
    expect(engines.pa11y).toBe(true);
    expect(engines.lighthouse).toBe(true);
    expect(engines.ibm).toBe(false);
    expect(engines.alfa).toBe(false);
    expect(engines.qualweb).toBe(false);
  });
});

describe('WaveApiOptions型', () => {
  it('enabledフラグとapiKeyを持つ', () => {
    const waveApi: WaveApiOptions = {
      enabled: true,
      apiKey: 'test-api-key-12345',
    };

    expect(waveApi.enabled).toBe(true);
    expect(waveApi.apiKey).toBe('test-api-key-12345');
  });

  it('apiKeyはオプショナルである', () => {
    const waveApi: WaveApiOptions = {
      enabled: false,
    };

    expect(waveApi.enabled).toBe(false);
    expect(waveApi.apiKey).toBeUndefined();
  });
});

describe('AnalysisOptions型', () => {
  describe('エンジン選択オプション (Req 8.2)', () => {
    it('enginesプロパティを持つ', () => {
      const options: AnalysisOptions = {
        engines: {
          axeCore: true,
          pa11y: true,
          lighthouse: true,
          ibm: true,
          alfa: true,
          qualweb: true,
        },
        waveApi: { enabled: false },
        wcagVersion: '2.1',
        semiAutoCheck: false,
        responsiveTest: false,
        viewports: ['desktop'],
      };

      expect(options.engines).toBeDefined();
      expect(options.engines.axeCore).toBe(true);
      expect(options.engines.ibm).toBe(true);
    });
  });

  describe('WCAGバージョン選択 (Req 8.2)', () => {
    it('wcagVersionが2.0を選択できる', () => {
      const options: AnalysisOptions = {
        engines: { axeCore: true, pa11y: true, lighthouse: true, ibm: false, alfa: false, qualweb: false },
        waveApi: { enabled: false },
        wcagVersion: '2.0',
        semiAutoCheck: false,
        responsiveTest: false,
        viewports: ['desktop'],
      };

      expect(options.wcagVersion).toBe('2.0');
    });

    it('wcagVersionが2.1を選択できる', () => {
      const options: AnalysisOptions = {
        engines: { axeCore: true, pa11y: true, lighthouse: true, ibm: false, alfa: false, qualweb: false },
        waveApi: { enabled: false },
        wcagVersion: '2.1',
        semiAutoCheck: false,
        responsiveTest: false,
        viewports: ['desktop'],
      };

      expect(options.wcagVersion).toBe('2.1');
    });

    it('wcagVersionが2.2を選択できる', () => {
      const options: AnalysisOptions = {
        engines: { axeCore: true, pa11y: true, lighthouse: true, ibm: true, alfa: true, qualweb: false },
        waveApi: { enabled: false },
        wcagVersion: '2.2',
        semiAutoCheck: false,
        responsiveTest: false,
        viewports: ['desktop'],
      };

      expect(options.wcagVersion).toBe('2.2');
    });
  });

  describe('半自動チェック設定 (Req 8.2)', () => {
    it('semiAutoCheckが有効にできる', () => {
      const options: AnalysisOptions = {
        engines: { axeCore: true, pa11y: true, lighthouse: true, ibm: false, alfa: false, qualweb: false },
        waveApi: { enabled: false },
        wcagVersion: '2.1',
        semiAutoCheck: true,
        responsiveTest: false,
        viewports: ['desktop'],
      };

      expect(options.semiAutoCheck).toBe(true);
    });
  });

  describe('レスポンシブテスト設定 (Req 8.2)', () => {
    it('responsiveTestが有効にできる', () => {
      const options: AnalysisOptions = {
        engines: { axeCore: true, pa11y: true, lighthouse: true, ibm: false, alfa: false, qualweb: false },
        waveApi: { enabled: false },
        wcagVersion: '2.1',
        semiAutoCheck: false,
        responsiveTest: true,
        viewports: ['mobile', 'tablet', 'desktop'],
      };

      expect(options.responsiveTest).toBe(true);
      expect(options.viewports).toContain('mobile');
      expect(options.viewports).toContain('tablet');
      expect(options.viewports).toContain('desktop');
    });

    it('viewportsは単一のビューポートでも設定できる', () => {
      const options: AnalysisOptions = {
        engines: { axeCore: true, pa11y: true, lighthouse: true, ibm: false, alfa: false, qualweb: false },
        waveApi: { enabled: false },
        wcagVersion: '2.1',
        semiAutoCheck: false,
        responsiveTest: false,
        viewports: ['desktop'],
      };

      expect(options.viewports).toHaveLength(1);
      expect(options.viewports[0]).toBe('desktop');
    });
  });

  describe('WAVE API設定 (Req 8.2)', () => {
    it('waveApiが有効にできる', () => {
      const options: AnalysisOptions = {
        engines: { axeCore: true, pa11y: true, lighthouse: true, ibm: false, alfa: false, qualweb: false },
        waveApi: { enabled: true, apiKey: 'my-wave-api-key' },
        wcagVersion: '2.1',
        semiAutoCheck: false,
        responsiveTest: false,
        viewports: ['desktop'],
      };

      expect(options.waveApi.enabled).toBe(true);
      expect(options.waveApi.apiKey).toBe('my-wave-api-key');
    });
  });
});

describe('DEFAULT_ANALYSIS_OPTIONS', () => {
  it('デフォルト設定が定義されている', () => {
    expect(DEFAULT_ANALYSIS_OPTIONS).toBeDefined();
  });

  it('既存エンジン（axe-core, pa11y, lighthouse）がデフォルトで有効', () => {
    expect(DEFAULT_ANALYSIS_OPTIONS.engines.axeCore).toBe(true);
    expect(DEFAULT_ANALYSIS_OPTIONS.engines.pa11y).toBe(true);
    expect(DEFAULT_ANALYSIS_OPTIONS.engines.lighthouse).toBe(true);
  });

  it('新規エンジン（ibm, alfa, qualweb）がデフォルトで有効', () => {
    // @requirement wcag-coverage-expansion - 半自動チェック以外の全エンジンをデフォルトで有効化
    expect(DEFAULT_ANALYSIS_OPTIONS.engines.ibm).toBe(true);
    expect(DEFAULT_ANALYSIS_OPTIONS.engines.alfa).toBe(true);
    expect(DEFAULT_ANALYSIS_OPTIONS.engines.qualweb).toBe(true);
  });

  it('WAVE APIがデフォルトで無効', () => {
    expect(DEFAULT_ANALYSIS_OPTIONS.waveApi.enabled).toBe(false);
  });

  it('WCAGバージョンがデフォルトで2.1', () => {
    expect(DEFAULT_ANALYSIS_OPTIONS.wcagVersion).toBe('2.1');
  });

  it('半自動チェックがデフォルトで無効', () => {
    expect(DEFAULT_ANALYSIS_OPTIONS.semiAutoCheck).toBe(false);
  });

  it('レスポンシブテストがデフォルトで無効', () => {
    expect(DEFAULT_ANALYSIS_OPTIONS.responsiveTest).toBe(false);
  });

  it('ビューポートがデフォルトでdesktopのみ', () => {
    expect(DEFAULT_ANALYSIS_OPTIONS.viewports).toEqual(['desktop']);
  });
});

describe('QUICK_ANALYSIS_PRESET (Req 8.3)', () => {
  it('クイック分析プリセットが定義されている', () => {
    expect(QUICK_ANALYSIS_PRESET).toBeDefined();
  });

  it('axe-coreとlighthouseのみが有効', () => {
    expect(QUICK_ANALYSIS_PRESET.engines.axeCore).toBe(true);
    expect(QUICK_ANALYSIS_PRESET.engines.lighthouse).toBe(true);
    expect(QUICK_ANALYSIS_PRESET.engines.pa11y).toBe(false);
    expect(QUICK_ANALYSIS_PRESET.engines.ibm).toBe(false);
    expect(QUICK_ANALYSIS_PRESET.engines.alfa).toBe(false);
    expect(QUICK_ANALYSIS_PRESET.engines.qualweb).toBe(false);
  });

  it('半自動チェックが無効', () => {
    expect(QUICK_ANALYSIS_PRESET.semiAutoCheck).toBe(false);
  });

  it('レスポンシブテストが無効', () => {
    expect(QUICK_ANALYSIS_PRESET.responsiveTest).toBe(false);
  });

  it('WAVE APIが無効', () => {
    expect(QUICK_ANALYSIS_PRESET.waveApi.enabled).toBe(false);
  });
});

describe('FULL_ANALYSIS_PRESET (Req 8.4)', () => {
  it('フル分析プリセットが定義されている', () => {
    expect(FULL_ANALYSIS_PRESET).toBeDefined();
  });

  it('全てのエンジンが有効', () => {
    expect(FULL_ANALYSIS_PRESET.engines.axeCore).toBe(true);
    expect(FULL_ANALYSIS_PRESET.engines.pa11y).toBe(true);
    expect(FULL_ANALYSIS_PRESET.engines.lighthouse).toBe(true);
    expect(FULL_ANALYSIS_PRESET.engines.ibm).toBe(true);
    expect(FULL_ANALYSIS_PRESET.engines.alfa).toBe(true);
    expect(FULL_ANALYSIS_PRESET.engines.qualweb).toBe(true);
  });

  it('半自動チェックが有効', () => {
    expect(FULL_ANALYSIS_PRESET.semiAutoCheck).toBe(true);
  });

  it('レスポンシブテストが有効', () => {
    expect(FULL_ANALYSIS_PRESET.responsiveTest).toBe(true);
  });

  it('全てのビューポートが設定されている', () => {
    expect(FULL_ANALYSIS_PRESET.viewports).toContain('mobile');
    expect(FULL_ANALYSIS_PRESET.viewports).toContain('tablet');
    expect(FULL_ANALYSIS_PRESET.viewports).toContain('desktop');
  });
});
