/**
 * AIChatButtonコンポーネントテスト
 * @requirement 1.1, 1.5, 6.1, 4.12 - 対話ポイントのトリガーボタン
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIChatButton } from '../AIChatButton';
import type { ChatContext } from '../../utils/chat-storage';

// chat-apiモジュールをモック
vi.mock('../../services/chat-api', () => ({
  sendChatRequest: vi.fn(),
  sendInitialMessageRequest: vi.fn(),
  ChatApiError: class ChatApiError extends Error {
    type: string;
    retryAfter?: number;
    constructor(type: string, message: string, retryAfter?: number) {
      super(message);
      this.name = 'ChatApiError';
      this.type = type;
      this.retryAfter = retryAfter;
    }
  },
}));

describe('AIChatButton', () => {
  const mockContext: ChatContext = {
    type: 'violation',
    ruleId: 'color-contrast',
    wcagCriteria: ['1.4.3'],
    data: { description: 'コントラスト不足' },
    label: 'コントラスト',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('基本的なレンダリング', () => {
    it('should render chat button', () => {
      render(<AIChatButton context={mockContext} />);

      expect(screen.getByRole('button', { name: /AIに質問/i })).toBeInTheDocument();
    });

    it('should have correct aria-label', () => {
      render(<AIChatButton context={mockContext} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'この項目についてAIに質問する');
    });

    it('should support size prop', () => {
      const { rerender } = render(<AIChatButton context={mockContext} size="small" />);
      expect(screen.getByRole('button')).toBeInTheDocument();

      rerender(<AIChatButton context={mockContext} size="medium" />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Popover開閉', () => {
    it('should open popover on click', async () => {
      render(<AIChatButton context={mockContext} />);

      await userEvent.click(screen.getByRole('button', { name: /AIに質問/i }));

      // Popoverが開いている（dialogが表示されている）
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should close popover on second click', async () => {
      render(<AIChatButton context={mockContext} />);

      // 開く
      await userEvent.click(screen.getByRole('button', { name: /AIに質問/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // 閉じるボタンをクリック
      await userEvent.click(screen.getByRole('button', { name: /閉じる/i }));

      // Popoverが閉じている
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('履歴バッジ', () => {
    it('should render Badge component wrapping the button', () => {
      render(<AIChatButton context={mockContext} />);

      // Badgeラッパーが存在することを確認
      const badgeWrapper = document.querySelector('.MuiBadge-root');
      expect(badgeWrapper).toBeInTheDocument();
    });

    it('should hide badge when no history', () => {
      render(<AIChatButton context={mockContext} />);

      // バッジがinvisibleクラスを持っていることを確認
      const badge = document.querySelector('.MuiBadge-badge');
      expect(badge).toHaveClass('MuiBadge-invisible');
    });
  });

  describe('キーボードアクセシビリティ', () => {
    it('should be keyboard focusable', () => {
      render(<AIChatButton context={mockContext} />);

      const button = screen.getByRole('button', { name: /AIに質問/i });
      button.focus();

      expect(document.activeElement).toBe(button);
    });

    it('should open/close on Enter key', async () => {
      render(<AIChatButton context={mockContext} />);

      const button = screen.getByRole('button', { name: /AIに質問/i });
      button.focus();

      // Enterで開く
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('ARIA属性', () => {
    it('should have correct aria-expanded', async () => {
      render(<AIChatButton context={mockContext} />);

      const button = screen.getByRole('button', { name: /AIに質問/i });

      // 閉じている状態
      expect(button).toHaveAttribute('aria-expanded', 'false');

      // 開く
      await userEvent.click(button);

      // 開いている状態
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have aria-controls', async () => {
      render(<AIChatButton context={mockContext} />);

      const button = screen.getByRole('button', { name: /AIに質問/i });

      // 開く
      await userEvent.click(button);

      // aria-controlsが設定されている
      expect(button).toHaveAttribute('aria-controls');
    });
  });

  describe('フォーカス管理', () => {
    it('should return focus on popover close', async () => {
      render(<AIChatButton context={mockContext} />);

      const button = screen.getByRole('button', { name: /AIに質問/i });

      // Popoverを開く
      await userEvent.click(button);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Popoverを閉じる（Escapeキー）
      await userEvent.keyboard('{Escape}');

      // フォーカスがボタンに戻る
      await waitFor(() => {
        expect(document.activeElement).toBe(button);
      });
    });
  });
});
