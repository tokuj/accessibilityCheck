/**
 * InteractiveLoginDialog コンポーネントテスト
 *
 * Task 9: インタラクティブログインUI実装
 * Requirements: 7.1-7.3
 *
 * テスト対象:
 * - ダイアログの開閉
 * - フォーム入力
 * - API呼び出し
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InteractiveLoginDialog } from '../InteractiveLoginDialog';
import * as api from '../../services/api';

// APIモジュールをモック
vi.mock('../../services/api');
const mockApi = vi.mocked(api);

describe('InteractiveLoginDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ダイアログの開閉', () => {
    it('openがtrueの場合ダイアログを表示する', () => {
      render(
        <InteractiveLoginDialog
          open={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('ログイン記録')).toBeInTheDocument();
    });

    it('openがfalseの場合ダイアログを表示しない', () => {
      render(
        <InteractiveLoginDialog
          open={false}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('キャンセルボタンをクリックするとonCloseが呼ばれる', async () => {
      const onClose = vi.fn();
      render(
        <InteractiveLoginDialog
          open={true}
          onClose={onClose}
          onSuccess={vi.fn()}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('フォーム入力（ステップ1: ログインURL入力）', () => {
    it('ログインURLの入力フィールドを表示する', () => {
      render(
        <InteractiveLoginDialog
          open={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      expect(screen.getByLabelText(/ログインURL/i)).toBeInTheDocument();
    });

    it('ログインURLが空の場合は開始ボタンが無効', () => {
      render(
        <InteractiveLoginDialog
          open={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      const startButton = screen.getByRole('button', { name: /ブラウザを起動/i });
      expect(startButton).toBeDisabled();
    });

    it('ログインURLを入力すると開始ボタンが有効になる', async () => {
      render(
        <InteractiveLoginDialog
          open={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      await userEvent.type(
        screen.getByLabelText(/ログインURL/i),
        'https://example.com/login'
      );

      const startButton = screen.getByRole('button', { name: /ブラウザを起動/i });
      expect(startButton).not.toBeDisabled();
    });
  });

  describe('API呼び出し（ステップ1: ブラウザ起動）', () => {
    it('ブラウザを起動ボタンをクリックするとstartInteractiveLoginが呼ばれる', async () => {
      mockApi.startInteractiveLogin.mockResolvedValue({
        id: 'login-session-1',
        loginUrl: 'https://example.com/login',
        startedAt: new Date().toISOString(),
        status: 'waiting_for_login',
      });

      render(
        <InteractiveLoginDialog
          open={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      await userEvent.type(
        screen.getByLabelText(/ログインURL/i),
        'https://example.com/login'
      );
      await userEvent.click(screen.getByRole('button', { name: /ブラウザを起動/i }));

      expect(mockApi.startInteractiveLogin).toHaveBeenCalledWith(
        'https://example.com/login'
      );
    });

    it('ブラウザ起動成功後はステップ2（待機中）に進む', async () => {
      mockApi.startInteractiveLogin.mockResolvedValue({
        id: 'login-session-1',
        loginUrl: 'https://example.com/login',
        startedAt: new Date().toISOString(),
        status: 'waiting_for_login',
      });

      render(
        <InteractiveLoginDialog
          open={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      await userEvent.type(
        screen.getByLabelText(/ログインURL/i),
        'https://example.com/login'
      );
      await userEvent.click(screen.getByRole('button', { name: /ブラウザを起動/i }));

      await waitFor(() => {
        expect(screen.getByText(/ブラウザでログインしてください/i)).toBeInTheDocument();
      });
    });

    it('ブラウザ起動失敗時はエラーメッセージを表示する', async () => {
      mockApi.startInteractiveLogin.mockRejectedValue(
        new Error('headedブラウザはこの環境で利用できません')
      );

      render(
        <InteractiveLoginDialog
          open={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      await userEvent.type(
        screen.getByLabelText(/ログインURL/i),
        'https://example.com/login'
      );
      await userEvent.click(screen.getByRole('button', { name: /ブラウザを起動/i }));

      await waitFor(() => {
        expect(screen.getByText(/headedブラウザはこの環境で利用できません/i)).toBeInTheDocument();
      });
    });
  });

  describe('ステップ2: ログイン待機中', () => {
    it('「ログイン完了」ボタンを表示する', async () => {
      mockApi.startInteractiveLogin.mockResolvedValue({
        id: 'login-session-1',
        loginUrl: 'https://example.com/login',
        startedAt: new Date().toISOString(),
        status: 'waiting_for_login',
      });

      render(
        <InteractiveLoginDialog
          open={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      await userEvent.type(
        screen.getByLabelText(/ログインURL/i),
        'https://example.com/login'
      );
      await userEvent.click(screen.getByRole('button', { name: /ブラウザを起動/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ログイン完了/i })).toBeInTheDocument();
      });
    });

    it('「ログイン完了」をクリックするとステップ3（キャプチャ）に進む', async () => {
      mockApi.startInteractiveLogin.mockResolvedValue({
        id: 'login-session-1',
        loginUrl: 'https://example.com/login',
        startedAt: new Date().toISOString(),
        status: 'waiting_for_login',
      });

      render(
        <InteractiveLoginDialog
          open={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      await userEvent.type(
        screen.getByLabelText(/ログインURL/i),
        'https://example.com/login'
      );
      await userEvent.click(screen.getByRole('button', { name: /ブラウザを起動/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ログイン完了/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /ログイン完了/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/セッション名/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/パスフレーズ/i)).toBeInTheDocument();
      });
    });

    it('キャンセルボタンをクリックするとcancelInteractiveLoginが呼ばれる', async () => {
      mockApi.startInteractiveLogin.mockResolvedValue({
        id: 'login-session-1',
        loginUrl: 'https://example.com/login',
        startedAt: new Date().toISOString(),
        status: 'waiting_for_login',
      });
      mockApi.cancelInteractiveLogin.mockResolvedValue(undefined);

      render(
        <InteractiveLoginDialog
          open={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      await userEvent.type(
        screen.getByLabelText(/ログインURL/i),
        'https://example.com/login'
      );
      await userEvent.click(screen.getByRole('button', { name: /ブラウザを起動/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

      expect(mockApi.cancelInteractiveLogin).toHaveBeenCalled();
    });
  });

  describe('ステップ3: セッション保存', () => {
    it('セッション名とパスフレーズの入力フィールドを表示する', async () => {
      mockApi.startInteractiveLogin.mockResolvedValue({
        id: 'login-session-1',
        loginUrl: 'https://example.com/login',
        startedAt: new Date().toISOString(),
        status: 'waiting_for_login',
      });

      render(
        <InteractiveLoginDialog
          open={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      // ステップ1: URL入力
      await userEvent.type(
        screen.getByLabelText(/ログインURL/i),
        'https://example.com/login'
      );
      await userEvent.click(screen.getByRole('button', { name: /ブラウザを起動/i }));

      // ステップ2: 待機
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ログイン完了/i })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole('button', { name: /ログイン完了/i }));

      // ステップ3: 保存
      await waitFor(() => {
        expect(screen.getByLabelText(/セッション名/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/パスフレーズ/i)).toBeInTheDocument();
      });
    });

    it('保存ボタンをクリックするとcaptureSessionが呼ばれる', async () => {
      mockApi.startInteractiveLogin.mockResolvedValue({
        id: 'login-session-1',
        loginUrl: 'https://example.com/login',
        startedAt: new Date().toISOString(),
        status: 'waiting_for_login',
      });
      mockApi.captureSession.mockResolvedValue({
        id: 'captured-session-1',
        name: 'My Session',
        domain: 'example.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schemaVersion: 1,
        authType: 'form',
        autoDestroy: false,
      });

      const onSuccess = vi.fn();
      render(
        <InteractiveLoginDialog
          open={true}
          onClose={vi.fn()}
          onSuccess={onSuccess}
        />
      );

      // ステップ1: URL入力
      await userEvent.type(
        screen.getByLabelText(/ログインURL/i),
        'https://example.com/login'
      );
      await userEvent.click(screen.getByRole('button', { name: /ブラウザを起動/i }));

      // ステップ2: 待機
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ログイン完了/i })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole('button', { name: /ログイン完了/i }));

      // ステップ3: 保存
      await waitFor(() => {
        expect(screen.getByLabelText(/セッション名/i)).toBeInTheDocument();
      });

      // デフォルトのセッション名（ホスト名）をクリアして新しい名前を入力
      const sessionNameInput = screen.getByLabelText(/セッション名/i);
      await userEvent.clear(sessionNameInput);
      await userEvent.type(sessionNameInput, 'My Session');
      await userEvent.type(screen.getByLabelText(/パスフレーズ/i), 'my-passphrase');
      await userEvent.click(screen.getByRole('button', { name: /保存/i }));

      expect(mockApi.captureSession).toHaveBeenCalledWith(
        'My Session',
        'my-passphrase'
      );
    });

    it('保存成功時はonSuccessが呼ばれる', async () => {
      mockApi.startInteractiveLogin.mockResolvedValue({
        id: 'login-session-1',
        loginUrl: 'https://example.com/login',
        startedAt: new Date().toISOString(),
        status: 'waiting_for_login',
      });
      mockApi.captureSession.mockResolvedValue({
        id: 'captured-session-1',
        name: 'My Session',
        domain: 'example.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schemaVersion: 1,
        authType: 'form',
        autoDestroy: false,
      });

      const onSuccess = vi.fn();
      render(
        <InteractiveLoginDialog
          open={true}
          onClose={vi.fn()}
          onSuccess={onSuccess}
        />
      );

      // ステップ1: URL入力
      await userEvent.type(
        screen.getByLabelText(/ログインURL/i),
        'https://example.com/login'
      );
      await userEvent.click(screen.getByRole('button', { name: /ブラウザを起動/i }));

      // ステップ2: 待機
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ログイン完了/i })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole('button', { name: /ログイン完了/i }));

      // ステップ3: 保存
      await waitFor(() => {
        expect(screen.getByLabelText(/セッション名/i)).toBeInTheDocument();
      });

      await userEvent.type(screen.getByLabelText(/セッション名/i), 'My Session');
      await userEvent.type(screen.getByLabelText(/パスフレーズ/i), 'my-passphrase');
      await userEvent.click(screen.getByRole('button', { name: /保存/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });
});
