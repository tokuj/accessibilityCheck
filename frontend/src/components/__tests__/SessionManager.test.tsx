/**
 * SessionManager コンポーネントテスト
 *
 * Task 4: SessionManagerUIコンポーネント実装
 * Requirements: 5.2-5.4, 7.1, 7.4, 7.6
 *
 * テスト対象:
 * - セッション一覧表示
 * - セッション選択
 * - セッション削除
 * - ローディング状態・エラー状態表示
 * - 認証状態インジケーター
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionManager } from '../SessionManager';
import * as api from '../../services/api';
import type { SessionMetadata } from '../../types/accessibility';

// APIモジュールをモック
vi.mock('../../services/api');
const mockApi = vi.mocked(api);

// テスト用のモックデータ
const mockSessions: SessionMetadata[] = [
  {
    id: 'session-1',
    name: 'Admin Session',
    domain: 'example.com',
    createdAt: '2025-12-20T10:00:00Z',
    updatedAt: '2025-12-20T10:00:00Z',
    schemaVersion: 1,
    authType: 'form',
    autoDestroy: false,
  },
  {
    id: 'session-2',
    name: 'Viewer Session',
    domain: 'example.com',
    createdAt: '2025-12-19T10:00:00Z',
    updatedAt: '2025-12-19T10:00:00Z',
    expiresAt: '2025-12-18T10:00:00Z', // 期限切れ
    schemaVersion: 1,
    authType: 'cookie',
    autoDestroy: true,
  },
];

describe('SessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('セッション一覧表示', () => {
    it('セッション一覧をドロップダウンで表示する', async () => {
      mockApi.getSessions.mockResolvedValue(mockSessions);

      render(<SessionManager onSessionSelect={vi.fn()} />);

      // ローディング完了を待つ
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      // ドロップダウンをクリック
      const select = screen.getByRole('combobox');
      await userEvent.click(select);

      // セッション名が表示されることを確認
      expect(screen.getByText('Admin Session')).toBeInTheDocument();
      expect(screen.getByText('Viewer Session')).toBeInTheDocument();
    });

    it('セッションがない場合は「セッションなし」を表示する', async () => {
      mockApi.getSessions.mockResolvedValue([]);

      render(<SessionManager onSessionSelect={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('セッションがありません')).toBeInTheDocument();
      });
    });

    it('各セッションにロックアイコンを表示する', async () => {
      mockApi.getSessions.mockResolvedValue(mockSessions);

      render(<SessionManager onSessionSelect={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      await userEvent.click(select);

      // ロックアイコンが表示されることを確認（data-testidで確認）
      const lockIcons = screen.getAllByTestId('lock-icon');
      expect(lockIcons.length).toBeGreaterThan(0);
    });

    it('ホバー時にドメイン、認証タイプ、有効期限をツールチップ表示する', async () => {
      mockApi.getSessions.mockResolvedValue(mockSessions);

      render(<SessionManager onSessionSelect={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      await userEvent.click(select);

      // ツールチップの存在を確認（title属性またはTooltip）
      const adminOption = screen.getByText('Admin Session').closest('[role="option"]');
      expect(adminOption).toHaveAttribute('title');
    });
  });

  describe('セッション選択', () => {
    it('セッション選択時に親コンポーネントに通知する', async () => {
      mockApi.getSessions.mockResolvedValue(mockSessions);
      const onSessionSelect = vi.fn();

      render(<SessionManager onSessionSelect={onSessionSelect} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      // ドロップダウンを開いてセッションを選択
      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByText('Admin Session'));

      expect(onSessionSelect).toHaveBeenCalledWith('session-1');
    });
  });

  describe('セッション削除', () => {
    it('削除ボタンをクリックすると確認ダイアログを表示する', async () => {
      mockApi.getSessions.mockResolvedValue(mockSessions);

      render(<SessionManager onSessionSelect={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      // ドロップダウンを開く
      const select = screen.getByRole('combobox');
      await userEvent.click(select);

      // 削除ボタンをクリック
      const deleteButtons = screen.getAllByTestId('delete-session-button');
      await userEvent.click(deleteButtons[0]);

      // 確認ダイアログが表示されることを確認
      expect(screen.getByText('セッションを削除しますか？')).toBeInTheDocument();
    });

    it('確認ダイアログで「削除」をクリックするとセッションを削除する', async () => {
      mockApi.getSessions.mockResolvedValue(mockSessions);
      mockApi.deleteSession.mockResolvedValue(undefined);

      render(<SessionManager onSessionSelect={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      // ドロップダウンを開く
      const select = screen.getByRole('combobox');
      await userEvent.click(select);

      // 削除ボタンをクリック
      const deleteButtons = screen.getAllByTestId('delete-session-button');
      await userEvent.click(deleteButtons[0]);

      // 確認ダイアログで「削除」をクリック
      await userEvent.click(screen.getByRole('button', { name: '削除' }));

      expect(mockApi.deleteSession).toHaveBeenCalledWith('session-1');
    });

    it('確認ダイアログで「キャンセル」をクリックするとダイアログを閉じる', async () => {
      mockApi.getSessions.mockResolvedValue(mockSessions);

      render(<SessionManager onSessionSelect={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      // ドロップダウンを開く
      const select = screen.getByRole('combobox');
      await userEvent.click(select);

      // 削除ボタンをクリック
      const deleteButtons = screen.getAllByTestId('delete-session-button');
      await userEvent.click(deleteButtons[0]);

      // 確認ダイアログが表示されることを確認
      expect(screen.getByText('セッションを削除しますか？')).toBeInTheDocument();

      // 確認ダイアログで「キャンセル」をクリック
      await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

      // ダイアログが閉じることを確認（非同期で閉じるのを待つ）
      await waitFor(() => {
        expect(screen.queryByText('セッションを削除しますか？')).not.toBeInTheDocument();
      });
    });
  });

  describe('認証状態インジケーター', () => {
    it('未認証状態を表示する', async () => {
      mockApi.getSessions.mockResolvedValue([]);

      render(<SessionManager onSessionSelect={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('auth-status-unauthenticated')).toBeInTheDocument();
      });
    });

    it('認証済み状態を表示する', async () => {
      mockApi.getSessions.mockResolvedValue(mockSessions);

      render(
        <SessionManager
          onSessionSelect={vi.fn()}
          selectedSessionId="session-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status-authenticated')).toBeInTheDocument();
      });
    });

    it('期限切れセッション選択時は期限切れ状態を表示する', async () => {
      mockApi.getSessions.mockResolvedValue(mockSessions);

      render(
        <SessionManager
          onSessionSelect={vi.fn()}
          selectedSessionId="session-2"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status-expired')).toBeInTheDocument();
      });
    });
  });

  describe('ローディング・エラー状態', () => {
    it('ローディング中はスピナーを表示する', async () => {
      // 解決を遅延させる
      mockApi.getSessions.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockSessions), 1000))
      );

      render(<SessionManager onSessionSelect={vi.fn()} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('API呼び出しでエラーが発生した場合はエラーメッセージを表示する', async () => {
      const errorMessage = 'サーバーに接続できません';
      mockApi.getSessions.mockRejectedValue(new Error(errorMessage));

      render(<SessionManager onSessionSelect={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });
  });

  describe('「ログイン記録」ボタン（開発環境）', () => {
    it('開発環境では「ログイン記録」ボタンを表示する', async () => {
      mockApi.getSessions.mockResolvedValue([]);

      render(<SessionManager onSessionSelect={vi.fn()} isDevelopment={true} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ログイン記録/ })).toBeInTheDocument();
      });
    });

    it('本番環境では「ログイン記録」ボタンを表示しない', async () => {
      mockApi.getSessions.mockResolvedValue([]);

      render(<SessionManager onSessionSelect={vi.fn()} isDevelopment={false} />);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /ログイン記録/ })).not.toBeInTheDocument();
      });
    });
  });

  describe('「再認証」ボタン（期限切れ時）', () => {
    it('期限切れセッション選択時は「再認証」ボタンを表示する', async () => {
      mockApi.getSessions.mockResolvedValue(mockSessions);

      render(
        <SessionManager
          onSessionSelect={vi.fn()}
          selectedSessionId="session-2"
          isDevelopment={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /再認証/ })).toBeInTheDocument();
      });
    });

    it('有効なセッション選択時は「再認証」ボタンを表示しない', async () => {
      mockApi.getSessions.mockResolvedValue(mockSessions);

      render(
        <SessionManager
          onSessionSelect={vi.fn()}
          selectedSessionId="session-1"
          isDevelopment={true}
        />
      );

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /再認証/ })).not.toBeInTheDocument();
      });
    });
  });
});
