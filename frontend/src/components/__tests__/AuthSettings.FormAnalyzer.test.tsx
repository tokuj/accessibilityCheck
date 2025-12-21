/**
 * AuthSettings + FormAnalyzerPanel 統合テスト
 *
 * Task 4.1〜4.3: AuthSettingsコンポーネントの拡張
 * Requirements: 1.1, 1.2, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2
 *
 * テスト対象:
 * - 4.1: フォームログイン選択時にフォーム解析パネルを表示
 * - 4.1: 解析成功後、検出されたセレクタを認証設定に自動反映
 * - 4.2: 解析完了後はユーザー名/パスワード入力のみ表示
 * - 4.2: パスワード入力欄はマスク表示
 * - 4.2: セレクタ入力フィールドは非表示（自動設定済み）
 * - 4.2: 解析未完了時は認証情報入力欄を無効化
 * - 4.3: 手動設定モード選択時は従来のセレクタ入力を表示
 * - 4.3: 自動解析モードと手動設定モードを切り替え可能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthSettings } from '../AuthSettings';
import * as formAnalyzerApi from '../../services/form-analyzer-api';

// モックAPI
vi.mock('../../services/form-analyzer-api', () => ({
  analyzeForm: vi.fn(),
  FormAnalyzerApiError: class extends Error {
    errorType: string;
    constructor(type: string, message: string) {
      super(message);
      this.errorType = type;
    }
  },
}));

const mockAnalyzeForm = vi.mocked(formAnalyzerApi.analyzeForm);

describe('AuthSettings + FormAnalyzerPanel 統合', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Task 4.1: フォーム解析パネルの統合', () => {
    it('フォームログイン選択時にフォーム解析パネルが表示される', async () => {
      render(
        <AuthSettings
          open={true}
          onClose={vi.fn()}
          authConfig={undefined}
          onSave={vi.fn()}
        />
      );

      // 認証タイプでフォームログインを選択
      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: 'フォームログイン' }));

      // フォーム解析パネルの要素が表示されることを確認
      expect(
        screen.getByText(/ログインページのURLを入力して「解析」をクリック/)
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText('https://example.com/login')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '解析' })).toBeInTheDocument();
    });

    it('解析成功後、検出されたセレクタが認証設定に自動反映される', async () => {
      const onSave = vi.fn();

      mockAnalyzeForm.mockResolvedValueOnce({
        usernameFields: [
          {
            selector: '#username',
            label: 'Username',
            placeholder: 'Enter username',
            name: 'username',
            id: 'username',
            type: 'text',
            confidence: 0.95,
          },
        ],
        passwordFields: [
          {
            selector: '#password',
            label: 'Password',
            placeholder: 'Enter password',
            name: 'password',
            id: 'password',
            type: 'password',
            confidence: 0.99,
          },
        ],
        submitButtons: [
          {
            selector: 'button[type="submit"]',
            label: 'Login',
            placeholder: null,
            name: null,
            id: 'login-btn',
            type: 'submit',
            confidence: 0.9,
          },
        ],
        confidence: 'high',
      });

      render(
        <AuthSettings
          open={true}
          onClose={vi.fn()}
          authConfig={undefined}
          onSave={onSave}
        />
      );

      // フォームログインを選択
      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: 'フォームログイン' }));

      // URLを入力して解析
      const urlInput = screen.getByPlaceholderText('https://example.com/login');
      await userEvent.type(urlInput, 'https://test.example.com/login');
      await userEvent.click(screen.getByRole('button', { name: '解析' }));

      // 解析結果が表示される
      await waitFor(() => {
        expect(screen.getByText('解析結果')).toBeInTheDocument();
      });

      // ユーザー名・パスワードを入力して保存
      const usernameInput = screen.getByLabelText('ユーザー名');
      const passwordInput = screen.getByLabelText('パスワード');

      await userEvent.type(usernameInput, 'testuser');
      await userEvent.type(passwordInput, 'testpass');
      await userEvent.click(screen.getByRole('button', { name: '保存' }));

      // 保存時にセレクタが自動設定されている
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'form',
          usernameSelector: '#username',
          passwordSelector: '#password',
          submitSelector: 'button[type="submit"]',
          username: 'testuser',
          password: 'testpass',
        })
      );
    });
  });

  describe('Task 4.2: 簡易認証情報入力UI', () => {
    it('解析完了後はユーザー名入力欄とパスワード入力欄のみを表示する', async () => {
      mockAnalyzeForm.mockResolvedValueOnce({
        usernameFields: [
          {
            selector: '#user',
            label: null,
            placeholder: null,
            name: 'user',
            id: 'user',
            type: 'text',
            confidence: 0.9,
          },
        ],
        passwordFields: [
          {
            selector: '#pass',
            label: null,
            placeholder: null,
            name: 'pass',
            id: 'pass',
            type: 'password',
            confidence: 0.95,
          },
        ],
        submitButtons: [
          {
            selector: '#submit',
            label: null,
            placeholder: null,
            name: null,
            id: 'submit',
            type: 'submit',
            confidence: 0.8,
          },
        ],
        confidence: 'high',
      });

      render(
        <AuthSettings
          open={true}
          onClose={vi.fn()}
          authConfig={undefined}
          onSave={vi.fn()}
        />
      );

      // フォームログインを選択
      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: 'フォームログイン' }));

      // URLを入力して解析
      const urlInput = screen.getByPlaceholderText('https://example.com/login');
      await userEvent.type(urlInput, 'https://test.example.com/login');
      await userEvent.click(screen.getByRole('button', { name: '解析' }));

      await waitFor(() => {
        expect(screen.getByText('解析結果')).toBeInTheDocument();
      });

      // ユーザー名・パスワード入力は表示
      expect(screen.getByLabelText('ユーザー名')).toBeInTheDocument();
      expect(screen.getByLabelText('パスワード')).toBeInTheDocument();

      // セレクタ入力フィールドは非表示
      expect(screen.queryByLabelText('ユーザー名入力欄')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('パスワード入力欄')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('送信ボタン')).not.toBeInTheDocument();
    });

    it('パスワード入力欄はマスク表示される', async () => {
      mockAnalyzeForm.mockResolvedValueOnce({
        usernameFields: [
          { selector: '#user', label: null, placeholder: null, name: 'user', id: 'user', type: 'text', confidence: 0.9 },
        ],
        passwordFields: [
          { selector: '#pass', label: null, placeholder: null, name: 'pass', id: 'pass', type: 'password', confidence: 0.95 },
        ],
        submitButtons: [
          { selector: '#submit', label: null, placeholder: null, name: null, id: 'submit', type: 'submit', confidence: 0.8 },
        ],
        confidence: 'high',
      });

      render(
        <AuthSettings
          open={true}
          onClose={vi.fn()}
          authConfig={undefined}
          onSave={vi.fn()}
        />
      );

      // フォームログインを選択して解析
      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: 'フォームログイン' }));

      const urlInput = screen.getByPlaceholderText('https://example.com/login');
      await userEvent.type(urlInput, 'https://test.example.com/login');
      await userEvent.click(screen.getByRole('button', { name: '解析' }));

      await waitFor(() => {
        expect(screen.getByText('解析結果')).toBeInTheDocument();
      });

      // パスワード入力がtype="password"であることを確認
      const passwordInput = screen.getByLabelText('パスワード');
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('解析未完了時は認証情報入力欄が無効化される', async () => {
      render(
        <AuthSettings
          open={true}
          onClose={vi.fn()}
          authConfig={undefined}
          onSave={vi.fn()}
        />
      );

      // フォームログインを選択
      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: 'フォームログイン' }));

      // 解析前はユーザー名・パスワード入力が無効
      const usernameInput = screen.getByLabelText('ユーザー名');
      const passwordInput = screen.getByLabelText('パスワード');

      expect(usernameInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
    });
  });

  describe('Task 4.3: 手動設定モードへのフォールバック', () => {
    it('手動設定モード選択時は従来のセレクタ入力フィールドを表示する', async () => {
      render(
        <AuthSettings
          open={true}
          onClose={vi.fn()}
          authConfig={undefined}
          onSave={vi.fn()}
        />
      );

      // フォームログインを選択
      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: 'フォームログイン' }));

      // 手動設定に切り替え
      const manualButton = screen.getByRole('button', { name: '手動設定に切り替え' });
      await userEvent.click(manualButton);

      // 従来のセレクタ入力フィールドが表示される
      expect(screen.getByLabelText('ユーザー名入力欄')).toBeInTheDocument();
      expect(screen.getByLabelText('パスワード入力欄')).toBeInTheDocument();
      expect(screen.getByLabelText(/送信ボタン/)).toBeInTheDocument();

      // ユーザー名・パスワード入力も表示（有効状態）
      expect(screen.getByLabelText('ユーザー名')).toBeEnabled();
      expect(screen.getByLabelText('パスワード')).toBeEnabled();
    });

    it('自動解析モードと手動設定モードを切り替えできる', async () => {
      render(
        <AuthSettings
          open={true}
          onClose={vi.fn()}
          authConfig={undefined}
          onSave={vi.fn()}
        />
      );

      // フォームログインを選択
      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: 'フォームログイン' }));

      // 初期状態は自動解析モード
      expect(screen.getByRole('button', { name: '解析' })).toBeInTheDocument();

      // 手動設定に切り替え
      await userEvent.click(screen.getByRole('button', { name: '手動設定に切り替え' }));

      // 従来のセレクタ入力フィールドが表示
      expect(screen.getByLabelText('ユーザー名入力欄')).toBeInTheDocument();

      // 自動解析に戻す
      await userEvent.click(screen.getByRole('button', { name: '自動解析に切り替え' }));

      // 自動解析モードに戻る
      expect(screen.getByRole('button', { name: '解析' })).toBeInTheDocument();
      expect(screen.queryByLabelText('ユーザー名入力欄')).not.toBeInTheDocument();
    });

    it('手動設定モードで入力した値が保存される', async () => {
      const onSave = vi.fn();

      render(
        <AuthSettings
          open={true}
          onClose={vi.fn()}
          authConfig={undefined}
          onSave={onSave}
        />
      );

      // フォームログインを選択
      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: 'フォームログイン' }));

      // 手動設定に切り替え
      await userEvent.click(screen.getByRole('button', { name: '手動設定に切り替え' }));

      // ログインURL
      const loginUrlInput = screen.getByLabelText('ログインURL');
      await userEvent.type(loginUrlInput, 'https://example.com/login');

      // セレクタを入力
      await userEvent.type(screen.getByLabelText('ユーザー名入力欄'), '#email');
      await userEvent.type(screen.getByLabelText('パスワード入力欄'), '#password');
      await userEvent.type(screen.getByLabelText(/送信ボタン/), '#login-btn');

      // 認証情報を入力
      await userEvent.type(screen.getByLabelText('ユーザー名'), 'myuser');
      await userEvent.type(screen.getByLabelText('パスワード'), 'mypass');

      // 保存
      await userEvent.click(screen.getByRole('button', { name: '保存' }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'form',
          loginUrl: 'https://example.com/login',
          usernameSelector: '#email',
          passwordSelector: '#password',
          submitSelector: '#login-btn',
          username: 'myuser',
          password: 'mypass',
        })
      );
    });
  });
});
