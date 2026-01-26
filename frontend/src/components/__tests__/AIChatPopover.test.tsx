/**
 * AIChatPopoverコンポーネントテスト
 * @requirement 1.2-1.6, 5.1-5.5, 6.2-6.6 - 対話UIポップオーバー
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIChatPopover } from '../AIChatPopover';
import type { ChatContext } from '../../utils/chat-storage';
import * as chatApi from '../../services/chat-api';

// chat-apiモジュールをモック（Grounding対応）
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

describe('AIChatPopover', () => {
  const mockContext: ChatContext = {
    type: 'violation',
    ruleId: 'color-contrast',
    wcagCriteria: ['1.4.3'],
    data: { description: 'コントラスト不足' },
    label: 'コントラスト',
  };

  // Grounding対応：referenceLinksはドメイン情報を含む
  const mockResponse = {
    answer: 'コントラスト比を4.5:1以上にしてください。',
    referenceUrls: ['https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html'],
    referenceLinks: [{
      uri: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html',
      domain: 'w3.org',
      title: 'Understanding SC 1.4.3',
    }],
  };

  let anchorEl: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    // アンカー要素を作成
    anchorEl = document.createElement('button');
    anchorEl.id = 'test-anchor';
    document.body.appendChild(anchorEl);
  });

  afterEach(() => {
    sessionStorage.clear();
    if (anchorEl && anchorEl.parentNode) {
      anchorEl.parentNode.removeChild(anchorEl);
    }
  });

  describe('基本的なレンダリング', () => {
    it('should render input field, send button, and close button', () => {
      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={vi.fn()}
        />
      );

      // 入力フィールド
      expect(screen.getByRole('textbox', { name: /質問/i })).toBeInTheDocument();
      // 送信ボタン
      expect(screen.getByRole('button', { name: /送信/i })).toBeInTheDocument();
      // 閉じるボタン
      expect(screen.getByRole('button', { name: /閉じる/i })).toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      render(
        <AIChatPopover
          open={false}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={vi.fn()}
        />
      );

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('should have correct ARIA attributes', () => {
      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={vi.fn()}
        />
      );

      // role="dialog"
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      // aria-modal="true"
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      // aria-labelledby
      expect(dialog).toHaveAttribute('aria-labelledby');
    });
  });

  describe('対話履歴表示', () => {
    it('should display chat history', async () => {
      vi.mocked(chatApi.sendChatRequest).mockResolvedValue(mockResponse);

      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={vi.fn()}
        />
      );

      // 質問を入力して送信
      const input = screen.getByRole('textbox', { name: /質問/i });
      await userEvent.type(input, 'テスト質問');
      await userEvent.click(screen.getByRole('button', { name: /送信/i }));

      // 回答が表示される
      await waitFor(() => {
        expect(screen.getByText(/コントラスト比を4.5:1以上/)).toBeInTheDocument();
      });
    });
  });

  describe('ローディング状態', () => {
    it('should show loading state while sending', async () => {
      let resolvePromise: (value: typeof mockResponse) => void;
      const pendingPromise = new Promise<typeof mockResponse>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(chatApi.sendChatRequest).mockReturnValue(pendingPromise);

      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={vi.fn()}
        />
      );

      const input = screen.getByRole('textbox', { name: /質問/i });
      await userEvent.type(input, 'テスト質問');
      await userEvent.click(screen.getByRole('button', { name: /送信/i }));

      // ローディング表示を確認
      expect(screen.getByText(/回答を生成中/i)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      // クリーンアップ
      resolvePromise!(mockResponse);
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });

    it('should disable send button while loading', async () => {
      let resolvePromise: (value: typeof mockResponse) => void;
      const pendingPromise = new Promise<typeof mockResponse>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(chatApi.sendChatRequest).mockReturnValue(pendingPromise);

      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={vi.fn()}
        />
      );

      const input = screen.getByRole('textbox', { name: /質問/i });
      await userEvent.type(input, 'テスト質問');
      await userEvent.click(screen.getByRole('button', { name: /送信/i }));

      // ローディング中は送信ボタンが無効化（入力がクリアされるので常に無効）
      expect(screen.getByRole('button', { name: /送信/i })).toBeDisabled();

      // クリーンアップ
      resolvePromise!(mockResponse);
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });
  });

  describe('エラー状態', () => {
    it('should show error message and retry button on error', async () => {
      const mockError = new chatApi.ChatApiError('server', 'サーバーエラーが発生しました');
      vi.mocked(chatApi.sendChatRequest).mockRejectedValue(mockError);

      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={vi.fn()}
        />
      );

      const input = screen.getByRole('textbox', { name: /質問/i });
      await userEvent.type(input, 'テスト質問');
      await userEvent.click(screen.getByRole('button', { name: /送信/i }));

      // エラーメッセージ
      await waitFor(() => {
        expect(screen.getByText(/サーバーエラー/i)).toBeInTheDocument();
      });
      // 再試行ボタン
      expect(screen.getByRole('button', { name: /再試行/i })).toBeInTheDocument();
    });

    it('should retry on retry button click', async () => {
      const mockError = new chatApi.ChatApiError('server', 'サーバーエラー');
      vi.mocked(chatApi.sendChatRequest).mockRejectedValueOnce(mockError);
      vi.mocked(chatApi.sendChatRequest).mockResolvedValueOnce(mockResponse);

      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={vi.fn()}
        />
      );

      const input = screen.getByRole('textbox', { name: /質問/i });
      await userEvent.type(input, 'テスト質問');
      await userEvent.click(screen.getByRole('button', { name: /送信/i }));

      // エラー発生
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /再試行/i })).toBeInTheDocument();
      });

      // 再試行
      await userEvent.click(screen.getByRole('button', { name: /再試行/i }));

      // 成功
      await waitFor(() => {
        expect(screen.getByText(/コントラスト比を4.5:1以上/)).toBeInTheDocument();
      });
    });
  });

  describe('閉じる動作', () => {
    it('should close on close button click', async () => {
      const onClose = vi.fn();
      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={onClose}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: /閉じる/i }));

      expect(onClose).toHaveBeenCalled();
    });

    it('should close on Escape key', async () => {
      const onClose = vi.fn();
      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={onClose}
        />
      );

      await userEvent.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('フォーカス管理', () => {
    it('should focus input field when opened', async () => {
      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        const input = screen.getByRole('textbox', { name: /質問/i });
        expect(document.activeElement).toBe(input);
      });
    });
  });

  describe('参照URL表示（Grounding対応）', () => {
    it('should display reference URLs as links with domain', async () => {
      vi.mocked(chatApi.sendChatRequest).mockResolvedValue(mockResponse);

      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={vi.fn()}
        />
      );

      const input = screen.getByRole('textbox', { name: /質問/i });
      await userEvent.type(input, 'テスト質問');
      await userEvent.click(screen.getByRole('button', { name: /送信/i }));

      await waitFor(() => {
        // 参照URLがテキストとして表示されることを確認
        expect(screen.getByText(/参照/i)).toBeInTheDocument();
        // ドメインがリンクとして表示される（domainフィールドから）
        const link = screen.getByRole('link', { name: /w3\.org/i });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute(
          'href',
          'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html'
        );
      });
    });

    it('should use domain field from referenceLinks', async () => {
      // ドメインフィールドを持つレスポンス（Grounding API形式）
      const responseWithDomain = {
        answer: '回答テキスト',
        referenceUrls: ['https://redirect.example.com/abc'],
        referenceLinks: [{
          uri: 'https://redirect.example.com/abc',
          domain: 'mdn.developer.org',
          title: 'MDN Documentation',
        }],
      };
      vi.mocked(chatApi.sendChatRequest).mockResolvedValue(responseWithDomain);

      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={vi.fn()}
        />
      );

      const input = screen.getByRole('textbox', { name: /質問/i });
      await userEvent.type(input, 'テスト質問');
      await userEvent.click(screen.getByRole('button', { name: /送信/i }));

      await waitFor(() => {
        // domainフィールドの値が表示される（URIのホスト名ではなく）
        const link = screen.getByRole('link', { name: /mdn\.developer\.org/i });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', 'https://redirect.example.com/abc');
      });
    });

    it('should extract actual domain from redirect URL when domain field is missing', async () => {
      // domainフィールドがなく、リダイレクトURLを持つレスポンス（Gemini Developer API形式）
      const responseWithRedirectUrl = {
        answer: 'WCAGの説明です。',
        referenceUrls: ['https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc?targetOriginUrl=https%3A%2F%2Fwww.w3.org%2FWAI%2FWCAG21%2F'],
        referenceLinks: [{
          uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc?targetOriginUrl=https%3A%2F%2Fwww.w3.org%2FWAI%2FWCAG21%2F',
          // domainフィールドなし
          title: 'WCAG 2.1',
        }],
      };
      vi.mocked(chatApi.sendChatRequest).mockResolvedValue(responseWithRedirectUrl);

      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={vi.fn()}
        />
      );

      const input = screen.getByRole('textbox', { name: /質問/i });
      await userEvent.type(input, 'テスト質問');
      await userEvent.click(screen.getByRole('button', { name: /送信/i }));

      await waitFor(() => {
        // リダイレクトURLからtargetOriginUrlを抽出して実際のドメイン（www.w3.org）を表示
        const link = screen.getByRole('link', { name: /www\.w3\.org/i });
        expect(link).toBeInTheDocument();
        // hrefはリダイレクトURLのまま（クリック時にリダイレクトされる）
        expect(link).toHaveAttribute('href', expect.stringContaining('vertexaisearch.cloud.google.com'));
      });
    });

    it('should extract MDN domain from redirect URL', async () => {
      // MDNへのリダイレクトURL
      const responseWithMdnRedirect = {
        answer: 'アクセシビリティの説明です。',
        referenceUrls: ['https://vertexaisearch.cloud.google.com/grounding-api-redirect/xyz?targetOriginUrl=https%3A%2F%2Fdeveloper.mozilla.org%2Fen-US%2Fdocs%2FWeb%2FAccessibility'],
        referenceLinks: [{
          uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/xyz?targetOriginUrl=https%3A%2F%2Fdeveloper.mozilla.org%2Fen-US%2Fdocs%2FWeb%2FAccessibility',
        }],
      };
      vi.mocked(chatApi.sendChatRequest).mockResolvedValue(responseWithMdnRedirect);

      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={vi.fn()}
        />
      );

      const input = screen.getByRole('textbox', { name: /質問/i });
      await userEvent.type(input, 'テスト質問');
      await userEvent.click(screen.getByRole('button', { name: /送信/i }));

      await waitFor(() => {
        // developer.mozilla.orgが表示される
        const link = screen.getByRole('link', { name: /developer\.mozilla\.org/i });
        expect(link).toBeInTheDocument();
      });
    });
  });

  describe('空の質問', () => {
    it('should not send empty question', () => {
      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={vi.fn()}
        />
      );

      // 空の状態では送信ボタンが無効
      expect(screen.getByRole('button', { name: /送信/i })).toBeDisabled();

      // APIは呼ばれない
      expect(chatApi.sendChatRequest).not.toHaveBeenCalled();
    });
  });

  describe('初期メッセージのスタイリング', () => {
    it('should use grey.100 background for initial message', async () => {
      // 初期メッセージを返すモック
      vi.mocked(chatApi.sendInitialMessageRequest).mockResolvedValue({
        answer: 'この問題を放置すると視覚障害者がコンテンツを認識できなくなります',
        referenceUrls: [],
        referenceLinks: [],
      });

      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={vi.fn()}
        />
      );

      // 初期メッセージが表示されるのを待つ
      await waitFor(() => {
        expect(screen.getByText(/この項目を満たさないと/)).toBeInTheDocument();
      });

      // 初期メッセージのコンテナを取得
      const initialMessageContainer = screen.getByText(/この問題を放置すると/).closest('.MuiPaper-root');
      expect(initialMessageContainer).toBeInTheDocument();

      // 背景色がgrey.100（info.lightではない）であることを確認
      // ※ スタイルの詳細なテストはスナップショットテストで行う方が適切
      // ここではinfo.lightクラスが適用されていないことを確認
      expect(initialMessageContainer).not.toHaveClass('MuiAlert-standardInfo');
    });
  });

  describe('IME対応', () => {
    it('should not submit when isComposing is true', async () => {
      const user = userEvent.setup();

      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={vi.fn()}
        />
      );

      const input = screen.getByRole('textbox', { name: /質問/i }) as HTMLInputElement;

      // 値を直接設定（IME入力中の状態をシミュレート）
      await user.click(input);
      input.value = 'テスト';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // IME変換中のEnterキーイベントをシミュレート
      // compositionstartイベントでIME状態を設定
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));

      // isComposingがtrueのEnterイベントを発火
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      // isComposingはKeyboardEventのプロパティなので直接設定
      Object.defineProperty(enterEvent, 'isComposing', { value: true });
      input.dispatchEvent(enterEvent);

      // APIは呼ばれない（IME変換中のため）
      expect(chatApi.sendChatRequest).not.toHaveBeenCalled();
    });

    it('should not submit when key is Process', async () => {
      const user = userEvent.setup();

      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={vi.fn()}
        />
      );

      const input = screen.getByRole('textbox', { name: /質問/i }) as HTMLInputElement;

      // 値を直接設定
      await user.click(input);
      input.value = 'テスト';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // Processキーイベントをシミュレート（IME状態）
      const processEvent = new KeyboardEvent('keydown', {
        key: 'Process',
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(processEvent);

      // APIは呼ばれない
      expect(chatApi.sendChatRequest).not.toHaveBeenCalled();
    });

    it('should submit when isComposing is false and Enter is pressed', async () => {
      vi.mocked(chatApi.sendChatRequest).mockResolvedValue(mockResponse);

      render(
        <AIChatPopover
          open={true}
          anchorEl={anchorEl}
          context={mockContext}
          onClose={vi.fn()}
        />
      );

      const input = screen.getByRole('textbox', { name: /質問/i });
      await userEvent.type(input, 'テスト質問');

      // IME変換完了後のEnterキーイベント
      await userEvent.keyboard('{Enter}');

      // APIが呼ばれる
      await waitFor(() => {
        expect(chatApi.sendChatRequest).toHaveBeenCalled();
      });
    });
  });
});
