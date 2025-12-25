import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDownload } from './useDownload';
import type { DetectedIssue } from '../types/accessibility';
import * as csvExport from '../utils/csvExport';
import * as pdfExport from '../utils/pdfExport';

// CSVエクスポートのモック
vi.mock('../utils/csvExport', () => ({
  exportAISummaryToCsv: vi.fn(),
}));

// PDFエクスポートのモック
vi.mock('../utils/pdfExport', () => ({
  exportReportToPdf: vi.fn(),
  generatePdfFileName: vi.fn(),
}));

describe('useDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('初期状態', () => {
    it('初期状態ではisGeneratingがfalseである', () => {
      const { result } = renderHook(() => useDownload());
      expect(result.current.state.isGenerating).toBe(false);
    });

    it('初期状態ではerrorがnullである', () => {
      const { result } = renderHook(() => useDownload());
      expect(result.current.state.error).toBeNull();
    });

    it('初期状態ではsnackbarPropsのopenがfalseである', () => {
      const { result } = renderHook(() => useDownload());
      expect(result.current.snackbarProps.open).toBe(false);
    });
  });

  describe('downloadAISummaryCsv', () => {
    const sampleIssues: DetectedIssue[] = [
      {
        ruleId: 'color-contrast',
        whatIsHappening: 'コントラスト比が不足',
        whatIsNeeded: 'コントラスト比4.5:1以上',
        howToFix: 'CSSで色を調整',
      },
    ];
    const sampleUrl = 'https://example.com/';

    it('CSVダウンロード関数を呼び出す', () => {
      const { result } = renderHook(() => useDownload());

      act(() => {
        result.current.downloadAISummaryCsv(sampleIssues, sampleUrl);
      });

      expect(csvExport.exportAISummaryToCsv).toHaveBeenCalledWith(sampleIssues, sampleUrl);
    });

    it('成功時にSnackbarを表示する', async () => {
      const { result } = renderHook(() => useDownload());

      act(() => {
        result.current.downloadAISummaryCsv(sampleIssues, sampleUrl);
      });

      await waitFor(() => {
        expect(result.current.snackbarProps.open).toBe(true);
        expect(result.current.snackbarProps.severity).toBe('success');
        expect(result.current.snackbarProps.message).toContain('CSV');
      });
    });

    it('エラー時にSnackbarにエラーを表示する', async () => {
      vi.mocked(csvExport.exportAISummaryToCsv).mockImplementation(() => {
        throw new Error('CSVエクスポートエラー');
      });

      const { result } = renderHook(() => useDownload());

      act(() => {
        result.current.downloadAISummaryCsv(sampleIssues, sampleUrl);
      });

      await waitFor(() => {
        expect(result.current.snackbarProps.open).toBe(true);
        expect(result.current.snackbarProps.severity).toBe('error');
        expect(result.current.state.error).toBeTruthy();
      });
    });
  });

  describe('downloadReportPdf', () => {
    const sampleUrl = 'https://example.com/';

    beforeEach(() => {
      vi.mocked(pdfExport.generatePdfFileName).mockReturnValue('a11y-report_example-com_2025-12-23.pdf');
    });

    it('PDF生成中はisGeneratingがtrueになり、完了後にfalseに戻る', async () => {
      let resolveExport: (value: { success: boolean }) => void;
      vi.mocked(pdfExport.exportReportToPdf).mockImplementation(() => {
        return new Promise((resolve) => {
          resolveExport = resolve;
        });
      });

      const mockElement = document.createElement('div');
      const mockRef = { current: mockElement };

      const { result } = renderHook(() => useDownload());

      // 非同期処理を開始
      act(() => {
        result.current.downloadReportPdf(mockRef, sampleUrl);
      });

      // PDF生成中はisGeneratingがtrueになる
      await waitFor(() => {
        expect(result.current.state.isGenerating).toBe(true);
      });

      // PDF生成を完了
      await act(async () => {
        resolveExport({ success: true });
      });

      // 完了後はisGeneratingがfalseに戻る
      await waitFor(() => {
        expect(result.current.state.isGenerating).toBe(false);
      });
    });

    it('PDF生成成功時にSnackbarで成功メッセージを表示する', async () => {
      vi.mocked(pdfExport.exportReportToPdf).mockResolvedValue({ success: true });

      const mockElement = document.createElement('div');
      const mockRef = { current: mockElement };

      const { result } = renderHook(() => useDownload());

      await act(async () => {
        await result.current.downloadReportPdf(mockRef, sampleUrl);
      });

      expect(result.current.snackbarProps.open).toBe(true);
      expect(result.current.snackbarProps.severity).toBe('success');
      expect(result.current.snackbarProps.message).toContain('PDF');
    });

    it('PDF生成失敗時にSnackbarでエラーメッセージを表示する', async () => {
      vi.mocked(pdfExport.exportReportToPdf).mockResolvedValue({
        success: false,
        error: 'PDF生成中にエラーが発生しました',
      });

      const mockElement = document.createElement('div');
      const mockRef = { current: mockElement };

      const { result } = renderHook(() => useDownload());

      await act(async () => {
        await result.current.downloadReportPdf(mockRef, sampleUrl);
      });

      expect(result.current.snackbarProps.open).toBe(true);
      expect(result.current.snackbarProps.severity).toBe('error');
      expect(result.current.state.error).toBeTruthy();
    });

    it('要素参照がnullの場合はエラーを表示する', async () => {
      const mockRef = { current: null };

      const { result } = renderHook(() => useDownload());

      await act(async () => {
        await result.current.downloadReportPdf(mockRef, sampleUrl);
      });

      expect(result.current.snackbarProps.open).toBe(true);
      expect(result.current.snackbarProps.severity).toBe('error');
      expect(result.current.state.error).toContain('要素');
    });

    it('生成中に再度呼び出しても処理をスキップする（ガード処理）', async () => {
      vi.mocked(pdfExport.exportReportToPdf).mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ success: true }), 200);
        });
      });

      const mockElement = document.createElement('div');
      const mockRef = { current: mockElement };

      const { result } = renderHook(() => useDownload());

      // 1回目の呼び出し
      act(() => {
        result.current.downloadReportPdf(mockRef, sampleUrl);
      });

      // 生成中に2回目の呼び出しを試みる
      act(() => {
        result.current.downloadReportPdf(mockRef, sampleUrl);
      });

      // exportReportToPdfが1回しか呼び出されていないことを確認
      expect(pdfExport.exportReportToPdf).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearError', () => {
    it('エラー状態をクリアする', async () => {
      vi.mocked(pdfExport.exportReportToPdf).mockResolvedValue({
        success: false,
        error: 'テストエラー',
      });
      vi.mocked(pdfExport.generatePdfFileName).mockReturnValue('test.pdf');

      const mockElement = document.createElement('div');
      const mockRef = { current: mockElement };

      const { result } = renderHook(() => useDownload());

      // エラーを発生させる
      await act(async () => {
        await result.current.downloadReportPdf(mockRef, 'https://example.com/');
      });

      expect(result.current.state.error).toBeTruthy();

      // エラーをクリア
      act(() => {
        result.current.clearError();
      });

      expect(result.current.state.error).toBeNull();
    });
  });

  describe('snackbarProps.onClose', () => {
    it('onClose呼び出しでSnackbarを閉じる', async () => {
      const { result } = renderHook(() => useDownload());

      const sampleIssues: DetectedIssue[] = [
        {
          ruleId: 'color-contrast',
          whatIsHappening: 'テスト',
          whatIsNeeded: 'テスト',
          howToFix: 'テスト',
        },
      ];

      act(() => {
        result.current.downloadAISummaryCsv(sampleIssues, 'https://example.com/');
      });

      await waitFor(() => {
        expect(result.current.snackbarProps.open).toBe(true);
      });

      act(() => {
        result.current.snackbarProps.onClose();
      });

      expect(result.current.snackbarProps.open).toBe(false);
    });
  });

  describe('再試行機能', () => {
    it('PDF生成失敗時に再試行用の情報を保持する', async () => {
      vi.mocked(pdfExport.exportReportToPdf).mockResolvedValue({
        success: false,
        error: 'PDF生成エラー',
      });
      vi.mocked(pdfExport.generatePdfFileName).mockReturnValue('test.pdf');

      const mockElement = document.createElement('div');
      const mockRef = { current: mockElement };

      const { result } = renderHook(() => useDownload());

      await act(async () => {
        await result.current.downloadReportPdf(mockRef, 'https://example.com/');
      });

      // 再試行ボタンがactionに含まれることを確認
      expect(result.current.snackbarProps.action).toBeDefined();
    });
  });
});
