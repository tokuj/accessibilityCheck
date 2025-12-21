/**
 * UrlInput コンポーネントテスト
 *
 * Task 5: UrlInputとSessionManagerの統合テスト
 * Task 12: AuthSettingsコンポーネント拡張テスト
 * Requirements: 2.2, 7.5
 *
 * テスト対象:
 * - セッション選択状態の管理
 * - 検証開始時にセッションIDとパスフレーズをAPIに送信
 * - 認証方式選択UI（セッション/手動）の提供
 * - 既存のAuthSettings（手動認証）との共存
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UrlInput } from '../UrlInput';
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
    schemaVersion: 1,
    authType: 'cookie',
    autoDestroy: false,
  },
];

describe('UrlInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getSessions.mockResolvedValue(mockSessions);
  });

  describe('基本機能', () => {
    it('URLを入力して検証ボタンをクリックできる', async () => {
      const onAnalyze = vi.fn();

      render(<UrlInput onAnalyze={onAnalyze} />);

      const input = screen.getByPlaceholderText('分析したいURLを入力してください...');
      await userEvent.type(input, 'https://example.com');

      const submitButton = screen.getByRole('button', { name: '' });
      await userEvent.click(submitButton);

      // セッション管理なしの場合は2引数で呼ばれる（後方互換性）
      expect(onAnalyze).toHaveBeenCalledWith(
        'https://example.com',
        undefined // auth
      );
    });

    it('http/httpsなしのURLにhttps://を自動付与する', async () => {
      const onAnalyze = vi.fn();

      render(<UrlInput onAnalyze={onAnalyze} />);

      const input = screen.getByPlaceholderText('分析したいURLを入力してください...');
      await userEvent.type(input, 'example.com');

      const submitButton = screen.getByRole('button', { name: '' });
      await userEvent.click(submitButton);

      expect(onAnalyze).toHaveBeenCalledWith(
        'https://example.com',
        undefined
      );
    });
  });

  describe('セッション管理統合（AuthSettingsダイアログ内）', () => {
    /**
     * 新しいUI構造:
     * 1. 鍵アイコンをクリック → AuthSettingsダイアログが開く
     * 2. 認証方式ドロップダウンで「保存済みセッション」を選択
     * 3. SessionManagerが表示され、セッションを選択できる
     */

    it('AuthSettingsダイアログで「保存済みセッション」オプションが表示される', async () => {
      render(<UrlInput onAnalyze={vi.fn()} showSessionManager />);

      // 認証設定ダイアログを開く（鍵アイコン）
      const lockButton = screen.getByLabelText(/認証設定/);
      await userEvent.click(lockButton);

      // ダイアログが開くのを待つ
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // 認証方式ドロップダウンが表示されることを確認
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByLabelText('認証方式')).toBeInTheDocument();
    });

    it('「保存済みセッション」を選択するとセッション一覧が表示される', async () => {
      render(<UrlInput onAnalyze={vi.fn()} showSessionManager />);

      // 認証設定ダイアログを開く
      const lockButton = screen.getByLabelText(/認証設定/);
      await userEvent.click(lockButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // 認証方式ドロップダウンを開いて「保存済みセッション」を選択
      // デフォルトで「保存済みセッション」が選択されている（selectedSessionIdがnullでない場合）
      // またはデフォルトで「手動認証設定」が選択されている
      const dialog = screen.getByRole('dialog');
      const authModeSelect = within(dialog).getByLabelText('認証方式');
      await userEvent.click(authModeSelect);

      // 「保存済みセッション」オプションを選択
      await userEvent.click(screen.getByRole('option', { name: '保存済みセッション' }));

      // SessionManager（セッションドロップダウン）が表示されるのを待つ
      await waitFor(() => {
        // セッション一覧が表示される（Alert要素を確認）
        expect(within(dialog).getByText(/保存済みのセッションを選択してください/)).toBeInTheDocument();
      });
    });

    it('セッションを選択できる', async () => {
      render(<UrlInput onAnalyze={vi.fn()} showSessionManager />);

      // 認証設定ダイアログを開く
      const lockButton = screen.getByLabelText(/認証設定/);
      await userEvent.click(lockButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');

      // 認証方式で「保存済みセッション」を選択
      const authModeSelect = within(dialog).getByLabelText('認証方式');
      await userEvent.click(authModeSelect);
      await userEvent.click(screen.getByRole('option', { name: '保存済みセッション' }));

      // SessionManagerのセッション一覧が読み込まれるのを待つ
      await waitFor(() => {
        expect(mockApi.getSessions).toHaveBeenCalled();
      });

      // セッションドロップダウンを選択
      // SessionManagerにはcomboboxロールのselectがある
      await waitFor(() => {
        const sessionSelect = within(dialog).getByLabelText('セッション');
        expect(sessionSelect).toBeInTheDocument();
      });

      const sessionSelect = within(dialog).getByLabelText('セッション');
      await userEvent.click(sessionSelect);

      // セッションを選択
      await userEvent.click(screen.getByText('Admin Session'));

      // セッションが選択されたことを確認（認証状態インジケーターが変化）
      await waitFor(() => {
        expect(screen.getByTestId('auth-status-authenticated')).toBeInTheDocument();
      });
    });

    it('セッション選択時に検証開始するとセッションIDがAPIに渡される', async () => {
      const onAnalyze = vi.fn();
      render(<UrlInput onAnalyze={onAnalyze} showSessionManager />);

      // 認証設定ダイアログを開く
      const lockButton = screen.getByLabelText(/認証設定/);
      await userEvent.click(lockButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');

      // 認証方式で「保存済みセッション」を選択
      const authModeSelect = within(dialog).getByLabelText('認証方式');
      await userEvent.click(authModeSelect);
      await userEvent.click(screen.getByRole('option', { name: '保存済みセッション' }));

      // SessionManagerのセッション一覧が読み込まれるのを待つ
      await waitFor(() => {
        expect(within(dialog).getByLabelText('セッション')).toBeInTheDocument();
      });

      // セッションを選択
      const sessionSelect = within(dialog).getByLabelText('セッション');
      await userEvent.click(sessionSelect);
      await userEvent.click(screen.getByText('Admin Session'));

      // ダイアログを閉じる（保存ボタン）
      const saveButton = within(dialog).getByText('保存');
      await userEvent.click(saveButton);

      // URLを入力して検証開始
      const input = screen.getByPlaceholderText('分析したいURLを入力してください...');
      await userEvent.type(input, 'https://example.com');

      // 送信ボタンをクリック
      const submitButton = screen.getByRole('button', { name: '' });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(onAnalyze).toHaveBeenCalledWith(
          'https://example.com',
          undefined, // auth (手動認証はなし)
          'session-1', // sessionId
          expect.any(String) // passphrase（またはundefined）
        );
      });
    });
  });

  describe('認証方式の共存', () => {
    it('認証設定ダイアログを開ける', async () => {
      render(<UrlInput onAnalyze={vi.fn()} showSessionManager />);

      // 認証設定ダイアログを開く（鍵アイコン）
      const lockButton = screen.getByLabelText(/認証設定/);
      await userEvent.click(lockButton);

      // 認証設定ダイアログが表示されることを確認
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // ダイアログタイトルが表示されることを確認
      expect(screen.getByText('認証設定')).toBeInTheDocument();
    });

    it('手動認証設定に切り替えると従来の認証オプションが表示される', async () => {
      render(<UrlInput onAnalyze={vi.fn()} showSessionManager />);

      // 認証設定ダイアログを開く
      const lockButton = screen.getByLabelText(/認証設定/);
      await userEvent.click(lockButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');

      // 認証方式で「手動認証設定」を選択
      const authModeSelect = within(dialog).getByLabelText('認証方式');
      await userEvent.click(authModeSelect);
      await userEvent.click(screen.getByRole('option', { name: '手動認証設定' }));

      // 認証タイプドロップダウンが表示されることを確認
      await waitFor(() => {
        expect(within(dialog).getByLabelText('認証タイプ')).toBeInTheDocument();
      });
    });

    it('セッション選択後も手動認証設定に切り替えられる', async () => {
      render(<UrlInput onAnalyze={vi.fn()} showSessionManager />);

      // 認証設定ダイアログを開く
      const lockButton = screen.getByLabelText(/認証設定/);
      await userEvent.click(lockButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');

      // まず「保存済みセッション」を選択
      const authModeSelect = within(dialog).getByLabelText('認証方式');
      await userEvent.click(authModeSelect);
      await userEvent.click(screen.getByRole('option', { name: '保存済みセッション' }));

      // セッションを選択
      await waitFor(() => {
        expect(within(dialog).getByLabelText('セッション')).toBeInTheDocument();
      });
      const sessionSelect = within(dialog).getByLabelText('セッション');
      await userEvent.click(sessionSelect);
      await userEvent.click(screen.getByText('Admin Session'));

      // 手動認証設定に切り替え
      const authModeSelect2 = within(dialog).getByLabelText('認証方式');
      await userEvent.click(authModeSelect2);
      await userEvent.click(screen.getByRole('option', { name: '手動認証設定' }));

      // 認証タイプドロップダウンが表示されることを確認
      await waitFor(() => {
        expect(within(dialog).getByLabelText('認証タイプ')).toBeInTheDocument();
      });
    });
  });

  describe('showSessionManager=false（後方互換性）', () => {
    it('showSessionManager=falseの場合、認証方式ドロップダウンは表示されない', async () => {
      render(<UrlInput onAnalyze={vi.fn()} showSessionManager={false} />);

      // 認証設定ダイアログを開く
      const lockButton = screen.getByLabelText(/認証設定/);
      await userEvent.click(lockButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');

      // 認証方式ドロップダウンがないことを確認（従来のUI）
      expect(within(dialog).queryByLabelText('認証方式')).not.toBeInTheDocument();

      // 認証タイプドロップダウンが直接表示されることを確認
      expect(within(dialog).getByLabelText('認証タイプ')).toBeInTheDocument();
    });

    it('showSessionManagerがデフォルト（false）の場合も認証方式ドロップダウンは表示されない', async () => {
      render(<UrlInput onAnalyze={vi.fn()} />);

      // 認証設定ダイアログを開く
      const lockButton = screen.getByLabelText(/認証設定/);
      await userEvent.click(lockButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');

      // 認証方式ドロップダウンがないことを確認
      expect(within(dialog).queryByLabelText('認証方式')).not.toBeInTheDocument();
    });

    it('既存の動作（authConfigのみ）を維持する', async () => {
      const onAnalyze = vi.fn();
      render(<UrlInput onAnalyze={onAnalyze} />);

      const input = screen.getByPlaceholderText('分析したいURLを入力してください...');
      await userEvent.type(input, 'https://example.com');

      // フォームを送信（認証なし）
      const submitButton = screen.getByRole('button', { name: '' });
      await userEvent.click(submitButton);

      expect(onAnalyze).toHaveBeenCalledWith(
        'https://example.com',
        undefined
      );

      // onAnalyzeは2引数で呼ばれる（sessionId, passphraseは渡されない）
      const call = onAnalyze.mock.calls[0];
      expect(call.length).toBe(2);
    });
  });
});
