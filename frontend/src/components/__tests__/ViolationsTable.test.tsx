/**
 * ViolationsTableコンポーネントのテスト
 * @requirement 4.8, 4.11 - 対話ポイントの設置
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViolationsTable } from '../ViolationsTable';
import type { PageResult } from '../../types/accessibility';

// モック: useAIChat, useChatHistory
vi.mock('../../hooks/useAIChat', () => ({
  useAIChat: () => ({
    isLoading: false,
    error: null,
    history: [],
    lastAnswer: null,
    sendQuestion: vi.fn(),
    retry: vi.fn(),
    clearError: vi.fn(),
  }),
}));

vi.mock('../../hooks/useChatHistory', () => ({
  useChatHistory: () => ({
    history: [],
    historyCount: 0,
    addEntry: vi.fn(),
    clearHistory: vi.fn(),
  }),
}));

// サンプルデータ
const mockPages: PageResult[] = [
  {
    name: 'ホームページ',
    url: 'https://example.com',
    violations: [
      {
        id: 'color-contrast',
        description: 'コントラスト比が不十分',
        impact: 'serious',
        nodeCount: 5,
        wcagCriteria: ['1.4.3'],
        helpUrl: 'https://example.com/help',
        toolSource: 'axe-core',
      },
      {
        id: 'image-alt',
        description: '代替テキストがありません',
        impact: 'critical',
        nodeCount: 3,
        wcagCriteria: ['1.1.1'],
        helpUrl: 'https://example.com/help2',
        toolSource: 'pa11y',
      },
    ],
    passes: [],
    incomplete: [],
  },
];

describe('ViolationsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('違反がない場合は「違反はありません」と表示する', () => {
    render(<ViolationsTable pages={[{ name: 'Page', url: 'https://example.com', violations: [], passes: [], incomplete: [] }]} />);

    expect(screen.getByText('違反はありません')).toBeInTheDocument();
  });

  it('違反データを表示する', () => {
    render(<ViolationsTable pages={mockPages} />);

    expect(screen.getByText('color-contrast')).toBeInTheDocument();
    expect(screen.getByText('image-alt')).toBeInTheDocument();
    expect(screen.getByText('コントラスト比が不十分')).toBeInTheDocument();
  });

  describe('AIChatButton統合', () => {
    it('各違反行にAIChatButtonが表示される', () => {
      render(<ViolationsTable pages={mockPages} />);

      // 2つの違反行 = 少なくとも2つのAIChatButton
      const chatButtons = screen.getAllByRole('button', {
        name: 'この項目についてAIに質問する',
      });
      expect(chatButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('AIChatButtonにaria-labelが設定されている', () => {
      render(<ViolationsTable pages={mockPages} />);

      const chatButtons = screen.getAllByRole('button', {
        name: 'この項目についてAIに質問する',
      });
      chatButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label', 'この項目についてAIに質問する');
      });
    });

    it('WCAG基準表示部分にもAIChatButtonが表示される', () => {
      render(<ViolationsTable pages={mockPages} />);

      // WCAG基準が表示されている
      expect(screen.getByText('1.4.3')).toBeInTheDocument();
      expect(screen.getByText('1.1.1')).toBeInTheDocument();

      // 違反行 + WCAG基準分のボタン
      const chatButtons = screen.getAllByRole('button', {
        name: 'この項目についてAIに質問する',
      });
      // 2違反 + 2 WCAG基準 = 4以上
      expect(chatButtons.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('NodeDetails展開機能', () => {
    const mockPagesWithNodes: PageResult[] = [
      {
        name: 'ホームページ',
        url: 'https://example.com',
        violations: [
          {
            id: 'color-contrast',
            description: 'コントラスト比が不十分',
            impact: 'serious',
            nodeCount: 2,
            wcagCriteria: ['1.4.3'],
            helpUrl: 'https://example.com/help',
            toolSource: 'axe-core',
            nodes: [
              {
                target: 'html > body > p',
                html: '<p style="color: #777">テスト</p>',
                failureSummary: 'コントラスト比が不足しています',
              },
              {
                target: 'html > body > span',
                html: '<span style="color: #888">テスト2</span>',
              },
            ],
          },
        ],
        passes: [],
        incomplete: [],
      },
    ];

    it('各行に展開アイコンボタンが表示される', () => {
      render(<ViolationsTable pages={mockPagesWithNodes} />);

      const expandButtons = screen.getAllByRole('button', { name: /ノード情報を展開/ });
      expect(expandButtons.length).toBe(1);
    });

    it('展開ボタンをクリックするとノード情報が表示される', async () => {
      const user = userEvent.setup();
      render(<ViolationsTable pages={mockPagesWithNodes} />);

      // 初期状態ではノード情報は表示されていない
      expect(screen.queryByText('<p style="color: #777">テスト</p>')).not.toBeInTheDocument();

      // 展開ボタンをクリック
      const expandButton = screen.getByRole('button', { name: /ノード情報を展開/ });
      await user.click(expandButton);

      // ノード情報が表示される（HTML抜粋で確認）
      expect(screen.getByText('<p style="color: #777">テスト</p>')).toBeInTheDocument();
    });

    it('展開状態で再度クリックすると折りたたまれる', async () => {
      const user = userEvent.setup();
      render(<ViolationsTable pages={mockPagesWithNodes} />);

      // 展開
      const expandButton = screen.getByRole('button', { name: /ノード情報を展開/ });
      await user.click(expandButton);
      expect(screen.getByText('<p style="color: #777">テスト</p>')).toBeInTheDocument();

      // 折りたたみ（テーブルの展開ボタン）
      const collapseButton = screen.getByRole('button', { name: /ノード情報を折りたたむ/ });
      await user.click(collapseButton);

      // 展開アイコンが元に戻る
      expect(screen.getByRole('button', { name: /ノード情報を展開/ })).toBeInTheDocument();
    });

    it('ノード情報がない場合は展開ボタンが無効化される', () => {
      const pagesWithoutNodes: PageResult[] = [
        {
          name: 'ホームページ',
          url: 'https://example.com',
          violations: [
            {
              id: 'color-contrast',
              description: 'コントラスト比が不十分',
              impact: 'serious',
              nodeCount: 2,
              wcagCriteria: ['1.4.3'],
              helpUrl: 'https://example.com/help',
              toolSource: 'axe-core',
              // nodes プロパティなし
            },
          ],
          passes: [],
          incomplete: [],
        },
      ];

      render(<ViolationsTable pages={pagesWithoutNodes} />);

      const expandButton = screen.getByRole('button', { name: /ノード情報/ });
      expect(expandButton).toBeDisabled();
    });
  });

  describe('Task 11.2: WCAGフィルタ機能', () => {
    it('wcagFilterが指定されていると該当する違反のみ表示される', () => {
      render(<ViolationsTable pages={mockPages} wcagFilter="1.4.3" />);

      // 1.4.3に該当するcolor-contrastは表示される
      expect(screen.getByText('color-contrast')).toBeInTheDocument();
      // 1.1.1のimage-altは表示されない
      expect(screen.queryByText('image-alt')).not.toBeInTheDocument();
    });

    it('wcagFilterが指定されていて該当する違反がない場合はメッセージを表示する', () => {
      render(<ViolationsTable pages={mockPages} wcagFilter="2.4.4" />);

      expect(screen.getByText('WCAG 2.4.4 に該当する違反はありません')).toBeInTheDocument();
    });

    it('wcagFilterがnullの場合は全ての違反を表示する', () => {
      render(<ViolationsTable pages={mockPages} wcagFilter={null} />);

      expect(screen.getByText('color-contrast')).toBeInTheDocument();
      expect(screen.getByText('image-alt')).toBeInTheDocument();
    });

    it('wcagFilterが未指定の場合は全ての違反を表示する', () => {
      render(<ViolationsTable pages={mockPages} />);

      expect(screen.getByText('color-contrast')).toBeInTheDocument();
      expect(screen.getByText('image-alt')).toBeInTheDocument();
    });
  });
});
