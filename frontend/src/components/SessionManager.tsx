/**
 * SessionManager コンポーネント
 *
 * Task 4: SessionManagerUIコンポーネント実装
 * Requirements: 5.2-5.4, 7.1, 7.4, 7.6
 *
 * セッション一覧表示・選択・管理のUIコンポーネント
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  CircularProgress,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Chip,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningIcon from '@mui/icons-material/Warning';

import { getSessions, deleteSession } from '../services/api';
import type { SessionMetadata, AuthStatus } from '../types/accessibility';

/**
 * SessionManagerコンポーネントのprops
 */
interface SessionManagerProps {
  /** セッション選択時のコールバック */
  onSessionSelect: (sessionId: string | null) => void;
  /** 選択中のセッションID */
  selectedSessionId?: string | null;
  /** 開発環境フラグ（デフォルト: false） */
  isDevelopment?: boolean;
  /** ログイン記録ボタンクリック時のコールバック */
  onRecordLogin?: () => void;
  /** 再認証ボタンクリック時のコールバック */
  onReauthenticate?: () => void;
}

/**
 * セッションが期限切れかどうかを判定
 */
function isSessionExpired(session: SessionMetadata): boolean {
  if (!session.expiresAt) {
    return false;
  }
  return new Date(session.expiresAt) < new Date();
}

/**
 * 認証タイプの表示名を取得
 */
function getAuthTypeLabel(authType: SessionMetadata['authType']): string {
  const labels: Record<SessionMetadata['authType'], string> = {
    none: 'なし',
    cookie: 'Cookie',
    bearer: 'Bearer',
    basic: 'Basic',
    form: 'フォーム',
  };
  return labels[authType] || authType;
}

/**
 * ツールチップテキストを生成
 */
function getTooltipText(session: SessionMetadata): string {
  const parts = [
    `ドメイン: ${session.domain}`,
    `認証タイプ: ${getAuthTypeLabel(session.authType)}`,
  ];

  if (session.expiresAt) {
    const expired = isSessionExpired(session);
    const expiresLabel = expired ? '期限切れ' : new Date(session.expiresAt).toLocaleString('ja-JP');
    parts.push(`有効期限: ${expiresLabel}`);
  }

  return parts.join('\n');
}

/**
 * SessionManager - セッション管理UIコンポーネント
 */
export function SessionManager({
  onSessionSelect,
  selectedSessionId = null,
  isDevelopment = false,
  onRecordLogin,
  onReauthenticate,
}: SessionManagerProps) {
  // 状態管理
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  // 認証状態を計算
  const getAuthStatus = useCallback((): AuthStatus => {
    if (!selectedSessionId) {
      return 'unauthenticated';
    }
    const selectedSession = sessions.find((s) => s.id === selectedSessionId);
    if (!selectedSession) {
      return 'unauthenticated';
    }
    if (isSessionExpired(selectedSession)) {
      return 'expired';
    }
    return 'authenticated';
  }, [selectedSessionId, sessions]);

  const authStatus = getAuthStatus();

  // セッション一覧を取得
  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSessions();
      setSessions(data);
    } catch (err) {
      // エラーメッセージを取得（ApiErrorまたは通常のError）
      const errorMessage =
        err instanceof Error ? err.message : 'セッション一覧の取得に失敗しました';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初回マウント時にセッション一覧を取得
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // セッション選択ハンドラー
  const handleSessionChange = (sessionId: string) => {
    if (sessionId === '') {
      onSessionSelect(null);
    } else {
      onSessionSelect(sessionId);
    }
  };

  // 削除ダイアログを開く
  const handleDeleteClick = (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
  };

  // 削除を実行
  const handleDeleteConfirm = async () => {
    if (!sessionToDelete) return;

    try {
      await deleteSession(sessionToDelete);
      // 削除成功後にセッション一覧を再取得
      await fetchSessions();
      // 削除したセッションが選択中だった場合は選択解除
      if (selectedSessionId === sessionToDelete) {
        onSessionSelect(null);
      }
    } catch (err) {
      // エラーメッセージを取得（ApiErrorまたは通常のError）
      const errorMessage =
        err instanceof Error ? err.message : 'セッションの削除に失敗しました';
      setError(errorMessage);
    } finally {
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  };

  // 削除をキャンセル
  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSessionToDelete(null);
  };

  // 認証状態インジケーターのレンダリング
  const renderAuthStatusIndicator = () => {
    switch (authStatus) {
      case 'authenticated':
        return (
          <Tooltip title="認証済み">
            <CheckCircleIcon
              data-testid="auth-status-authenticated"
              color="success"
              sx={{ ml: 1 }}
            />
          </Tooltip>
        );
      case 'expired':
        return (
          <Tooltip title="セッション期限切れ">
            <WarningIcon
              data-testid="auth-status-expired"
              color="warning"
              sx={{ ml: 1 }}
            />
          </Tooltip>
        );
      case 'unauthenticated':
      default:
        return (
          <Tooltip title="未認証">
            <CancelIcon
              data-testid="auth-status-unauthenticated"
              color="disabled"
              sx={{ ml: 1 }}
            />
          </Tooltip>
        );
    }
  };

  // ローディング中の表示
  if (isLoading) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <CircularProgress size={24} />
        <Typography variant="body2">セッション読み込み中...</Typography>
      </Box>
    );
  }

  // エラー表示
  if (error) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body2" color="error">
          {error}
        </Typography>
        <IconButton size="small" onClick={fetchSessions}>
          <RefreshIcon />
        </IconButton>
      </Box>
    );
  }

  // セッションがない場合
  if (sessions.length === 0) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body2" color="text.secondary">
          セッションがありません
        </Typography>
        {renderAuthStatusIndicator()}
        {isDevelopment && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={onRecordLogin}
          >
            ログイン記録
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel id="session-select-label">セッション</InputLabel>
        <Select
          labelId="session-select-label"
          id="session-select"
          value={selectedSessionId || ''}
          label="セッション"
          onChange={(e) => handleSessionChange(e.target.value as string)}
        >
          <MenuItem value="">
            <em>セッションなし</em>
          </MenuItem>
          {sessions.map((session) => {
            const expired = isSessionExpired(session);
            return (
              <MenuItem
                key={session.id}
                value={session.id}
                title={getTooltipText(session)}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Box display="flex" alignItems="center" gap={1}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <LockIcon
                      data-testid="lock-icon"
                      fontSize="small"
                      color={expired ? 'warning' : 'action'}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={session.name}
                    secondary={session.domain}
                    primaryTypographyProps={{
                      sx: { color: expired ? 'warning.main' : 'inherit' },
                    }}
                  />
                  {expired && (
                    <Chip
                      label="期限切れ"
                      size="small"
                      color="warning"
                      sx={{ ml: 1 }}
                    />
                  )}
                </Box>
                <IconButton
                  size="small"
                  data-testid="delete-session-button"
                  onClick={(e) => handleDeleteClick(session.id, e)}
                  sx={{ ml: 1 }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>

      {renderAuthStatusIndicator()}

      {isDevelopment && (
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={onRecordLogin}
        >
          ログイン記録
        </Button>
      )}

      {authStatus === 'expired' && isDevelopment && (
        <Button
          variant="contained"
          size="small"
          color="warning"
          startIcon={<RefreshIcon />}
          onClick={onReauthenticate}
        >
          再認証
        </Button>
      )}

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>セッションを削除しますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            この操作は取り消せません。セッションに保存された認証情報は完全に削除されます。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>キャンセル</Button>
          <Button onClick={handleDeleteConfirm} color="error">
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
