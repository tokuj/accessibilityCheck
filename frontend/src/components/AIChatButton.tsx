/**
 * AIChatButtonコンポーネント
 * 対話可能な項目にホバー時表示するコメントアイコンボタン
 * @requirement 1.1, 1.5, 6.1, 4.12 - 対話ポイントのトリガーボタン
 */
import { useState, useRef, useId, useCallback } from 'react';
import { IconButton, Badge } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { AIChatPopover } from './AIChatPopover';
import { useChatHistory } from '../hooks/useChatHistory';
import type { ChatContext } from '../utils/chat-storage';

/**
 * AIChatButtonのProps
 */
export interface AIChatButtonProps {
  context: ChatContext;
  size?: 'small' | 'medium';
  className?: string;
}

/**
 * AIChatButtonコンポーネント
 */
export function AIChatButton({ context, size = 'small', className }: AIChatButtonProps) {
  // 状態
  const [open, setOpen] = useState(false);

  // Refs
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 履歴カウント取得用
  const { historyCount } = useChatHistory(context);

  // IDを生成
  const popoverId = useId();

  // Popoverを開く
  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  // Popoverを閉じる
  const handleClose = useCallback(() => {
    setOpen(false);
    // フォーカスをボタンに戻す
    setTimeout(() => {
      buttonRef.current?.focus();
    }, 0);
  }, []);

  return (
    <>
      <Badge
        badgeContent={historyCount}
        color="primary"
        invisible={historyCount === 0}
        max={99}
      >
        <IconButton
          ref={buttonRef}
          onClick={handleOpen}
          size={size}
          className={className}
          aria-label="この項目についてAIに質問する"
          aria-expanded={open}
          aria-controls={open ? popoverId : undefined}
          aria-haspopup="dialog"
          sx={{
            opacity: 0.7,
            '&:hover': {
              opacity: 1,
            },
          }}
        >
          <ChatBubbleOutlineIcon fontSize={size} />
        </IconButton>
      </Badge>

      <AIChatPopover
        open={open}
        anchorEl={buttonRef.current}
        context={context}
        onClose={handleClose}
      />
    </>
  );
}
