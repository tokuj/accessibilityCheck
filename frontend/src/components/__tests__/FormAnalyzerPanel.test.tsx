/**
 * FormAnalyzerPanel コンポーネントテスト
 *
 * Task 3.3〜3.5: フォーム解析UIパネルの実装
 * Requirements: 1.2, 1.3, 1.4, 2.1, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 5.1, 5.3, 5.4
 *
 * テスト対象:
 * - ログインURL入力フィールド (Req 1.2)
 * - URL形式バリデーション (Req 1.3, 1.4)
 * - 解析ボタン (Req 2.1)
 * - ローディング表示 (Req 2.5)
 * - 解析結果表示 (Req 3.1, 3.2, 3.4)
 * - 複数候補選択 (Req 3.3)
 * - エラー表示 (Req 2.6, 5.3, 5.4)
 * - 手動設定モード切り替え (Req 5.1)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormAnalyzerPanel } from '../FormAnalyzerPanel';
import * as formAnalyzerApi from '../../services/form-analyzer-api';
import { FormAnalyzerApiError } from '../../services/form-analyzer-api';
import type { FormAnalysisResult } from '../../types/form-analyzer';

// APIモック（analyzeFormのみモック、FormAnalyzerApiErrorは実際のクラスを使用）
vi.mock('../../services/form-analyzer-api', async (importOriginal) => {
  const actual = await importOriginal<typeof formAnalyzerApi>();
  return {
    ...actual,
    analyzeForm: vi.fn(),
  };
});

describe('FormAnalyzerPanel', () => {
  const mockOnSelectorsChange = vi.fn();
  const mockOnModeChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('URL入力フィールド (Req 1.2)', () => {
    it('ログインURL入力フィールドが表示される', () => {
      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      expect(screen.getByLabelText('ログインページURL')).toBeInTheDocument();
    });

    it('プレースホルダーが表示される', () => {
      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      expect(
        screen.getByPlaceholderText('https://example.com/login')
      ).toBeInTheDocument();
    });
  });

  describe('URL形式バリデーション (Req 1.3, 1.4)', () => {
    it('無効なURL形式でエラーメッセージが表示される', async () => {
      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      const input = screen.getByLabelText('ログインページURL');
      await userEvent.type(input, 'invalid-url');
      await userEvent.click(screen.getByRole('button', { name: '解析' }));

      expect(
        screen.getByText('有効なURL（http:// または https://）を入力してください')
      ).toBeInTheDocument();
    });

    it('有効なURL形式ではエラーが表示されない', async () => {
      const mockResult: FormAnalysisResult = {
        usernameFields: [],
        passwordFields: [
          {
            selector: '#password',
            label: 'パスワード',
            placeholder: null,
            name: 'password',
            id: 'password',
            type: 'password',
            confidence: 1.0,
          },
        ],
        submitButtons: [],
        confidence: 'medium',
      };

      vi.mocked(formAnalyzerApi.analyzeForm).mockResolvedValue(mockResult);

      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      const input = screen.getByLabelText('ログインページURL');
      await userEvent.type(input, 'https://example.com/login');
      await userEvent.click(screen.getByRole('button', { name: '解析' }));

      await waitFor(() => {
        expect(
          screen.queryByText(
            '有効なURL（http:// または https://）を入力してください'
          )
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('解析ボタン (Req 2.1)', () => {
    it('解析ボタンが表示される', () => {
      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      expect(screen.getByRole('button', { name: '解析' })).toBeInTheDocument();
    });

    it('URLが空の場合、解析ボタンが無効になる', () => {
      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      expect(screen.getByRole('button', { name: '解析' })).toBeDisabled();
    });

    it('URLを入力すると解析ボタンが有効になる', async () => {
      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      const input = screen.getByLabelText('ログインページURL');
      await userEvent.type(input, 'https://example.com/login');

      expect(screen.getByRole('button', { name: '解析' })).not.toBeDisabled();
    });
  });

  describe('ローディング表示 (Req 2.5)', () => {
    it('解析中はローディングインジケーターが表示される', async () => {
      vi.mocked(formAnalyzerApi.analyzeForm).mockImplementation(
        () => new Promise(() => {})
      );

      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      const input = screen.getByLabelText('ログインページURL');
      await userEvent.type(input, 'https://example.com/login');
      await userEvent.click(screen.getByRole('button', { name: '解析' }));

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('解析中...')).toBeInTheDocument();
    });

    it('解析中は解析ボタンが無効になる', async () => {
      vi.mocked(formAnalyzerApi.analyzeForm).mockImplementation(
        () => new Promise(() => {})
      );

      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      const input = screen.getByLabelText('ログインページURL');
      await userEvent.type(input, 'https://example.com/login');
      await userEvent.click(screen.getByRole('button', { name: '解析' }));

      expect(screen.getByRole('button', { name: '解析' })).toBeDisabled();
    });
  });

  describe('解析結果表示 (Req 3.1, 3.2, 3.4)', () => {
    const mockResult: FormAnalysisResult = {
      usernameFields: [
        {
          selector: '#email',
          label: 'メールアドレス',
          placeholder: 'Enter email',
          name: 'email',
          id: 'email',
          type: 'email',
          confidence: 0.9,
        },
      ],
      passwordFields: [
        {
          selector: '#password',
          label: 'パスワード',
          placeholder: null,
          name: 'password',
          id: 'password',
          type: 'password',
          confidence: 1.0,
        },
      ],
      submitButtons: [
        {
          selector: 'button[type="submit"]',
          label: 'ログイン',
          placeholder: null,
          name: null,
          id: null,
          type: 'submit',
          confidence: 0.85,
        },
      ],
      confidence: 'high',
    };

    it('解析成功後に検出されたフォーム要素が表示される', async () => {
      vi.mocked(formAnalyzerApi.analyzeForm).mockResolvedValue(mockResult);

      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      const input = screen.getByLabelText('ログインページURL');
      await userEvent.type(input, 'https://example.com/login');
      await userEvent.click(screen.getByRole('button', { name: '解析' }));

      await waitFor(() => {
        expect(screen.getByText('ユーザー名フィールド')).toBeInTheDocument();
        expect(screen.getByText('パスワードフィールド')).toBeInTheDocument();
        expect(screen.getByText('送信ボタン')).toBeInTheDocument();
      });
    });

    it('セレクタ情報が表示される', async () => {
      vi.mocked(formAnalyzerApi.analyzeForm).mockResolvedValue(mockResult);

      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      const input = screen.getByLabelText('ログインページURL');
      await userEvent.type(input, 'https://example.com/login');
      await userEvent.click(screen.getByRole('button', { name: '解析' }));

      await waitFor(() => {
        expect(screen.getByText('#email')).toBeInTheDocument();
        expect(screen.getByText('#password')).toBeInTheDocument();
        expect(screen.getByText('button[type="submit"]')).toBeInTheDocument();
      });
    });

    it('解析成功後にonSelectorsChangeが呼ばれる', async () => {
      vi.mocked(formAnalyzerApi.analyzeForm).mockResolvedValue(mockResult);

      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      const input = screen.getByLabelText('ログインページURL');
      await userEvent.type(input, 'https://example.com/login');
      await userEvent.click(screen.getByRole('button', { name: '解析' }));

      await waitFor(() => {
        expect(mockOnSelectorsChange).toHaveBeenCalledWith({
          loginUrl: 'https://example.com/login',
          usernameSelector: '#email',
          passwordSelector: '#password',
          submitSelector: 'button[type="submit"]',
        });
      });
    });
  });

  describe('複数候補選択 (Req 3.3)', () => {
    const mockResultWithMultiple: FormAnalysisResult = {
      usernameFields: [
        {
          selector: '#email',
          label: 'メール',
          placeholder: null,
          name: 'email',
          id: 'email',
          type: 'email',
          confidence: 0.9,
        },
        {
          selector: '#username',
          label: 'ユーザー名',
          placeholder: null,
          name: 'username',
          id: 'username',
          type: 'text',
          confidence: 0.7,
        },
      ],
      passwordFields: [
        {
          selector: '#password',
          label: 'パスワード',
          placeholder: null,
          name: 'password',
          id: 'password',
          type: 'password',
          confidence: 1.0,
        },
      ],
      submitButtons: [
        {
          selector: 'button[type="submit"]',
          label: 'ログイン',
          placeholder: null,
          name: null,
          id: null,
          type: 'submit',
          confidence: 0.85,
        },
      ],
      confidence: 'high',
    };

    it('複数候補がある場合に選択UIが表示される', async () => {
      vi.mocked(formAnalyzerApi.analyzeForm).mockResolvedValue(
        mockResultWithMultiple
      );

      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      const input = screen.getByLabelText('ログインページURL');
      await userEvent.type(input, 'https://example.com/login');
      await userEvent.click(screen.getByRole('button', { name: '解析' }));

      await waitFor(() => {
        // 複数候補がある場合はセレクトUIが表示される
        expect(screen.getByLabelText('候補を選択')).toBeInTheDocument();
      });

      // ドロップダウンを開いて候補を確認
      await userEvent.click(screen.getByLabelText('候補を選択'));

      await waitFor(() => {
        // 複数候補がドロップダウン内に表示される
        expect(screen.getByRole('option', { name: /#email/i })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /#username/i })).toBeInTheDocument();
      });
    });
  });

  describe('エラー表示 (Req 2.6, 5.3, 5.4)', () => {
    it('フォーム未検出エラーが表示される', async () => {
      vi.mocked(formAnalyzerApi.analyzeForm).mockRejectedValue(
        new FormAnalyzerApiError(
          'no_form_found',
          'ログインフォームが見つかりませんでした'
        )
      );

      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      const input = screen.getByLabelText('ログインページURL');
      await userEvent.type(input, 'https://example.com/about');
      await userEvent.click(screen.getByRole('button', { name: '解析' }));

      await waitFor(() => {
        expect(
          screen.getByText('ログインフォームが見つかりませんでした')
        ).toBeInTheDocument();
      });
    });

    it('タイムアウトエラーでリトライボタンが表示される', async () => {
      vi.mocked(formAnalyzerApi.analyzeForm).mockRejectedValue(
        new FormAnalyzerApiError(
          'timeout',
          'タイムアウトしました'
        )
      );

      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      const input = screen.getByLabelText('ログインページURL');
      await userEvent.type(input, 'https://slow-site.com/login');
      await userEvent.click(screen.getByRole('button', { name: '解析' }));

      await waitFor(() => {
        expect(screen.getByText('タイムアウトしました')).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: 'リトライ' })
        ).toBeInTheDocument();
      });
    });

    it('ネットワークエラーが表示される', async () => {
      vi.mocked(formAnalyzerApi.analyzeForm).mockRejectedValue(
        new FormAnalyzerApiError(
          'network_error',
          'サーバーに接続できません'
        )
      );

      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      const input = screen.getByLabelText('ログインページURL');
      await userEvent.type(input, 'https://example.com/login');
      await userEvent.click(screen.getByRole('button', { name: '解析' }));

      await waitFor(() => {
        expect(
          screen.getByText('サーバーに接続できません')
        ).toBeInTheDocument();
      });
    });
  });

  describe('手動設定モード切り替え (Req 5.1)', () => {
    it('「手動設定に切り替え」ボタンが表示される', () => {
      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      expect(
        screen.getByRole('button', { name: '手動設定に切り替え' })
      ).toBeInTheDocument();
    });

    it('手動設定ボタンをクリックするとonModeChangeが呼ばれる', async () => {
      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      await userEvent.click(
        screen.getByRole('button', { name: '手動設定に切り替え' })
      );

      expect(mockOnModeChange).toHaveBeenCalledWith('manual');
    });

    it('解析失敗時に手動設定への切り替えオプションが表示される', async () => {
      vi.mocked(formAnalyzerApi.analyzeForm).mockRejectedValue(
        new FormAnalyzerApiError(
          'no_form_found',
          'ログインフォームが見つかりませんでした'
        )
      );

      render(
        <FormAnalyzerPanel
          onSelectorsChange={mockOnSelectorsChange}
          onModeChange={mockOnModeChange}
        />
      );

      const input = screen.getByLabelText('ログインページURL');
      await userEvent.type(input, 'https://example.com/about');
      await userEvent.click(screen.getByRole('button', { name: '解析' }));

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: '手動設定に切り替え' })
        ).toBeInTheDocument();
      });
    });
  });
});
