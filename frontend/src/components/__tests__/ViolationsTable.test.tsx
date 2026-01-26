/**
 * ViolationsTableコンポーネントのテスト
 * @requirement 4.8, 4.11 - 対話ポイントの設置
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
