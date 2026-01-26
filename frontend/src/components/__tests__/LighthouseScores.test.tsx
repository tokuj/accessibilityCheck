/**
 * LighthouseScoresコンポーネントのテスト
 * @requirement 4.3 - 各スコア行に対話ポイントを設置
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LighthouseScores } from '../LighthouseScores';
import type { LighthouseScores as LighthouseScoresType } from '../../types/accessibility';

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
const mockScores: LighthouseScoresType = {
  performance: 85,
  accessibility: 92,
  bestPractices: 88,
  seo: 95,
};

describe('LighthouseScores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('各スコアラベルを表示する', () => {
    render(<LighthouseScores scores={mockScores} />);

    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('Accessibility')).toBeInTheDocument();
    expect(screen.getByText('Best Practices')).toBeInTheDocument();
    expect(screen.getByText('SEO')).toBeInTheDocument();
  });

  it('各スコア値を表示する', () => {
    render(<LighthouseScores scores={mockScores} />);

    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('92')).toBeInTheDocument();
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText('95')).toBeInTheDocument();
  });

  describe('AIChatButton統合', () => {
    it('各スコア行にAIChatButtonが表示される', () => {
      render(<LighthouseScores scores={mockScores} />);

      // 4つのスコア行 = 4つのAIChatButton
      const chatButtons = screen.getAllByRole('button', {
        name: 'この項目についてAIに質問する',
      });
      expect(chatButtons).toHaveLength(4);
    });

    it('AIChatButtonにaria-labelが設定されている', () => {
      render(<LighthouseScores scores={mockScores} />);

      const chatButtons = screen.getAllByRole('button', {
        name: 'この項目についてAIに質問する',
      });
      chatButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label', 'この項目についてAIに質問する');
      });
    });

    it('スコアがN/Aの場合でもAIChatButtonが表示される', () => {
      // N/A（未定義）のスコアをテストするため、型チェックをバイパス
      const scoresWithNA = {
        performance: undefined,
        accessibility: 92,
        bestPractices: undefined,
        seo: 95,
      } as unknown as LighthouseScoresType;
      render(<LighthouseScores scores={scoresWithNA} />);

      // 4つのスコア行すべてにAIChatButton
      const chatButtons = screen.getAllByRole('button', {
        name: 'この項目についてAIに質問する',
      });
      expect(chatButtons).toHaveLength(4);
    });
  });
});
