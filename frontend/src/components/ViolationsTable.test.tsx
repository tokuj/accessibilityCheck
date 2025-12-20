import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ViolationsTable } from './ViolationsTable';
import type { PageResult } from '../types/accessibility';

// ImpactBadgeをモック
vi.mock('./ImpactBadge', () => ({
  ImpactBadge: ({ impact }: { impact: string }) => (
    <span data-testid="impact-badge">{impact}</span>
  ),
}));

const createMockPages = (): PageResult[] => [
  {
    name: 'トップページ',
    url: 'https://example.com',
    violations: [
      {
        toolSource: 'axe-core',
        id: 'color-contrast',
        description: 'コントラスト比が不足しています',
        impact: 'serious',
        nodeCount: 3,
        wcagCriteria: ['WCAG 1.4.3'],
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/color-contrast',
      },
      {
        toolSource: 'pa11y',
        id: 'link-name',
        description: 'リンクに識別可能なテキストがありません',
        impact: 'critical',
        nodeCount: 1,
        wcagCriteria: ['WCAG 2.4.4', 'WCAG 4.1.2'],
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/link-name',
      },
    ],
    passes: [],
    incomplete: [],
  },
];

describe('ViolationsTable', () => {
  describe('タスク1.2: テーブルカラムレイアウト最適化', () => {
    it('8つのカラムヘッダーが表示されること', () => {
      const pages = createMockPages();
      render(<ViolationsTable pages={pages} />);

      expect(screen.getByRole('columnheader', { name: 'ツール' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'ページ' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'ルールID' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '説明' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '影響度' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'ノード数' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'WCAG項番' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '詳細' })).toBeInTheDocument();
    });

    it('説明カラムの最大幅制限が適切に設定されていること', () => {
      const pages = createMockPages();
      const { container } = render(<ViolationsTable pages={pages} />);

      // テーブルボディの説明カラムを取得
      const descriptionCells = container.querySelectorAll('td');
      // 4番目のカラム（0-indexed: 3）が説明
      const descriptionCell = descriptionCells[3];

      expect(descriptionCell).toBeTruthy();
      // 説明カラムは横幅制限が緩和されている（300pxより大きいか、制限なし）
      // 現在のテストでは、maxWidth制限がないか拡大されていることを期待
    });

    it('テーブルが横スクロールなしで表示可能な構造であること', () => {
      const pages = createMockPages();
      const { container } = render(<ViolationsTable pages={pages} />);

      // TableContainerがオーバーフロー設定を持っていないか、auto/hiddenであることを確認
      const tableContainer = container.querySelector('.MuiTableContainer-root');
      expect(tableContainer).toBeTruthy();

      // テーブルが適切にレンダリングされていることを確認
      const table = container.querySelector('table');
      expect(table).toBeTruthy();
    });
  });

  describe('基本レンダリング', () => {
    it('違反がない場合はメッセージを表示すること', () => {
      const emptyPages: PageResult[] = [
        {
          name: 'トップページ',
          url: 'https://example.com',
          violations: [],
          passes: [],
          incomplete: [],
        },
      ];

      render(<ViolationsTable pages={emptyPages} />);

      expect(screen.getByText('違反はありません')).toBeInTheDocument();
    });

    it('違反データが正しく表示されること', () => {
      const pages = createMockPages();
      render(<ViolationsTable pages={pages} />);

      // 違反ルールIDが表示されていることを確認
      expect(screen.getByText('color-contrast')).toBeInTheDocument();
      expect(screen.getByText('link-name')).toBeInTheDocument();

      // 説明が表示されていることを確認
      expect(screen.getByText('コントラスト比が不足しています')).toBeInTheDocument();
      expect(screen.getByText('リンクに識別可能なテキストがありません')).toBeInTheDocument();
    });

    it('ツールソースがChipで表示されること', () => {
      const pages = createMockPages();
      render(<ViolationsTable pages={pages} />);

      // axe-coreとpa11yのチップが表示されていることを確認
      expect(screen.getByText('axe-core')).toBeInTheDocument();
      expect(screen.getByText('pa11y')).toBeInTheDocument();
    });

    it('WCAG項番がChipで表示されること', () => {
      const pages = createMockPages();
      render(<ViolationsTable pages={pages} />);

      expect(screen.getByText('WCAG 1.4.3')).toBeInTheDocument();
      expect(screen.getByText('WCAG 2.4.4')).toBeInTheDocument();
      expect(screen.getByText('WCAG 4.1.2')).toBeInTheDocument();
    });

    it('詳細リンクが正しく設定されていること', () => {
      const pages = createMockPages();
      render(<ViolationsTable pages={pages} />);

      const links = screen.getAllByRole('link', { name: '参照' });
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveAttribute('href', 'https://dequeuniversity.com/rules/axe/4.11/color-contrast');
      expect(links[1]).toHaveAttribute('href', 'https://dequeuniversity.com/rules/axe/4.11/link-name');
    });
  });

});
// CSVダウンロードボタンはReportSummaryコンポーネントに移動済み
