import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import type { AuthConfig, AuthType } from '../types/accessibility';

interface AuthSettingsProps {
  open: boolean;
  onClose: () => void;
  authConfig: AuthConfig | undefined;
  onSave: (config: AuthConfig | undefined) => void;
}

const AUTH_TYPE_LABELS: Record<AuthType, string> = {
  none: '認証なし',
  cookie: 'Cookie認証',
  bearer: 'Bearer Token認証',
  basic: 'Basic認証',
  form: 'フォームログイン',
};

const defaultConfig: AuthConfig = {
  type: 'none',
};

export function AuthSettings({ open, onClose, authConfig, onSave }: AuthSettingsProps) {
  const [config, setConfig] = useState<AuthConfig>(authConfig || defaultConfig);

  useEffect(() => {
    if (open) {
      setConfig(authConfig || defaultConfig);
    }
  }, [open, authConfig]);

  const handleTypeChange = (type: AuthType) => {
    setConfig({ ...config, type });
  };

  const handleFieldChange = (field: keyof AuthConfig, value: string) => {
    setConfig({ ...config, [field]: value });
  };

  const handleSave = () => {
    if (config.type === 'none') {
      onSave(undefined);
    } else {
      onSave(config);
    }
    onClose();
  };

  const handleClear = () => {
    setConfig(defaultConfig);
    onSave(undefined);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>認証設定</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel id="auth-type-label">認証タイプ</InputLabel>
            <Select
              labelId="auth-type-label"
              value={config.type}
              label="認証タイプ"
              onChange={(e) => handleTypeChange(e.target.value as AuthType)}
            >
              {Object.entries(AUTH_TYPE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {config.type === 'cookie' && (
            <>
              <Alert severity="info" sx={{ mb: 1 }}>
                ブラウザの開発者ツールからCookieをコピーして貼り付けてください。
              </Alert>
              <TextField
                label="Cookie"
                placeholder="name=value; name2=value2"
                multiline
                rows={3}
                value={config.cookies || ''}
                onChange={(e) => handleFieldChange('cookies', e.target.value)}
                fullWidth
              />
            </>
          )}

          {config.type === 'bearer' && (
            <>
              <Alert severity="info" sx={{ mb: 1 }}>
                APIアクセストークンを入力してください。
              </Alert>
              <TextField
                label="Bearer Token"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={config.token || ''}
                onChange={(e) => handleFieldChange('token', e.target.value)}
                fullWidth
              />
            </>
          )}

          {config.type === 'basic' && (
            <>
              <Alert severity="info" sx={{ mb: 1 }}>
                HTTP Basic認証の資格情報を入力してください。
              </Alert>
              <TextField
                label="ユーザー名"
                value={config.username || ''}
                onChange={(e) => handleFieldChange('username', e.target.value)}
                fullWidth
              />
              <TextField
                label="パスワード"
                type="password"
                value={config.password || ''}
                onChange={(e) => handleFieldChange('password', e.target.value)}
                fullWidth
              />
            </>
          )}

          {config.type === 'form' && (
            <>
              <Alert severity="info" sx={{ mb: 1 }}>
                ログインフォームの情報を入力してください。自動でログインを行います。
              </Alert>
              <TextField
                label="ログインURL"
                placeholder="https://example.com/login"
                value={config.loginUrl || ''}
                onChange={(e) => handleFieldChange('loginUrl', e.target.value)}
                fullWidth
              />
              <TextField
                label="ユーザー名"
                value={config.username || ''}
                onChange={(e) => handleFieldChange('username', e.target.value)}
                fullWidth
              />
              <TextField
                label="パスワード"
                type="password"
                value={config.password || ''}
                onChange={(e) => handleFieldChange('password', e.target.value)}
                fullWidth
              />
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>
                フォーム要素のセレクタ（CSS）
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                ブラウザの開発者ツール（F12）でログインフォームの要素を右クリック →「Copy」→「Copy selector」でセレクタを取得できます。
              </Typography>
              <TextField
                label="ユーザー名入力欄"
                placeholder="#username, input[name='email']"
                value={config.usernameSelector || ''}
                onChange={(e) => handleFieldChange('usernameSelector', e.target.value)}
                fullWidth
                size="small"
                helperText="例: #email, input[name='username'], .login-input"
              />
              <TextField
                label="パスワード入力欄"
                placeholder="#password, input[type='password']"
                value={config.passwordSelector || ''}
                onChange={(e) => handleFieldChange('passwordSelector', e.target.value)}
                fullWidth
                size="small"
                helperText="例: #password, input[type='password']"
              />
              <TextField
                label="送信ボタン"
                placeholder="button[type='submit'], #login-btn"
                value={config.submitSelector || ''}
                onChange={(e) => handleFieldChange('submitSelector', e.target.value)}
                fullWidth
                size="small"
                helperText="例: button[type='submit'], .login-button, #login-btn"
              />
              <TextField
                label="ログイン成功URLパターン（正規表現）"
                placeholder="/dashboard, /home"
                value={config.successUrlPattern || ''}
                onChange={(e) => handleFieldChange('successUrlPattern', e.target.value)}
                fullWidth
                size="small"
                helperText="ログイン成功後に遷移するURLのパターンを指定（省略可）"
              />
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClear} color="inherit">
          クリア
        </Button>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSave} variant="contained">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
