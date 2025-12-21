/**
 * SessionExpiredDialog コンポーネント
 *
 * Task 11: セッション期限切れ検出と再認証フロー
 * Requirements: 2.4, 6.3, 7.6
 *
 * セッション期限切れ時の確認ダイアログ
 * - 401/403エラー検出時に表示
 * - 再認証またはキャンセルの選択肢を提供
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';

/**
 * SessionExpiredDialogのprops
 */
interface SessionExpiredDialogProps {
  /** ダイアログの表示状態 */
  open: boolean;
  /** セッション名 */
  sessionName: string;
  /** エラーメッセージ（オプション） */
  errorMessage?: string;
  /** 再認証ボタンクリック時のコールバック */
  onReauthenticate: () => void;
  /** キャンセル/閉じるボタンクリック時のコールバック */
  onClose: () => void;
}

/**
 * SessionExpiredDialog - セッション期限切れ確認ダイアログ
 */
export function SessionExpiredDialog({
  open,
  sessionName,
  errorMessage,
  onReauthenticate,
  onClose,
}: SessionExpiredDialogProps) {
  // デフォルトメッセージ
  const defaultMessage = '認証セッションの有効期限が切れています。再ログインしますか？';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <WarningIcon color="warning" />
          セッション期限切れ
        </Box>
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          セッション「{sessionName}」の{errorMessage || defaultMessage}
        </DialogContentText>
        {errorMessage && (
          <DialogContentText sx={{ mt: 1, color: 'error.main' }}>
            {errorMessage}
          </DialogContentText>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          onClick={onReauthenticate}
          variant="contained"
          color="warning"
          startIcon={<WarningIcon />}
        >
          再認証
        </Button>
      </DialogActions>
    </Dialog>
  );
}
