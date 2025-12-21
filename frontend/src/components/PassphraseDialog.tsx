/**
 * PassphraseDialog コンポーネント
 *
 * Task 10: パスフレーズ入力UIコンポーネント
 * Requirements: 4.1, 2.1
 *
 * セッション読み込み時のパスフレーズ入力ダイアログ
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress,
  Alert,
  FormControlLabel,
  Checkbox,
  InputAdornment,
  IconButton,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockIcon from '@mui/icons-material/Lock';

/**
 * PassphraseDialogのprops
 */
interface PassphraseDialogProps {
  /** ダイアログの開閉状態 */
  open: boolean;
  /** セッションID */
  sessionId: string;
  /** セッション名 */
  sessionName: string;
  /** 送信コールバック */
  onSubmit: (passphrase: string, remember: boolean) => void;
  /** キャンセルコールバック */
  onCancel: () => void;
  /** エラーメッセージ */
  error?: string | null;
  /** ローディング状態 */
  isLoading?: boolean;
}

/**
 * sessionStorageのキーを生成
 */
function getStorageKey(sessionId: string): string {
  return `passphrase_${sessionId}`;
}

/**
 * PassphraseDialog - パスフレーズ入力ダイアログ
 */
export function PassphraseDialog({
  open,
  sessionId,
  sessionName,
  onSubmit,
  onCancel,
  error,
  isLoading = false,
}: PassphraseDialogProps) {
  // 状態管理
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [remember, setRemember] = useState(false);

  // ダイアログが開かれたときにsessionStorageからパスフレーズを読み込む
  useEffect(() => {
    if (open && sessionId) {
      const savedPassphrase = sessionStorage.getItem(getStorageKey(sessionId));
      if (savedPassphrase) {
        setPassphrase(savedPassphrase);
        setRemember(true);
      } else {
        setPassphrase('');
        setRemember(false);
      }
      setShowPassphrase(false);
    }
  }, [open, sessionId]);

  // パスフレーズ表示/非表示の切り替え
  const toggleShowPassphrase = useCallback(() => {
    setShowPassphrase((prev) => !prev);
  }, []);

  // 送信処理
  const handleSubmit = useCallback(() => {
    // 記憶オプションがオンの場合はsessionStorageに保存
    if (remember) {
      sessionStorage.setItem(getStorageKey(sessionId), passphrase);
    } else {
      sessionStorage.removeItem(getStorageKey(sessionId));
    }

    onSubmit(passphrase, remember);
  }, [passphrase, remember, sessionId, onSubmit]);

  // キャンセル処理
  const handleCancel = useCallback(() => {
    setPassphrase('');
    setShowPassphrase(false);
    setRemember(false);
    onCancel();
  }, [onCancel]);

  // Enterキーで送信
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && passphrase && !isLoading) {
        handleSubmit();
      }
    },
    [passphrase, isLoading, handleSubmit]
  );

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <LockIcon color="primary" />
          <Typography variant="h6">セッションを読み込む</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          「{sessionName}」を読み込むにはパスフレーズを入力してください。
        </Typography>

        {/* エラー表示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          label="パスフレーズ"
          type={showPassphrase ? 'text' : 'password'}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          autoFocus
          data-testid="passphrase-input"
          sx={{ mb: 2 }}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={toggleShowPassphrase}
                    edge="end"
                    aria-label={showPassphrase ? '非表示' : '表示'}
                  >
                    {showPassphrase ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={isLoading}
            />
          }
          label="このセッションのパスフレーズを記憶"
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel} disabled={isLoading}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!passphrase || isLoading}
        >
          {isLoading ? <CircularProgress size={24} /> : '読み込み'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
