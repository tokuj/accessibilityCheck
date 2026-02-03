/**
 * EngineSummaryPanelコンポーネントのテスト
 *
 * Requirements: wcag-coverage-expansion 1.4, 6.3, 6.5
 * Task 13.1: エンジン別検出数サマリーコンポーネントを実装
 *
 * - 各エンジンの違反数・パス数を表示
 * - 複数エンジンで検出された違反の統合表示
 * - 検出元エンジンのリスト表示
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { EngineSummaryPanel } from '../EngineSummaryPanel';
import type { ToolSource } from '../../types/analysis-options';

// エンジンサマリーのモックデータ
const createMockEngineSummary = (): Record<ToolSource, { violations: number; passes: number }> => ({
  'axe-core': { violations: 5, passes: 20 },
  pa11y: { violations: 3, passes: 15 },
  lighthouse: { violations: 2, passes: 18 },
  ibm: { violations: 4, passes: 12 },
  alfa: { violations: 2, passes: 10 },
  qualweb: { violations: 3, passes: 8 },
  wave: { violations: 1, passes: 5 },
  custom: { violations: 2, passes: 0 },
});

// 複数エンジンで検出された違反のモックデータ
interface MultiEngineViolation {
  ruleId: string;
  description: string;
  wcagCriteria: string[];
  toolSources: ToolSource[];
  nodeCount: number;
}

const createMockMultiEngineViolations = (): MultiEngineViolation[] => [
  {
    ruleId: 'color-contrast',
    description: 'コントラスト比が不十分です',
    wcagCriteria: ['1.4.3'],
    toolSources: ['axe-core', 'pa11y', 'ibm'],
    nodeCount: 3,
  },
  {
    ruleId: 'image-alt',
    description: '画像にalt属性がありません',
    wcagCriteria: ['1.1.1'],
    toolSources: ['axe-core', 'lighthouse'],
    nodeCount: 2,
  },
  {
    ruleId: 'heading-order',
    description: '見出しの順序が正しくありません',
    wcagCriteria: ['1.3.1'],
    toolSources: ['alfa', 'qualweb'],
    nodeCount: 1,
  },
];

describe('EngineSummaryPanel', () => {
  describe('基本レンダリング', () => {
    it('タイトルが表示される', () => {
      render(
        <EngineSummaryPanel
          engineSummary={createMockEngineSummary()}
          multiEngineViolations={[]}
        />
      );

      expect(screen.getByText('エンジン別検出サマリー')).toBeInTheDocument();
    });

    it('エンジン数が正しく表示される', () => {
      const summary = createMockEngineSummary();
      render(
        <EngineSummaryPanel
          engineSummary={summary}
          multiEngineViolations={[]}
        />
      );

      // 8つのエンジンすべてが表示される
      expect(screen.getByText('axe-core')).toBeInTheDocument();
      expect(screen.getByText('Pa11y')).toBeInTheDocument();
      expect(screen.getByText('Lighthouse')).toBeInTheDocument();
      expect(screen.getByText('IBM Equal Access')).toBeInTheDocument();
      expect(screen.getByText('Siteimprove Alfa')).toBeInTheDocument();
      expect(screen.getByText('QualWeb')).toBeInTheDocument();
      expect(screen.getByText('WAVE')).toBeInTheDocument();
      expect(screen.getByText('カスタムルール')).toBeInTheDocument();
    });

    it('空のエンジンサマリーでは「データがありません」と表示される', () => {
      render(
        <EngineSummaryPanel
          engineSummary={{} as Record<ToolSource, { violations: number; passes: number }>}
          multiEngineViolations={[]}
        />
      );

      expect(screen.getByText('エンジンサマリーデータがありません')).toBeInTheDocument();
    });
  });

  describe('エンジン別検出数表示', () => {
    it('各エンジンの違反数が表示される', () => {
      const summary = createMockEngineSummary();
      render(
        <EngineSummaryPanel
          engineSummary={summary}
          multiEngineViolations={[]}
        />
      );

      // axe-coreの違反数5が表示される
      const axeRow = screen.getByTestId('engine-row-axe-core');
      expect(within(axeRow).getByText('5')).toBeInTheDocument();
    });

    it('各エンジンのパス数が表示される', () => {
      const summary = createMockEngineSummary();
      render(
        <EngineSummaryPanel
          engineSummary={summary}
          multiEngineViolations={[]}
        />
      );

      // axe-coreのパス数20が表示される
      const axeRow = screen.getByTestId('engine-row-axe-core');
      expect(within(axeRow).getByText('20')).toBeInTheDocument();
    });

    it('違反数0のエンジンも表示される', () => {
      const summary: Record<ToolSource, { violations: number; passes: number }> = {
        'axe-core': { violations: 0, passes: 10 },
        pa11y: { violations: 0, passes: 0 },
        lighthouse: { violations: 0, passes: 0 },
        ibm: { violations: 0, passes: 0 },
        alfa: { violations: 0, passes: 0 },
        qualweb: { violations: 0, passes: 0 },
        wave: { violations: 0, passes: 0 },
        custom: { violations: 0, passes: 0 },
      };

      render(
        <EngineSummaryPanel
          engineSummary={summary}
          multiEngineViolations={[]}
        />
      );

      const axeRow = screen.getByTestId('engine-row-axe-core');
      expect(within(axeRow).getByTestId('violation-count')).toHaveTextContent('0');
    });
  });

  describe('合計値表示', () => {
    it('全エンジンの違反数合計が表示される', () => {
      const summary = createMockEngineSummary();
      // 合計: 5 + 3 + 2 + 4 + 2 + 3 + 1 + 2 = 22
      render(
        <EngineSummaryPanel
          engineSummary={summary}
          multiEngineViolations={[]}
        />
      );

      expect(screen.getByTestId('total-violations')).toHaveTextContent('22');
    });

    it('全エンジンのパス数合計が表示される', () => {
      const summary = createMockEngineSummary();
      // 合計: 20 + 15 + 18 + 12 + 10 + 8 + 5 + 0 = 88
      render(
        <EngineSummaryPanel
          engineSummary={summary}
          multiEngineViolations={[]}
        />
      );

      expect(screen.getByTestId('total-passes')).toHaveTextContent('88');
    });
  });

  describe('複数エンジン検出違反表示', () => {
    it('複数エンジンで検出された違反セクションが表示される', () => {
      render(
        <EngineSummaryPanel
          engineSummary={createMockEngineSummary()}
          multiEngineViolations={createMockMultiEngineViolations()}
        />
      );

      expect(screen.getByText('複数エンジンで検出された違反')).toBeInTheDocument();
    });

    it('違反の説明が表示される', () => {
      render(
        <EngineSummaryPanel
          engineSummary={createMockEngineSummary()}
          multiEngineViolations={createMockMultiEngineViolations()}
        />
      );

      expect(screen.getByText('コントラスト比が不十分です')).toBeInTheDocument();
      expect(screen.getByText('画像にalt属性がありません')).toBeInTheDocument();
    });

    it('検出元エンジンがリスト表示される', () => {
      render(
        <EngineSummaryPanel
          engineSummary={createMockEngineSummary()}
          multiEngineViolations={createMockMultiEngineViolations()}
        />
      );

      // 「axe-core, Pa11y, IBM Equal Access」のような形式で表示
      expect(screen.getByText(/axe-core.*Pa11y.*IBM Equal Access/)).toBeInTheDocument();
    });

    it('WCAG基準が表示される', () => {
      render(
        <EngineSummaryPanel
          engineSummary={createMockEngineSummary()}
          multiEngineViolations={createMockMultiEngineViolations()}
        />
      );

      expect(screen.getByText('1.4.3')).toBeInTheDocument();
      expect(screen.getByText('1.1.1')).toBeInTheDocument();
    });

    it('違反がない場合は「複数エンジン検出の違反はありません」と表示される', () => {
      render(
        <EngineSummaryPanel
          engineSummary={createMockEngineSummary()}
          multiEngineViolations={[]}
        />
      );

      expect(screen.getByText('複数エンジンで検出された違反はありません')).toBeInTheDocument();
    });

    it('検出エンジン数が表示される', () => {
      render(
        <EngineSummaryPanel
          engineSummary={createMockEngineSummary()}
          multiEngineViolations={createMockMultiEngineViolations()}
        />
      );

      // 3エンジンで検出されたことを示すバッジ
      const violationItem = screen.getByTestId('multi-violation-color-contrast');
      expect(within(violationItem).getByText('3')).toBeInTheDocument();
    });
  });

  describe('エンジン名の日本語ラベル表示', () => {
    it('エンジン識別子が人間が読みやすい名前に変換される', () => {
      const summary: Record<ToolSource, { violations: number; passes: number }> = {
        'axe-core': { violations: 1, passes: 0 },
        pa11y: { violations: 0, passes: 0 },
        lighthouse: { violations: 0, passes: 0 },
        ibm: { violations: 1, passes: 0 },
        alfa: { violations: 0, passes: 0 },
        qualweb: { violations: 0, passes: 0 },
        wave: { violations: 0, passes: 0 },
        custom: { violations: 0, passes: 0 },
      };

      render(
        <EngineSummaryPanel
          engineSummary={summary}
          multiEngineViolations={[]}
        />
      );

      // 'ibm' -> 'IBM Equal Access'
      expect(screen.getByText('IBM Equal Access')).toBeInTheDocument();
      // 'alfa' -> 'Siteimprove Alfa'
      expect(screen.getByText('Siteimprove Alfa')).toBeInTheDocument();
    });
  });

  describe('ソートと表示順序', () => {
    it('違反数の多い順にエンジンがソートされる', () => {
      const summary: Record<ToolSource, { violations: number; passes: number }> = {
        'axe-core': { violations: 10, passes: 0 },
        pa11y: { violations: 5, passes: 0 },
        lighthouse: { violations: 3, passes: 0 },
        ibm: { violations: 0, passes: 0 },
        alfa: { violations: 0, passes: 0 },
        qualweb: { violations: 0, passes: 0 },
        wave: { violations: 0, passes: 0 },
        custom: { violations: 0, passes: 0 },
      };

      render(
        <EngineSummaryPanel
          engineSummary={summary}
          multiEngineViolations={[]}
          sortBy="violations"
        />
      );

      const rows = screen.getAllByTestId(/^engine-row-/);
      expect(rows[0]).toHaveAttribute('data-testid', 'engine-row-axe-core');
      expect(rows[1]).toHaveAttribute('data-testid', 'engine-row-pa11y');
      expect(rows[2]).toHaveAttribute('data-testid', 'engine-row-lighthouse');
    });
  });

  describe('compactモード', () => {
    it('compactモードでは詳細が折りたたまれる', () => {
      render(
        <EngineSummaryPanel
          engineSummary={createMockEngineSummary()}
          multiEngineViolations={createMockMultiEngineViolations()}
          compact
        />
      );

      // 複数エンジン違反セクションが非表示
      expect(screen.queryByText('複数エンジンで検出された違反')).not.toBeInTheDocument();
    });

    it('compactモードでも合計は表示される', () => {
      render(
        <EngineSummaryPanel
          engineSummary={createMockEngineSummary()}
          multiEngineViolations={[]}
          compact
        />
      );

      expect(screen.getByTestId('total-violations')).toBeInTheDocument();
    });
  });

  describe('アクセシビリティ', () => {
    it('テーブルにaria-labelが設定されている', () => {
      render(
        <EngineSummaryPanel
          engineSummary={createMockEngineSummary()}
          multiEngineViolations={[]}
        />
      );

      expect(screen.getByRole('table', { name: 'エンジン別検出サマリー' })).toBeInTheDocument();
    });

    it('違反数が赤系の色で表示される', () => {
      render(
        <EngineSummaryPanel
          engineSummary={createMockEngineSummary()}
          multiEngineViolations={[]}
        />
      );

      const axeRow = screen.getByTestId('engine-row-axe-core');
      const violationCell = within(axeRow).getByTestId('violation-count');
      expect(violationCell).toHaveClass('violation-count');
    });

    it('パス数が緑系の色で表示される', () => {
      render(
        <EngineSummaryPanel
          engineSummary={createMockEngineSummary()}
          multiEngineViolations={[]}
        />
      );

      const axeRow = screen.getByTestId('engine-row-axe-core');
      const passCell = within(axeRow).getByTestId('pass-count');
      expect(passCell).toHaveClass('pass-count');
    });
  });
});
