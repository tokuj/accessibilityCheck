import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { GridBackground } from './components/GridBackground';
import { UrlInput } from './components/UrlInput';
import { ReportSummary } from './components/ReportSummary';
import { AnalysisProgress } from './components/AnalysisProgress';
import { analyzeMultipleUrlsWithSSE } from './services/api';
import {
  clearAllChatHistory,
  setCurrentTargetUrl
} from './utils/chat-storage';
import type { AccessibilityReport, AuthConfig, LogEntry, AnalysisState } from './types/accessibility';

// 最大ログ行数（メモリ管理のため）
const MAX_LOG_ENTRIES = 1000;

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AccessibilityReport | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');

  // SSE用の状態
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(4);
  const [stepName, setStepName] = useState('');

  // 複数URL分析用の状態（Task 6.1）
  const [analysisState, setAnalysisState] = useState<AnalysisState | null>(null);
  // アクティブなレポートタブのインデックス（Task 6.2）
  // 注: setActiveReportTabは初期化時に0にリセットするために使用
  const [, setActiveReportTab] = useState(0);

  /**
   * 分析ハンドラー（複数URL対応）
   * @param urls 分析対象URL配列
   * @param auth 認証設定
   * @param sessionId セッションID
   * @param passphrase パスフレーズ
   * @requirement 6.1 - 入力されたURLリストを保存し、分析状態を初期化する
   */
  const handleAnalyze = useCallback((urls: string[], auth?: AuthConfig, sessionId?: string, passphrase?: string) => {
    // 再分析時は常にチャット履歴をクリア
    clearAllChatHistory();

    const primaryUrl = urls[0] || '';
    setCurrentTargetUrl(primaryUrl);

    setLoading(true);
    setError(null);
    setReport(null);
    setCurrentUrl(urls[0] || '');
    setLogs([]);
    setCurrentStep(0);
    setStepName('');
    setActiveReportTab(0);

    // 分析状態を初期化（Task 6.1）
    setAnalysisState({
      targetUrls: urls,
      currentPageIndex: 0,
      completedPageIndexes: [],
      currentPageTitle: '',
    });

    analyzeMultipleUrlsWithSSE(
      { urls, auth },
      {
        onLog: (log) => {
          setLogs((prev) => {
            const newLogs = [...prev, log];
            // 最大行数を超えたら古いログを削除
            if (newLogs.length > MAX_LOG_ENTRIES) {
              return newLogs.slice(-MAX_LOG_ENTRIES);
            }
            return newLogs;
          });
        },
        onProgress: (step, total, name) => {
          setCurrentStep(step);
          setTotalSteps(total);
          setStepName(name);
        },
        onPageProgress: (pageData) => {
          // ページ進捗状態を更新（Task 6.1）
          setAnalysisState((prev) => {
            if (!prev) return prev;
            const newState = { ...prev };
            newState.currentPageIndex = pageData.pageIndex;
            newState.currentPageTitle = pageData.pageTitle;
            if (pageData.status === 'completed' && !newState.completedPageIndexes.includes(pageData.pageIndex)) {
              newState.completedPageIndexes = [...newState.completedPageIndexes, pageData.pageIndex];
            }
            return newState;
          });
        },
        onComplete: (report) => {
          setReport(report);
          setLoading(false);
          setAnalysisState(null);
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              type: 'complete',
              message: '分析が完了しました',
            },
          ]);
        },
        onError: (message) => {
          setError(message);
          setLoading(false);
          setAnalysisState(null);
        },
      },
      { sessionId, passphrase }
    );
  }, []);

  const handleReset = () => {
    setReport(null);
    setError(null);
    setCurrentUrl('');
    setLogs([]);
    setCurrentStep(0);
    setStepName('');
    setAnalysisState(null);
    setActiveReportTab(0);
  };

  return (
    <GridBackground>
      {/* Input Screen */}
      {!report && !loading && (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            px: 2,
          }}
        >
          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 700,
              mb: 1,
              textAlign: 'center',
            }}
          >
            a11y Checker
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 4, textAlign: 'center' }}
          >
            URLを入力するだけで、WCAG準拠状況を簡単に分析します
          </Typography>

          <UrlInput
              onAnalyze={handleAnalyze}
              disabled={loading}
              showSessionManager={true}
              isDevelopment={import.meta.env.DEV}
            />

          {error && (
            <Alert severity="error" sx={{ mt: 3, maxWidth: 600 }}>
              {error}
            </Alert>
          )}
        </Box>
      )}

      {/* Loading Screen with Live Logs */}
      {loading && (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            px: 2,
          }}
        >
          <AnalysisProgress
            logs={logs}
            currentStep={currentStep}
            totalSteps={totalSteps}
            stepName={stepName}
            // 複数URL分析用props（Task 7.1）
            currentPageIndex={analysisState?.currentPageIndex}
            totalPages={analysisState?.targetUrls.length}
            currentPageUrl={analysisState ? analysisState.targetUrls[analysisState.currentPageIndex] : undefined}
            currentPageTitle={analysisState?.currentPageTitle}
            completedPages={analysisState?.completedPageIndexes}
          />
        </Box>
      )}

      {/* Report Screen */}
      {report && (
        <Box
          sx={{
            minHeight: '100vh',
            py: 4,
            px: 2,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ flex: 1 }}>
            <ReportSummary report={report} url={currentUrl} onClose={handleReset} />
          </Box>

          {/* Bottom Search Bar */}
          <Box
            sx={{
              position: 'sticky',
              bottom: 0,
              py: 3,
              backgroundColor: 'transparent',
            }}
          >
            <UrlInput
              onAnalyze={handleAnalyze}
              disabled={loading}
              initialValue={currentUrl}
              compact
              showSessionManager={true}
              isDevelopment={import.meta.env.DEV}
            />
          </Box>
        </Box>
      )}
    </GridBackground>
  );
}

export default App;
