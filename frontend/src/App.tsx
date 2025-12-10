import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { GridBackground } from './components/GridBackground';
import { UrlInput } from './components/UrlInput';
import { ReportSummary } from './components/ReportSummary';
import { analyzeUrl } from './services/api';
import type { AccessibilityReport, AuthConfig } from './types/accessibility';

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AccessibilityReport | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');

  const handleAnalyze = async (url: string, auth?: AuthConfig) => {
    setLoading(true);
    setError(null);
    setReport(null);
    setCurrentUrl(url);

    try {
      const response = await analyzeUrl({ url, auth });
      if (response.status === 'completed' && response.report) {
        setReport(response.report);
      } else {
        setError(response.error || '分析に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setReport(null);
    setError(null);
    setCurrentUrl('');
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
            アクセシビリティチェック
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 4, textAlign: 'center' }}
          >
            URLを入力するだけで、WCAG準拠状況を瞬時に分析します
          </Typography>

          <UrlInput onAnalyze={handleAnalyze} disabled={loading} />

          {error && (
            <Alert severity="error" sx={{ mt: 3, maxWidth: 600 }}>
              {error}
            </Alert>
          )}
        </Box>
      )}

      {/* Loading Screen */}
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
          <CircularProgress size={60} sx={{ mb: 3 }} />
          <Typography variant="h6" gutterBottom>
            分析中...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Webページをスキャンしています。しばらくお待ちください。
          </Typography>
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
            />
          </Box>
        </Box>
      )}
    </GridBackground>
  );
}

export default App;
