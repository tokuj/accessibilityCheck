/**
 * SessionExpiredDialog コンポーネントのテスト
 *
 * Task 11: セッション期限切れ検出と再認証フロー
 * Requirements: 2.4, 6.3, 7.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionExpiredDialog } from '../SessionExpiredDialog';

describe('SessionExpiredDialog', () => {
  const mockOnReauthenticate = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 基本的なレンダリングテスト
  describe('ダイアログ表示テスト', () => {
    it('openがtrueの場合、ダイアログが表示される', () => {
      render(
        <SessionExpiredDialog
          open={true}
          sessionName="テストセッション"
          onReauthenticate={mockOnReauthenticate}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('セッション期限切れ')).toBeInTheDocument();
    });

    it('openがfalseの場合、ダイアログが表示されない', () => {
      render(
        <SessionExpiredDialog
          open={false}
          sessionName="テストセッション"
          onReauthenticate={mockOnReauthenticate}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('セッション名が正しく表示される', () => {
      render(
        <SessionExpiredDialog
          open={true}
          sessionName="管理者セッション"
          onReauthenticate={mockOnReauthenticate}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/管理者セッション/)).toBeInTheDocument();
    });

    it('確認メッセージが表示される', () => {
      render(
        <SessionExpiredDialog
          open={true}
          sessionName="テストセッション"
          onReauthenticate={mockOnReauthenticate}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/再ログインしますか/)).toBeInTheDocument();
    });
  });

  // 再認証フローテスト
  describe('再認証フローテスト', () => {
    it('「再認証」ボタンをクリックするとonReauthenticateが呼ばれる', () => {
      render(
        <SessionExpiredDialog
          open={true}
          sessionName="テストセッション"
          onReauthenticate={mockOnReauthenticate}
          onClose={mockOnClose}
        />
      );

      const reauthButton = screen.getByRole('button', { name: /再認証/i });
      fireEvent.click(reauthButton);

      expect(mockOnReauthenticate).toHaveBeenCalledTimes(1);
    });

    it('「キャンセル」ボタンをクリックするとonCloseが呼ばれる', () => {
      render(
        <SessionExpiredDialog
          open={true}
          sessionName="テストセッション"
          onReauthenticate={mockOnReauthenticate}
          onClose={mockOnClose}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /キャンセル/i });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('再認証ボタンが強調表示される', () => {
      render(
        <SessionExpiredDialog
          open={true}
          sessionName="テストセッション"
          onReauthenticate={mockOnReauthenticate}
          onClose={mockOnClose}
        />
      );

      const reauthButton = screen.getByRole('button', { name: /再認証/i });
      expect(reauthButton).toHaveClass('MuiButton-containedWarning');
    });
  });

  // カスタムメッセージテスト
  describe('カスタムメッセージテスト', () => {
    it('errorMessageが指定された場合、カスタムメッセージが表示される', () => {
      render(
        <SessionExpiredDialog
          open={true}
          sessionName="テストセッション"
          errorMessage="401 Unauthorized エラーが発生しました"
          onReauthenticate={mockOnReauthenticate}
          onClose={mockOnClose}
        />
      );

      // errorMessageが2箇所で表示されるため、getAllByTextを使用
      const errorMessages = screen.getAllByText(/401 Unauthorized/);
      expect(errorMessages.length).toBeGreaterThan(0);
    });

    it('errorMessageが未指定の場合、デフォルトメッセージが表示される', () => {
      render(
        <SessionExpiredDialog
          open={true}
          sessionName="テストセッション"
          onReauthenticate={mockOnReauthenticate}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/認証セッションの有効期限が切れています/)).toBeInTheDocument();
    });
  });
});
