/**
 * PassesTableコンポーネントのテスト
 * @requirement 4.9 - 対話ポイントの設置
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PassesTable } from '../PassesTable';
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
    violations: [],
    passes: [
      {
        id: 'button-name',
        description: 'ボタンに名前があります',
        nodeCount: 10,
        wcagCriteria: ['4.1.2'],
        helpUrl: 'https://example.com/help',
        toolSource: 'axe-core',
      },
      {
        id: 'html-lang-valid',
        description: 'HTML要素に有効なlang属性があります',
        nodeCount: 1,
        wcagCriteria: ['3.1.1'],
        helpUrl: 'https://example.com/help2',
        toolSource: 'axe-core',
      },
    ],
    incomplete: [],
  },
];

describe('PassesTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('パスがない場合は「パスした項目はありません」と表示する', () => {
    render(<PassesTable pages={[{ name: 'Page', url: 'https://example.com', violations: [], passes: [], incomplete: [] }]} />);

    expect(screen.getByText('パスした項目はありません')).toBeInTheDocument();
  });

  it('パスデータを表示する', () => {
    render(<PassesTable pages={mockPages} />);

    expect(screen.getByText('button-name')).toBeInTheDocument();
    expect(screen.getByText('html-lang-valid')).toBeInTheDocument();
    expect(screen.getByText('ボタンに名前があります')).toBeInTheDocument();
  });

  describe('AIChatButton統合', () => {
    it('各パス行にAIChatButtonが表示される', () => {
      render(<PassesTable pages={mockPages} />);

      // 2つのパス行 = 少なくとも2つのAIChatButton
      const chatButtons = screen.getAllByRole('button', {
        name: 'この項目についてAIに質問する',
      });
      expect(chatButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('AIChatButtonにaria-labelが設定されている', () => {
      render(<PassesTable pages={mockPages} />);

      const chatButtons = screen.getAllByRole('button', {
        name: 'この項目についてAIに質問する',
      });
      chatButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label', 'この項目についてAIに質問する');
      });
    });
  });
});
