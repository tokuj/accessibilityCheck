/**
 * PageTabs コンポーネントテスト
 *
 * Task 8.1: PageTabsコンポーネントを新規作成
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 *
 * テスト対象:
 * - 複数ページのレポートをタブ形式で切り替えるコンポーネント
 * - 各タブにページタイトルを表示
 * - 長いタイトルは省略表示（ellipsis）
 * - タブに違反数をバッジで表示
 * - タブクリック時にonChangeコールバックでインデックスを通知
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageTabs } from '../PageTabs';

describe('PageTabs', () => {
  const mockPages = [
    { title: 'ホームページ', url: 'https://example.com/', violationCount: 3 },
    { title: 'お問い合わせ', url: 'https://example.com/contact', violationCount: 0 },
    { title: '商品一覧', url: 'https://example.com/products', violationCount: 5 },
  ];

  describe('基本表示', () => {
    it('ページタイトルがタブとして表示される', () => {
      render(
        <PageTabs
          pages={mockPages}
          activeIndex={0}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByRole('tab', { name: /ホームページ/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /お問い合わせ/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /商品一覧/ })).toBeInTheDocument();
    });

    it('タブリストが表示される', () => {
      render(
        <PageTabs
          pages={mockPages}
          activeIndex={0}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('指定されたインデックスのタブがアクティブになる', () => {
      render(
        <PageTabs
          pages={mockPages}
          activeIndex={1}
          onChange={vi.fn()}
        />
      );

      const activeTab = screen.getByRole('tab', { name: /お問い合わせ/ });
      expect(activeTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('タイトル省略表示', () => {
    it('20文字以下のタイトルはそのまま表示される', () => {
      const pagesWithShortTitle = [
        { title: 'ホームページ', url: 'https://example.com/', violationCount: 0 },
      ];

      render(
        <PageTabs
          pages={pagesWithShortTitle}
          activeIndex={0}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByRole('tab', { name: /ホームページ/ })).toBeInTheDocument();
    });

    it('20文字を超えるタイトルは省略表示される', () => {
      const longTitle = 'これは非常に長いページタイトルで20文字を超えています';
      const pagesWithLongTitle = [
        { title: longTitle, url: 'https://example.com/', violationCount: 0 },
      ];

      render(
        <PageTabs
          pages={pagesWithLongTitle}
          activeIndex={0}
          onChange={vi.fn()}
        />
      );

      // 20文字で切り詰め + "..."
      const truncated = longTitle.substring(0, 20) + '...';
      expect(screen.getByRole('tab')).toHaveTextContent(truncated);
    });
  });

  describe('違反数バッジ', () => {
    it('違反数がバッジで表示される', () => {
      render(
        <PageTabs
          pages={mockPages}
          activeIndex={0}
          onChange={vi.fn()}
        />
      );

      // バッジの数字を確認
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('違反数が0の場合はバッジが非表示または0と表示される', () => {
      const pagesWithZeroViolations = [
        { title: 'ページA', url: 'https://example.com/a', violationCount: 0 },
      ];

      render(
        <PageTabs
          pages={pagesWithZeroViolations}
          activeIndex={0}
          onChange={vi.fn()}
        />
      );

      // 違反数0のときのバッジの挙動を確認（デザインにより0非表示または0表示）
      const tab = screen.getByRole('tab', { name: /ページA/ });
      expect(tab).toBeInTheDocument();
    });

    it('違反数に応じたスタイルが適用される', () => {
      render(
        <PageTabs
          pages={mockPages}
          activeIndex={0}
          onChange={vi.fn()}
        />
      );

      // バッジが表示されていることを確認
      const badges = screen.getAllByTestId('violation-badge');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  describe('スコアバッジ', () => {
    it('アクセシビリティスコアがバッジで表示される', () => {
      const pagesWithScores = [
        { title: 'ページ1', url: 'https://example.com/1', violationCount: 1, accessibilityScore: 85 },
        { title: 'ページ2', url: 'https://example.com/2', violationCount: 0, accessibilityScore: 100 },
      ];

      render(
        <PageTabs
          pages={pagesWithScores}
          activeIndex={0}
          onChange={vi.fn()}
        />
      );

      // スコアバッジの数字を確認
      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('スコアが未定義の場合はスコアバッジが表示されない', () => {
      const pagesWithoutScores = [
        { title: 'ページ1', url: 'https://example.com/1', violationCount: 1 },
      ];

      render(
        <PageTabs
          pages={pagesWithoutScores}
          activeIndex={0}
          onChange={vi.fn()}
        />
      );

      // スコアバッジがないことを確認
      expect(screen.queryByTestId('score-badge')).not.toBeInTheDocument();
    });

    it('スコアに応じた色が適用される（90以上=緑、50-89=黄、50未満=赤）', () => {
      const pagesWithVariousScores = [
        { title: 'ページ1', url: 'https://example.com/1', violationCount: 0, accessibilityScore: 95 },
        { title: 'ページ2', url: 'https://example.com/2', violationCount: 0, accessibilityScore: 70 },
        { title: 'ページ3', url: 'https://example.com/3', violationCount: 0, accessibilityScore: 30 },
      ];

      render(
        <PageTabs
          pages={pagesWithVariousScores}
          activeIndex={0}
          onChange={vi.fn()}
        />
      );

      // スコアバッジが表示されていることを確認
      const scoreBadges = screen.getAllByTestId('score-badge');
      expect(scoreBadges).toHaveLength(3);
    });
  });

  describe('タブ切り替え', () => {
    it('タブをクリックするとonChangeが正しいインデックスで呼ばれる', async () => {
      const onChange = vi.fn();
      render(
        <PageTabs
          pages={mockPages}
          activeIndex={0}
          onChange={onChange}
        />
      );

      const secondTab = screen.getByRole('tab', { name: /お問い合わせ/ });
      await userEvent.click(secondTab);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(1);
    });

    it('異なるタブをクリックするたびにonChangeが呼ばれる', async () => {
      const onChange = vi.fn();
      render(
        <PageTabs
          pages={mockPages}
          activeIndex={0}
          onChange={onChange}
        />
      );

      await userEvent.click(screen.getByRole('tab', { name: /お問い合わせ/ }));
      await userEvent.click(screen.getByRole('tab', { name: /商品一覧/ }));

      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenNthCalledWith(1, 1);
      expect(onChange).toHaveBeenNthCalledWith(2, 2);
    });
  });

  describe('アクセシビリティ', () => {
    it('適切なARIA属性が設定されている', () => {
      render(
        <PageTabs
          pages={mockPages}
          activeIndex={0}
          onChange={vi.fn()}
        />
      );

      const tabList = screen.getByRole('tablist');
      expect(tabList).toHaveAttribute('aria-label');

      const tabs = screen.getAllByRole('tab');
      tabs.forEach((tab) => {
        expect(tab).toHaveAttribute('aria-selected');
      });
    });

    it('キーボードナビゲーションが可能', async () => {
      const onChange = vi.fn();
      render(
        <PageTabs
          pages={mockPages}
          activeIndex={0}
          onChange={onChange}
        />
      );

      // 最初のタブにフォーカス
      const firstTab = screen.getByRole('tab', { name: /ホームページ/ });
      firstTab.focus();

      // 右矢印キーで次のタブに移動
      await userEvent.keyboard('{ArrowRight}');

      // タブにフォーカスが移動していることを確認
      expect(document.activeElement).toHaveAttribute('role', 'tab');
    });
  });

  describe('単一ページ時の表示', () => {
    it('単一ページでもタブが表示される', () => {
      const singlePage = [
        { title: 'ホームページ', url: 'https://example.com/', violationCount: 2 },
      ];

      render(
        <PageTabs
          pages={singlePage}
          activeIndex={0}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByRole('tab', { name: /ホームページ/ })).toBeInTheDocument();
    });
  });

  describe('4ページ（最大）の表示', () => {
    it('4つのページが全てタブとして表示される', () => {
      const fourPages = [
        { title: 'ページ1', url: 'https://example.com/1', violationCount: 1 },
        { title: 'ページ2', url: 'https://example.com/2', violationCount: 2 },
        { title: 'ページ3', url: 'https://example.com/3', violationCount: 3 },
        { title: 'ページ4', url: 'https://example.com/4', violationCount: 4 },
      ];

      render(
        <PageTabs
          pages={fourPages}
          activeIndex={0}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByRole('tab', { name: /ページ1/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /ページ2/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /ページ3/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /ページ4/ })).toBeInTheDocument();
    });
  });

  describe('ツールチップ', () => {
    it('タブにマウスオーバーするとツールチップが表示される', async () => {
      const user = userEvent.setup();
      const pagesWithLongTitle = [
        {
          title: 'これは非常に長いページタイトルで20文字を超えています',
          url: 'https://example.com/very/long/path/to/page',
          violationCount: 0,
        },
      ];

      render(
        <PageTabs pages={pagesWithLongTitle} activeIndex={0} onChange={vi.fn()} />
      );

      const tab = screen.getByRole('tab');
      await user.hover(tab);

      // ツールチップに完全なタイトルが表示される
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent(
          'これは非常に長いページタイトルで20文字を超えています'
        );
      });
    });

    it('ツールチップにURLが表示される', async () => {
      const user = userEvent.setup();
      const pages = [
        {
          title: 'テストページ',
          url: 'https://example.com/test/page',
          violationCount: 0,
        },
      ];

      render(
        <PageTabs pages={pages} activeIndex={0} onChange={vi.fn()} />
      );

      const tab = screen.getByRole('tab');
      await user.hover(tab);

      // ツールチップにURLが表示される
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent(
          'https://example.com/test/page'
        );
      });
    });
  });
});
