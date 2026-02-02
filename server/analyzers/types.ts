// Tool source identifier
// 既存エンジン: axe-core, pa11y, lighthouse
// 新規エンジン (wcag-coverage-expansion): ibm, alfa, qualweb, wave, custom
export type ToolSource =
  | 'axe-core'
  | 'pa11y'
  | 'lighthouse'
  | 'ibm'       // IBM Equal Access Checker
  | 'alfa'      // Siteimprove Alfa
  | 'qualweb'   // QualWeb
  | 'wave'      // WAVE API
  | 'custom';   // カスタムルール

// Impact level for accessibility violations
export type ImpactLevel = 'critical' | 'serious' | 'moderate' | 'minor';

/**
 * 要素のバウンディングボックス情報
 * @requirement 6.1 - ノードの位置情報を表現
 */
export interface BoundingBox {
  /** 左上X座標（ページ座標系） */
  x: number;
  /** 左上Y座標（ページ座標系） */
  y: number;
  /** 要素の幅（ピクセル） */
  width: number;
  /** 要素の高さ（ピクセル） */
  height: number;
}

/**
 * 個別DOM要素のアクセシビリティ違反情報
 * @requirement 1.1, 1.2, 6.1, 6.4, 6.5, 6.7, 7.2 - 指摘箇所の具体的な特定と視覚的表示
 */
export interface NodeInfo {
  /** CSSセレクタ（要素を一意に特定） */
  target: string;
  /** XPath（要素をDOM上で正確に特定） @requirement 6.4 */
  xpath?: string;
  /** HTML抜粋（最大200文字） */
  html: string;
  /** 周辺HTML（親要素と兄弟要素を含む） @requirement 6.5 */
  contextHtml?: string;
  /** 失敗理由のサマリー（axe-coreのみ） */
  failureSummary?: string;
  /** 要素のバウンディングボックス @requirement 6.1 */
  boundingBox?: BoundingBox;
  /** 要素がビューポート外または非表示かどうか @requirement 6.7 */
  isHidden?: boolean;
  /** 人間が読める要素説明（例：「リンク『詳細はこちら...』」）@requirement 7.2 */
  elementDescription?: string;
  /** 要素個別のスクリーンショット（Base64エンコード）@requirement 7.4 */
  elementScreenshot?: string;
}

/**
 * Lighthouse不明項目の分類理由
 * @requirement 3.4, 3.5 - Lighthouse「不明」項目の削減
 */
export type ClassificationReason = 'manual-review' | 'insufficient-data' | 'partial-support';

// Individual rule result from any analyzer
export interface RuleResult {
  id: string;
  description: string;
  impact?: ImpactLevel;
  nodeCount: number;
  helpUrl: string;
  wcagCriteria: string[];
  toolSource: ToolSource;
  /** ノード情報配列（オプショナル、後方互換性維持） @requirement 1.3 */
  nodes?: NodeInfo[];
  /** Lighthouse生スコア（0-1、Lighthouseのみ） @requirement 3.5 */
  rawScore?: number | null;
  /** 分類理由（Lighthouseのincomplete項目のみ） @requirement 3.4, 3.5 */
  classificationReason?: ClassificationReason;
  /** 複数エンジンで検出された場合の検出元リスト @requirement wcag-coverage-expansion 1.4 */
  toolSources?: ToolSource[];
  /** WCAG 2.2実験的ルールかどうか @requirement wcag-coverage-expansion 2.4 */
  isExperimental?: boolean;
}

// SemiAutoItem型のインポート用前方宣言
import type { SemiAutoItem } from './semi-auto-check';

// Page-level analysis results
export interface PageResult {
  name: string;
  url: string;
  violations: RuleResult[];
  passes: RuleResult[];
  incomplete: RuleResult[];
  /** ページごとのLighthouseスコア */
  lighthouseScores?: LighthouseScores;
  /** ページのスクリーンショット（Base64エンコード） */
  screenshot?: string;
  /** ページごとのAI総評 */
  aiSummary?: AISummary;
  /** 半自動チェック項目 @requirement wcag-coverage-expansion 5.1, 16.2 */
  semiAutoItems?: SemiAutoItem[];
}

// Tool execution info
export interface ToolInfo {
  name: string;
  version: string;
  duration: number; // milliseconds
}

// Lighthouse category scores
export interface LighthouseScores {
  performance: number;      // 0-100
  accessibility: number;    // 0-100
  bestPractices: number;    // 0-100
  seo: number;              // 0-100
  pwa?: number;             // 0-100 (undefined if not applicable)
}

// AI総評の影響度サマリー
export interface ImpactSummary {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}

// 検出された問題の詳細（構造化された改善提案）
export interface DetectedIssue {
  ruleId: string;           // ルールID（例: color-contrast）
  whatIsHappening: string;  // 何が起きているか
  whatIsNeeded: string;     // 修正に必要なもの
  howToFix: string;         // どう修正するか
}

// AI総評（Gemini Flash生成）
export interface AISummary {
  overallAssessment: string;           // 全体的な評価
  detectedIssues: DetectedIssue[];     // 構造化された問題詳細
  prioritizedImprovements: string[];   // 優先度順の改善ポイント
  specificRecommendations: string[];   // 具体的な推奨事項
  impactSummary: ImpactSummary;        // 影響度別の問題数
  generatedAt: string;                 // 生成日時
  isFallback?: boolean;                // フォールバック生成の場合true
}

// Complete accessibility report
export interface AccessibilityReport {
  generatedAt: string;
  summary: {
    totalViolations: number;
    totalPasses: number;
    totalIncomplete: number;
  };
  pages: PageResult[];
  screenshot?: string;
  toolsUsed: ToolInfo[];
  lighthouseScores?: LighthouseScores;
  aiSummary?: AISummary;  // AI総評（オプショナル、後方互換性のため）
  /** 半自動チェック項目（レポートレベル） @requirement wcag-coverage-expansion 5.1, 16.2 */
  semiAutoItems?: SemiAutoItem[];
}

// Common analyzer interface
export interface AnalyzerResult {
  violations: RuleResult[];
  passes: RuleResult[];
  incomplete: RuleResult[];
  duration: number;
}

// Lighthouse specific result
export interface LighthouseResult extends AnalyzerResult {
  scores: LighthouseScores;
}

// Extract WCAG criteria from tags
export function extractWcagCriteria(tags: string[]): string[] {
  const criteria: string[] = [];

  for (const tag of tags) {
    const match = tag.match(/^wcag(\d)(\d)(\d+)$/);
    if (match) {
      const criterion = `${match[1]}.${match[2]}.${match[3]}`;
      if (!criteria.includes(criterion)) {
        criteria.push(criterion);
      }
    }
  }

  return criteria.sort();
}
