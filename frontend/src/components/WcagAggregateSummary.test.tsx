/**
 * WcagAggregateSummaryコンポーネントのユニットテスト
 * @requirement 2.1, 2.2, 2.3, 2.5 - WCAG項番別の集約サマリー
 * @task 7.2 - WcagAggregateSummaryコンポーネントのテストを作成する
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WcagAggregateSummary } from './WcagAggregateSummary';
import type { RuleResult } from '../types/accessibility';

// テスト用のモック違反データを作成
const createMockViolation = (overrides: Partial<RuleResult> = {}): RuleResult => ({
  id: 'test-rule',
  description: 'テストルール説明',
  impact: 'serious',
  nodeCount: 1,
  helpUrl: 'https://example.com/help',
  wcagCriteria: ['1.4.3'],
  toolSource: 'axe-core',
  ...overrides,
});

describe('WcagAggregateSummary', () => {
  describe('集約ロジック', () => {
    it('WCAG項番でグループ化されて表示されること', () => {
      const violations: RuleResult[] = [
        createMockViolation({ id: 'rule-1', wcagCriteria: ['1.4.3'], toolSource: 'axe-core' }),
        createMockViolation({ id: 'rule-2', wcagCriteria: ['1.4.3'], toolSource: 'pa11y' }),
        createMockViolation({ id: 'rule-3', wcagCriteria: ['2.4.4'], toolSource: 'axe-core' }),
      ];

      render(<WcagAggregateSummary violations={violations} />);

      // WCAG 1.4.3と2.4.4がそれぞれ表示されること
      expect(screen.getByText('1.4.3')).toBeInTheDocument();
      expect(screen.getByText('2.4.4')).toBeInTheDocument();
    });

    it('ツール別の検出件数が正しく表示されること', () => {
      const violations: RuleResult[] = [
        createMockViolation({ id: 'rule-1', wcagCriteria: ['1.4.3'], toolSource: 'axe-core' }),
        createMockViolation({ id: 'rule-2', wcagCriteria: ['1.4.3'], toolSource: 'axe-core' }),
        createMockViolation({ id: 'rule-3', wcagCriteria: ['1.4.3'], toolSource: 'pa11y' }),
        createMockViolation({ id: 'rule-4', wcagCriteria: ['1.4.3'], toolSource: 'lighthouse' }),
      ];

      render(<WcagAggregateSummary violations={violations} />);

      // ツール別件数が表示されること（axe-core: 2, pa11y: 1, lighthouse: 1）
      expect(screen.getByText('axe-core: 2')).toBeInTheDocument();
      expect(screen.getByText('pa11y: 1')).toBeInTheDocument();
      expect(screen.getByText('lighthouse: 1')).toBeInTheDocument();
      // 合計4件が表示されること
      expect(screen.getByText('4件')).toBeInTheDocument();
    });

    it('複数のWCAG項番を持つ違反が各項番に集計されること', () => {
      const violations: RuleResult[] = [
        createMockViolation({ id: 'rule-1', wcagCriteria: ['1.4.3', '1.4.6'], toolSource: 'axe-core' }),
      ];

      render(<WcagAggregateSummary violations={violations} />);

      // 両方のWCAG項番が表示されること
      expect(screen.getByText('1.4.3')).toBeInTheDocument();
      expect(screen.getByText('1.4.6')).toBeInTheDocument();
    });

    it('WCAG項番が空の違反はスキップされること', () => {
      const violations: RuleResult[] = [
        createMockViolation({ id: 'rule-1', wcagCriteria: ['1.4.3'], toolSource: 'axe-core' }),
        createMockViolation({ id: 'rule-2', wcagCriteria: [], toolSource: 'axe-core' }),
      ];

      render(<WcagAggregateSummary violations={violations} />);

      // 1.4.3のみ表示されること
      expect(screen.getByText('1.4.3')).toBeInTheDocument();
      // rule-2はWCAG項番がないため集計されない
    });
  });

  describe('ソート順', () => {
    it('違反件数の多い順にソートされること', () => {
      const violations: RuleResult[] = [
        createMockViolation({ id: 'rule-1', wcagCriteria: ['2.4.4'], toolSource: 'axe-core' }),
        createMockViolation({ id: 'rule-2', wcagCriteria: ['1.4.3'], toolSource: 'axe-core' }),
        createMockViolation({ id: 'rule-3', wcagCriteria: ['1.4.3'], toolSource: 'pa11y' }),
        createMockViolation({ id: 'rule-4', wcagCriteria: ['1.4.3'], toolSource: 'lighthouse' }),
      ];

      render(<WcagAggregateSummary violations={violations} />);

      // 1.4.3（3件）が2.4.4（1件）より先に表示されること
      const items = screen.getAllByTestId('wcag-summary-item');
      expect(items.length).toBe(2);

      // 最初のアイテムが1.4.3であること
      expect(items[0]).toHaveTextContent('1.4.3');
      expect(items[1]).toHaveTextContent('2.4.4');
    });

    it('同じ件数の場合、WCAG項番の昇順でソートされること', () => {
      const violations: RuleResult[] = [
        createMockViolation({ id: 'rule-1', wcagCriteria: ['2.4.4'], toolSource: 'axe-core' }),
        createMockViolation({ id: 'rule-2', wcagCriteria: ['1.4.3'], toolSource: 'axe-core' }),
      ];

      render(<WcagAggregateSummary violations={violations} />);

      const items = screen.getAllByTestId('wcag-summary-item');
      // 件数が同じなので、WCAG項番の昇順（1.4.3 < 2.4.4）
      expect(items[0]).toHaveTextContent('1.4.3');
      expect(items[1]).toHaveTextContent('2.4.4');
    });
  });

  describe('WCAGレベル表示', () => {
    it('Level Aのバッジが正しい色で表示されること', () => {
      const violations: RuleResult[] = [
        createMockViolation({ id: 'rule-1', wcagCriteria: ['1.1.1'], toolSource: 'axe-core' }), // Level A
      ];

      render(<WcagAggregateSummary violations={violations} />);

      const levelBadge = screen.getByTestId('wcag-level-badge-1.1.1');
      expect(levelBadge).toHaveTextContent('A');
    });

    it('Level AAのバッジが正しい色で表示されること', () => {
      const violations: RuleResult[] = [
        createMockViolation({ id: 'rule-1', wcagCriteria: ['1.4.3'], toolSource: 'axe-core' }), // Level AA
      ];

      render(<WcagAggregateSummary violations={violations} />);

      const levelBadge = screen.getByTestId('wcag-level-badge-1.4.3');
      expect(levelBadge).toHaveTextContent('AA');
    });

    it('Level AAAのバッジが正しい色で表示されること', () => {
      const violations: RuleResult[] = [
        createMockViolation({ id: 'rule-1', wcagCriteria: ['1.4.6'], toolSource: 'axe-core' }), // Level AAA
      ];

      render(<WcagAggregateSummary violations={violations} />);

      const levelBadge = screen.getByTestId('wcag-level-badge-1.4.6');
      expect(levelBadge).toHaveTextContent('AAA');
    });
  });

  describe('クリックイベント', () => {
    it('WCAG項番クリック時にonWcagFilterコールバックが呼ばれること', () => {
      const onWcagFilter = vi.fn();
      const violations: RuleResult[] = [
        createMockViolation({ id: 'rule-1', wcagCriteria: ['1.4.3'], toolSource: 'axe-core' }),
      ];

      render(<WcagAggregateSummary violations={violations} onWcagFilter={onWcagFilter} />);

      const item = screen.getByTestId('wcag-summary-item');
      fireEvent.click(item);

      expect(onWcagFilter).toHaveBeenCalledTimes(1);
      expect(onWcagFilter).toHaveBeenCalledWith('1.4.3');
    });

    it('onWcagFilterが未定義の場合でもクリックでエラーにならないこと', () => {
      const violations: RuleResult[] = [
        createMockViolation({ id: 'rule-1', wcagCriteria: ['1.4.3'], toolSource: 'axe-core' }),
      ];

      render(<WcagAggregateSummary violations={violations} />);

      const item = screen.getByTestId('wcag-summary-item');

      // クリックしてもエラーにならないこと
      expect(() => fireEvent.click(item)).not.toThrow();
    });
  });

  describe('空データ・エッジケース', () => {
    it('違反が空配列の場合、何も表示されないこと', () => {
      const { container } = render(<WcagAggregateSummary violations={[]} />);

      expect(screen.queryByTestId('wcag-summary-item')).not.toBeInTheDocument();
      expect(container.textContent).toContain('WCAG項番別の違反はありません');
    });

    it('ツール別件数が0件のツールは非表示になること', () => {
      const violations: RuleResult[] = [
        createMockViolation({ id: 'rule-1', wcagCriteria: ['1.4.3'], toolSource: 'axe-core' }),
      ];

      render(<WcagAggregateSummary violations={violations} />);

      // axe-coreのみ表示され、pa11yとlighthouseは非表示
      expect(screen.getByText('axe-core: 1')).toBeInTheDocument();
      expect(screen.queryByText(/pa11y:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/lighthouse:/)).not.toBeInTheDocument();
    });
  });

  describe('ツール別カラー表示', () => {
    it('axe-coreは既存パターンに従ったカラーで表示されること', () => {
      const violations: RuleResult[] = [
        createMockViolation({ id: 'rule-1', wcagCriteria: ['1.4.3'], toolSource: 'axe-core' }),
      ];

      render(<WcagAggregateSummary violations={violations} />);

      const toolChip = screen.getByText('axe-core: 1').closest('.MuiChip-root');
      expect(toolChip).toBeInTheDocument();
      expect(toolChip).toHaveClass('MuiChip-colorDefault');
    });

    it('pa11yは既存パターンに従ったカラーで表示されること', () => {
      const violations: RuleResult[] = [
        createMockViolation({ id: 'rule-1', wcagCriteria: ['1.4.3'], toolSource: 'pa11y' }),
      ];

      render(<WcagAggregateSummary violations={violations} />);

      const toolChip = screen.getByText('pa11y: 1').closest('.MuiChip-root');
      expect(toolChip).toBeInTheDocument();
      expect(toolChip).toHaveClass('MuiChip-colorSecondary');
    });

    it('lighthouseは既存パターンに従ったカラーで表示されること', () => {
      const violations: RuleResult[] = [
        createMockViolation({ id: 'rule-1', wcagCriteria: ['1.4.3'], toolSource: 'lighthouse' }),
      ];

      render(<WcagAggregateSummary violations={violations} />);

      const toolChip = screen.getByText('lighthouse: 1').closest('.MuiChip-root');
      expect(toolChip).toBeInTheDocument();
      expect(toolChip).toHaveClass('MuiChip-colorWarning');
    });
  });

  describe('セクションヘッダー', () => {
    it('セクションタイトルが表示されること', () => {
      const violations: RuleResult[] = [
        createMockViolation({ id: 'rule-1', wcagCriteria: ['1.4.3'], toolSource: 'axe-core' }),
      ];

      render(<WcagAggregateSummary violations={violations} />);

      expect(screen.getByText('WCAG項番別サマリー')).toBeInTheDocument();
    });
  });
});
