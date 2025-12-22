/**
 * UrlChip コンポーネント
 *
 * Task 2.1: UrlChipコンポーネントを新規作成
 * Requirements: 1.1, 1.6
 *
 * 単一のURLをチップ形式で表示するプレゼンテーショナルコンポーネント。
 * - URLが長い場合は30文字で省略表示し、ツールチップで全体を表示
 * - MUI Chipの削除ボタン（onDelete）を活用し、削除操作を親コンポーネントに通知
 * - リンクアイコンをチップの先頭に表示
 */

import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import LinkIcon from '@mui/icons-material/Link';
import CancelIcon from '@mui/icons-material/Cancel';

/** URL表示の最大文字数 */
const MAX_URL_LENGTH = 30;

export interface UrlChipProps {
  /** 表示するURL */
  url: string;
  /** 削除ボタンクリック時のコールバック */
  onDelete: () => void;
  /** 無効化状態 */
  disabled?: boolean;
}

/**
 * URLを省略表示する
 * @param url 元のURL
 * @returns 30文字を超える場合は省略した文字列
 */
function truncateUrl(url: string): string {
  if (url.length <= MAX_URL_LENGTH) {
    return url;
  }
  return url.substring(0, MAX_URL_LENGTH) + '...';
}

/**
 * 単一URLをチップ形式で表示するコンポーネント
 */
export function UrlChip({ url, onDelete, disabled = false }: UrlChipProps) {
  const displayUrl = truncateUrl(url);
  const isLongUrl = url.length > MAX_URL_LENGTH;

  const chip = (
    <Chip
      icon={<LinkIcon data-testid="LinkIcon" />}
      label={displayUrl}
      onDelete={disabled ? undefined : onDelete}
      disabled={disabled}
      deleteIcon={<CancelIcon data-testid="CancelIcon" />}
      sx={{
        maxWidth: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        '& .MuiChip-label': {
          fontFamily: 'monospace',
          fontSize: '0.875rem',
        },
        '& .MuiChip-deleteIcon': {
          color: 'rgba(0, 0, 0, 0.54)',
          fontSize: '1rem',
          '&:hover': {
            color: 'rgba(0, 0, 0, 0.87)',
          },
        },
      }}
    />
  );

  // 長いURLの場合はツールチップで全体を表示
  if (isLongUrl) {
    return (
      <Tooltip title={url} placement="top">
        {chip}
      </Tooltip>
    );
  }

  return chip;
}
