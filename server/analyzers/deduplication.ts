/**
 * 重複排除サービス
 *
 * Requirements: 1.4, 6.1, 6.2, 6.3, 6.4, 6.5
 * - CSSセレクタの正規化
 * - WCAG成功基準による一致判定
 * - 違反内容の類似度計算（Levenshtein距離またはシンプルな文字列比較）
 * - 同一違反を統合し、検出元エンジンをリストとして保持
 * - 異なる重要度の場合は最高重要度を採用
 * - エンジン別検出数サマリーを生成
 */

import type { RuleResult, ToolSource, AnalyzerResult, ImpactLevel, NodeInfo } from './types';

/**
 * 重複排除オプション
 */
export interface DeduplicationOptions {
  /** セレクタ類似度の閾値（デフォルト: 0.9） */
  selectorThreshold?: number;
  /** 説明文類似度の閾値（デフォルト: 0.8） */
  descriptionThreshold?: number;
}

/**
 * 重複排除結果
 */
export interface DeduplicatedResult {
  violations: RuleResult[];
  passes: RuleResult[];
  incomplete: RuleResult[];
  engineSummary: Record<ToolSource, { violations: number; passes: number }>;
}

/**
 * 重要度の優先順位マップ
 * 高い数値ほど高い優先度
 */
const IMPACT_PRIORITY: Record<ImpactLevel, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1,
};

/**
 * CSSセレクタを正規化
 * - 前後の空白を削除
 * - 複数の連続空白を単一空白に
 * - コンビネータ（>, +, ~）周辺の空白を正規化
 */
export function normalizeSelector(selector: string): string {
  return selector
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*>\s*/g, ' > ')
    .replace(/\s*\+\s*/g, ' + ')
    .replace(/\s*~\s*/g, ' ~ ');
}

/**
 * 2つの文字列の類似度を計算（0.0〜1.0）
 * シンプルなトライグラム類似度を使用
 */
export function calculateSimilarity(str1: string, str2: string): number {
  // 両方空文字列の場合は完全一致
  if (str1 === '' && str2 === '') {
    return 1.0;
  }

  // 片方が空文字列の場合は不一致
  if (str1 === '' || str2 === '') {
    return 0.0;
  }

  // 完全一致
  if (str1 === str2) {
    return 1.0;
  }

  // トライグラム（3文字連続）を抽出
  const getTrigrams = (s: string): Set<string> => {
    const trigrams = new Set<string>();
    const padded = `  ${s.toLowerCase()}  `;
    for (let i = 0; i < padded.length - 2; i++) {
      trigrams.add(padded.substring(i, i + 3));
    }
    return trigrams;
  };

  const trigrams1 = getTrigrams(str1);
  const trigrams2 = getTrigrams(str2);

  // 共通トライグラムをカウント
  let intersection = 0;
  for (const t of trigrams1) {
    if (trigrams2.has(t)) {
      intersection++;
    }
  }

  // Dice係数を使用
  const union = trigrams1.size + trigrams2.size;
  if (union === 0) {
    return 0.0;
  }

  return (2 * intersection) / union;
}

/**
 * 2つのWCAG基準配列が一致するか確認
 */
function wcagCriteriaMatch(criteria1: string[], criteria2: string[]): boolean {
  if (criteria1.length === 0 || criteria2.length === 0) {
    return false;
  }

  // 少なくとも1つの基準が共通していれば一致とみなす
  const set1 = new Set(criteria1);
  return criteria2.some(c => set1.has(c));
}

/**
 * より高い重要度を返す
 */
function getHigherImpact(impact1?: ImpactLevel, impact2?: ImpactLevel): ImpactLevel | undefined {
  if (!impact1 && !impact2) return undefined;
  if (!impact1) return impact2;
  if (!impact2) return impact1;

  return IMPACT_PRIORITY[impact1] >= IMPACT_PRIORITY[impact2] ? impact1 : impact2;
}

/**
 * ノード情報を統合（重複排除）
 */
function mergeNodes(nodes1: NodeInfo[] | undefined, nodes2: NodeInfo[] | undefined): NodeInfo[] {
  const merged: NodeInfo[] = [];
  const seenSelectors = new Set<string>();

  const addNodes = (nodes: NodeInfo[] | undefined) => {
    if (!nodes) return;
    for (const node of nodes) {
      const normalizedTarget = normalizeSelector(node.target);
      if (!seenSelectors.has(normalizedTarget)) {
        seenSelectors.add(normalizedTarget);
        merged.push(node);
      }
    }
  };

  addNodes(nodes1);
  addNodes(nodes2);

  return merged;
}

/**
 * 2つのRuleResultのキーを生成（重複判定用）
 * - ルールID（または空）
 * - WCAG基準（ソート済み）
 * - 最初のノードのセレクタ（正規化済み）
 */
function generateResultKey(rule: RuleResult): string {
  const sortedCriteria = [...rule.wcagCriteria].sort().join(',');
  const firstSelector = rule.nodes?.[0]?.target
    ? normalizeSelector(rule.nodes[0].target)
    : '';
  return `${sortedCriteria}|${firstSelector}`;
}

/**
 * 2つのRuleResultが重複しているか判定
 */
function isDuplicate(
  rule1: RuleResult,
  rule2: RuleResult,
  options: DeduplicationOptions
): boolean {
  const selectorThreshold = options.selectorThreshold ?? 0.9;
  const descriptionThreshold = options.descriptionThreshold ?? 0.8;

  // WCAG基準が一致しない場合は重複とみなさない
  if (!wcagCriteriaMatch(rule1.wcagCriteria, rule2.wcagCriteria)) {
    return false;
  }

  // セレクタを比較
  const selector1 = rule1.nodes?.[0]?.target ?? '';
  const selector2 = rule2.nodes?.[0]?.target ?? '';

  if (selector1 && selector2) {
    const normalizedSelector1 = normalizeSelector(selector1);
    const normalizedSelector2 = normalizeSelector(selector2);

    // 完全一致の場合
    if (normalizedSelector1 === normalizedSelector2) {
      return true;
    }

    // 類似度による判定
    const selectorSimilarity = calculateSimilarity(normalizedSelector1, normalizedSelector2);
    if (selectorSimilarity >= selectorThreshold) {
      return true;
    }
  }

  // 説明文の類似度で判定（セレクタがない場合やセレクタが異なる場合）
  if (rule1.description && rule2.description) {
    const descSimilarity = calculateSimilarity(rule1.description, rule2.description);
    if (descSimilarity >= descriptionThreshold && wcagCriteriaMatch(rule1.wcagCriteria, rule2.wcagCriteria)) {
      // 同じWCAG基準で説明文が類似していれば重複とみなす
      return selector1 === '' || selector2 === '' || selector1 === selector2;
    }
  }

  return false;
}

/**
 * 2つのRuleResultを統合
 */
function mergeRuleResults(existing: RuleResult, newRule: RuleResult): RuleResult {
  // toolSourcesを統合
  const toolSources: ToolSource[] = existing.toolSources
    ? [...existing.toolSources]
    : [existing.toolSource];

  if (!toolSources.includes(newRule.toolSource)) {
    toolSources.push(newRule.toolSource);
  }

  // ノードを統合
  const mergedNodes = mergeNodes(existing.nodes, newRule.nodes);

  // 高い方の重要度を採用
  const impact = getHigherImpact(existing.impact, newRule.impact);

  // 長い方の説明文を採用
  const description =
    (existing.description?.length ?? 0) >= (newRule.description?.length ?? 0)
      ? existing.description
      : newRule.description;

  // WCAG基準を統合（重複排除）
  const wcagCriteria = [...new Set([...existing.wcagCriteria, ...newRule.wcagCriteria])].sort();

  return {
    ...existing,
    description,
    impact,
    wcagCriteria,
    toolSources,
    nodes: mergedNodes,
    nodeCount: mergedNodes.length,
    // 実験的フラグがある場合は保持
    isExperimental: existing.isExperimental || newRule.isExperimental,
  };
}

/**
 * RuleResult配列を重複排除
 */
function deduplicateRules(
  rules: RuleResult[],
  options: DeduplicationOptions
): RuleResult[] {
  const deduplicated: RuleResult[] = [];

  for (const rule of rules) {
    let merged = false;

    for (let i = 0; i < deduplicated.length; i++) {
      if (isDuplicate(deduplicated[i], rule, options)) {
        deduplicated[i] = mergeRuleResults(deduplicated[i], rule);
        merged = true;
        break;
      }
    }

    if (!merged) {
      // 新規ルールの場合、toolSourcesを初期化
      deduplicated.push({
        ...rule,
        toolSources: [rule.toolSource],
      });
    }
  }

  return deduplicated;
}

/**
 * 重複排除サービス
 */
export class DeduplicationService {
  /**
   * 複数のAnalyzerResultを重複排除して統合
   */
  deduplicate(
    results: AnalyzerResult[],
    options: DeduplicationOptions = {}
  ): DeduplicatedResult {
    // 全結果を収集
    const allViolations: RuleResult[] = [];
    const allPasses: RuleResult[] = [];
    const allIncomplete: RuleResult[] = [];

    // エンジン別サマリーを計算
    const engineSummary: Record<ToolSource, { violations: number; passes: number }> = {} as Record<
      ToolSource,
      { violations: number; passes: number }
    >;

    for (const result of results) {
      allViolations.push(...result.violations);
      allPasses.push(...result.passes);
      allIncomplete.push(...result.incomplete);

      // エンジン別サマリーを更新
      for (const v of result.violations) {
        if (!engineSummary[v.toolSource]) {
          engineSummary[v.toolSource] = { violations: 0, passes: 0 };
        }
        engineSummary[v.toolSource].violations++;
      }

      for (const p of result.passes) {
        if (!engineSummary[p.toolSource]) {
          engineSummary[p.toolSource] = { violations: 0, passes: 0 };
        }
        engineSummary[p.toolSource].passes++;
      }
    }

    // 各カテゴリを重複排除
    const deduplicatedViolations = deduplicateRules(allViolations, options);
    const deduplicatedPasses = deduplicateRules(allPasses, options);
    const deduplicatedIncomplete = deduplicateRules(allIncomplete, options);

    return {
      violations: deduplicatedViolations,
      passes: deduplicatedPasses,
      incomplete: deduplicatedIncomplete,
      engineSummary,
    };
  }
}
