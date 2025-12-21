import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { GridBackground } from './components/GridBackground';
import { UrlInput } from './components/UrlInput';
import { ReportSummary } from './components/ReportSummary';
import { AnalysisProgress } from './components/AnalysisProgress';
import { analyzeUrlWithSSE } from './services/api';
import type { AccessibilityReport, AuthConfig, LogEntry } from './types/accessibility';

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

  const handleAnalyze = useCallback((url: string, auth?: AuthConfig, sessionId?: string, passphrase?: string) => {
    setLoading(true);
    setError(null);
    setReport(null);
    setCurrentUrl(url);
    setLogs([]);
    setCurrentStep(0);
    setStepName('');

    analyzeUrlWithSSE(
      { url, auth, sessionId, passphrase },
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
        onComplete: (report) => {
          setReport(report);
          setLoading(false);
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
        },
      }
    );
  }, []);

  const handleReset = () => {
    setReport(null);
    setError(null);
    setCurrentUrl('');
    setLogs([]);
    setCurrentStep(0);
    setStepName('');
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
            URLを入力するだけで、WCAG準拠状況を瞬時に分析します
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
