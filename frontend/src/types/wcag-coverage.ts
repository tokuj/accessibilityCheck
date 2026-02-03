/**
 * WCAGカバレッジ関連の型定義
 *
 * Requirements: wcag-coverage-expansion 7.1, 7.2, 7.3
 * Task 8.1, 8.2, 12.1: カバレッジサービスとUIコンポーネントで共有
 *
 * - server/analyzers/coverage.tsの型定義をフロントエンドでも使用
 */

import type { ToolSource } from './analysis-options';

/**
 * テスト方法
 * @requirement 7.2 - テスト状態（自動テスト済み/半自動確認済み/未テスト）
 */
export type TestMethod = 'auto' | 'semi-auto' | 'manual' | 'not-tested';

/**
 * テスト結果
 * @requirement 7.2 - 結果（合格/違反/要確認/該当なし）
 */
export type TestResult = 'pass' | 'fail' | 'needs-review' | 'not-applicable';

/**
 * 成功基準の状態
 * @requirement 7.1 - WCAGカバレッジマトリクスを生成
 */
export interface CriterionStatus {
  /** 成功基準番号（例: "1.1.1"） */
  criterion: string;
  /** 適合レベル */
  level: 'A' | 'AA' | 'AAA';
  /** 成功基準のタイトル */
  title: string;
  /** テスト方法 */
  method: TestMethod;
  /** テスト結果 */
  result: TestResult;
  /** 検出に使用したツール */
  tools: ToolSource[];
}

/**
 * カバレッジマトリクス
 * @requirement 7.3 - WCAG適合レベル（A/AA/AAA）ごとのカバレッジ率を計算して表示
 */
export interface CoverageMatrix {
  /** 各成功基準の状態 */
  criteria: CriterionStatus[];
  /** レベル別カバレッジサマリー */
  summary: {
    levelA: { covered: number; total: number };
    levelAA: { covered: number; total: number };
    levelAAA: { covered: number; total: number };
  };
}

/**
 * テスト方法の日本語ラベル
 */
export const TEST_METHOD_LABELS: Record<TestMethod, string> = {
  auto: '自動テスト',
  'semi-auto': '半自動確認',
  manual: '手動テスト',
  'not-tested': '未テスト',
};

/**
 * テスト結果の日本語ラベル
 */
export const TEST_RESULT_LABELS: Record<TestResult, string> = {
  pass: '合格',
  fail: '違反',
  'needs-review': '要確認',
  'not-applicable': '該当なし',
};

/**
 * テスト方法の色（MUI theme.palette準拠）
 * @requirement 7.5 - 「自動/半自動/手動」カテゴリを色分け
 */
export const TEST_METHOD_COLORS: Record<TestMethod, string> = {
  auto: 'primary',      // 青色
  'semi-auto': 'warning', // 黄色
  manual: 'default',    // グレー
  'not-tested': 'default', // グレー
};

/**
 * テスト結果の色（MUI theme.palette準拠）
 */
export const TEST_RESULT_COLORS: Record<TestResult, 'success' | 'error' | 'warning' | 'default'> = {
  pass: 'success',      // 緑色
  fail: 'error',        // 赤色
  'needs-review': 'warning', // 黄色
  'not-applicable': 'default', // グレー
};
