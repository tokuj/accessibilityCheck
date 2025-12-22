/**
 * UrlChip コンポーネントテスト
 *
 * Task 2.1: UrlChipコンポーネントを新規作成
 * Requirements: 1.1, 1.6
 *
 * テスト対象:
 * - 単一URLをチップ形式で表示
 * - URLが長い場合は30文字で省略表示
 * - ツールチップで全体URLを表示
 * - 削除ボタン（×）のクリックハンドリング
 * - リンクアイコンの表示
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UrlChip } from '../UrlChip';

describe('UrlChip', () => {
  describe('基本表示', () => {
    it('URLをチップ形式で表示する', () => {
      render(<UrlChip url="https://example.com" onDelete={vi.fn()} />);

      expect(screen.getByText('https://example.com')).toBeInTheDocument();
    });

    it('リンクアイコンが表示される', () => {
      render(<UrlChip url="https://example.com" onDelete={vi.fn()} />);

      // LinkIconはMUIのアイコンなのでdata-testidで確認
      expect(screen.getByTestId('LinkIcon')).toBeInTheDocument();
    });

    it('削除ボタン（×）が表示される', () => {
      render(<UrlChip url="https://example.com" onDelete={vi.fn()} />);

      // MUI Chipの削除ボタン
      expect(screen.getByTestId('CancelIcon')).toBeInTheDocument();
    });
  });

  describe('URL省略表示', () => {
    it('30文字以下のURLはそのまま表示される', () => {
      const shortUrl = 'https://example.com';
      render(<UrlChip url={shortUrl} onDelete={vi.fn()} />);

      expect(screen.getByText(shortUrl)).toBeInTheDocument();
    });

    it('30文字を超えるURLは省略表示される', () => {
      const longUrl = 'https://www.example.com/very/long/path/to/page';
      render(<UrlChip url={longUrl} onDelete={vi.fn()} />);

      // 30文字で省略 + "..."
      const truncated = longUrl.substring(0, 30) + '...';
      expect(screen.getByText(truncated)).toBeInTheDocument();
    });

    it('ツールチップで全体URLが表示される', async () => {
      const longUrl = 'https://www.example.com/very/long/path/to/page';
      render(<UrlChip url={longUrl} onDelete={vi.fn()} />);

      // チップにホバー
      const chip = screen.getByRole('button');
      await userEvent.hover(chip);

      // ツールチップが表示されるのを待つ
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent(longUrl);
      });
    });
  });

  describe('削除操作', () => {
    it('削除ボタンをクリックするとonDeleteが呼ばれる', async () => {
      const onDelete = vi.fn();
      render(<UrlChip url="https://example.com" onDelete={onDelete} />);

      // MUI Chipの削除アイコンをクリック
      const deleteIcon = screen.getByTestId('CancelIcon');
      await userEvent.click(deleteIcon);

      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('disabled時は削除ボタンが表示されない', () => {
      const onDelete = vi.fn();
      render(<UrlChip url="https://example.com" onDelete={onDelete} disabled />);

      // disabled時は削除アイコンが非表示であることを確認
      // onDeleteがundefinedになるため、削除アイコンは表示されない
      expect(screen.queryByTestId('CancelIcon')).not.toBeInTheDocument();
    });
  });

  describe('スタイリング', () => {
    it('チップがクリック可能なスタイルで表示される', () => {
      render(<UrlChip url="https://example.com" onDelete={vi.fn()} />);

      const chip = screen.getByRole('button');
      // MUI Chipはbuttonロールを持つ
      expect(chip).toBeInTheDocument();
    });
  });
});
