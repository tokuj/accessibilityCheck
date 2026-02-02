/**
 * IBM Equal Access Checker分析モジュール
 *
 * Requirements: wcag-coverage-expansion 1.1, 1.6, 2.2
 * - IBM Equal Access Checkerを第4のエンジンとして統合
 * - WCAG 2.2ポリシーを使用
 * - エラーハンドリングとタイムアウト処理
 */
import type { Page } from 'playwright';
import type { AnalyzerResult, RuleResult, NodeInfo, ImpactLevel } from './types';
import {
  createAnalyzerTiming,
  completeAnalyzerTiming,
  logAnalyzerStart,
  logAnalyzerComplete,
} from '../utils';

/**
 * IBM Equal Access Checkerのルール結果の型定義
 */
interface IBMRuleResult {
  ruleId: string;
  message: string;
  path: {
    dom: string;
  };
  value: [string, string]; // [level, type] e.g., ['VIOLATION', 'FAIL']
  reasonId: string;
  snippet?: string;
}

/**
 * IBM Equal Access Checkerのレポート型定義
 */
interface IBMReport {
  results: IBMRuleResult[];
  nls: Record<string, Record<string, { 1: string }>>;
}

/**
 * IBM Equal Access Checkerの分析オプション
 * @requirement 2.2 - WCAG 2.2ポリシー設定
 */
export interface IBMAnalyzerOptions {
  /** 使用するポリシー（デフォルト: ['WCAG_2_2']） */
  policies?: string[];
  /** 違反として扱うレベル */
  failLevels?: ('violation' | 'potentialviolation')[];
  /** タイムアウト（ミリ秒） */
  timeout?: number;
}

/**
 * IBM Equal Access CheckerのルールIDからWCAG成功基準へのマッピング
 * @requirement 2.2 - WCAG 2.2対応
 */
const RULE_TO_WCAG: Record<string, string[]> = {
  // WCAG 2.0/2.1
  'WCAG20_Img_HasAlt': ['1.1.1'],
  'img_alt_valid': ['1.1.1'],
  'WCAG20_Img_LinkTextNotRedundant': ['1.1.1'],
  'WCAG20_A_HasText': ['2.4.4', '4.1.2'],
  'WCAG20_A_TargetAndText': ['2.4.4'],
  'WCAG20_Label_RefValid': ['1.3.1', '4.1.2'],
  'WCAG20_Input_ExplicitLabel': ['1.3.1', '4.1.2'],
  'WCAG20_Input_ExplicitLabelImage': ['1.3.1', '4.1.2'],
  'WCAG21_Label_Accessible': ['1.3.5', '2.5.3'],
  'WCAG20_Input_RadioChkInFieldSet': ['1.3.1'],
  'WCAG20_Fieldset_HasLegend': ['1.3.1'],
  'WCAG20_Table_Structure': ['1.3.1'],
  'WCAG20_Table_CapSummRedundant': ['1.3.1'],
  'WCAG20_Html_HasLang': ['3.1.1'],
  'WCAG20_Doc_HasTitle': ['2.4.2'],
  'WCAG20_Frame_HasTitle': ['2.4.1', '4.1.2'],
  'WCAG20_Body_FirstAContainsSkipText': ['2.4.1'],
  'WCAG20_Elem_UniqueAccessKey': ['2.4.1'],
  'WCAG20_Script_FocusBlurs': ['2.1.2'],
  'WCAG20_Select_HasOptGroup': ['1.3.1'],
  'WCAG20_Style_ColorSemantics1': ['1.4.1'],
  'WCAG20_Style_BeforeAfter': ['1.3.1'],
  'WCAG20_Text_ColorContrast': ['1.4.3'],
  'WCAG20_Text_LetterSpacing': ['1.4.8'],
  'WCAG20_Elem_Lang_Valid': ['3.1.2'],
  'WCAG20_Blink_AlwaysTrigger': ['2.2.2'],
  'WCAG20_Marquee_Trigger': ['2.2.2'],
  'WCAG20_Meta_RedirectZero': ['2.2.1'],
  'WCAG20_Object_HasText': ['1.1.1'],
  'WCAG20_Applet_HasAlt': ['1.1.1'],
  'WCAG20_Area_HasAlt': ['1.1.1'],
  'WCAG20_Embed_HasNoEmbed': ['1.1.1'],
  'RPT_Media_AltBrief': ['1.1.1'],
  'RPT_Media_ImgColorUsage': ['1.4.1'],

  // WCAG 2.2 新規（Req 2.2）
  'focus-not-obscured': ['2.4.11'],
  'focus_not_obscured_minimum': ['2.4.11'],
  'focus_not_obscured_enhanced': ['2.4.12'],
  'dragging_movements': ['2.5.7'],
  'target-size': ['2.5.8'],
  'target_size_minimum': ['2.5.8'],
  'redundant_entry': ['3.3.7'],
  'accessible_authentication': ['3.3.8'],
  'accessible_authentication_minimum': ['3.3.8'],

  // ARIAルール
  'aria_role_valid': ['4.1.2'],
  'aria_hidden_focus': ['4.1.2'],
  'aria_activedescendant_valid': ['4.1.2'],
  'aria_attribute_valid': ['4.1.2'],
  'aria_content_in_landmark': ['1.3.1'],
  'aria_child_valid': ['4.1.2'],
  'aria_descendant_valid': ['4.1.2'],
  'aria_eventhandler_role_valid': ['4.1.2'],
  'aria_graphic_labelled': ['1.1.1'],
  'aria_id_unique': ['4.1.1'],
  'aria_landmark_name_unique': ['2.4.1'],
  'aria_main_label_visible': ['2.4.1'],
  'aria_parent_required': ['4.1.2'],
  'aria_region_label_unique': ['2.4.1'],
  'aria_semantics_role': ['4.1.2'],
  'aria_widget_labelled': ['4.1.2'],
};

/**
 * IBM Equal Access Checkerの結果レベルをImpactLevelに変換
 */
function convertToImpactLevel(level: string): ImpactLevel {
  switch (level.toUpperCase()) {
    case 'VIOLATION':
      return 'serious';
    case 'POTENTIAL_VIOLATION':
    case 'RECOMMENDATION':
      return 'moderate';
    case 'MANUAL':
      return 'minor';
    default:
      return 'minor';
  }
}

/**
 * IBM Equal Access Checkerの結果タイプを判定
 */
function getResultType(value: [string, string]): 'violation' | 'pass' | 'incomplete' {
  const [level, type] = value;

  if (level.toUpperCase() === 'PASS') {
    return 'pass';
  }
  if (level.toUpperCase() === 'VIOLATION') {
    return 'violation';
  }
  // POTENTIAL_VIOLATION, RECOMMENDATION, MANUAL -> incomplete
  return 'incomplete';
}

/**
 * WCAG 2.2の実験的ルールかどうかを判定
 * @requirement 2.4 - 実験的ラベル
 */
function isExperimentalRule(ruleId: string): boolean {
  const experimentalRules = [
    'focus-not-obscured',
    'focus_not_obscured_minimum',
    'focus_not_obscured_enhanced',
    'dragging_movements',
    'target-size',
    'target_size_minimum',
    'redundant_entry',
    'accessible_authentication',
    'accessible_authentication_minimum',
  ];
  return experimentalRules.includes(ruleId);
}

/**
 * IBM Equal Access Checkerを使用してアクセシビリティ分析を実行
 *
 * @param page - Playwrightページインスタンス
 * @param options - 分析オプション
 * @returns 分析結果
 *
 * Requirements: 1.1, 1.6, 2.2
 */
export async function analyzeWithIBM(
  page: Page,
  options: IBMAnalyzerOptions = {}
): Promise<AnalyzerResult> {
  const startTime = Date.now();
  const url = page.url();

  logAnalyzerStart('ibm', url);
  const timing = createAnalyzerTiming('ibm', url);

  const emptyResult: AnalyzerResult = {
    violations: [],
    passes: [],
    incomplete: [],
    duration: 0,
  };

  try {
    // ページコンテンツを取得
    const html = await page.content();

    // accessibility-checkerを動的インポート（モジュールが存在しない場合のエラーハンドリング）
    let aChecker;
    try {
      aChecker = await import('accessibility-checker');
    } catch (importError) {
      console.error('[ibm] accessibility-checkerモジュールのインポートに失敗しました:', importError);
      emptyResult.duration = Date.now() - startTime;
      const completedTiming = completeAnalyzerTiming(timing, 'error');
      logAnalyzerComplete(completedTiming);
      return emptyResult;
    }

    // IBM Equal Access Checkerで分析実行
    const complianceResult = await aChecker.getCompliance(html, 'page');

    if (!complianceResult || !complianceResult.report) {
      console.warn('[ibm] 分析結果が空です');
      emptyResult.duration = Date.now() - startTime;
      const completedTiming = completeAnalyzerTiming(timing, 'success');
      logAnalyzerComplete(completedTiming);
      return emptyResult;
    }

    const report: IBMReport = complianceResult.report;
    const results = report.results || [];

    // 結果をルールIDごとにグループ化
    const violationMap = new Map<string, { rule: IBMRuleResult; nodes: NodeInfo[] }>();
    const passMap = new Map<string, { rule: IBMRuleResult; nodes: NodeInfo[] }>();
    const incompleteMap = new Map<string, { rule: IBMRuleResult; nodes: NodeInfo[] }>();

    for (const result of results) {
      const resultType = getResultType(result.value);
      const nodeInfo: NodeInfo = {
        target: result.path.dom,
        xpath: result.path.dom,
        html: result.snippet || '',
      };

      const targetMap =
        resultType === 'violation'
          ? violationMap
          : resultType === 'pass'
            ? passMap
            : incompleteMap;

      if (targetMap.has(result.ruleId)) {
        targetMap.get(result.ruleId)!.nodes.push(nodeInfo);
      } else {
        targetMap.set(result.ruleId, {
          rule: result,
          nodes: [nodeInfo],
        });
      }
    }

    // RuleResult配列に変換
    const violations: RuleResult[] = Array.from(violationMap.entries()).map(
      ([ruleId, { rule, nodes }]) => ({
        id: ruleId,
        description: rule.message,
        impact: convertToImpactLevel(rule.value[0]),
        nodeCount: nodes.length,
        helpUrl: `https://www.ibm.com/able/requirements/checker/rules/${ruleId}`,
        wcagCriteria: RULE_TO_WCAG[ruleId] || [],
        toolSource: 'ibm' as const,
        nodes,
        isExperimental: isExperimentalRule(ruleId),
      })
    );

    const passes: RuleResult[] = Array.from(passMap.entries()).map(
      ([ruleId, { rule, nodes }]) => ({
        id: ruleId,
        description: rule.message,
        nodeCount: nodes.length,
        helpUrl: `https://www.ibm.com/able/requirements/checker/rules/${ruleId}`,
        wcagCriteria: RULE_TO_WCAG[ruleId] || [],
        toolSource: 'ibm' as const,
        nodes,
      })
    );

    const incomplete: RuleResult[] = Array.from(incompleteMap.entries()).map(
      ([ruleId, { rule, nodes }]) => ({
        id: ruleId,
        description: rule.message,
        impact: convertToImpactLevel(rule.value[0]),
        nodeCount: nodes.length,
        helpUrl: `https://www.ibm.com/able/requirements/checker/rules/${ruleId}`,
        wcagCriteria: RULE_TO_WCAG[ruleId] || [],
        toolSource: 'ibm' as const,
        nodes,
        isExperimental: isExperimentalRule(ruleId),
      })
    );

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
    console.error('[ibm] 分析中にエラーが発生しました:', error);
    emptyResult.duration = Date.now() - startTime;
    const completedTiming = completeAnalyzerTiming(timing, 'error');
    logAnalyzerComplete(completedTiming);
    return emptyResult;
  }
}
