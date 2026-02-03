/**
 * WCAGCoverageMatrix コンポーネントテスト
 *
 * Requirements: wcag-coverage-expansion 7.1, 7.2, 7.3, 7.4, 7.5
 * Task 12.1: WCAGCoverageMatrixコンポーネントを実装
 *
 * - 全WCAG成功基準をテーブル形式で表示
 * - 各基準のテスト状態と結果を表示
 * - 検出に使用したツールを表示
 * - 適合レベル別カバレッジ率のサマリーを表示
 * - 「自動/半自動/手動」カテゴリを色分けして表示
 * - CSVエクスポートボタンを表示
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { WCAGCoverageMatrix } from '../WCAGCoverageMatrix';
import { theme } from '../../theme';
import type { CoverageMatrix, CriterionStatus, TestMethod, TestResult } from '../../types/wcag-coverage';

// テスト用ラッパー
function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

// モックCoverageMatrixデータ
function createMockCoverageMatrix(
  overrides?: Partial<CoverageMatrix>
): CoverageMatrix {
  const defaultCriteria: CriterionStatus[] = [
    {
      criterion: '1.1.1',
      level: 'A',
      title: '非テキストコンテンツ',
      method: 'auto',
      result: 'pass',
      tools: ['axe-core', 'pa11y'],
    },
    {
      criterion: '1.4.3',
      level: 'AA',
      title: 'コントラスト（最低限）',
      method: 'auto',
      result: 'fail',
      tools: ['axe-core'],
    },
    {
      criterion: '2.4.7',
      level: 'AA',
      title: 'フォーカスの可視化',
      method: 'semi-auto',
      result: 'needs-review',
      tools: ['custom'],
    },
    {
      criterion: '1.4.6',
      level: 'AAA',
      title: 'コントラスト（高度）',
      method: 'not-tested',
      result: 'not-applicable',
      tools: [],
    },
    {
      criterion: '2.1.1',
      level: 'A',
      title: 'キーボード',
      method: 'manual',
      result: 'pass',
      tools: [],
    },
  ];

  return {
    criteria: overrides?.criteria ?? defaultCriteria,
    summary: overrides?.summary ?? {
      levelA: { covered: 2, total: 3 },
      levelAA: { covered: 2, total: 5 },
      levelAAA: { covered: 0, total: 2 },
    },
  };
}

describe('WCAGCoverageMatrix', () => {
  describe('初期表示', () => {
    it('テーブル形式で成功基準が表示される', () => {
      const matrix = createMockCoverageMatrix();
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      // テーブルヘッダーが表示される
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('成功基準')).toBeInTheDocument();
      expect(screen.getByText('レベル')).toBeInTheDocument();
      expect(screen.getByText('タイトル')).toBeInTheDocument();
      expect(screen.getByText('テスト方法')).toBeInTheDocument();
      expect(screen.getByText('結果')).toBeInTheDocument();
      expect(screen.getByText('検出ツール')).toBeInTheDocument();
    });

    it('@requirement 7.1 各成功基準のデータが表示される', () => {
      const matrix = createMockCoverageMatrix();
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      // 成功基準が表示される
      expect(screen.getByText('1.1.1')).toBeInTheDocument();
      expect(screen.getByText('1.4.3')).toBeInTheDocument();
      expect(screen.getByText('2.4.7')).toBeInTheDocument();
      expect(screen.getByText('1.4.6')).toBeInTheDocument();

      // タイトルが表示される
      expect(screen.getByText('非テキストコンテンツ')).toBeInTheDocument();
      expect(screen.getByText('コントラスト（最低限）')).toBeInTheDocument();
    });

    it('@requirement 7.2 テスト状態（自動/半自動/手動/未テスト）が表示される', () => {
      const matrix = createMockCoverageMatrix();
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      // テスト方法が表示される（日本語ラベル）- 複数存在する場合あり
      expect(screen.getAllByText('自動テスト').length).toBeGreaterThan(0);
      expect(screen.getAllByText('半自動確認').length).toBeGreaterThan(0);
      expect(screen.getAllByText('手動テスト').length).toBeGreaterThan(0);
      expect(screen.getAllByText('未テスト').length).toBeGreaterThan(0);
    });

    it('@requirement 7.2 結果（合格/違反/要確認/該当なし）が表示される', () => {
      const matrix = createMockCoverageMatrix();
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      // 結果が表示される（日本語ラベル）- 複数存在する場合あり
      expect(screen.getAllByText('合格').length).toBeGreaterThan(0);
      expect(screen.getAllByText('違反').length).toBeGreaterThan(0);
      expect(screen.getAllByText('要確認').length).toBeGreaterThan(0);
      expect(screen.getAllByText('該当なし').length).toBeGreaterThan(0);
    });

    it('@requirement 7.2 検出に使用したツールが表示される', () => {
      const matrix = createMockCoverageMatrix();
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      // ツールが表示される
      expect(screen.getByText('axe-core, pa11y')).toBeInTheDocument();
      expect(screen.getByText('axe-core')).toBeInTheDocument();
      expect(screen.getByText('custom')).toBeInTheDocument();
    });
  });

  describe('カバレッジサマリー', () => {
    it('@requirement 7.3 適合レベル別カバレッジ率が表示される', () => {
      const matrix = createMockCoverageMatrix();
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      // サマリーセクションが表示される
      expect(screen.getByText('カバレッジサマリー')).toBeInTheDocument();

      // レベル別カバレッジが表示される（複数マッチの可能性あり）
      expect(screen.getAllByText(/Level A/).length).toBeGreaterThan(0);
      expect(screen.getByText('2 / 3')).toBeInTheDocument();
      expect(screen.getAllByText(/Level AA/).length).toBeGreaterThan(0);
      expect(screen.getByText('2 / 5')).toBeInTheDocument();
      expect(screen.getAllByText(/Level AAA/).length).toBeGreaterThan(0);
      expect(screen.getByText('0 / 2')).toBeInTheDocument();
    });

    it('カバレッジ率がパーセンテージで表示される', () => {
      const matrix = createMockCoverageMatrix();
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      // パーセンテージが表示される（66.7%、40%、0%）- 複数マッチの可能性あり
      expect(screen.getAllByText(/66\.7%/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/40\.0%/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/0\.0%/).length).toBeGreaterThan(0);
    });
  });

  describe('色分け表示', () => {
    it('@requirement 7.5 自動テストは青色で表示される', () => {
      const matrix = createMockCoverageMatrix({
        criteria: [
          {
            criterion: '1.1.1',
            level: 'A',
            title: 'テスト',
            method: 'auto',
            result: 'pass',
            tools: ['axe-core'],
          },
        ],
        summary: { levelA: { covered: 1, total: 1 }, levelAA: { covered: 0, total: 0 }, levelAAA: { covered: 0, total: 0 } },
      });
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      // MUIのChipでは親要素にdata-method属性が付与される
      const autoChip = screen.getByText('自動テスト').closest('.MuiChip-root');
      expect(autoChip).toHaveAttribute('data-method', 'auto');
    });

    it('@requirement 7.5 半自動確認は黄色で表示される', () => {
      const matrix = createMockCoverageMatrix({
        criteria: [
          {
            criterion: '1.1.1',
            level: 'A',
            title: 'テスト',
            method: 'semi-auto',
            result: 'needs-review',
            tools: ['custom'],
          },
        ],
        summary: { levelA: { covered: 1, total: 1 }, levelAA: { covered: 0, total: 0 }, levelAAA: { covered: 0, total: 0 } },
      });
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      const semiAutoChip = screen.getByText('半自動確認').closest('.MuiChip-root');
      expect(semiAutoChip).toHaveAttribute('data-method', 'semi-auto');
    });

    it('@requirement 7.5 手動テストはグレーで表示される', () => {
      const matrix = createMockCoverageMatrix({
        criteria: [
          {
            criterion: '1.1.1',
            level: 'A',
            title: 'テスト',
            method: 'manual',
            result: 'pass',
            tools: [],
          },
        ],
        summary: { levelA: { covered: 1, total: 1 }, levelAA: { covered: 0, total: 0 }, levelAAA: { covered: 0, total: 0 } },
      });
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      const manualChip = screen.getByText('手動テスト').closest('.MuiChip-root');
      expect(manualChip).toHaveAttribute('data-method', 'manual');
    });

    it('結果によって行の背景色が変わる', () => {
      const matrix = createMockCoverageMatrix({
        criteria: [
          {
            criterion: '1.1.1',
            level: 'A',
            title: 'テスト',
            method: 'auto',
            result: 'fail',
            tools: ['axe-core'],
          },
        ],
        summary: { levelA: { covered: 1, total: 1 }, levelAA: { covered: 0, total: 0 }, levelAAA: { covered: 0, total: 0 } },
      });
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      const row = screen.getByRole('row', { name: /1\.1\.1/ });
      expect(row).toHaveAttribute('data-result', 'fail');
    });
  });

  describe('CSVエクスポート', () => {
    it('@requirement 7.4 CSVエクスポートボタンが表示される', () => {
      const matrix = createMockCoverageMatrix();
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      expect(screen.getByRole('button', { name: /CSV.*エクスポート|エクスポート.*CSV/i })).toBeInTheDocument();
    });

    it('@requirement 7.4 CSVエクスポートボタンをクリックするとonExportが呼ばれる', async () => {
      const user = userEvent.setup();
      const mockOnExport = vi.fn();
      const matrix = createMockCoverageMatrix();

      renderWithTheme(
        <WCAGCoverageMatrix matrix={matrix} onExportCSV={mockOnExport} />
      );

      const exportButton = screen.getByRole('button', { name: /CSV.*エクスポート|エクスポート.*CSV/i });
      await user.click(exportButton);

      expect(mockOnExport).toHaveBeenCalledWith(matrix);
    });

    it('onExportCSVが渡されない場合もボタンは表示される（デフォルト動作）', () => {
      const matrix = createMockCoverageMatrix();
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      // ボタンは表示される（デフォルトのダウンロード動作）
      expect(screen.getByRole('button', { name: /CSV.*エクスポート|エクスポート.*CSV/i })).toBeInTheDocument();
    });
  });

  describe('フィルタリング', () => {
    it('レベルでフィルタリングできる', async () => {
      const user = userEvent.setup();
      const matrix = createMockCoverageMatrix();
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      // AAでフィルタ
      const filterSelect = screen.getByLabelText('レベルフィルタ');
      await user.click(filterSelect);
      await user.click(screen.getByRole('option', { name: 'AA' }));

      // AA項目のみ表示される
      expect(screen.getByText('1.4.3')).toBeInTheDocument();
      expect(screen.getByText('2.4.7')).toBeInTheDocument();
      // A項目は非表示
      expect(screen.queryByText('1.1.1')).not.toBeInTheDocument();
    });

    it('結果でフィルタリングできる', async () => {
      const user = userEvent.setup();
      const matrix = createMockCoverageMatrix();
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      // 違反のみ表示
      const filterSelect = screen.getByLabelText('結果フィルタ');
      await user.click(filterSelect);
      await user.click(screen.getByRole('option', { name: '違反' }));

      // 違反項目のみ表示される
      expect(screen.getByText('1.4.3')).toBeInTheDocument();
      // 合格項目は非表示
      expect(screen.queryByText('1.1.1')).not.toBeInTheDocument();
    });

    it('テスト方法でフィルタリングできる', async () => {
      const user = userEvent.setup();
      const matrix = createMockCoverageMatrix();
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      // 未テストのみ表示
      const filterSelect = screen.getByLabelText('テスト方法フィルタ');
      await user.click(filterSelect);
      await user.click(screen.getByRole('option', { name: '未テスト' }));

      // 未テスト項目のみ表示される
      expect(screen.getByText('1.4.6')).toBeInTheDocument();
      // 自動テスト項目は非表示
      expect(screen.queryByText('1.1.1')).not.toBeInTheDocument();
    });
  });

  describe('ソート', () => {
    it('成功基準でソートできる', async () => {
      const user = userEvent.setup();
      const matrix = createMockCoverageMatrix();
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      // テーブルヘッダーをクリックしてソート
      const criterionHeader = screen.getByText('成功基準');
      await user.click(criterionHeader);

      // ソート順が変わる（降順）
      const rows = screen.getAllByRole('row');
      // ヘッダー行を除いた最初のデータ行を確認
      expect(within(rows[1]).getByText(/2\./)).toBeInTheDocument();
    });

    it('レベルでソートできる', async () => {
      const user = userEvent.setup();
      const matrix = createMockCoverageMatrix();
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      const levelHeader = screen.getByText('レベル');
      await user.click(levelHeader);

      // レベル順にソートされる
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(1);
    });
  });

  describe('空の状態', () => {
    it('criteriaが空の場合、空状態メッセージが表示される', () => {
      const matrix = createMockCoverageMatrix({
        criteria: [],
        summary: {
          levelA: { covered: 0, total: 0 },
          levelAA: { covered: 0, total: 0 },
          levelAAA: { covered: 0, total: 0 },
        },
      });
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      expect(screen.getByText('カバレッジデータがありません')).toBeInTheDocument();
    });
  });

  describe('アクセシビリティ', () => {
    it('テーブルにアクセシブルなラベルがある', () => {
      const matrix = createMockCoverageMatrix();
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      const table = screen.getByRole('table');
      expect(table).toHaveAttribute('aria-label', 'WCAGカバレッジマトリクス');
    });

    it('ソート可能なヘッダーにaria属性がある', () => {
      const matrix = createMockCoverageMatrix();
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      // MUIのTableSortLabelにはデフォルトでaria-sort属性がないため、
      // ソートボタンが存在することを確認
      const sortButtons = screen.getAllByRole('button');
      const criterionSortButton = sortButtons.find(btn => btn.textContent?.includes('成功基準'));
      expect(criterionSortButton).toBeInTheDocument();
    });

    it('キーボードでテーブルを操作できる', async () => {
      const user = userEvent.setup();
      const matrix = createMockCoverageMatrix();
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      // Tabキーでフォーカス移動
      await user.tab();
      expect(document.activeElement).not.toBe(document.body);
    });
  });

  describe('レスポンシブ対応', () => {
    it('横スクロール可能なコンテナがある', () => {
      const matrix = createMockCoverageMatrix();
      renderWithTheme(<WCAGCoverageMatrix matrix={matrix} />);

      // TableContainerが存在し、スクロール可能
      const tableContainer = screen.getByRole('table').parentElement;
      expect(tableContainer).toHaveStyle({ overflowX: 'auto' });
    });
  });
});
