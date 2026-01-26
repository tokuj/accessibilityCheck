/**
 * ImprovementListコンポーネントのテスト
 * @requirement 4.4, 4.5, 4.6, 4.7 - 対話ポイントの設置
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImprovementList } from '../ImprovementList';
import type { RuleResult, AISummary } from '../../types/accessibility';

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
const mockViolations: RuleResult[] = [
  {
    id: 'color-contrast',
    description: 'コントラスト比が不十分',
    impact: 'serious',
    nodeCount: 5,
    wcagCriteria: ['1.4.3'],
    helpUrl: 'https://example.com/help',
  },
  {
    id: 'image-alt',
    description: '代替テキストがありません',
    impact: 'critical',
    nodeCount: 3,
    wcagCriteria: ['1.1.1'],
    helpUrl: 'https://example.com/help2',
  },
];

const mockAISummary: AISummary = {
  overallAssessment: 'アクセシビリティの全体評価です。',
  impactSummary: {
    critical: 1,
    serious: 2,
    moderate: 0,
    minor: 1,
  },
  prioritizedImprovements: ['画像に代替テキストを追加', 'コントラスト比を改善'],
  specificRecommendations: ['推奨事項1', '推奨事項2'],
  detectedIssues: [
    {
      ruleId: 'color-contrast',
      whatIsHappening: 'コントラスト比が低いテキストがあります',
      whatIsNeeded: '4.5:1以上のコントラスト比',
      howToFix: 'テキストの色を濃くするか背景色を変更',
    },
    {
      ruleId: 'image-alt',
      whatIsHappening: '画像に代替テキストがありません',
      whatIsNeeded: 'alt属性の追加',
      howToFix: '<img alt="説明" />を追加',
    },
  ],
};

describe('ImprovementList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AI総評セクションが表示される', () => {
    render(
      <ImprovementList
        violations={mockViolations}
        aiSummary={mockAISummary}
      />
    );

    expect(screen.getByText('AI総評')).toBeInTheDocument();
    expect(screen.getByText('アクセシビリティの全体評価です。')).toBeInTheDocument();
  });

  describe('AIChatButton統合', () => {
    it('全体評価（overallAssessment）にAIChatButtonが表示される', () => {
      render(
        <ImprovementList
          violations={mockViolations}
          aiSummary={mockAISummary}
        />
      );

      // AI総評セクション内にボタンがある
      const chatButtons = screen.getAllByRole('button', {
        name: 'この項目についてAIに質問する',
      });
      expect(chatButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('各優先改善ポイントにAIChatButtonが表示される', () => {
      render(
        <ImprovementList
          violations={mockViolations}
          aiSummary={mockAISummary}
        />
      );

      // 優先改善ポイントが表示されている
      expect(screen.getByText('画像に代替テキストを追加')).toBeInTheDocument();
      expect(screen.getByText('コントラスト比を改善')).toBeInTheDocument();

      // 少なくとも改善ポイント分のボタンがある
      const chatButtons = screen.getAllByRole('button', {
        name: 'この項目についてAIに質問する',
      });
      expect(chatButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('各推奨事項にAIChatButtonが表示される', () => {
      render(
        <ImprovementList
          violations={mockViolations}
          aiSummary={mockAISummary}
        />
      );

      // 推奨事項が表示されている
      expect(screen.getByText('推奨事項1')).toBeInTheDocument();
      expect(screen.getByText('推奨事項2')).toBeInTheDocument();
    });

    it('各検出問題（detectedIssue）にAIChatButtonが表示される', () => {
      render(
        <ImprovementList
          violations={mockViolations}
          aiSummary={mockAISummary}
        />
      );

      // 検出問題が表示されている
      expect(screen.getByText('color-contrast')).toBeInTheDocument();
      expect(screen.getByText('image-alt')).toBeInTheDocument();

      // ボタンが十分にある
      const chatButtons = screen.getAllByRole('button', {
        name: 'この項目についてAIに質問する',
      });
      // 全体評価1 + 改善ポイント2 + 推奨事項2 + 検出問題2 = 7以上
      expect(chatButtons.length).toBeGreaterThanOrEqual(7);
    });

    it('AIサマリーがない場合でもエラーが発生しない', () => {
      render(<ImprovementList violations={mockViolations} />);

      // エラーなく表示される
      expect(screen.getByText('改善提案')).toBeInTheDocument();
    });
  });
});
