/**
 * SemiAutoCheckPanel コンポーネントテスト
 *
 * Requirements: wcag-coverage-expansion 5.1, 5.2, 5.3, 5.5, 5.6
 * Task 11.1: SemiAutoCheckPanelコンポーネントを実装
 *
 * - カード形式で半自動チェック項目を一覧表示
 * - 各カードにスクリーンショット、HTML抜粋、質問を表示
 * - 選択肢ボタン（適切/不適切/判断不能）を表示
 * - 進捗バーで完了状況を表示
 * - スキップボタンで後回しを可能に
 * - 「自動テストのみ」オプション時はパネルを非表示
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { SemiAutoCheckPanel } from '../SemiAutoCheckPanel';
import { theme } from '../../theme';
import type { SemiAutoItem, SemiAutoAnswer } from '../../types/semi-auto-check';

// テスト用ラッパー
function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

// モックデータ
const mockItems: SemiAutoItem[] = [
  {
    id: 'item-1',
    ruleId: 'image-alt',
    wcagCriteria: ['1.1.1'],
    question: 'この画像のalt属性「ロゴ」は、画像の内容を適切に説明していますか？',
    html: '<img src="logo.png" alt="ロゴ">',
    elementDescription: '画像（alt: "ロゴ"）',
    selector: 'img.logo',
    screenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  },
  {
    id: 'item-2',
    ruleId: 'link-name',
    wcagCriteria: ['2.4.4', '4.1.2'],
    question: 'このリンクテキストは、リンク先の内容を明確に説明していますか？',
    html: '<a href="/details">詳細を見る</a>',
    elementDescription: 'a要素「詳細を見る」',
    selector: 'a.details-link',
  },
  {
    id: 'item-3',
    ruleId: 'heading-order',
    wcagCriteria: ['1.3.1'],
    question: 'この見出し構造は、ページの論理的な階層を正しく反映していますか？',
    html: '<h3>セクションタイトル</h3>',
    elementDescription: 'h3要素「セクションタイトル」',
    selector: 'h3.section-title',
  },
];

describe('SemiAutoCheckPanel', () => {
  let mockOnAnswer: ReturnType<typeof vi.fn>;
  let mockOnSkip: ReturnType<typeof vi.fn>;
  let mockOnComplete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnAnswer = vi.fn();
    mockOnSkip = vi.fn();
    mockOnComplete = vi.fn();
  });

  describe('初期表示', () => {
    it('半自動チェック項目がカード形式で表示される', () => {
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
        />
      );

      // 最初の項目の質問が表示される
      expect(screen.getByText(mockItems[0].question)).toBeInTheDocument();
    });

    it('スクリーンショットが表示される（存在する場合）', () => {
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
        />
      );

      // スクリーンショット画像が表示される
      const screenshot = screen.getByRole('img', { name: /要素のスクリーンショット/i });
      expect(screenshot).toBeInTheDocument();
      expect(screenshot).toHaveAttribute('src', mockItems[0].screenshot);
    });

    it('HTML抜粋が表示される', () => {
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
        />
      );

      // HTML抜粋が表示される
      expect(screen.getByText(/<img src="logo.png" alt="ロゴ">/)).toBeInTheDocument();
    });

    it('要素の説明が表示される', () => {
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText(mockItems[0].elementDescription)).toBeInTheDocument();
    });

    it('WCAG成功基準が表示される', () => {
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText('1.1.1')).toBeInTheDocument();
    });

    it('選択肢ボタンが表示される', () => {
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByRole('button', { name: '適切' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '不適切' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '判断不能' })).toBeInTheDocument();
    });

    it('スキップボタンが表示される', () => {
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByRole('button', { name: 'スキップ' })).toBeInTheDocument();
    });
  });

  describe('進捗表示（Requirement 5.6）', () => {
    it('進捗バーが表示される', () => {
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
          progress={{ completed: 0, total: 3 }}
        />
      );

      // 進捗表示が存在する
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('進捗状況のテキストが表示される', () => {
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
          progress={{ completed: 1, total: 3 }}
        />
      );

      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });

    it('進捗が更新される', () => {
      const { rerender } = renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
          progress={{ completed: 0, total: 3 }}
        />
      );

      expect(screen.getByText('0 / 3')).toBeInTheDocument();

      rerender(
        <ThemeProvider theme={theme}>
          <SemiAutoCheckPanel
            items={mockItems}
            currentIndex={1}
            onAnswer={mockOnAnswer}
            onSkip={mockOnSkip}
            onComplete={mockOnComplete}
            progress={{ completed: 1, total: 3 }}
          />
        </ThemeProvider>
      );

      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });
  });

  describe('回答選択（Requirement 5.3）', () => {
    it('「適切」ボタンをクリックするとonAnswerが呼ばれる', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
        />
      );

      await user.click(screen.getByRole('button', { name: '適切' }));

      expect(mockOnAnswer).toHaveBeenCalledWith('item-1', 'appropriate');
    });

    it('「不適切」ボタンをクリックするとonAnswerが呼ばれる', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
        />
      );

      await user.click(screen.getByRole('button', { name: '不適切' }));

      expect(mockOnAnswer).toHaveBeenCalledWith('item-1', 'inappropriate');
    });

    it('「判断不能」ボタンをクリックするとonAnswerが呼ばれる', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
        />
      );

      await user.click(screen.getByRole('button', { name: '判断不能' }));

      expect(mockOnAnswer).toHaveBeenCalledWith('item-1', 'cannot-determine');
    });
  });

  describe('スキップ機能（Requirement 5.5）', () => {
    it('スキップボタンをクリックするとonSkipが呼ばれる', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
        />
      );

      await user.click(screen.getByRole('button', { name: 'スキップ' }));

      expect(mockOnSkip).toHaveBeenCalledWith('item-1');
    });
  });

  describe('項目切り替え', () => {
    it('currentIndexに応じて表示される項目が変わる', () => {
      const { rerender } = renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText(mockItems[0].question)).toBeInTheDocument();

      rerender(
        <ThemeProvider theme={theme}>
          <SemiAutoCheckPanel
            items={mockItems}
            currentIndex={1}
            onAnswer={mockOnAnswer}
            onSkip={mockOnSkip}
            onComplete={mockOnComplete}
          />
        </ThemeProvider>
      );

      expect(screen.getByText(mockItems[1].question)).toBeInTheDocument();
    });

    it('スクリーンショットがない項目では画像が表示されない', () => {
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={1}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
        />
      );

      // スクリーンショット画像が存在しない
      expect(screen.queryByRole('img', { name: /要素のスクリーンショット/i })).not.toBeInTheDocument();
    });
  });

  describe('完了状態', () => {
    it('全項目完了時に完了メッセージが表示される', () => {
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={-1}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
          progress={{ completed: 3, total: 3 }}
          isComplete={true}
        />
      );

      expect(screen.getByText(/すべての項目を確認しました/i)).toBeInTheDocument();
    });

    it('完了ボタンをクリックするとonCompleteが呼ばれる', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={-1}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
          progress={{ completed: 3, total: 3 }}
          isComplete={true}
        />
      );

      await user.click(screen.getByRole('button', { name: '完了' }));

      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  describe('空の項目リスト', () => {
    it('項目がない場合は「確認項目がありません」と表示される', () => {
      renderWithTheme(
        <SemiAutoCheckPanel
          items={[]}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText(/確認項目がありません/i)).toBeInTheDocument();
    });
  });

  describe('非表示状態（Requirement 5.5）', () => {
    it('hiddenがtrueの場合はパネルが表示されない', () => {
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
          hidden={true}
        />
      );

      // パネルが表示されない
      expect(screen.queryByText(mockItems[0].question)).not.toBeInTheDocument();
    });
  });

  describe('アクセシビリティ', () => {
    it('すべてのボタンにアクセシブルなラベルがある', () => {
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByRole('button', { name: '適切' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '不適切' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '判断不能' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'スキップ' })).toBeInTheDocument();
    });

    it('キーボードでボタンを操作できる', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
        />
      );

      // 適切ボタンにフォーカスしてEnterで選択
      const appropriateButton = screen.getByRole('button', { name: '適切' });
      appropriateButton.focus();
      await user.keyboard('{Enter}');

      expect(mockOnAnswer).toHaveBeenCalledWith('item-1', 'appropriate');
    });

    it('進捗バーにaria属性が設定されている', () => {
      renderWithTheme(
        <SemiAutoCheckPanel
          items={mockItems}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
          progress={{ completed: 1, total: 3 }}
        />
      );

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow');
    });
  });

  describe('回答済み項目の表示', () => {
    it('回答済みの項目では回答が表示される', () => {
      const itemsWithAnswer: SemiAutoItem[] = [
        {
          ...mockItems[0],
          answer: 'appropriate',
          answeredAt: '2026-01-31T12:00:00Z',
        },
      ];

      renderWithTheme(
        <SemiAutoCheckPanel
          items={itemsWithAnswer}
          currentIndex={0}
          onAnswer={mockOnAnswer}
          onSkip={mockOnSkip}
          onComplete={mockOnComplete}
          showPreviousAnswer={true}
        />
      );

      expect(screen.getByText(/前回の回答: 適切/i)).toBeInTheDocument();
    });
  });
});
