/**
 * PassphraseDialog コンポーネントテスト
 *
 * Task 10: パスフレーズ入力UIコンポーネント
 * Requirements: 4.1, 2.1
 *
 * テスト対象:
 * - パスフレーズ入力
 * - 表示/非表示切り替え
 * - 記憶オプション
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PassphraseDialog } from '../PassphraseDialog';

/**
 * パスフレーズ入力フィールドを取得する
 * data-testidを使用して正確に取得
 */
function getPassphraseInput() {
  const container = screen.getByTestId('passphrase-input');
  return container.querySelector('input') as HTMLInputElement;
}

describe('PassphraseDialog', () => {
  beforeEach(() => {
    // sessionStorageをクリア
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('パスフレーズ入力', () => {
    it('セッション選択時にパスフレーズ入力ダイアログを表示する', () => {
      render(
        <PassphraseDialog
          open={true}
          sessionId="session-1"
          sessionName="Admin Session"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Admin Session/)).toBeInTheDocument();
      expect(getPassphraseInput()).toBeInTheDocument();
    });

    it('openがfalseの場合はダイアログを表示しない', () => {
      render(
        <PassphraseDialog
          open={false}
          sessionId="session-1"
          sessionName="Admin Session"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('パスフレーズが空の場合は送信ボタンが無効', () => {
      render(
        <PassphraseDialog
          open={true}
          sessionId="session-1"
          sessionName="Admin Session"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const submitButton = screen.getByRole('button', { name: /読み込み/i });
      expect(submitButton).toBeDisabled();
    });

    it('パスフレーズを入力すると送信ボタンが有効になる', async () => {
      render(
        <PassphraseDialog
          open={true}
          sessionId="session-1"
          sessionName="Admin Session"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      await userEvent.type(getPassphraseInput(), 'my-passphrase');

      const submitButton = screen.getByRole('button', { name: /読み込み/i });
      expect(submitButton).not.toBeDisabled();
    });

    it('送信ボタンをクリックするとonSubmitが呼ばれる', async () => {
      const onSubmit = vi.fn();
      render(
        <PassphraseDialog
          open={true}
          sessionId="session-1"
          sessionName="Admin Session"
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      );

      await userEvent.type(getPassphraseInput(), 'my-passphrase');
      await userEvent.click(screen.getByRole('button', { name: /読み込み/i }));

      expect(onSubmit).toHaveBeenCalledWith('my-passphrase', false);
    });

    it('キャンセルボタンをクリックするとonCancelが呼ばれる', async () => {
      const onCancel = vi.fn();
      render(
        <PassphraseDialog
          open={true}
          sessionId="session-1"
          sessionName="Admin Session"
          onSubmit={vi.fn()}
          onCancel={onCancel}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: /キャンセル/i }));

      expect(onCancel).toHaveBeenCalled();
    });

    it('不正パスフレーズ時はエラーメッセージを表示する', () => {
      render(
        <PassphraseDialog
          open={true}
          sessionId="session-1"
          sessionName="Admin Session"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          error="パスフレーズが正しくありません"
        />
      );

      expect(screen.getByText('パスフレーズが正しくありません')).toBeInTheDocument();
    });
  });

  describe('表示/非表示切り替え', () => {
    it('パスワード入力フィールドはデフォルトで非表示', () => {
      render(
        <PassphraseDialog
          open={true}
          sessionId="session-1"
          sessionName="Admin Session"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const input = getPassphraseInput();
      expect(input).toHaveAttribute('type', 'password');
    });

    it('表示ボタンをクリックするとパスフレーズが表示される', async () => {
      render(
        <PassphraseDialog
          open={true}
          sessionId="session-1"
          sessionName="Admin Session"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const toggleButton = screen.getByRole('button', { name: /表示/i });
      await userEvent.click(toggleButton);

      const input = getPassphraseInput();
      expect(input).toHaveAttribute('type', 'text');
    });

    it('再度クリックするとパスフレーズが非表示になる', async () => {
      render(
        <PassphraseDialog
          open={true}
          sessionId="session-1"
          sessionName="Admin Session"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const toggleButton = screen.getByRole('button', { name: /表示/i });
      await userEvent.click(toggleButton);
      await userEvent.click(screen.getByRole('button', { name: /非表示/i }));

      const input = getPassphraseInput();
      expect(input).toHaveAttribute('type', 'password');
    });
  });

  describe('記憶オプション', () => {
    it('「このセッションのパスフレーズを記憶」チェックボックスを表示する', () => {
      render(
        <PassphraseDialog
          open={true}
          sessionId="session-1"
          sessionName="Admin Session"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByRole('checkbox')).toBeInTheDocument();
      expect(screen.getByText(/このセッションのパスフレーズを記憶/i)).toBeInTheDocument();
    });

    it('チェックボックスをオンにして送信するとonSubmitにremember=trueが渡される', async () => {
      const onSubmit = vi.fn();
      render(
        <PassphraseDialog
          open={true}
          sessionId="session-1"
          sessionName="Admin Session"
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      );

      await userEvent.type(getPassphraseInput(), 'my-passphrase');
      await userEvent.click(screen.getByRole('checkbox'));
      await userEvent.click(screen.getByRole('button', { name: /読み込み/i }));

      expect(onSubmit).toHaveBeenCalledWith('my-passphrase', true);
    });

    it('セッションに保存されたパスフレーズがある場合は自動入力される', () => {
      // sessionStorageにパスフレーズを保存
      sessionStorage.setItem('passphrase_session-1', 'saved-passphrase');

      render(
        <PassphraseDialog
          open={true}
          sessionId="session-1"
          sessionName="Admin Session"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const input = getPassphraseInput();
      expect(input).toHaveValue('saved-passphrase');
    });

    it('記憶オプションがオンの場合、sessionStorageに保存される', async () => {
      const onSubmit = vi.fn();
      render(
        <PassphraseDialog
          open={true}
          sessionId="session-1"
          sessionName="Admin Session"
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      );

      await userEvent.type(getPassphraseInput(), 'my-passphrase');
      await userEvent.click(screen.getByRole('checkbox'));
      await userEvent.click(screen.getByRole('button', { name: /読み込み/i }));

      // onSubmitが呼ばれ、コンポーネント内でsessionStorageに保存される
      expect(onSubmit).toHaveBeenCalledWith('my-passphrase', true);
      // sessionStorageに保存されたことを確認
      expect(sessionStorage.getItem('passphrase_session-1')).toBe('my-passphrase');
    });
  });

  describe('ローディング状態', () => {
    it('isLoadingがtrueの場合は入力フィールドが無効になる', () => {
      render(
        <PassphraseDialog
          open={true}
          sessionId="session-1"
          sessionName="Admin Session"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          isLoading={true}
        />
      );

      // ローディング中は入力フィールドが無効
      const input = getPassphraseInput();
      expect(input).toBeDisabled();

      // ローディングインジケーターが表示されていることを確認
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });
});
