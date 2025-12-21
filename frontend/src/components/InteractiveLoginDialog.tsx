/**
 * InteractiveLoginDialog コンポーネント
 *
 * Task 9: インタラクティブログインUI実装
 * Requirements: 7.1-7.3
 *
 * ログイン記録ボタン・進行状況表示・完了通知のUI
 */

import { useState, useCallback } from 'react';
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
  Stepper,
  Step,
  StepLabel,
  InputAdornment,
  IconButton,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import {
  startInteractiveLogin,
  captureSession,
  cancelInteractiveLogin,
  type LoginSession,
} from '../services/api';
import type { SessionMetadata } from '../types/accessibility';

/**
 * InteractiveLoginDialogのprops
 */
interface InteractiveLoginDialogProps {
  /** ダイアログの開閉状態 */
  open: boolean;
  /** ダイアログを閉じるコールバック */
  onClose: () => void;
  /** ログイン成功時のコールバック */
  onSuccess: (session: SessionMetadata) => void;
}

/** ダイアログのステップ */
type DialogStep = 'url-input' | 'waiting-for-login' | 'capture';

/** ステップのラベル */
const STEP_LABELS = ['ログインURL入力', 'ブラウザでログイン', 'セッション保存'];

/**
 * ステップ番号を取得
 */
function getStepIndex(step: DialogStep): number {
  switch (step) {
    case 'url-input':
      return 0;
    case 'waiting-for-login':
      return 1;
    case 'capture':
      return 2;
    default:
      return 0;
  }
}

/**
 * InteractiveLoginDialog - インタラクティブログイン用ダイアログ
 */
export function InteractiveLoginDialog({
  open,
  onClose,
  onSuccess,
}: InteractiveLoginDialogProps) {
  // 状態管理
  const [step, setStep] = useState<DialogStep>('url-input');
  const [loginUrl, setLoginUrl] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginSession, setLoginSession] = useState<LoginSession | null>(null);

  // 状態リセット
  const resetState = useCallback(() => {
    setStep('url-input');
    setLoginUrl('');
    setSessionName('');
    setPassphrase('');
    setShowPassphrase(false);
    setIsLoading(false);
    setError(null);
    setLoginSession(null);
  }, []);

  // ダイアログを閉じる
  const handleClose = useCallback(async () => {
    // 待機中の場合はブラウザをキャンセル
    if (step === 'waiting-for-login' && loginSession) {
      try {
        await cancelInteractiveLogin();
      } catch {
        // キャンセルエラーは無視
      }
    }
    resetState();
    onClose();
  }, [step, loginSession, resetState, onClose]);

  // ステップ1: ブラウザを起動
  const handleStartLogin = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const session = await startInteractiveLogin(loginUrl);
      setLoginSession(session);
      setStep('waiting-for-login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ブラウザの起動に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [loginUrl]);

  // ステップ2: ログイン完了
  const handleLoginComplete = useCallback(() => {
    setStep('capture');
    // URLからデフォルトのセッション名を生成
    try {
      const url = new URL(loginUrl);
      setSessionName(url.hostname);
    } catch {
      setSessionName('');
    }
  }, [loginUrl]);

  // ステップ3: セッション保存
  const handleSaveSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const savedSession = await captureSession(sessionName, passphrase);
      onSuccess(savedSession);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'セッションの保存に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [sessionName, passphrase, onSuccess, handleClose]);

  // パスフレーズの表示/非表示切り替え
  const toggleShowPassphrase = useCallback(() => {
    setShowPassphrase((prev) => !prev);
  }, []);

  // ステップ1のコンテンツ: URL入力
  const renderUrlInputStep = () => (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        ログインしたいWebサイトのログインページURLを入力してください。
        ブラウザが起動し、手動でログインできます。
      </Typography>

      <TextField
        fullWidth
        label="ログインURL"
        placeholder="https://example.com/login"
        value={loginUrl}
        onChange={(e) => setLoginUrl(e.target.value)}
        disabled={isLoading}
        autoFocus
      />
    </>
  );

  // ステップ2のコンテンツ: ログイン待機中
  const renderWaitingStep = () => (
    <Box textAlign="center" py={3}>
      <CircularProgress sx={{ mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        ブラウザでログインしてください
      </Typography>
      <Typography variant="body2" color="text.secondary">
        別ウィンドウでブラウザが開いています。
        ログイン操作が完了したら「ログイン完了」ボタンをクリックしてください。
      </Typography>
    </Box>
  );

  // ステップ3のコンテンツ: セッション保存
  const renderCaptureStep = () => (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        セッション名とパスフレーズを入力して保存してください。
        パスフレーズは暗号化に使用されます。
      </Typography>

      <TextField
        fullWidth
        label="セッション名"
        placeholder="Admin Session"
        value={sessionName}
        onChange={(e) => setSessionName(e.target.value)}
        disabled={isLoading}
        sx={{ mb: 2 }}
      />

      <TextField
        fullWidth
        label="パスフレーズ"
        type={showPassphrase ? 'text' : 'password'}
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        disabled={isLoading}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={toggleShowPassphrase} edge="end">
                  {showPassphrase ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    </>
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>ログイン記録</DialogTitle>

      <DialogContent>
        {/* ステッパー */}
        <Stepper activeStep={getStepIndex(step)} sx={{ mb: 3 }}>
          {STEP_LABELS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* エラー表示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* ステップ別コンテンツ */}
        {step === 'url-input' && renderUrlInputStep()}
        {step === 'waiting-for-login' && renderWaitingStep()}
        {step === 'capture' && renderCaptureStep()}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          キャンセル
        </Button>

        {/* ステップ1: ブラウザ起動ボタン */}
        {step === 'url-input' && (
          <Button
            variant="contained"
            onClick={handleStartLogin}
            disabled={!loginUrl || isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : 'ブラウザを起動'}
          </Button>
        )}

        {/* ステップ2: ログイン完了ボタン */}
        {step === 'waiting-for-login' && (
          <Button
            variant="contained"
            color="success"
            onClick={handleLoginComplete}
            disabled={isLoading}
          >
            ログイン完了
          </Button>
        )}

        {/* ステップ3: 保存ボタン */}
        {step === 'capture' && (
          <Button
            variant="contained"
            onClick={handleSaveSession}
            disabled={!sessionName || !passphrase || isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : '保存'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
