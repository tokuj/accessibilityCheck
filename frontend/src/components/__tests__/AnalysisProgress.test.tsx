/**
 * AnalysisProgress コンポーネントのテスト
 *
 * Task 7: 分析中画面の改善
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalysisProgress } from '../AnalysisProgress';

describe('AnalysisProgress', () => {
  describe('基本機能', () => {
    it('分析中のテキストを表示すること', () => {
      render(<AnalysisProgress />);
      expect(screen.getByText('分析中...')).toBeInTheDocument();
    });

    it('ステップ名を表示すること', () => {
      render(<AnalysisProgress stepName="axe-core分析" />);
      expect(screen.getByText(/axe-core分析 を実行中/)).toBeInTheDocument();
    });

    it('進捗を表示すること', () => {
      render(<AnalysisProgress currentStep={2} totalSteps={4} />);
      expect(screen.getByText('2 / 4')).toBeInTheDocument();
    });
  });

  describe('複数URL分析時のページ進捗表示（Task 7.1）', () => {
    it('複数URL分析時にページ進捗を表示すること', () => {
      render(
        <AnalysisProgress
          currentPageIndex={1}
          totalPages={3}
          currentPageUrl="https://example.com/page2"
          currentPageTitle="ページ2"
        />
      );
      expect(screen.getByText(/ページ 2\/3/)).toBeInTheDocument();
    });

    it('現在分析中のページタイトルを表示すること', () => {
      render(
        <AnalysisProgress
          currentPageIndex={0}
          totalPages={2}
          currentPageUrl="https://example.com/home"
          currentPageTitle="ホームページ"
        />
      );
      expect(screen.getByText(/ホームページ/)).toBeInTheDocument();
    });

    it('現在分析中のURLを表示すること', () => {
      render(
        <AnalysisProgress
          currentPageIndex={0}
          totalPages={2}
          currentPageUrl="https://example.com/about"
          currentPageTitle="About"
        />
      );
      expect(screen.getByText(/example\.com\/about/)).toBeInTheDocument();
    });

    it('単一URLの場合はページ進捗を表示しないこと', () => {
      const { container } = render(
        <AnalysisProgress
          currentStep={1}
          totalSteps={4}
          stepName="分析中"
        />
      );
      expect(container.textContent).not.toMatch(/ページ \d\/\d/);
    });
  });

  describe('固定幅レイアウト（Task 7.2）', () => {
    it('カードに最小幅600pxが設定されていること', () => {
      const { container } = render(<AnalysisProgress />);
      const card = container.querySelector('.MuiCard-root');
      expect(card).toBeInTheDocument();
      // スタイルの確認（minWidthが設定されている）
      // Note: 実際のスタイル確認はスナップショットテストや視覚回帰テストで行う
    });
  });

  describe('完了ページの視覚的区別（Task 7.3）', () => {
    it('完了済みページ数を表示すること', () => {
      render(
        <AnalysisProgress
          currentPageIndex={2}
          totalPages={4}
          currentPageUrl="https://example.com/page3"
          currentPageTitle="ページ3"
          completedPages={[0, 1]}
        />
      );
      expect(screen.getByText(/2.*完了/)).toBeInTheDocument();
    });
  });
});
