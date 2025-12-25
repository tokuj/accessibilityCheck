import { useState, useCallback, type RefObject, type ReactNode } from 'react';
import type { DetectedIssue } from '../types/accessibility';
import { exportAISummaryToCsv } from '../utils/csvExport';
import { exportReportToPdf, generatePdfFileName } from '../utils/pdfExport';

export interface DownloadState {
  isGenerating: boolean;
  error: string | null;
}

export interface SnackbarProps {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
  onClose: () => void;
  action?: ReactNode;
}

export interface UseDownloadReturn {
  state: DownloadState;
  downloadAISummaryCsv: (issues: DetectedIssue[], targetUrl: string) => void;
  downloadReportPdf: (elementRef: RefObject<HTMLElement | null>, targetUrl: string) => Promise<void>;
  clearError: () => void;
  snackbarProps: SnackbarProps;
  retryPdf: () => Promise<void>;
}

interface RetryContext {
  elementRef: RefObject<HTMLElement | null> | null;
  targetUrl: string | null;
}

export function useDownload(): UseDownloadReturn {
  const [state, setState] = useState<DownloadState>({
    isGenerating: false,
    error: null,
  });

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [snackbarAction, setSnackbarAction] = useState<ReactNode | undefined>(undefined);

  const [retryContext, setRetryContext] = useState<RetryContext>({
    elementRef: null,
    targetUrl: null,
  });

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error', action?: ReactNode) => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarAction(action);
    setSnackbarOpen(true);
  }, []);

  const closeSnackbar = useCallback(() => {
    setSnackbarOpen(false);
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const downloadAISummaryCsv = useCallback(
    (issues: DetectedIssue[], targetUrl: string) => {
      try {
        exportAISummaryToCsv(issues, targetUrl);
        showSnackbar('CSVファイルのダウンロードを開始しました', 'success');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'CSVダウンロード中にエラーが発生しました';
        setState((prev) => ({ ...prev, error: errorMessage }));
        showSnackbar(errorMessage, 'error');
      }
    },
    [showSnackbar]
  );

  const downloadReportPdf = useCallback(
    async (elementRef: RefObject<HTMLElement | null>, targetUrl: string) => {
      // ガード処理：生成中は処理をスキップ
      if (state.isGenerating) {
        return;
      }

      // 要素参照がnullの場合はエラー
      if (!elementRef.current) {
        const errorMessage = 'PDF生成対象の要素が見つかりません';
        setState((prev) => ({ ...prev, error: errorMessage }));
        showSnackbar(errorMessage, 'error');
        return;
      }

      // 再試行用のコンテキストを保存
      setRetryContext({ elementRef, targetUrl });

      setState((prev) => ({ ...prev, isGenerating: true, error: null }));

      try {
        const filename = generatePdfFileName(targetUrl);
        const result = await exportReportToPdf(elementRef.current, { filename });

        if (result.success) {
          showSnackbar('PDFファイルのダウンロードを開始しました', 'success');
        } else {
          const errorMessage = result.error || 'PDF生成中にエラーが発生しました';
          setState((prev) => ({ ...prev, error: errorMessage }));

          // 再試行ボタンを含むアクションを設定
          const retryAction = '再試行';
          showSnackbar(errorMessage, 'error', retryAction);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'PDF生成中にエラーが発生しました';
        setState((prev) => ({ ...prev, error: errorMessage }));

        const retryAction = '再試行';
        showSnackbar(errorMessage, 'error', retryAction);
      } finally {
        setState((prev) => ({ ...prev, isGenerating: false }));
      }
    },
    [state.isGenerating, showSnackbar]
  );

  const retryPdf = useCallback(async () => {
    if (retryContext.elementRef && retryContext.targetUrl) {
      await downloadReportPdf(retryContext.elementRef, retryContext.targetUrl);
    }
  }, [retryContext, downloadReportPdf]);

  const snackbarProps: SnackbarProps = {
    open: snackbarOpen,
    message: snackbarMessage,
    severity: snackbarSeverity,
    onClose: closeSnackbar,
    action: snackbarAction,
  };

  return {
    state,
    downloadAISummaryCsv,
    downloadReportPdf,
    clearError,
    snackbarProps,
    retryPdf,
  };
}
