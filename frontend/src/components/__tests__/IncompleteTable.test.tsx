/**
 * IncompleteTableコンポーネントのテスト
 * @requirement 4.10 - 対話ポイントの設置
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IncompleteTable } from '../IncompleteTable';
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
    passes: [],
    incomplete: [
      {
        id: 'aria-hidden-focus',
        description: 'aria-hidden要素にフォーカス可能な要素が含まれている可能性',
        impact: 'moderate',
        nodeCount: 2,
        wcagCriteria: ['4.1.2'],
        helpUrl: 'https://example.com/help',
        toolSource: 'axe-core',
      },
      {
        id: 'color-contrast',
        description: 'コントラスト比を確認してください',
        impact: 'serious',
        nodeCount: 4,
        wcagCriteria: ['1.4.3'],
        helpUrl: 'https://example.com/help2',
        toolSource: 'axe-core',
      },
    ],
  },
];

describe('IncompleteTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('要確認がない場合は「要確認項目はありません」と表示する', () => {
    render(<IncompleteTable pages={[{ name: 'Page', url: 'https://example.com', violations: [], passes: [], incomplete: [] }]} />);

    expect(screen.getByText('要確認項目はありません')).toBeInTheDocument();
  });

  it('要確認データを表示する', () => {
    render(<IncompleteTable pages={mockPages} />);

    expect(screen.getByText('aria-hidden-focus')).toBeInTheDocument();
    expect(screen.getByText('color-contrast')).toBeInTheDocument();
  });

  describe('AIChatButton統合', () => {
    it('各要確認行にAIChatButtonが表示される', () => {
      render(<IncompleteTable pages={mockPages} />);

      // 2つの要確認行 = 少なくとも2つのAIChatButton
      const chatButtons = screen.getAllByRole('button', {
        name: 'この項目についてAIに質問する',
      });
      expect(chatButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('AIChatButtonにaria-labelが設定されている', () => {
      render(<IncompleteTable pages={mockPages} />);

      const chatButtons = screen.getAllByRole('button', {
        name: 'この項目についてAIに質問する',
      });
      chatButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label', 'この項目についてAIに質問する');
      });
    });
  });
});
