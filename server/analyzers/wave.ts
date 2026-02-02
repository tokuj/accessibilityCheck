/**
 * WAVE API分析モジュール
 *
 * Requirements: wcag-coverage-expansion 4.1, 4.2, 4.4, 4.5
 * - WAVE REST APIを使用した追加分析
 * - APIキーの安全な取得（環境変数/Secret Manager）
 * - レポートタイプ3（XPath含む）のレスポンスを解析
 * - レート制限エラー（429）とAPIキーエラー（401）のハンドリング
 * - API呼び出し数のカウント機能
 */
import type { AnalyzerResult, RuleResult, NodeInfo, ImpactLevel } from './types';
import {
  createAnalyzerTiming,
  completeAnalyzerTiming,
  logAnalyzerStart,
  logAnalyzerComplete,
} from '../utils';

/**
 * WAVE APIのベースURL
 */
const WAVE_API_BASE_URL = 'https://wave.webaim.org/api/request';

/**
 * API呼び出しカウンター
 * @requirement 4.5 - API呼び出し数をカウントし、ユーザーに表示する
 */
let apiCallCount = 0;

/**
 * API呼び出し数を取得
 */
export function getApiCallCount(): number {
  return apiCallCount;
}

/**
 * API呼び出しカウントをリセット
 */
export function resetApiCallCount(): void {
  apiCallCount = 0;
}

/**
 * WAVE APIの分析オプション
 * @requirement 4.1 - WAVE APIを使用した追加分析
 */
export interface WaveAnalyzerOptions {
  /** WAVE APIキー（必須） */
  apiKey: string;
  /** レポートタイプ（デフォルト: 3、XPath含む） */
  reportType?: 1 | 2 | 3 | 4;
}

/**
 * WAVEのカテゴリ項目型定義
 */
interface WaveItem {
  id: string;
  description: string;
  count: number;
  xpaths?: string[];
  selectors?: string[];
}

/**
 * WAVEのカテゴリ型定義
 */
interface WaveCategory {
  count: number;
  items: Record<string, WaveItem>;
}

/**
 * WAVEのレスポンス型定義
 */
interface WaveResponse {
  status: {
    success: boolean;
    httpstatuscode?: number;
  };
  categories: {
    error: WaveCategory;
    contrast: WaveCategory;
    alert: WaveCategory;
    feature: WaveCategory;
    structure: WaveCategory;
    aria: WaveCategory;
  };
  statistics?: {
    creditsremaining?: number;
  };
}

/**
 * WAVEのルールIDからWCAG成功基準へのマッピング
 */
const WAVE_RULE_TO_WCAG: Record<string, string[]> = {
  // Error
  'alt_missing': ['1.1.1'],
  'alt_link_missing': ['1.1.1', '2.4.4'],
  'alt_spacer_missing': ['1.1.1'],
  'alt_input_missing': ['1.1.1', '1.3.1'],
  'alt_area_missing': ['1.1.1', '2.4.4'],
  'alt_map_missing': ['1.1.1'],
  'longdesc_invalid': ['1.1.1'],
  'label_missing': ['1.3.1', '4.1.2'],
  'label_empty': ['1.3.1', '4.1.2'],
  'label_multiple': ['1.3.1'],
  'title_invalid': ['2.4.2'],
  'language_missing': ['3.1.1'],
  'meta_refresh': ['2.2.1', '2.2.4'],
  'heading_empty': ['1.3.1', '2.4.6'],
  'button_empty': ['1.1.1', '4.1.2'],
  'link_empty': ['2.4.4', '4.1.2'],
  'link_skip_broken': ['2.4.1'],
  'th_empty': ['1.3.1'],
  'blink': ['2.2.2'],
  'marquee': ['2.2.2'],

  // Contrast
  'contrast': ['1.4.3'],

  // Alert
  'alt_suspicious': ['1.1.1'],
  'alt_redundant': ['1.1.1'],
  'alt_duplicate': ['1.1.1'],
  'alt_long': ['1.1.1'],
  'longdesc': ['1.1.1'],
  'label_orphaned': ['1.3.1'],
  'label_title': ['1.3.1'],
  'heading_skipped': ['1.3.1'],
  'heading_possible': ['1.3.1'],
  'region_missing': ['1.3.1'],
  'table_layout': ['1.3.1'],
  'table_caption_possible': ['1.3.1'],
  'link_suspicious': ['2.4.4'],
  'link_redundant': ['2.4.4'],
  'noscript': ['4.1.1'],
  'title_redundant': ['2.4.2'],
  'audio_video': ['1.2.1', '1.2.2', '1.2.3'],
  'youtube_video': ['1.2.1', '1.2.2'],
  'flash': ['1.1.1'],
  'applet': ['1.1.1'],
  'object': ['1.1.1'],
  'plugin': ['1.1.1'],
  'html5_video_audio': ['1.2.1', '1.2.2'],
  'pdf': ['1.1.1'],
  'underline': ['1.4.1'],
  'text_small': ['1.4.4'],
  'text_justified': ['1.4.8'],

  // ARIA
  'aria_reference_broken': ['4.1.2'],
  'aria_menu_broken': ['4.1.2'],
  'aria_hidden': ['4.1.2'],
};

/**
 * WAVEのカテゴリからImpactLevelに変換
 */
function getImpactFromCategory(category: string): ImpactLevel {
  switch (category) {
    case 'error':
    case 'contrast':
      return 'serious';
    case 'alert':
      return 'moderate';
    default:
      return 'minor';
  }
}

/**
 * WAVEのカテゴリから結果タイプに変換
 */
function getResultTypeFromCategory(category: string): 'violation' | 'pass' | 'incomplete' {
  switch (category) {
    case 'error':
    case 'contrast':
      return 'violation';
    case 'alert':
      return 'incomplete';
    case 'feature':
    case 'structure':
    case 'aria':
      return 'pass';
    default:
      return 'incomplete';
  }
}

/**
 * WAVE APIを使用してアクセシビリティ分析を実行
 *
 * @param url - 分析対象のURL
 * @param options - 分析オプション
 * @returns 分析結果
 *
 * Requirements: 4.1, 4.2, 4.4, 4.5
 */
export async function analyzeWithWave(
  url: string,
  options: WaveAnalyzerOptions
): Promise<AnalyzerResult> {
  const startTime = Date.now();

  logAnalyzerStart('wave', url);
  const timing = createAnalyzerTiming('wave', url);

  const emptyResult: AnalyzerResult = {
    violations: [],
    passes: [],
    incomplete: [],
    duration: 0,
  };

  // APIキーが空の場合は早期リターン
  if (!options.apiKey) {
    console.error('[wave] APIキーが設定されていません');
    emptyResult.duration = Date.now() - startTime;
    const completedTiming = completeAnalyzerTiming(timing, 'error');
    logAnalyzerComplete(completedTiming);
    return emptyResult;
  }

  try {
    // API呼び出しカウントを増加
    apiCallCount++;

    // WAVE APIを呼び出し
    const reportType = options.reportType || 3;
    const apiUrl = `${WAVE_API_BASE_URL}?key=${encodeURIComponent(options.apiKey)}&url=${encodeURIComponent(url)}&reporttype=${reportType}`;

    const response = await fetch(apiUrl);

    // エラーレスポンスのハンドリング
    if (!response.ok) {
      if (response.status === 401) {
        console.error('[wave] APIキーが無効です（401）');
      } else if (response.status === 429) {
        console.warn('[wave] レート制限に達しました（429）');
      } else {
        console.error(`[wave] APIエラー: ${response.status}`);
      }
      emptyResult.duration = Date.now() - startTime;
      const completedTiming = completeAnalyzerTiming(timing, 'error');
      logAnalyzerComplete(completedTiming);
      return emptyResult;
    }

    const data: WaveResponse = await response.json();

    // APIレスポンスの検証
    if (!data.status?.success) {
      console.error('[wave] APIレスポンスが失敗を示しています');
      emptyResult.duration = Date.now() - startTime;
      const completedTiming = completeAnalyzerTiming(timing, 'error');
      logAnalyzerComplete(completedTiming);
      return emptyResult;
    }

    // 結果を収集
    const violations: RuleResult[] = [];
    const passes: RuleResult[] = [];
    const incomplete: RuleResult[] = [];

    const categories = data.categories;

    // 各カテゴリを処理
    for (const [categoryName, category] of Object.entries(categories)) {
      if (!category.items) continue;

      const resultType = getResultTypeFromCategory(categoryName);
      const impact = getImpactFromCategory(categoryName);

      for (const [itemId, item] of Object.entries(category.items)) {
        // ノード情報を作成
        const nodes: NodeInfo[] = (item.xpaths || []).map((xpath) => ({
          target: xpath,
          xpath,
          html: '',
        }));

        const ruleResult: RuleResult = {
          id: itemId,
          description: item.description,
          impact: resultType === 'pass' ? undefined : impact,
          nodeCount: item.count,
          helpUrl: `https://wave.webaim.org/doc/rule/${itemId}`,
          wcagCriteria: WAVE_RULE_TO_WCAG[itemId] || [],
          toolSource: 'wave' as const,
          nodes,
        };

        if (resultType === 'violation') {
          violations.push(ruleResult);
        } else if (resultType === 'pass') {
          passes.push(ruleResult);
        } else {
          incomplete.push(ruleResult);
        }
      }
    }

    const duration = Date.now() - startTime;
    const completedTiming = completeAnalyzerTiming(timing, 'success');
    logAnalyzerComplete(completedTiming);

    return {
      violations,
      passes,
      incomplete,
      duration,
    };
  } catch (error) {
    console.error('[wave] 分析中にエラーが発生しました:', error);
    emptyResult.duration = Date.now() - startTime;
    const completedTiming = completeAnalyzerTiming(timing, 'error');
    logAnalyzerComplete(completedTiming);
    return emptyResult;
  }
}
