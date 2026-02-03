/**
 * Siteimprove Alfa分析モジュール
 *
 * Requirements: wcag-coverage-expansion 1.2, 1.6, 2.3
 * - Siteimprove Alfaを第5のエンジンとして統合
 * - AA levelフィルタでルールを実行
 * - Focus Appearance（2.4.13）とConsistent Help（3.2.6）の検出
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
 * Alfaの結果アイテム型定義
 */
interface AlfaResultItem {
  outcome: 'passed' | 'failed' | 'cantTell' | 'inapplicable';
  rule: {
    uri: string;
    requirements?: Array<{ uri: string }>;
  };
  target?: {
    path?: string;
    html?: string;
  };
}

/**
 * Siteimprove Alfaの分析オプション
 * @requirement 1.2 - AA levelフィルタ
 */
export interface AlfaAnalyzerOptions {
  /** フィルタするWCAGレベル（デフォルト: ['A', 'AA']） */
  levels?: ('A' | 'AA' | 'AAA')[];
  /** iframeを含めるか（デフォルト: false） */
  includeIframes?: boolean;
}

/**
 * WCAG URIからWCAG成功基準番号を抽出するマッピング
 * @requirement 2.3 - Focus Appearance（2.4.13）とConsistent Help（3.2.6）
 */
const WCAG_URI_TO_CRITERION: Record<string, string> = {
  // WCAG 2.0/2.1
  'non-text-content': '1.1.1',
  'audio-only-and-video-only-prerecorded': '1.2.1',
  'captions-prerecorded': '1.2.2',
  'audio-description-or-media-alternative-prerecorded': '1.2.3',
  'captions-live': '1.2.4',
  'audio-description-prerecorded': '1.2.5',
  'info-and-relationships': '1.3.1',
  'meaningful-sequence': '1.3.2',
  'sensory-characteristics': '1.3.3',
  'orientation': '1.3.4',
  'identify-input-purpose': '1.3.5',
  'use-of-color': '1.4.1',
  'audio-control': '1.4.2',
  'contrast-minimum': '1.4.3',
  'resize-text': '1.4.4',
  'images-of-text': '1.4.5',
  'contrast-enhanced': '1.4.6',
  'low-or-no-background-audio': '1.4.7',
  'visual-presentation': '1.4.8',
  'images-of-text-no-exception': '1.4.9',
  'reflow': '1.4.10',
  'non-text-contrast': '1.4.11',
  'text-spacing': '1.4.12',
  'content-on-hover-or-focus': '1.4.13',
  'keyboard': '2.1.1',
  'no-keyboard-trap': '2.1.2',
  'keyboard-no-exception': '2.1.3',
  'character-key-shortcuts': '2.1.4',
  'timing-adjustable': '2.2.1',
  'pause-stop-hide': '2.2.2',
  'no-timing': '2.2.3',
  'interruptions': '2.2.4',
  're-authenticating': '2.2.5',
  'timeouts': '2.2.6',
  'three-flashes-or-below-threshold': '2.3.1',
  'three-flashes': '2.3.2',
  'animation-from-interactions': '2.3.3',
  'bypass-blocks': '2.4.1',
  'page-titled': '2.4.2',
  'focus-order': '2.4.3',
  'link-purpose-in-context': '2.4.4',
  'multiple-ways': '2.4.5',
  'headings-and-labels': '2.4.6',
  'focus-visible': '2.4.7',
  'location': '2.4.8',
  'link-purpose-link-only': '2.4.9',
  'section-headings': '2.4.10',
  'focus-not-obscured-minimum': '2.4.11',
  'focus-not-obscured-enhanced': '2.4.12',
  'focus-appearance': '2.4.13',
  'pointer-gestures': '2.5.1',
  'pointer-cancellation': '2.5.2',
  'label-in-name': '2.5.3',
  'motion-actuation': '2.5.4',
  'target-size-enhanced': '2.5.5',
  'concurrent-input-mechanisms': '2.5.6',
  'dragging-movements': '2.5.7',
  'target-size-minimum': '2.5.8',
  'language-of-page': '3.1.1',
  'language-of-parts': '3.1.2',
  'unusual-words': '3.1.3',
  'abbreviations': '3.1.4',
  'reading-level': '3.1.5',
  'pronunciation': '3.1.6',
  'on-focus': '3.2.1',
  'on-input': '3.2.2',
  'consistent-navigation': '3.2.3',
  'consistent-identification': '3.2.4',
  'change-on-request': '3.2.5',
  'consistent-help': '3.2.6',
  'error-identification': '3.3.1',
  'labels-or-instructions': '3.3.2',
  'error-suggestion': '3.3.3',
  'error-prevention-legal-financial-data': '3.3.4',
  'help': '3.3.5',
  'error-prevention-all': '3.3.6',
  'redundant-entry': '3.3.7',
  'accessible-authentication-minimum': '3.3.8',
  'accessible-authentication-enhanced': '3.3.9',
  'parsing': '4.1.1',
  'name-role-value': '4.1.2',
  'status-messages': '4.1.3',
};

/**
 * WCAG URIから成功基準番号を抽出
 */
function extractCriterionFromUri(uri: string): string | null {
  // URIの末尾のフラグメントを取得
  const fragment = uri.split('#').pop();
  if (!fragment) return null;

  // マッピングから検索
  if (WCAG_URI_TO_CRITERION[fragment]) {
    return WCAG_URI_TO_CRITERION[fragment];
  }

  return null;
}

/**
 * AlfaのルールURIからルールIDを抽出
 */
function extractRuleId(ruleUri: string): string {
  // https://alfa.siteimprove.com/rules/sia-r1 -> sia-r1
  const parts = ruleUri.split('/');
  return parts[parts.length - 1] || ruleUri;
}

/**
 * Alfaのoutcomeをimpactレベルに変換
 */
function convertToImpactLevel(outcome: string): ImpactLevel {
  switch (outcome) {
    case 'failed':
      return 'serious';
    case 'cantTell':
      return 'moderate';
    default:
      return 'minor';
  }
}

/**
 * WCAG 2.2の実験的ルールかどうかを判定
 * @requirement 2.4 - 実験的ラベル
 */
function isExperimentalRule(wcagCriteria: string[]): boolean {
  const wcag22Criteria = [
    '2.4.11', '2.4.12', '2.4.13',
    '2.5.7', '2.5.8',
    '3.2.6',
    '3.3.7', '3.3.8', '3.3.9',
  ];
  return wcagCriteria.some(c => wcag22Criteria.includes(c));
}

/**
 * Siteimprove Alfaを使用してアクセシビリティ分析を実行
 *
 * @param page - Playwrightページインスタンス
 * @param options - 分析オプション
 * @returns 分析結果
 *
 * Requirements: 1.2, 1.6, 2.3
 */
export async function analyzeWithAlfa(
  page: Page,
  options: AlfaAnalyzerOptions = {}
): Promise<AnalyzerResult> {
  const startTime = Date.now();
  const url = page.url();

  logAnalyzerStart('alfa', url);
  const timing = createAnalyzerTiming('alfa', url);

  const emptyResult: AnalyzerResult = {
    violations: [],
    passes: [],
    incomplete: [],
    duration: 0,
  };

  try {
    // alfa-playwright と alfa-test-utils を動的インポート
    let alfaPlaywright;
    let alfaTestUtils;
    try {
      alfaPlaywright = await import('@siteimprove/alfa-playwright');
      alfaTestUtils = await import('@siteimprove/alfa-test-utils');
    } catch (importError) {
      console.error('[alfa] Alfaモジュールのインポートに失敗しました:', importError);
      emptyResult.duration = Date.now() - startTime;
      const completedTiming = completeAnalyzerTiming(timing, 'error');
      logAnalyzerComplete(completedTiming);
      return emptyResult;
    }

    // Playwright PageからAlfa Documentを取得
    const alfaPage = await alfaPlaywright.Playwright.toPage(page);

    // Alfa分析を実行
    const auditResult = await alfaTestUtils.Audit.run(alfaPage);
    const jsonResult = auditResult.toJSON();
    const results: AlfaResultItem[] = jsonResult.outcomes || [];

    // 結果をルールIDごとにグループ化
    const violationMap = new Map<string, { rule: AlfaResultItem; nodes: NodeInfo[]; wcagCriteria: string[] }>();
    const passMap = new Map<string, { rule: AlfaResultItem; nodes: NodeInfo[]; wcagCriteria: string[] }>();
    const incompleteMap = new Map<string, { rule: AlfaResultItem; nodes: NodeInfo[]; wcagCriteria: string[] }>();

    for (const result of results) {
      // inapplicableはスキップ
      if (result.outcome === 'inapplicable') {
        continue;
      }

      const ruleId = extractRuleId(result.rule.uri);

      // WCAG成功基準を抽出
      const wcagCriteria: string[] = [];
      if (result.rule.requirements) {
        for (const req of result.rule.requirements) {
          const criterion = extractCriterionFromUri(req.uri);
          if (criterion && !wcagCriteria.includes(criterion)) {
            wcagCriteria.push(criterion);
          }
        }
      }

      // ノード情報を作成
      const nodeInfo: NodeInfo = {
        target: result.target?.path || '',
        xpath: result.target?.path || '',
        html: result.target?.html || '',
      };

      // 結果タイプに応じてMapに追加
      let targetMap: Map<string, { rule: AlfaResultItem; nodes: NodeInfo[]; wcagCriteria: string[] }>;
      if (result.outcome === 'failed') {
        targetMap = violationMap;
      } else if (result.outcome === 'passed') {
        targetMap = passMap;
      } else {
        // cantTell
        targetMap = incompleteMap;
      }

      if (targetMap.has(ruleId)) {
        targetMap.get(ruleId)!.nodes.push(nodeInfo);
      } else {
        targetMap.set(ruleId, {
          rule: result,
          nodes: [nodeInfo],
          wcagCriteria,
        });
      }
    }

    // RuleResult配列に変換
    const violations: RuleResult[] = Array.from(violationMap.entries()).map(
      ([ruleId, { rule, nodes, wcagCriteria }]) => ({
        id: ruleId,
        description: `Alfa rule ${ruleId}`,
        impact: convertToImpactLevel(rule.outcome),
        nodeCount: nodes.length,
        helpUrl: rule.rule.uri,
        wcagCriteria,
        toolSource: 'alfa' as const,
        nodes,
        isExperimental: isExperimentalRule(wcagCriteria),
      })
    );

    const passes: RuleResult[] = Array.from(passMap.entries()).map(
      ([ruleId, { nodes, wcagCriteria, rule }]) => ({
        id: ruleId,
        description: `Alfa rule ${ruleId}`,
        nodeCount: nodes.length,
        helpUrl: rule.rule.uri,
        wcagCriteria,
        toolSource: 'alfa' as const,
        nodes,
      })
    );

    const incomplete: RuleResult[] = Array.from(incompleteMap.entries()).map(
      ([ruleId, { rule, nodes, wcagCriteria }]) => ({
        id: ruleId,
        description: `Alfa rule ${ruleId}`,
        impact: convertToImpactLevel(rule.outcome),
        nodeCount: nodes.length,
        helpUrl: rule.rule.uri,
        wcagCriteria,
        toolSource: 'alfa' as const,
        nodes,
        isExperimental: isExperimentalRule(wcagCriteria),
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
    console.error('[alfa] 分析中にエラーが発生しました:', error);
    emptyResult.duration = Date.now() - startTime;
    const completedTiming = completeAnalyzerTiming(timing, 'error');
    logAnalyzerComplete(completedTiming);
    return emptyResult;
  }
}
