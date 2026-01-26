/**
 * AIChatPopoverコンポーネント
 * 質問入力・履歴表示・回答表示を行うポップオーバーUI
 * @requirement 1.2-1.6, 5.1-5.5, 6.2-6.6 - 対話UIポップオーバー
 * @requirement 10.1-10.4 - 初期メッセージ（ユーザーインパクト提示）
 */
import { useState, useEffect, useRef, useId, type FormEvent, type KeyboardEvent } from 'react';
import {
  Popover,
  Box,
  TextField,
  IconButton,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Link,
  Divider,
  Paper,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import { useAIChat } from '../hooks/useAIChat';
import type { ChatContext, ChatHistoryEntry } from '../utils/chat-storage';
import { getDisplayDomain } from '../utils/url-utils';

/**
 * AIChatPopoverのProps
 */
export interface AIChatPopoverProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  context: ChatContext;
  onClose: () => void;
}

/**
 * AIChatPopoverコンポーネント
 */
export function AIChatPopover({
  open,
  anchorEl,
  context,
  onClose,
}: AIChatPopoverProps) {
  // フック
  const {
    isLoading,
    error,
    history,
    initialMessage,
    isLoadingInitialMessage,
    sendQuestion,
    retry,
    clearError,
    fetchInitialMessage,
  } = useAIChat(context);

  // 状態
  const [question, setQuestion] = useState('');

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const historyContainerRef = useRef<HTMLDivElement>(null);

  // IDs for ARIA
  const titleId = useId();

  // Popoverが開いたときに入力フィールドにフォーカス & 初期メッセージを取得
  useEffect(() => {
    if (open) {
      // 少し遅延させてフォーカスを設定（Popoverのアニメーション後）
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);

      // 初期メッセージを取得（履歴がない場合のみ）
      if (history.length === 0) {
        fetchInitialMessage();
      }

      return () => clearTimeout(timer);
    }
  }, [open, history.length, fetchInitialMessage]);

  // 新しい履歴が追加されたらスクロール
  useEffect(() => {
    if (historyContainerRef.current) {
      historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight;
    }
  }, [history]);

  // 質問を送信
  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isLoading) {
      return;
    }
    setQuestion('');
    await sendQuestion(trimmedQuestion);
  };

  // Escapeキーで閉じる
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // Enterキーで送信（Shift+Enterは改行、IME変換中は送信しない）
  // @requirement 11.1, 11.2 - 日本語入力（IME）対応
  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // IME変換中は送信しない
    if (e.nativeEvent.isComposing || e.key === 'Process') {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // 再試行
  const handleRetry = async () => {
    clearError();
    await retry();
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      onKeyDown={handleKeyDown}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-modal': 'true' as const,
          'aria-labelledby': titleId,
          sx: {
            maxWidth: 400,
            maxHeight: 500,
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      {/* ヘッダー */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography id={titleId} variant="subtitle2" component="h2">
          {context.label}についてAIに質問
        </Typography>
        <IconButton
          size="small"
          onClick={onClose}
          aria-label="閉じる"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* 履歴表示エリア */}
      <Box
        ref={historyContainerRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 1.5,
          minHeight: 100,
        }}
      >
        {/* 初期メッセージ取得中 */}
        {isLoadingInitialMessage && history.length === 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              この項目の影響を確認中...
            </Typography>
          </Box>
        )}

        {/* 履歴がなく、初期メッセージも取得中でない場合 */}
        {history.length === 0 && !isLoadingInitialMessage && !isLoading && !error && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            続けて質問できます
          </Typography>
        )}

        {history.map((entry: ChatHistoryEntry) => (
          <Box key={entry.id} sx={{ mb: 2 }}>
            {/* ユーザーの質問（初期メッセージの場合は表示しない） */}
            {!entry.isInitialMessage && (
              <Paper
                elevation={0}
                sx={{
                  p: 1,
                  mb: 1,
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                  borderRadius: 2,
                  ml: 4,
                }}
              >
                <Typography variant="body2">{entry.question}</Typography>
              </Paper>
            )}

            {/* AIの回答 */}
            <Paper
              elevation={0}
              sx={{
                p: 1,
                bgcolor: 'grey.100',
                borderRadius: 2,
                mr: entry.isInitialMessage ? 0 : 4,
              }}
            >
              {entry.isInitialMessage && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 0.5 }}
                >
                  この項目を満たさないと...
                </Typography>
              )}
              <Typography
                variant="body2"
                aria-live="polite"
                sx={{ whiteSpace: 'pre-wrap' }}
              >
                {entry.answer}
              </Typography>
              {/* 参照URL（Grounding対応：ドメイン情報を使用） */}
              {entry.referenceLinks && entry.referenceLinks.length > 0 && (
                <Box sx={{ mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    参照:
                  </Typography>
                  {entry.referenceLinks.slice(0, 3).map((link, idx) => (
                    <Link
                      key={idx}
                      href={link.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="caption"
                      sx={{ display: 'block', ml: 1 }}
                    >
                      {link.domain || link.title || getDisplayDomain(link.uri)}
                    </Link>
                  ))}
                </Box>
              )}
            </Paper>
          </Box>
        ))}

        {/* ローディング */}
        {isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              回答を生成中...
            </Typography>
          </Box>
        )}

        {/* エラー */}
        {error && (
          <Alert
            severity="error"
            sx={{ mt: 1 }}
            action={
              <Button color="inherit" size="small" onClick={handleRetry}>
                再試行
              </Button>
            }
          >
            {error.message}
          </Alert>
        )}
      </Box>

      <Divider />

      {/* 入力フォーム */}
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1.5,
        }}
      >
        <TextField
          inputRef={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="質問を入力..."
          size="small"
          fullWidth
          disabled={isLoading}
          inputProps={{
            'aria-label': '質問',
          }}
        />
        <IconButton
          type="submit"
          color="primary"
          disabled={isLoading || !question.trim()}
          aria-label="送信"
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Popover>
  );
}
