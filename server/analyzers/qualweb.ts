/**
 * QualWeb分析モジュール
 *
 * Requirements: wcag-coverage-expansion 1.3, 1.6
 * - QualWebを第6のエンジンとして統合
 * - ACT rulesとWCAG techniquesの結果を正規化
 * - Puppeteerクラスタのライフサイクル管理
 */
import type { AnalyzerResult, RuleResult, NodeInfo, ImpactLevel } from './types';
import {
  createAnalyzerTiming,
  completeAnalyzerTiming,
  logAnalyzerStart,
  logAnalyzerComplete,
} from '../utils';

/**
 * QualWebの結果アイテム型定義
 */
interface QualWebSuccessCriterion {
  name: string;
  level: string;
  principle: string;
  url: string;
}

interface QualWebResultItem {
  verdict: 'passed' | 'failed' | 'cantTell' | 'inapplicable';
  description: string;
  resultCode: string;
  pointer?: string;
  htmlCode?: string;
}

interface QualWebAssertion {
  '@type': string;
  name: string;
  code: string;
  mapping: string;
  description: string;
  metadata: {
    'success-criteria': QualWebSuccessCriterion[];
  };
  results: QualWebResultItem[];
}

interface QualWebReport {
  assertions: Record<string, QualWebAssertion>;
}

/**
 * QualWebの分析オプション
 * @requirement 1.3 - ACT rulesとWCAG techniquesの設定
 */
export interface QualWebAnalyzerOptions {
  /** ACT rulesを有効にするか（デフォルト: true） */
  actRules?: boolean;
  /** WCAG techniquesを有効にするか（デフォルト: true） */
  wcagTechniques?: boolean;
  /** フィルタするWCAGレベル（デフォルト: ['A', 'AA']） */
  levels?: ('A' | 'AA')[];
}

/**
 * QualWebのverdictをimpactレベルに変換
 */
function convertToImpactLevel(verdict: string): ImpactLevel {
  switch (verdict) {
    case 'failed':
      return 'serious';
    case 'cantTell':
      return 'moderate';
    default:
      return 'minor';
  }
}

/**
 * 成功基準名からWCAG番号を抽出
 * "1.1.1 Non-text Content" -> "1.1.1"
 */
function extractWcagCriterion(name: string): string | null {
  const match = name.match(/^(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

/**
 * WCAG 2.2の実験的ルールかどうかを判定
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
 * QualWebを使用してアクセシビリティ分析を実行
 *
 * @param html - 分析対象のHTMLコンテンツ
 * @param options - 分析オプション
 * @returns 分析結果
 *
 * Requirements: 1.3, 1.6
 */
export async function analyzeWithQualWeb(
  html: string,
  options: QualWebAnalyzerOptions = {}
): Promise<AnalyzerResult> {
  const startTime = Date.now();

  logAnalyzerStart('qualweb', 'html-content');
  const timing = createAnalyzerTiming('qualweb', 'html-content');

  const emptyResult: AnalyzerResult = {
    violations: [],
    passes: [],
    incomplete: [],
    duration: 0,
  };

  // 空のHTMLの場合は早期リターン
  if (!html || html.trim() === '') {
    emptyResult.duration = Date.now() - startTime;
    const completedTiming = completeAnalyzerTiming(timing, 'success');
    logAnalyzerComplete(completedTiming);
    return emptyResult;
  }

  let qualwebInstance: { start: () => Promise<void>; stop: () => Promise<void>; evaluate: (opts: unknown) => Promise<QualWebReport> } | null = null;

  try {
    // @qualweb/coreを動的読み込み（CJS互換）
    let QualWebModule;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      QualWebModule = require('@qualweb/core');
    } catch (importError) {
      console.error('[qualweb] @qualweb/coreモジュールのインポートに失敗しました:', importError);
      emptyResult.duration = Date.now() - startTime;
      const completedTiming = completeAnalyzerTiming(timing, 'error');
      logAnalyzerComplete(completedTiming);
      return emptyResult;
    }

    // QualWebインスタンスを作成
    qualwebInstance = new QualWebModule.QualWeb();
    await qualwebInstance.start();

    // 分析を実行
    const report = await qualwebInstance.evaluate({
      html,
      execute: {
        act: options.actRules !== false,
        wcag: options.wcagTechniques !== false,
      },
    });

    // 結果をルールIDごとにグループ化
    const violationMap = new Map<string, { assertion: QualWebAssertion; nodes: NodeInfo[]; wcagCriteria: string[] }>();
    const passMap = new Map<string, { assertion: QualWebAssertion; nodes: NodeInfo[]; wcagCriteria: string[] }>();
    const incompleteMap = new Map<string, { assertion: QualWebAssertion; nodes: NodeInfo[]; wcagCriteria: string[] }>();

    const assertions = report.assertions || {};

    for (const [ruleId, assertion] of Object.entries(assertions)) {
      if (!assertion.results || assertion.results.length === 0) {
        continue;
      }

      // WCAG成功基準を抽出
      const wcagCriteria: string[] = [];
      const successCriteria = assertion.metadata?.['success-criteria'] || [];
      for (const sc of successCriteria) {
        const criterion = extractWcagCriterion(sc.name);
        if (criterion && !wcagCriteria.includes(criterion)) {
          wcagCriteria.push(criterion);
        }
      }

      // 結果ごとに処理
      for (const resultItem of assertion.results) {
        // inapplicableはスキップ
        if (resultItem.verdict === 'inapplicable') {
          continue;
        }

        // ノード情報を作成
        const nodeInfo: NodeInfo = {
          target: resultItem.pointer || '',
          xpath: resultItem.pointer || '',
          html: resultItem.htmlCode || '',
        };

        // 結果タイプに応じてMapに追加
        let targetMap: Map<string, { assertion: QualWebAssertion; nodes: NodeInfo[]; wcagCriteria: string[] }>;
        if (resultItem.verdict === 'failed') {
          targetMap = violationMap;
        } else if (resultItem.verdict === 'passed') {
          targetMap = passMap;
        } else {
          // cantTell
          targetMap = incompleteMap;
        }

        if (targetMap.has(ruleId)) {
          targetMap.get(ruleId)!.nodes.push(nodeInfo);
        } else {
          targetMap.set(ruleId, {
            assertion,
            nodes: [nodeInfo],
            wcagCriteria,
          });
        }
      }
    }

    // RuleResult配列に変換
    const violations: RuleResult[] = Array.from(violationMap.entries()).map(
      ([ruleId, { assertion, nodes, wcagCriteria }]) => ({
        id: ruleId,
        description: assertion.description || assertion.name,
        impact: convertToImpactLevel('failed'),
        nodeCount: nodes.length,
        helpUrl: `https://qualweb.di.fc.ul.pt/rules/${ruleId}`,
        wcagCriteria,
        toolSource: 'qualweb' as const,
        nodes,
        isExperimental: isExperimentalRule(wcagCriteria),
      })
    );

    const passes: RuleResult[] = Array.from(passMap.entries()).map(
      ([ruleId, { assertion, nodes, wcagCriteria }]) => ({
        id: ruleId,
        description: assertion.description || assertion.name,
        nodeCount: nodes.length,
        helpUrl: `https://qualweb.di.fc.ul.pt/rules/${ruleId}`,
        wcagCriteria,
        toolSource: 'qualweb' as const,
        nodes,
      })
    );

    const incomplete: RuleResult[] = Array.from(incompleteMap.entries()).map(
      ([ruleId, { assertion, nodes, wcagCriteria }]) => ({
        id: ruleId,
        description: assertion.description || assertion.name,
        impact: convertToImpactLevel('cantTell'),
        nodeCount: nodes.length,
        helpUrl: `https://qualweb.di.fc.ul.pt/rules/${ruleId}`,
        wcagCriteria,
        toolSource: 'qualweb' as const,
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
    console.error('[qualweb] 分析中にエラーが発生しました:', error);
    emptyResult.duration = Date.now() - startTime;
    const completedTiming = completeAnalyzerTiming(timing, 'error');
    logAnalyzerComplete(completedTiming);
    return emptyResult;
  } finally {
    // QualWebインスタンスをクリーンアップ
    if (qualwebInstance) {
      try {
        await qualwebInstance.stop();
      } catch (stopError) {
        console.warn('[qualweb] インスタンスの停止中にエラーが発生しました:', stopError);
      }
    }
  }
}
