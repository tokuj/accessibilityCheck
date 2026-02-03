/**
 * 分析オプション型定義
 *
 * Requirements: wcag-coverage-expansion 8.1, 8.2, 8.3, 8.4, 9.4
 * - エンジン選択オプション
 * - WCAGバージョン選択
 * - 半自動チェック設定
 * - レスポンシブテスト設定
 * - カスタムルール設定
 * - プリセット定義
 */

/**
 * エンジン選択オプション
 * @requirement 8.2 - エンジン選択（axe-core, Pa11y, Lighthouse, IBM, Alfa, QualWeb）
 */
export interface EngineOptions {
  /** axe-coreエンジンの有効/無効 */
  axeCore: boolean;
  /** Pa11yエンジンの有効/無効 */
  pa11y: boolean;
  /** Lighthouseエンジンの有効/無効 */
  lighthouse: boolean;
  /** IBM Equal Access Checkerの有効/無効 */
  ibm: boolean;
  /** Siteimprove Alfaの有効/無効 */
  alfa: boolean;
  /** QualWebの有効/無効 */
  qualweb: boolean;
}

/**
 * WAVE API設定
 * @requirement 8.2 - WAVE API使用の有効/無効
 */
export interface WaveApiOptions {
  /** WAVE APIの有効/無効 */
  enabled: boolean;
  /** WAVE APIキー（有効時のみ必要） */
  apiKey?: string;
}

/**
 * WCAGバージョン選択
 * @requirement 8.2 - WCAGバージョン選択（2.0 AA, 2.1 AA, 2.2 AA）
 */
export type WcagVersion = '2.0' | '2.1' | '2.2';

/**
 * ビューポートタイプ
 * @requirement 8.2 - レスポンシブテストのビューポート設定
 */
export type ViewportType = 'mobile' | 'tablet' | 'desktop';

/**
 * カスタムルール設定
 * @requirement 9.4 - カスタムルールの有効/無効を個別に設定できる
 */
export interface CustomRulesSettings {
  /** カスタムルール全体の有効/無効 */
  enabled: boolean;
  /** 曖昧なリンクテキスト検出の有効/無効 */
  enableAmbiguousLink: boolean;
  /** 見出しレベルスキップ検出の有効/無効 */
  enableHeadingSkip: boolean;
  /** 長すぎるalt属性検出の有効/無効 */
  enableLongAlt: boolean;
  /** 空のボタン/リンク検出の有効/無効 */
  enableEmptyInteractive: boolean;
  /** alt属性の最大文字数 */
  maxAltLength: number;
}

/**
 * 分析オプション
 * @requirement 8.1 - 分析オプション設定を表示
 * @requirement 8.2 - 各種オプションを提供
 * @requirement 9.4 - カスタムルール設定
 */
export interface AnalysisOptions {
  /** エンジン選択設定 */
  engines: EngineOptions;
  /** WAVE API設定 */
  waveApi: WaveApiOptions;
  /** WCAGバージョン選択 */
  wcagVersion: WcagVersion;
  /** 半自動チェックの有効/無効 */
  semiAutoCheck: boolean;
  /** レスポンシブテストの有効/無効 */
  responsiveTest: boolean;
  /** テスト対象のビューポート */
  viewports: ViewportType[];
  /** カスタムルール設定 */
  customRules?: CustomRulesSettings;
}

/**
 * デフォルトカスタムルール設定
 * @requirement 9.4 - カスタムルールの有効/無効を個別に設定できる
 */
export const DEFAULT_CUSTOM_RULES_SETTINGS: CustomRulesSettings = {
  enabled: false,
  enableAmbiguousLink: true,
  enableHeadingSkip: true,
  enableLongAlt: true,
  enableEmptyInteractive: true,
  maxAltLength: 100,
};

/**
 * デフォルト分析オプション
 * 半自動チェック以外の全エンジンを有効化
 * 注: QualWebはライブラリにバグがあるため一時的に無効化
 */
export const DEFAULT_ANALYSIS_OPTIONS: AnalysisOptions = {
  engines: {
    axeCore: true,
    pa11y: true,
    lighthouse: true,
    ibm: true,
    alfa: true,
    qualweb: false,
  },
  waveApi: {
    enabled: false,
  },
  wcagVersion: '2.1',
  semiAutoCheck: false,
  responsiveTest: false,
  viewports: ['desktop'],
  customRules: DEFAULT_CUSTOM_RULES_SETTINGS,
};

/**
 * クイック分析プリセット
 * @requirement 8.3 - 「クイック分析」プリセット（axe-core + Lighthouseのみ、半自動なし）
 */
export const QUICK_ANALYSIS_PRESET: AnalysisOptions = {
  engines: {
    axeCore: true,
    pa11y: false,
    lighthouse: true,
    ibm: false,
    alfa: false,
    qualweb: false,
  },
  waveApi: {
    enabled: false,
  },
  wcagVersion: '2.1',
  semiAutoCheck: false,
  responsiveTest: false,
  viewports: ['desktop'],
  customRules: {
    enabled: false,
    enableAmbiguousLink: true,
    enableHeadingSkip: true,
    enableLongAlt: true,
    enableEmptyInteractive: true,
    maxAltLength: 100,
  },
};

/**
 * フル分析プリセット
 * @requirement 8.4 - 「フル分析」プリセット（全エンジン、半自動あり、レスポンシブあり）
 */
export const FULL_ANALYSIS_PRESET: AnalysisOptions = {
  engines: {
    axeCore: true,
    pa11y: true,
    lighthouse: true,
    ibm: true,
    alfa: true,
    qualweb: true,
  },
  waveApi: {
    enabled: false, // APIキーが必要なためデフォルトは無効
  },
  wcagVersion: '2.2',
  semiAutoCheck: true,
  responsiveTest: true,
  viewports: ['mobile', 'tablet', 'desktop'],
  customRules: {
    enabled: true,
    enableAmbiguousLink: true,
    enableHeadingSkip: true,
    enableLongAlt: true,
    enableEmptyInteractive: true,
    maxAltLength: 100,
  },
};
