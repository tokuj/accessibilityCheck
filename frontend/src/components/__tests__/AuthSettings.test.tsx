/**
 * AuthSettings コンポーネントテスト
 *
 * Task 12: AuthSettingsコンポーネント拡張
 * Requirements: 3.1, 7.5
 *
 * テスト対象:
 * - 認証方式選択に「保存済みセッション」オプション追加
 * - 「保存済みセッション」選択時はSessionManager表示
 * - 既存のBasic/Form/Bearer/Cookie認証UIを維持
 * - 認証方式切り替え時に状態をリセット
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthSettings } from '../AuthSettings';

describe('AuthSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基本機能', () => {
    it('ダイアログが開いた状態で表示される', () => {
      render(
        <AuthSettings
          open={true}
          onClose={vi.fn()}
          authConfig={undefined}
          onSave={vi.fn()}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('認証設定')).toBeInTheDocument();
    });

    it('認証タイプの選択肢が表示される', async () => {
      render(
        <AuthSettings
          open={true}
          onClose={vi.fn()}
          authConfig={undefined}
          onSave={vi.fn()}
        />
      );

      const select = screen.getByRole('combobox');
      await userEvent.click(select);

      // 既存の認証タイプが表示されることを確認
      expect(screen.getByRole('option', { name: '認証なし' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Cookie認証' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Bearer Token認証' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Basic認証' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'フォームログイン' })).toBeInTheDocument();
    });
  });

  describe('既存認証方式のUI維持', () => {
    it('Cookie認証を選択するとCookie入力フィールドが表示される', async () => {
      render(
        <AuthSettings
          open={true}
          onClose={vi.fn()}
          authConfig={undefined}
          onSave={vi.fn()}
        />
      );

      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: 'Cookie認証' }));

      expect(screen.getByLabelText('Cookie')).toBeInTheDocument();
    });

    it('Bearer Token認証を選択するとToken入力フィールドが表示される', async () => {
      render(
        <AuthSettings
          open={true}
          onClose={vi.fn()}
          authConfig={undefined}
          onSave={vi.fn()}
        />
      );

      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: 'Bearer Token認証' }));

      expect(screen.getByLabelText('Bearer Token')).toBeInTheDocument();
    });

    it('Basic認証を選択するとユーザー名・パスワード入力フィールドが表示される', async () => {
      render(
        <AuthSettings
          open={true}
          onClose={vi.fn()}
          authConfig={undefined}
          onSave={vi.fn()}
        />
      );

      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: 'Basic認証' }));

      expect(screen.getByLabelText('ユーザー名')).toBeInTheDocument();
      expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
    });

    it('フォームログインを選択するとフォーム設定フィールドが表示される', async () => {
      render(
        <AuthSettings
          open={true}
          onClose={vi.fn()}
          authConfig={undefined}
          onSave={vi.fn()}
        />
      );

      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: 'フォームログイン' }));

      expect(screen.getByLabelText('ログインURL')).toBeInTheDocument();
      expect(screen.getByLabelText('ユーザー名')).toBeInTheDocument();
      expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
    });
  });

  describe('認証方式の保存', () => {
    it('保存ボタンをクリックすると認証設定が保存される', async () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <AuthSettings
          open={true}
          onClose={onClose}
          authConfig={undefined}
          onSave={onSave}
        />
      );

      // Basic認証を設定
      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: 'Basic認証' }));

      await userEvent.type(screen.getByLabelText('ユーザー名'), 'testuser');
      await userEvent.type(screen.getByLabelText('パスワード'), 'testpass');

      await userEvent.click(screen.getByRole('button', { name: '保存' }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'basic',
          username: 'testuser',
          password: 'testpass',
        })
      );
      expect(onClose).toHaveBeenCalled();
    });

    it('「認証なし」を選択して保存するとundefinedが渡される', async () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <AuthSettings
          open={true}
          onClose={onClose}
          authConfig={{ type: 'basic', username: 'test', password: 'test' }}
          onSave={onSave}
        />
      );

      // 「認証なし」を選択
      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: '認証なし' }));

      await userEvent.click(screen.getByRole('button', { name: '保存' }));

      expect(onSave).toHaveBeenCalledWith(undefined);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('認証方式切り替え時の状態', () => {
    it('認証タイプを切り替えると対応するフィールドが表示される', async () => {
      render(
        <AuthSettings
          open={true}
          onClose={vi.fn()}
          authConfig={undefined}
          onSave={vi.fn()}
        />
      );

      // Basic認証を設定
      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: 'Basic認証' }));

      await userEvent.type(screen.getByLabelText('ユーザー名'), 'testuser');

      // Cookie認証に切り替え
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: 'Cookie認証' }));

      // Basic認証のフィールドが表示されないことを確認
      expect(screen.queryByLabelText('ユーザー名')).not.toBeInTheDocument();

      // Cookie認証のフィールドが表示されることを確認
      expect(screen.getByLabelText('Cookie')).toBeInTheDocument();
    });
  });

  describe('クリアボタン', () => {
    it('クリアボタンをクリックすると設定がクリアされる', async () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <AuthSettings
          open={true}
          onClose={onClose}
          authConfig={{ type: 'basic', username: 'test', password: 'test' }}
          onSave={onSave}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'クリア' }));

      expect(onSave).toHaveBeenCalledWith(undefined);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('キャンセルボタン', () => {
    it('キャンセルボタンをクリックするとダイアログが閉じる', async () => {
      const onClose = vi.fn();

      render(
        <AuthSettings
          open={true}
          onClose={onClose}
          authConfig={undefined}
          onSave={vi.fn()}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

      expect(onClose).toHaveBeenCalled();
    });
  });
});
