import { useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import type { LogEntry } from '../types/accessibility';

interface AnalysisProgressProps {
  logs?: LogEntry[];
  currentStep?: number;
  totalSteps?: number;
  stepName?: string;
}

export function AnalysisProgress({
  logs = [],
  currentStep = 0,
  totalSteps = 4,
  stepName = '',
}: AnalysisProgressProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);

  // 自動スクロール
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const progressPercent = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  return (
    <Card sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 2,
          }}
        >
          <CircularProgress size={50} sx={{ mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            分析中...
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {stepName ? `${stepName} を実行中...` : 'Webページをスキャンしています。しばらくお待ちください。'}
          </Typography>

          {/* 進捗バー */}
          <Box sx={{ width: '100%', mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                進捗
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {currentStep} / {totalSteps}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progressPercent}
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>

          {/* ログ表示エリア */}
          <Paper
            ref={logContainerRef}
            elevation={0}
            sx={{
              width: '100%',
              height: 300,
              overflow: 'auto',
              bgcolor: 'grey.900',
              borderRadius: 1,
              p: 2,
              fontFamily: 'monospace',
              fontSize: '0.85rem',
            }}
          >
            {logs.length === 0 ? (
              <Typography
                sx={{
                  color: 'grey.600',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                }}
              >
                ログを待機中...
              </Typography>
            ) : (
              logs.map((log, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    mb: 0.5,
                    color: getLogColor(log.type),
                  }}
                >
                  <Typography
                    component="span"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      color: 'grey.500',
                      mr: 1,
                      flexShrink: 0,
                    }}
                  >
                    {formatTimestamp(log.timestamp)}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      wordBreak: 'break-word',
                    }}
                  >
                    {log.message}
                  </Typography>
                </Box>
              ))
            )}
          </Paper>
        </Box>
      </CardContent>
    </Card>
  );
}

function getLogColor(type: LogEntry['type']): string {
  switch (type) {
    case 'error':
      return '#f44336'; // red
    case 'violation':
      return '#ff9800'; // orange
    case 'complete':
      return '#4caf50'; // green
    case 'progress':
      return '#2196f3'; // blue
    default:
      return '#ffffff'; // white
  }
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}
