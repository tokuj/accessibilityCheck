import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { AuthSettings } from './AuthSettings';
import type { AuthConfig, AuthType } from '../types/accessibility';

const getAuthTypeLabel = (type?: AuthType): string => {
  switch (type) {
    case 'cookie': return 'Cookie認証';
    case 'bearer': return 'Bearer Token';
    case 'basic': return 'Basic認証';
    case 'form': return 'フォームログイン';
    default: return '認証なし';
  }
};

interface UrlInputProps {
  /**
   * 分析開始時のコールバック
   * @param url 分析対象URL
   * @param auth 手動認証設定（オプション）
   * @param sessionId セッションID（オプション）
   * @param passphrase セッションのパスフレーズ（オプション）
   */
  onAnalyze: (url: string, auth?: AuthConfig, sessionId?: string, passphrase?: string) => void;
  disabled?: boolean;
  compact?: boolean;
  initialValue?: string;
  /** セッション管理UIを表示するかどうか（デフォルト: false - 後方互換性のため） */
  showSessionManager?: boolean;
  /** 開発環境フラグ（ログイン記録ボタン表示用） */
  isDevelopment?: boolean;
}

export function UrlInput({
  onAnalyze,
  disabled,
  compact = false,
  initialValue = '',
  showSessionManager = false,
  isDevelopment = false,
}: UrlInputProps) {
  const [url, setUrl] = useState(initialValue);
  const [authConfig, setAuthConfig] = useState<AuthConfig | undefined>(undefined);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  // セッション管理用の状態
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionPassphrase, setSessionPassphrase] = useState<string | undefined>(undefined);

  const validateUrl = (value: string): boolean => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      return;
    }

    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    if (!validateUrl(targetUrl)) {
      return;
    }

    // セッション選択時はセッションIDとパスフレーズを渡す
    if (selectedSessionId) {
      onAnalyze(targetUrl, undefined, selectedSessionId, sessionPassphrase);
    } else {
      onAnalyze(targetUrl, authConfig);
    }
  };

  // セッション選択ハンドラー
  const handleSessionSelect = (sessionId: string | null) => {
    setSelectedSessionId(sessionId);
    if (sessionId) {
      // セッション選択時はパスフレーズを設定（現時点では空文字列として初期化）
      // 実際のパスフレーズ入力は Task 10 で実装予定
      setSessionPassphrase('');
    } else {
      setSessionPassphrase(undefined);
    }
  };

  const hasAuth = authConfig && authConfig.type !== 'none';
  const hasSession = !!selectedSessionId;

  return (
    <>
      <Paper
        component="form"
        onSubmit={handleSubmit}
        sx={{
          display: 'flex',
          alignItems: 'center',
          width: compact ? '100%' : { xs: '90%', sm: '600px', md: '700px' },
          maxWidth: '700px',
          mx: 'auto',
          px: 3,
          py: 1,
          borderRadius: '50px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          backgroundColor: 'white',
          border: '1px solid rgba(0, 0, 0, 0.06)',
        }}
      >
        <Tooltip
          title={
            hasSession
              ? 'セッション認証使用中'
              : hasAuth
                ? `認証設定済み (${getAuthTypeLabel(authConfig?.type)})`
                : '認証設定'
          }
          aria-label="認証設定"
        >
          <IconButton
            onClick={() => setAuthDialogOpen(true)}
            disabled={disabled}
            aria-label="認証設定"
            sx={{
              mr: 1,
              color: hasSession ? 'primary.main' : hasAuth ? 'success.main' : 'text.secondary',
            }}
          >
            <Badge
              color={hasSession ? 'primary' : 'success'}
              variant="dot"
              invisible={!hasAuth && !hasSession}
            >
              {hasAuth || hasSession ? <LockIcon /> : <LockOpenIcon />}
            </Badge>
          </IconButton>
        </Tooltip>
        <InputBase
          sx={{
            flex: 1,
            fontSize: '1rem',
            '& input::placeholder': {
              color: 'text.secondary',
              opacity: 0.7,
            },
          }}
          placeholder="分析したいURLを入力してください..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={disabled}
        />
        <Box sx={{ width: '1px', height: 24, bgcolor: 'divider', mx: 2 }} />
        <IconButton
          type="submit"
          disabled={disabled || !url.trim()}
          sx={{
            p: 1.5,
            bgcolor: url.trim() ? 'primary.main' : 'grey.300',
            color: 'white',
            '&:hover': {
              bgcolor: url.trim() ? 'primary.dark' : 'grey.300',
            },
            '&.Mui-disabled': {
              bgcolor: 'grey.300',
              color: 'white',
            },
          }}
        >
          <ArrowUpwardIcon />
        </IconButton>
      </Paper>

      <AuthSettings
        open={authDialogOpen}
        onClose={() => setAuthDialogOpen(false)}
        authConfig={authConfig}
        onSave={setAuthConfig}
        // セッション機能が有効な場合のみセッション関連propsを渡す
        onSessionSelect={showSessionManager ? handleSessionSelect : undefined}
        selectedSessionId={showSessionManager ? selectedSessionId : undefined}
        isDevelopment={isDevelopment}
      />
    </>
  );
}
