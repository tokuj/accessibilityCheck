/**
 * WCAGカバレッジサービス
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 * - 全WCAG成功基準（1.1.1〜4.1.3）のマスターリストを定義
 * - 各基準のテスト状態（自動/半自動/手動/未テスト）を計算
 * - 各基準の結果（合格/違反/要確認/該当なし）を判定
 * - 検出に使用したツールを記録
 * - 適合レベル別（A/AA/AAA）カバレッジ率を計算
 * - カバレッジマトリクスをCSV形式に変換
 */

import type { AccessibilityReport, ToolSource, RuleResult } from './types';

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
 * WCAG成功基準のマスター定義
 */
export interface WcagCriterion {
  criterion: string;
  level: 'A' | 'AA' | 'AAA';
  title: string;
  wcagVersion: '2.0' | '2.1' | '2.2';
}

/**
 * 成功基準の状態
 * @requirement 7.1 - WCAGカバレッジマトリクスを生成
 */
export interface CriterionStatus {
  criterion: string;
  level: 'A' | 'AA' | 'AAA';
  title: string;
  method: TestMethod;
  result: TestResult;
  tools: ToolSource[];
}

/**
 * カバレッジマトリクス
 * @requirement 7.3 - WCAG適合レベル（A/AA/AAA）ごとのカバレッジ率を計算して表示
 */
export interface CoverageMatrix {
  criteria: CriterionStatus[];
  summary: {
    levelA: { covered: number; total: number };
    levelAA: { covered: number; total: number };
    levelAAA: { covered: number; total: number };
  };
}

/**
 * 半自動チェック回答
 */
export type SemiAutoAnswer = 'appropriate' | 'inappropriate' | 'cannot-determine';

/**
 * 半自動チェック結果（AccessibilityReport拡張用）
 */
export interface SemiAutoResult {
  itemId: string;
  ruleId: string;
  wcagCriteria: string[];
  answer: SemiAutoAnswer;
  answeredAt: string;
}

// AccessibilityReportにsemiAutoResultsを追加する型拡張
declare module './types' {
  interface AccessibilityReport {
    semiAutoResults?: SemiAutoResult[];
  }
}

/**
 * WCAG成功基準マスターリスト
 * WCAG 2.0, 2.1, 2.2の全成功基準を定義
 * @requirement 7.1 - 各WCAG成功基準（1.1.1〜4.1.3）
 */
export const WCAG_CRITERIA_MASTER_LIST: WcagCriterion[] = [
  // 原則1: 知覚可能 (Perceivable)
  // ガイドライン1.1: 代替テキスト
  { criterion: '1.1.1', level: 'A', title: '非テキストコンテンツ', wcagVersion: '2.0' },

  // ガイドライン1.2: 時間依存メディア
  { criterion: '1.2.1', level: 'A', title: '音声のみ及び映像のみ（収録済）', wcagVersion: '2.0' },
  { criterion: '1.2.2', level: 'A', title: 'キャプション（収録済）', wcagVersion: '2.0' },
  { criterion: '1.2.3', level: 'A', title: '音声解説又はメディアに対する代替（収録済）', wcagVersion: '2.0' },
  { criterion: '1.2.4', level: 'AA', title: 'キャプション（ライブ）', wcagVersion: '2.0' },
  { criterion: '1.2.5', level: 'AA', title: '音声解説（収録済）', wcagVersion: '2.0' },
  { criterion: '1.2.6', level: 'AAA', title: '手話（収録済）', wcagVersion: '2.0' },
  { criterion: '1.2.7', level: 'AAA', title: '拡張音声解説（収録済）', wcagVersion: '2.0' },
  { criterion: '1.2.8', level: 'AAA', title: 'メディアに対する代替（収録済）', wcagVersion: '2.0' },
  { criterion: '1.2.9', level: 'AAA', title: '音声のみ（ライブ）', wcagVersion: '2.0' },

  // ガイドライン1.3: 適応可能
  { criterion: '1.3.1', level: 'A', title: '情報及び関係性', wcagVersion: '2.0' },
  { criterion: '1.3.2', level: 'A', title: '意味のある順序', wcagVersion: '2.0' },
  { criterion: '1.3.3', level: 'A', title: '感覚的な特徴', wcagVersion: '2.0' },
  { criterion: '1.3.4', level: 'AA', title: '表示の向き', wcagVersion: '2.1' },
  { criterion: '1.3.5', level: 'AA', title: '入力目的の特定', wcagVersion: '2.1' },
  { criterion: '1.3.6', level: 'AAA', title: '目的の特定', wcagVersion: '2.1' },

  // ガイドライン1.4: 判別可能
  { criterion: '1.4.1', level: 'A', title: '色の使用', wcagVersion: '2.0' },
  { criterion: '1.4.2', level: 'A', title: '音声の制御', wcagVersion: '2.0' },
  { criterion: '1.4.3', level: 'AA', title: 'コントラスト（最低限）', wcagVersion: '2.0' },
  { criterion: '1.4.4', level: 'AA', title: 'テキストのサイズ変更', wcagVersion: '2.0' },
  { criterion: '1.4.5', level: 'AA', title: '文字画像', wcagVersion: '2.0' },
  { criterion: '1.4.6', level: 'AAA', title: 'コントラスト（高度）', wcagVersion: '2.0' },
  { criterion: '1.4.7', level: 'AAA', title: '小さな背景音又は背景音なし', wcagVersion: '2.0' },
  { criterion: '1.4.8', level: 'AAA', title: '視覚的提示', wcagVersion: '2.0' },
  { criterion: '1.4.9', level: 'AAA', title: '文字画像（例外なし）', wcagVersion: '2.0' },
  { criterion: '1.4.10', level: 'AA', title: 'リフロー', wcagVersion: '2.1' },
  { criterion: '1.4.11', level: 'AA', title: '非テキストのコントラスト', wcagVersion: '2.1' },
  { criterion: '1.4.12', level: 'AA', title: 'テキストの間隔', wcagVersion: '2.1' },
  { criterion: '1.4.13', level: 'AA', title: 'ホバー又はフォーカスで表示されるコンテンツ', wcagVersion: '2.1' },

  // 原則2: 操作可能 (Operable)
  // ガイドライン2.1: キーボード操作可能
  { criterion: '2.1.1', level: 'A', title: 'キーボード', wcagVersion: '2.0' },
  { criterion: '2.1.2', level: 'A', title: 'キーボードトラップなし', wcagVersion: '2.0' },
  { criterion: '2.1.3', level: 'AAA', title: 'キーボード（例外なし）', wcagVersion: '2.0' },
  { criterion: '2.1.4', level: 'A', title: '文字キーのショートカット', wcagVersion: '2.1' },

  // ガイドライン2.2: 十分な時間
  { criterion: '2.2.1', level: 'A', title: 'タイミング調整可能', wcagVersion: '2.0' },
  { criterion: '2.2.2', level: 'A', title: '一時停止、停止、非表示', wcagVersion: '2.0' },
  { criterion: '2.2.3', level: 'AAA', title: 'タイミング非依存', wcagVersion: '2.0' },
  { criterion: '2.2.4', level: 'AAA', title: '割込み', wcagVersion: '2.0' },
  { criterion: '2.2.5', level: 'AAA', title: '再認証', wcagVersion: '2.0' },
  { criterion: '2.2.6', level: 'AAA', title: 'タイムアウト', wcagVersion: '2.1' },

  // ガイドライン2.3: 発作と身体的反応
  { criterion: '2.3.1', level: 'A', title: '3回の閃光、又は閾値以下', wcagVersion: '2.0' },
  { criterion: '2.3.2', level: 'AAA', title: '3回の閃光', wcagVersion: '2.0' },
  { criterion: '2.3.3', level: 'AAA', title: 'インタラクションによるアニメーション', wcagVersion: '2.1' },

  // ガイドライン2.4: ナビゲーション可能
  { criterion: '2.4.1', level: 'A', title: 'ブロックスキップ', wcagVersion: '2.0' },
  { criterion: '2.4.2', level: 'A', title: 'ページタイトル', wcagVersion: '2.0' },
  { criterion: '2.4.3', level: 'A', title: 'フォーカス順序', wcagVersion: '2.0' },
  { criterion: '2.4.4', level: 'A', title: 'リンクの目的（コンテキスト内）', wcagVersion: '2.0' },
  { criterion: '2.4.5', level: 'AA', title: '複数の手段', wcagVersion: '2.0' },
  { criterion: '2.4.6', level: 'AA', title: '見出し及びラベル', wcagVersion: '2.0' },
  { criterion: '2.4.7', level: 'AA', title: 'フォーカスの可視化', wcagVersion: '2.0' },
  { criterion: '2.4.8', level: 'AAA', title: '現在位置', wcagVersion: '2.0' },
  { criterion: '2.4.9', level: 'AAA', title: 'リンクの目的（リンクのみ）', wcagVersion: '2.0' },
  { criterion: '2.4.10', level: 'AAA', title: 'セクション見出し', wcagVersion: '2.0' },
  { criterion: '2.4.11', level: 'AA', title: 'フォーカスの非隠蔽（最低限）', wcagVersion: '2.2' },
  { criterion: '2.4.12', level: 'AAA', title: 'フォーカスの非隠蔽（拡張）', wcagVersion: '2.2' },
  { criterion: '2.4.13', level: 'AAA', title: 'フォーカスの外観', wcagVersion: '2.2' },

  // ガイドライン2.5: 入力モダリティ
  { criterion: '2.5.1', level: 'A', title: 'ポインタジェスチャ', wcagVersion: '2.1' },
  { criterion: '2.5.2', level: 'A', title: 'ポインタのキャンセル', wcagVersion: '2.1' },
  { criterion: '2.5.3', level: 'A', title: 'ラベルを含む名前', wcagVersion: '2.1' },
  { criterion: '2.5.4', level: 'A', title: '動きによる起動', wcagVersion: '2.1' },
  { criterion: '2.5.5', level: 'AAA', title: 'ターゲットのサイズ（拡張）', wcagVersion: '2.1' },
  { criterion: '2.5.6', level: 'AAA', title: '入力メカニズムの共存', wcagVersion: '2.1' },
  { criterion: '2.5.7', level: 'AA', title: 'ドラッグ動作', wcagVersion: '2.2' },
  { criterion: '2.5.8', level: 'AA', title: 'ターゲットのサイズ（最低限）', wcagVersion: '2.2' },

  // 原則3: 理解可能 (Understandable)
  // ガイドライン3.1: 読み取り可能
  { criterion: '3.1.1', level: 'A', title: 'ページの言語', wcagVersion: '2.0' },
  { criterion: '3.1.2', level: 'AA', title: '一部分の言語', wcagVersion: '2.0' },
  { criterion: '3.1.3', level: 'AAA', title: '一般的ではない用語', wcagVersion: '2.0' },
  { criterion: '3.1.4', level: 'AAA', title: '略語', wcagVersion: '2.0' },
  { criterion: '3.1.5', level: 'AAA', title: '読解レベル', wcagVersion: '2.0' },
  { criterion: '3.1.6', level: 'AAA', title: '発音', wcagVersion: '2.0' },

  // ガイドライン3.2: 予測可能
  { criterion: '3.2.1', level: 'A', title: 'フォーカス時', wcagVersion: '2.0' },
  { criterion: '3.2.2', level: 'A', title: '入力時', wcagVersion: '2.0' },
  { criterion: '3.2.3', level: 'AA', title: '一貫したナビゲーション', wcagVersion: '2.0' },
  { criterion: '3.2.4', level: 'AA', title: '一貫した識別性', wcagVersion: '2.0' },
  { criterion: '3.2.5', level: 'AAA', title: '要求による変化', wcagVersion: '2.0' },
  { criterion: '3.2.6', level: 'A', title: '一貫したヘルプ', wcagVersion: '2.2' },

  // ガイドライン3.3: 入力支援
  { criterion: '3.3.1', level: 'A', title: 'エラーの特定', wcagVersion: '2.0' },
  { criterion: '3.3.2', level: 'A', title: 'ラベル又は説明', wcagVersion: '2.0' },
  { criterion: '3.3.3', level: 'AA', title: 'エラー修正の提案', wcagVersion: '2.0' },
  { criterion: '3.3.4', level: 'AA', title: 'エラー回避（法的、金融、データ）', wcagVersion: '2.0' },
  { criterion: '3.3.5', level: 'AAA', title: 'ヘルプ', wcagVersion: '2.0' },
  { criterion: '3.3.6', level: 'AAA', title: 'エラー回避（すべて）', wcagVersion: '2.0' },
  { criterion: '3.3.7', level: 'A', title: '冗長な入力', wcagVersion: '2.2' },
  { criterion: '3.3.8', level: 'AA', title: 'アクセシブルな認証（最低限）', wcagVersion: '2.2' },
  { criterion: '3.3.9', level: 'AAA', title: 'アクセシブルな認証（拡張）', wcagVersion: '2.2' },

  // 原則4: 堅牢 (Robust)
  // ガイドライン4.1: 互換性
  { criterion: '4.1.1', level: 'A', title: '構文解析', wcagVersion: '2.0' },
  { criterion: '4.1.2', level: 'A', title: '名前、役割、値', wcagVersion: '2.0' },
  { criterion: '4.1.3', level: 'AA', title: 'ステータスメッセージ', wcagVersion: '2.1' },
];

/**
 * WCAGカバレッジサービス
 * @requirement 7.1 - WCAGカバレッジマトリクスを生成
 * @requirement 7.3 - WCAG適合レベル（A/AA/AAA）ごとのカバレッジ率を計算
 * @requirement 7.4 - カバレッジマトリクスをCSV形式で出力
 */
export class CoverageService {
  /**
   * カバレッジマトリクスを計算する
   * @requirement 7.1 - WCAGカバレッジマトリクスを生成
   */
  calculateCoverage(report: AccessibilityReport): CoverageMatrix {
    // 初期状態：全基準を未テストとして設定
    const criteriaStatusMap = new Map<string, CriterionStatus>();

    for (const criterion of WCAG_CRITERIA_MASTER_LIST) {
      criteriaStatusMap.set(criterion.criterion, {
        criterion: criterion.criterion,
        level: criterion.level,
        title: criterion.title,
        method: 'not-tested',
        result: 'not-applicable',
        tools: [],
      });
    }

    // 全ページの結果を処理
    for (const page of report.pages) {
      this.processRuleResults(page.violations, 'fail', 'auto', criteriaStatusMap);
      this.processRuleResults(page.incomplete, 'needs-review', 'auto', criteriaStatusMap);
      this.processRuleResults(page.passes, 'pass', 'auto', criteriaStatusMap);
    }

    // 半自動チェック結果を処理
    if (report.semiAutoResults) {
      for (const result of report.semiAutoResults) {
        const testResult = this.semiAutoAnswerToResult(result.answer);
        for (const criterionId of result.wcagCriteria) {
          const status = criteriaStatusMap.get(criterionId);
          if (status) {
            // 半自動チェックは自動テストがまだ行われていない場合のみ更新
            if (status.method === 'not-tested') {
              status.method = 'semi-auto';
              status.result = testResult;
            }
          }
        }
      }
    }

    // カバレッジサマリーを計算
    const criteria = Array.from(criteriaStatusMap.values());
    const summary = this.calculateSummary(criteria);

    return { criteria, summary };
  }

  /**
   * カバレッジマトリクスをCSV形式に変換する
   * @requirement 7.4 - カバレッジマトリクスをCSV形式で出力
   */
  exportCSV(matrix: CoverageMatrix): string {
    const lines: string[] = [];

    // ヘッダー行
    lines.push('成功基準,タイトル,レベル,テスト方法,結果,検出ツール');

    // データ行
    for (const status of matrix.criteria) {
      const toolsStr = status.tools.length > 0 ? status.tools.join('; ') : '-';
      const line = [
        status.criterion,
        this.escapeCSV(status.title),
        status.level,
        status.method,
        status.result,
        toolsStr,
      ].join(',');
      lines.push(line);
    }

    // 空行
    lines.push('');

    // カバレッジサマリー
    lines.push('カバレッジサマリー');
    lines.push(`Level A,${matrix.summary.levelA.covered}/${matrix.summary.levelA.total}`);
    lines.push(`Level AA,${matrix.summary.levelAA.covered}/${matrix.summary.levelAA.total}`);
    lines.push(`Level AAA,${matrix.summary.levelAAA.covered}/${matrix.summary.levelAAA.total}`);

    return lines.join('\n');
  }

  /**
   * ルール結果を処理してカバレッジマップを更新
   */
  private processRuleResults(
    rules: RuleResult[],
    result: TestResult,
    method: TestMethod,
    statusMap: Map<string, CriterionStatus>
  ): void {
    for (const rule of rules) {
      for (const criterionId of rule.wcagCriteria) {
        const status = statusMap.get(criterionId);
        if (status) {
          // ツールを記録
          if (!status.tools.includes(rule.toolSource)) {
            status.tools.push(rule.toolSource);
          }

          // テスト方法を更新
          if (status.method === 'not-tested') {
            status.method = method;
          }

          // 結果を更新（優先順位: fail > needs-review > pass > not-applicable）
          status.result = this.mergeResult(status.result, result);
        }
      }
    }
  }

  /**
   * 結果をマージする（優先順位: fail > needs-review > pass > not-applicable）
   */
  private mergeResult(current: TestResult, newResult: TestResult): TestResult {
    const priority: Record<TestResult, number> = {
      fail: 4,
      'needs-review': 3,
      pass: 2,
      'not-applicable': 1,
    };

    return priority[newResult] > priority[current] ? newResult : current;
  }

  /**
   * 半自動チェック回答をテスト結果に変換
   */
  private semiAutoAnswerToResult(answer: SemiAutoAnswer): TestResult {
    switch (answer) {
      case 'appropriate':
        return 'pass';
      case 'inappropriate':
        return 'fail';
      case 'cannot-determine':
        return 'needs-review';
    }
  }

  /**
   * レベル別カバレッジサマリーを計算
   */
  private calculateSummary(criteria: CriterionStatus[]): CoverageMatrix['summary'] {
    const levelA = criteria.filter(c => c.level === 'A');
    const levelAA = criteria.filter(c => c.level === 'AA');
    const levelAAA = criteria.filter(c => c.level === 'AAA');

    return {
      levelA: {
        covered: levelA.filter(c => c.method !== 'not-tested').length,
        total: levelA.length,
      },
      levelAA: {
        covered: levelAA.filter(c => c.method !== 'not-tested').length,
        total: levelAA.length,
      },
      levelAAA: {
        covered: levelAAA.filter(c => c.method !== 'not-tested').length,
        total: levelAAA.length,
      },
    };
  }

  /**
   * CSV用にエスケープ
   */
  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
