/**
 * ScoreCardコンポーネントのテスト
 * @requirement 4.1, 4.2 - 対話ポイントの設置
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreCard } from '../ScoreCard';
import type { CategoryScore } from '../../utils/scoreCalculator';

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
const mockCategories: CategoryScore[] = [
  { name: '知覚可能', nameEn: 'Perceivable', score: 85, passes: 17, total: 20 },
  { name: '操作可能', nameEn: 'Operable', score: 90, passes: 18, total: 20 },
  { name: '理解可能', nameEn: 'Understandable', score: 75, passes: 15, total: 20 },
  { name: '堅牢性', nameEn: 'Robust', score: 95, passes: 19, total: 20 },
];

describe('ScoreCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('総合スコアを表示する', () => {
    render(
      <ScoreCard
        totalScore={85}
        categories={mockCategories}
        passCount={100}
        violationCount={18}
      />
    );

    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('/100')).toBeInTheDocument();
  });

  it('各カテゴリ別スコアを表示する', () => {
    render(
      <ScoreCard
        totalScore={85}
        categories={mockCategories}
        passCount={100}
        violationCount={18}
      />
    );

    expect(screen.getByText('知覚可能')).toBeInTheDocument();
    expect(screen.getByText('操作可能')).toBeInTheDocument();
    expect(screen.getByText('理解可能')).toBeInTheDocument();
    expect(screen.getByText('堅牢性')).toBeInTheDocument();
  });

  describe('AIChatButton統合', () => {
    it('総合スコアにAIChatButtonが表示される', () => {
      render(
        <ScoreCard
          totalScore={85}
          categories={mockCategories}
          passCount={100}
          violationCount={18}
        />
      );

      // 総合スコア用のAIChatButtonを検索
      const chatButtons = screen.getAllByRole('button', {
        name: 'この項目についてAIに質問する',
      });
      expect(chatButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('各カテゴリ別スコアにAIChatButtonが表示される', () => {
      render(
        <ScoreCard
          totalScore={85}
          categories={mockCategories}
          passCount={100}
          violationCount={18}
        />
      );

      // 総合スコア + 4カテゴリ = 少なくとも5つのボタン
      const chatButtons = screen.getAllByRole('button', {
        name: 'この項目についてAIに質問する',
      });
      expect(chatButtons.length).toBeGreaterThanOrEqual(5);
    });

    it('AIChatButtonにaria-labelが設定されている', () => {
      render(
        <ScoreCard
          totalScore={85}
          categories={mockCategories}
          passCount={100}
          violationCount={18}
        />
      );

      const chatButtons = screen.getAllByRole('button', {
        name: 'この項目についてAIに質問する',
      });
      chatButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label', 'この項目についてAIに質問する');
      });
    });
  });
});
