import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportSummary } from './ReportSummary';
import type { AccessibilityReport } from '../types/accessibility';
import * as pdfExport from '../utils/pdfExport';

// PDF関連のモック
vi.mock('../utils/pdfExport', () => ({
  exportReportToPdf: vi.fn(),
  generatePdfFileName: vi.fn(() => 'a11y-report_example-com_2025-12-23.pdf'),
}));

const mockExportReportToPdf = vi.mocked(pdfExport.exportReportToPdf);
const mockGeneratePdfFileName = vi.mocked(pdfExport.generatePdfFileName);

// Mock子コンポーネント
vi.mock('./ScoreCard', () => ({
  ScoreCard: () => <div data-testid="score-card">ScoreCard</div>,
}));

vi.mock('./ImprovementList', () => ({
  ImprovementList: () => <div data-testid="improvement-list">ImprovementList</div>,
}));

vi.mock('./ViolationsTable', () => ({
  ViolationsTable: ({ pages }: { pages: Array<{ name: string; url: string }> }) => (
    <div data-testid="violations-table">
      {pages.map((page, idx) => (
        <span key={idx} data-testid={`violations-page-${idx}`}>{page.name}</span>
      ))}
    </div>
  ),
}));

vi.mock('./PassesTable', () => ({
  PassesTable: () => <div data-testid="passes-table">PassesTable</div>,
}));

vi.mock('./IncompleteTable', () => ({
  IncompleteTable: () => <div data-testid="incomplete-table">IncompleteTable</div>,
}));

vi.mock('./LighthouseScores', () => ({
  LighthouseScores: () => <div data-testid="lighthouse-scores">LighthouseScores</div>,
}));

vi.mock('./PageTabs', () => ({
  PageTabs: ({ pages, activeIndex, onChange }: { pages: Array<{ title: string; url: string; violationCount: number }>; activeIndex: number; onChange: (index: number) => void }) => (
    <div data-testid="page-tabs">
      {pages.map((page, idx) => (
        <button
          key={page.url}
          data-testid={`page-tab-${idx}`}
          onClick={() => onChange(idx)}
          data-active={idx === activeIndex}
        >
          {page.title}
        </button>
      ))}
    </div>
  ),
}));

const createMockReport = (): AccessibilityReport => ({
  generatedAt: '2025-12-20T10:00:00+09:00',
  summary: {
    totalViolations: 5,
    totalPasses: 10,
    totalIncomplete: 2,
  },
  pages: [
    {
      name: 'トップページ',
      url: 'https://example.com',
      violations: [],
      passes: [],
      incomplete: [],
    },
  ],
});

/** 複数ページのモックレポートを作成 */
const createMultiPageMockReport = (): AccessibilityReport => ({
  generatedAt: '2025-12-20T10:00:00+09:00',
  summary: {
    totalViolations: 8,
    totalPasses: 20,
    totalIncomplete: 4,
  },
  pages: [
    {
      name: 'トップページ',
      url: 'https://example.com/',
      violations: [
        { id: 'color-contrast', description: 'コントラスト不足', impact: 'serious', nodeCount: 2, helpUrl: '', wcagCriteria: ['1.4.3'], toolSource: 'axe-core' },
        { id: 'link-name', description: 'リンク名なし', impact: 'serious', nodeCount: 1, helpUrl: '', wcagCriteria: ['2.4.4'], toolSource: 'axe-core' },
      ],
      passes: [],
      incomplete: [],
    },
    {
      name: 'お問い合わせ',
      url: 'https://example.com/contact',
      violations: [
        { id: 'label', description: 'ラベルなし', impact: 'critical', nodeCount: 3, helpUrl: '', wcagCriteria: ['1.3.1'], toolSource: 'axe-core' },
      ],
      passes: [],
      incomplete: [],
    },
    {
      name: '会社概要',
      url: 'https://example.com/about',
      violations: [
        { id: 'image-alt', description: '代替テキストなし', impact: 'critical', nodeCount: 2, helpUrl: '', wcagCriteria: ['1.1.1'], toolSource: 'axe-core' },
      ],
      passes: [],
      incomplete: [],
    },
  ],
});

describe('ReportSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExportReportToPdf.mockResolvedValue({ success: true });
  });
  describe('タスク1.1: レポートコンテナの横幅拡張', () => {
    it('Cardコンポーネントの最大幅が1400pxであること', () => {
      const report = createMockReport();
      const { container } = render(
        <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
      );

      // MUI Cardはclass="MuiCard-root"を持つ
      const card = container.querySelector('.MuiCard-root');
      expect(card).toBeTruthy();

      // MUIのsxプロパティはインラインスタイルとして適用される
      expect(card).toHaveStyle({ maxWidth: '1400px' });
    });

    it('レスポンシブ対応のために100%幅を使用していること', () => {
      const report = createMockReport();
      const { container } = render(
        <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toBeTruthy();
      // mx: 'auto' が設定されていることを確認（左右マージン自動）
      expect(card).toHaveStyle({ marginLeft: 'auto', marginRight: 'auto' });
    });
  });

  describe('基本レンダリング', () => {
    it('URLが正しく表示されること', () => {
      const report = createMockReport();
      render(
        <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
      );

      expect(screen.getByText('https://example.com')).toBeInTheDocument();
    });

    it('閉じるボタンが表示されること', () => {
      const report = createMockReport();
      render(
        <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
      );

      expect(screen.getByRole('button', { name: '閉じる' })).toBeInTheDocument();
    });

    it('タブが正しく表示されること', () => {
      const report = createMockReport();
      render(
        <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
      );

      expect(screen.getByRole('tab', { name: /違反/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /パス/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /要確認/ })).toBeInTheDocument();
    });
  });

  describe('Task 9.1: ReportSummaryにページタブを統合', () => {
    describe('複数ページ時（pages.length > 1）', () => {
      it('PageTabsコンポーネントが表示されること', () => {
        const report = createMultiPageMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        expect(screen.getByTestId('page-tabs')).toBeInTheDocument();
      });

      it('各ページのタブが表示されること', () => {
        const report = createMultiPageMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        expect(screen.getByTestId('page-tab-0')).toHaveTextContent('トップページ');
        expect(screen.getByTestId('page-tab-1')).toHaveTextContent('お問い合わせ');
        expect(screen.getByTestId('page-tab-2')).toHaveTextContent('会社概要');
      });

      it('初期状態で最初のページがアクティブであること', () => {
        const report = createMultiPageMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        const firstTab = screen.getByTestId('page-tab-0');
        expect(firstTab).toHaveAttribute('data-active', 'true');
      });

      it('タブをクリックするとアクティブなページが切り替わること', () => {
        const report = createMultiPageMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        // 2番目のタブをクリック
        fireEvent.click(screen.getByTestId('page-tab-1'));

        // 2番目のタブがアクティブになること
        expect(screen.getByTestId('page-tab-1')).toHaveAttribute('data-active', 'true');
        expect(screen.getByTestId('page-tab-0')).toHaveAttribute('data-active', 'false');
      });

      it('アクティブなページのURLが表示されること', () => {
        const report = createMultiPageMockReport();
        render(
          <ReportSummary report={report} url="https://example.com/" onClose={() => {}} />
        );

        // 初期状態ではトップページのURL
        expect(screen.getByText('https://example.com/')).toBeInTheDocument();
      });

      it('タブ切り替え時に表示URLが変わること', () => {
        const report = createMultiPageMockReport();
        render(
          <ReportSummary report={report} url="https://example.com/" onClose={() => {}} />
        );

        // 2番目のタブをクリック
        fireEvent.click(screen.getByTestId('page-tab-1'));

        // お問い合わせページのURLが表示されること
        expect(screen.getByText('https://example.com/contact')).toBeInTheDocument();
      });
    });

    describe('単一ページ時（pages.length === 1）', () => {
      it('PageTabsコンポーネントが表示されないこと（後方互換性）', () => {
        const report = createMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        expect(screen.queryByTestId('page-tabs')).not.toBeInTheDocument();
      });

      it('単一ページのURLが表示されること', () => {
        const report = createMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        expect(screen.getByText('https://example.com')).toBeInTheDocument();
      });
    });
  });

  describe('Task 9.2: ページ別のスクリーンショットとスコア表示', () => {
    describe('複数ページ時', () => {
      it('初期状態では最初のページの違反情報のみがViolationsTableに渡されること', () => {
        const report = createMultiPageMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        // 最初のページのみが表示されること
        expect(screen.getByTestId('violations-page-0')).toHaveTextContent('トップページ');
        // 2番目、3番目のページは表示されないこと
        expect(screen.queryByTestId('violations-page-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('violations-page-2')).not.toBeInTheDocument();
      });

      it('タブ切り替え時に選択されたページの違反情報がViolationsTableに渡されること', () => {
        const report = createMultiPageMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        // 2番目のタブをクリック
        fireEvent.click(screen.getByTestId('page-tab-1'));

        // 2番目のページのみが表示されること
        expect(screen.getByTestId('violations-page-0')).toHaveTextContent('お問い合わせ');
        // 1番目、3番目のページは表示されないこと
        expect(screen.queryByTestId('violations-page-1')).not.toBeInTheDocument();
      });
    });

    describe('単一ページ時（後方互換性）', () => {
      it('単一ページの場合、全ページ情報がViolationsTableに渡されること', () => {
        const report = createMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        expect(screen.getByTestId('violations-page-0')).toHaveTextContent('トップページ');
      });
    });

    describe('詳細タブのカウント表示', () => {
      it('複数ページ時、詳細タブにアクティブページの違反/パス/要確認数が表示されること', () => {
        const report = createMultiPageMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        // 初期状態（トップページ）では、そのページの違反数が表示される
        // トップページには2件の違反がある
        expect(screen.getByRole('tab', { name: /違反 \(2\)/ })).toBeInTheDocument();
      });

      it('タブ切り替え時に詳細タブのカウントが変わること', () => {
        const report = createMultiPageMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        // 2番目のタブ（お問い合わせ）をクリック
        fireEvent.click(screen.getByTestId('page-tab-1'));

        // お問い合わせページには1件の違反がある
        expect(screen.getByRole('tab', { name: /違反 \(1\)/ })).toBeInTheDocument();
      });

      it('単一ページ時は全体のサマリー数が表示されること（後方互換性）', () => {
        const report = createMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        // レポート全体のサマリー数が表示される
        expect(screen.getByRole('tab', { name: /違反 \(5\)/ })).toBeInTheDocument();
      });
    });
  });

  describe('Task 5: UI統合 - レポートPDFダウンロードボタン', () => {
    describe('Task 5.1: PDF対象領域のref設定', () => {
      it('CardContentにdata-testid="pdf-target-area"が設定されていること', () => {
        const report = createMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        const pdfTarget = screen.getByTestId('pdf-target-area');
        expect(pdfTarget).toBeInTheDocument();
      });

      it('PDF対象領域がCardContent内に存在すること', () => {
        const report = createMockReport();
        const { container } = render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        const cardContent = container.querySelector('.MuiCardContent-root');
        const pdfTarget = screen.getByTestId('pdf-target-area');
        expect(cardContent).toContainElement(pdfTarget);
      });
    });

    describe('Task 5.2: PDFダウンロードボタンの追加', () => {
      it('PDFダウンロードボタンがヘッダーに表示されること', () => {
        const report = createMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        const pdfButton = screen.getByRole('button', { name: /PDF.*ダウンロード/i });
        expect(pdfButton).toBeInTheDocument();
      });

      it('PDFダウンロードボタンが閉じるボタンの左隣に配置されること', () => {
        const report = createMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        const pdfButton = screen.getByRole('button', { name: /PDF.*ダウンロード/i });
        const closeButton = screen.getByRole('button', { name: '閉じる' });

        // 両方が同じヘッダーコンテナ内に存在することを確認
        const headerContainer = pdfButton.closest('[data-testid="report-header"]');
        expect(headerContainer).toContainElement(closeButton);
      });

      it('PDFダウンロードボタンにPictureAsPdfIconが含まれること', () => {
        const report = createMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        const pdfButton = screen.getByRole('button', { name: /PDF.*ダウンロード/i });
        // MUIのPictureAsPdfIconはsvg要素として描画される
        const icon = pdfButton.querySelector('svg');
        expect(icon).toBeInTheDocument();
      });

      it('ボタンスタイルが統一されていること（outlined, small）', () => {
        const report = createMockReport();
        const { container } = render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        const pdfButton = container.querySelector('button[aria-label="PDFダウンロード"]');
        expect(pdfButton).toHaveClass('MuiButton-outlined');
        expect(pdfButton).toHaveClass('MuiButton-sizeSmall');
      });

      it('PDFダウンロードボタンクリックでPDF生成が開始されること', async () => {
        const report = createMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        const pdfButton = screen.getByRole('button', { name: /PDF.*ダウンロード/i });
        fireEvent.click(pdfButton);

        await waitFor(() => {
          expect(mockExportReportToPdf).toHaveBeenCalledTimes(1);
        });
      });

      it('PDF生成時に正しいファイル名が生成されること', async () => {
        const report = createMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        const pdfButton = screen.getByRole('button', { name: /PDF.*ダウンロード/i });
        fireEvent.click(pdfButton);

        await waitFor(() => {
          expect(mockGeneratePdfFileName).toHaveBeenCalledWith('https://example.com');
        });
      });
    });

    describe('Task 5.3: PDF生成中の進捗インジケーター', () => {
      it('PDF生成中にローディングインジケーターが表示されること', async () => {
        // PDF生成に時間がかかるケースをシミュレート
        let resolvePromise: (value: { success: boolean }) => void;
        const promise = new Promise<{ success: boolean }>((resolve) => {
          resolvePromise = resolve;
        });
        mockExportReportToPdf.mockReturnValue(promise);

        const report = createMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        const pdfButton = screen.getByRole('button', { name: /PDF.*ダウンロード/i });
        fireEvent.click(pdfButton);

        // ローディングインジケーターが表示されることを確認
        await waitFor(() => {
          expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        // Promise を解決して cleanup
        resolvePromise!({ success: true });

        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        });
      });

      it('PDF生成中はボタンが非活性化されること', async () => {
        let resolvePromise: (value: { success: boolean }) => void;
        const promise = new Promise<{ success: boolean }>((resolve) => {
          resolvePromise = resolve;
        });
        mockExportReportToPdf.mockReturnValue(promise);

        const report = createMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        const pdfButton = screen.getByRole('button', { name: /PDF.*ダウンロード/i });
        fireEvent.click(pdfButton);

        await waitFor(() => {
          expect(pdfButton).toBeDisabled();
        });

        resolvePromise!({ success: true });

        await waitFor(() => {
          expect(pdfButton).not.toBeDisabled();
        });
      });
    });

    describe('Task 5.4: エラーハンドリングと再試行機能', () => {
      it('PDF生成失敗時にSnackbarでエラーメッセージが表示されること', async () => {
        mockExportReportToPdf.mockResolvedValue({
          success: false,
          error: 'PDF生成中にエラーが発生しました',
        });

        const report = createMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        const pdfButton = screen.getByRole('button', { name: /PDF.*ダウンロード/i });
        fireEvent.click(pdfButton);

        await waitFor(() => {
          expect(screen.getByRole('alert')).toBeInTheDocument();
          expect(screen.getByText(/PDF生成中にエラーが発生しました/)).toBeInTheDocument();
        });
      });

      it('PDF生成成功時にSnackbarで成功メッセージが表示されること', async () => {
        mockExportReportToPdf.mockResolvedValue({ success: true });

        const report = createMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        const pdfButton = screen.getByRole('button', { name: /PDF.*ダウンロード/i });
        fireEvent.click(pdfButton);

        await waitFor(() => {
          expect(screen.getByRole('alert')).toBeInTheDocument();
          expect(screen.getByText(/PDFファイルのダウンロードを開始しました/)).toBeInTheDocument();
        });
      });

      it('エラー時に再試行ボタンが表示されること', async () => {
        mockExportReportToPdf.mockResolvedValue({
          success: false,
          error: 'PDF生成中にエラーが発生しました',
        });

        const report = createMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        const pdfButton = screen.getByRole('button', { name: /PDF.*ダウンロード/i });
        fireEvent.click(pdfButton);

        await waitFor(() => {
          expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument();
        });
      });

      it('再試行ボタンクリックでPDF生成が再実行されること', async () => {
        mockExportReportToPdf.mockResolvedValueOnce({
          success: false,
          error: 'PDF生成中にエラーが発生しました',
        });
        mockExportReportToPdf.mockResolvedValueOnce({ success: true });

        const report = createMockReport();
        render(
          <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
        );

        const pdfButton = screen.getByRole('button', { name: /PDF.*ダウンロード/i });
        fireEvent.click(pdfButton);

        await waitFor(() => {
          expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument();
        });

        const retryButton = screen.getByRole('button', { name: '再試行' });
        fireEvent.click(retryButton);

        await waitFor(() => {
          expect(mockExportReportToPdf).toHaveBeenCalledTimes(2);
        });
      });
    });
  });
});
