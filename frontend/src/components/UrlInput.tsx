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
  onAnalyze: (url: string, auth?: AuthConfig) => void;
  disabled?: boolean;
  compact?: boolean;
  initialValue?: string;
}

export function UrlInput({ onAnalyze, disabled, compact = false, initialValue = '' }: UrlInputProps) {
  const [url, setUrl] = useState(initialValue);
  const [authConfig, setAuthConfig] = useState<AuthConfig | undefined>(undefined);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

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

    onAnalyze(targetUrl, authConfig);
  };

  const hasAuth = authConfig && authConfig.type !== 'none';

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
        <Tooltip title={hasAuth ? `認証設定済み (${getAuthTypeLabel(authConfig?.type)})` : '認証設定'}>
          <IconButton
            onClick={() => setAuthDialogOpen(true)}
            disabled={disabled}
            sx={{
              mr: 1,
              color: hasAuth ? 'success.main' : 'text.secondary',
            }}
          >
            <Badge
              color="success"
              variant="dot"
              invisible={!hasAuth}
            >
              {hasAuth ? <LockIcon /> : <LockOpenIcon />}
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
      />
    </>
  );
}
