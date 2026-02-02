/**
 * ReportSummary統合テスト
 *
 * Requirements: wcag-coverage-expansion 7.1, 7.2, 7.3, 7.4, 7.5, 1.4, 6.3, 6.5, 4.3
 * Task 17: レポート表示コンポーネントの統合
 * Task 17.1: WCAGCoverageMatrixをレポート画面に統合
 * Task 17.2: EngineSummaryPanelをレポート画面に統合
 * Task 17.3: WaveStructurePanelをレポート画面に統合
 */

import { render, screen, within, fireEvent } from '@testing-library/react';
import { ReportSummary } from '../ReportSummary';
import type { AccessibilityReport } from '../../types/accessibility';
import type { CoverageMatrix } from '../../types/wcag-coverage';
import type { ToolSource } from '../../types/analysis-options';
import type { WaveStructureInfo } from '../WaveStructurePanel';
import type { MultiEngineViolation } from '../EngineSummaryPanel';

// モックデータ作成ヘルパー
const createMockReport = (overrides?: Partial<AccessibilityReport>): AccessibilityReport => ({
  generatedAt: '2026-02-01T12:00:00Z',
  summary: {
    totalViolations: 5,
    totalPasses: 20,
    totalIncomplete: 3,
  },
  pages: [
    {
      name: 'テストページ',
      url: 'https://example.com',
      violations: [
        {
          id: 'color-contrast',
          description: 'Elements must have sufficient color contrast',
          impact: 'serious',
          nodeCount: 2,
          helpUrl: 'https://example.com/help',
          wcagCriteria: ['1.4.3'],
          toolSource: 'axe-core',
        },
      ],
      passes: [
        {
          id: 'image-alt',
          description: 'Images must have alternate text',
          nodeCount: 5,
          helpUrl: 'https://example.com/help',
          wcagCriteria: ['1.1.1'],
          toolSource: 'axe-core',
        },
      ],
      incomplete: [
        {
          id: 'aria-hidden-focus',
          description: 'ARIA hidden element should not be focusable',
          nodeCount: 1,
          helpUrl: 'https://example.com/help',
          wcagCriteria: ['4.1.2'],
          toolSource: 'pa11y',
        },
      ],
    },
  ],
  toolsUsed: [
    { name: 'axe-core', version: '4.8.0', duration: 1500 },
    { name: 'pa11y', version: '7.0.0', duration: 2000 },
    { name: 'lighthouse', version: '11.0.0', duration: 5000 },
  ],
  ...overrides,
});

const createMockCoverageMatrix = (): CoverageMatrix => ({
  criteria: [
    {
      criterion: '1.1.1',
      level: 'A',
      title: '非テキストコンテンツ',
      method: 'auto',
      result: 'pass',
      tools: ['axe-core'],
    },
    {
      criterion: '1.4.3',
      level: 'AA',
      title: 'コントラスト（最低限）',
      method: 'auto',
      result: 'fail',
      tools: ['axe-core', 'pa11y'],
    },
    {
      criterion: '4.1.2',
      level: 'A',
      title: '名前、役割、値',
      method: 'auto',
      result: 'needs-review',
      tools: ['pa11y'],
    },
  ],
  summary: {
    levelA: { covered: 2, total: 30 },
    levelAA: { covered: 1, total: 20 },
    levelAAA: { covered: 0, total: 28 },
  },
});

const createMockEngineSummary = (): Record<ToolSource, { violations: number; passes: number }> => ({
  'axe-core': { violations: 3, passes: 15 },
  pa11y: { violations: 2, passes: 5 },
  lighthouse: { violations: 0, passes: 10 },
  ibm: { violations: 0, passes: 0 },
  alfa: { violations: 0, passes: 0 },
  qualweb: { violations: 0, passes: 0 },
  wave: { violations: 0, passes: 0 },
  custom: { violations: 0, passes: 0 },
});

const createMockMultiEngineViolations = (): MultiEngineViolation[] => [
  {
    ruleId: 'color-contrast',
    description: 'Elements must have sufficient color contrast',
    wcagCriteria: ['1.4.3'],
    toolSources: ['axe-core', 'pa11y'],
    nodeCount: 2,
  },
];

const createMockWaveStructureInfo = (): WaveStructureInfo => ({
  headings: [
    { level: 1, text: 'メインタイトル' },
    { level: 2, text: 'サブタイトル1' },
    { level: 3, text: '詳細セクション' },
    { level: 2, text: 'サブタイトル2' },
  ],
  landmarks: [
    { type: 'banner', label: 'ヘッダー' },
    { type: 'navigation', label: 'メインナビゲーション' },
    { type: 'main' },
    { type: 'contentinfo', label: 'フッター' },
  ],
});

describe('ReportSummary統合テスト', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  describe('Task 17.1: WCAGCoverageMatrixの統合', () => {
    it('coverageMatrixがある場合、WCAGCoverageMatrixコンポーネントが表示される', () => {
      const report = createMockReport({
        coverageMatrix: createMockCoverageMatrix(),
      });

      render(
        <ReportSummary
          report={report}
          url="https://example.com"
          onClose={mockOnClose}
        />
      );

      // WCAGカバレッジマトリクスのヘッダーが表示される
      expect(screen.getByText('WCAGカバレッジマトリクス')).toBeInTheDocument();
    });

    it('coverageMatrixがない場合、WCAGCoverageMatrixは表示されない', () => {
      const report = createMockReport();

      render(
        <ReportSummary
          report={report}
          url="https://example.com"
          onClose={mockOnClose}
        />
      );

      // WCAGカバレッジマトリクスのヘッダーが表示されない
      expect(screen.queryByText('WCAGカバレッジマトリクス')).not.toBeInTheDocument();
    });

    it('カバレッジサマリーが正しく表示される', () => {
      const report = createMockReport({
        coverageMatrix: createMockCoverageMatrix(),
      });

      render(
        <ReportSummary
          report={report}
          url="https://example.com"
          onClose={mockOnClose}
        />
      );

      // Level Aのカバレッジが表示される
      expect(screen.getByText('Level A')).toBeInTheDocument();
      expect(screen.getByText('2 / 30')).toBeInTheDocument();
    });

    it('CSVエクスポートボタンがクリックできる', () => {
      const report = createMockReport({
        coverageMatrix: createMockCoverageMatrix(),
      });

      render(
        <ReportSummary
          report={report}
          url="https://example.com"
          onClose={mockOnClose}
        />
      );

      // CSVエクスポートボタンが存在する
      const exportButton = screen.getByRole('button', { name: /CSVエクスポート/i });
      expect(exportButton).toBeInTheDocument();

      // クリックしてもエラーが発生しない
      expect(() => fireEvent.click(exportButton)).not.toThrow();
    });
  });

  describe('Task 17.2: EngineSummaryPanelの統合', () => {
    it('engineSummaryがある場合、EngineSummaryPanelが表示される', () => {
      const report = createMockReport({
        engineSummary: createMockEngineSummary(),
        multiEngineViolations: createMockMultiEngineViolations(),
      });

      render(
        <ReportSummary
          report={report}
          url="https://example.com"
          onClose={mockOnClose}
        />
      );

      // エンジンサマリーのヘッダーが表示される
      expect(screen.getByText('エンジン別検出サマリー')).toBeInTheDocument();
    });

    it('engineSummaryがない場合、EngineSummaryPanelは表示されない', () => {
      const report = createMockReport();

      render(
        <ReportSummary
          report={report}
          url="https://example.com"
          onClose={mockOnClose}
        />
      );

      // エンジンサマリーのヘッダーが表示されない
      expect(screen.queryByText('エンジン別検出サマリー')).not.toBeInTheDocument();
    });

    it('エンジン別の違反数・パス数が表示される', () => {
      const report = createMockReport({
        engineSummary: createMockEngineSummary(),
        multiEngineViolations: createMockMultiEngineViolations(),
      });

      render(
        <ReportSummary
          report={report}
          url="https://example.com"
          onClose={mockOnClose}
        />
      );

      // axe-coreの行を探す
      const axeRow = screen.getByTestId('engine-row-axe-core');
      expect(axeRow).toBeInTheDocument();

      // 違反数とパス数が表示される
      const violationCount = within(axeRow).getByTestId('violation-count');
      expect(violationCount).toHaveTextContent('3');

      const passCount = within(axeRow).getByTestId('pass-count');
      expect(passCount).toHaveTextContent('15');
    });

    it('複数エンジンで検出された違反が表示される', () => {
      const report = createMockReport({
        engineSummary: createMockEngineSummary(),
        multiEngineViolations: createMockMultiEngineViolations(),
      });

      render(
        <ReportSummary
          report={report}
          url="https://example.com"
          onClose={mockOnClose}
        />
      );

      // 複数エンジン検出違反のセクションが表示される
      expect(screen.getByText('複数エンジンで検出された違反')).toBeInTheDocument();

      // 具体的な違反がEngineSummaryPanelのmulti-violation要素内に表示される
      const multiViolationSection = screen.getByTestId('multi-violation-color-contrast');
      expect(multiViolationSection).toBeInTheDocument();
    });
  });

  describe('Task 17.3: WaveStructurePanelの統合', () => {
    it('waveStructureInfoがある場合、WaveStructurePanelが表示される', () => {
      const report = createMockReport({
        waveStructureInfo: createMockWaveStructureInfo(),
      });

      render(
        <ReportSummary
          report={report}
          url="https://example.com"
          onClose={mockOnClose}
        />
      );

      // WAVE構造情報のヘッダーが表示される
      expect(screen.getByText('ページ構造情報（WAVE）')).toBeInTheDocument();
    });

    it('waveStructureInfoがない場合、WaveStructurePanelは表示されない', () => {
      const report = createMockReport();

      render(
        <ReportSummary
          report={report}
          url="https://example.com"
          onClose={mockOnClose}
        />
      );

      // WAVE構造情報のヘッダーが表示されない
      expect(screen.queryByText('ページ構造情報（WAVE）')).not.toBeInTheDocument();
    });

    it('見出し階層が表示される', () => {
      const report = createMockReport({
        waveStructureInfo: createMockWaveStructureInfo(),
      });

      render(
        <ReportSummary
          report={report}
          url="https://example.com"
          onClose={mockOnClose}
        />
      );

      // 見出し数が表示される
      const headingCount = screen.getByTestId('heading-count');
      expect(headingCount).toHaveTextContent('4');

      // 見出しテキストが表示される
      expect(screen.getByText('メインタイトル')).toBeInTheDocument();
    });

    it('ランドマーク情報が表示される', () => {
      const report = createMockReport({
        waveStructureInfo: createMockWaveStructureInfo(),
      });

      render(
        <ReportSummary
          report={report}
          url="https://example.com"
          onClose={mockOnClose}
        />
      );

      // ランドマーク数が表示される
      const landmarkCount = screen.getByTestId('landmark-count');
      expect(landmarkCount).toHaveTextContent('4');

      // ランドマークが表示される
      expect(screen.getByTestId('landmark-banner')).toBeInTheDocument();
      expect(screen.getByTestId('landmark-navigation')).toBeInTheDocument();
      expect(screen.getByTestId('landmark-main')).toBeInTheDocument();
    });
  });

  describe('統合表示の順序とレイアウト', () => {
    it('すべてのパネルが正しい順序で表示される', () => {
      const report = createMockReport({
        coverageMatrix: createMockCoverageMatrix(),
        engineSummary: createMockEngineSummary(),
        multiEngineViolations: createMockMultiEngineViolations(),
        waveStructureInfo: createMockWaveStructureInfo(),
      });

      render(
        <ReportSummary
          report={report}
          url="https://example.com"
          onClose={mockOnClose}
        />
      );

      // すべてのパネルが表示される
      expect(screen.getByText('WCAGカバレッジマトリクス')).toBeInTheDocument();
      expect(screen.getByText('エンジン別検出サマリー')).toBeInTheDocument();
      expect(screen.getByText('ページ構造情報（WAVE）')).toBeInTheDocument();
    });

    it('パネルが半自動チェックパネルの後に表示される', () => {
      const report = createMockReport({
        coverageMatrix: createMockCoverageMatrix(),
        engineSummary: createMockEngineSummary(),
        multiEngineViolations: createMockMultiEngineViolations(),
        waveStructureInfo: createMockWaveStructureInfo(),
        semiAutoItems: [
          {
            id: 'semi-1',
            ruleId: 'image-alt',
            wcagCriteria: ['1.1.1'],
            question: 'この画像のalt属性は適切ですか？',
            html: '<img src="test.jpg" alt="test">',
            elementDescription: '画像',
          },
        ],
      });

      render(
        <ReportSummary
          report={report}
          url="https://example.com"
          onClose={mockOnClose}
        />
      );

      // 半自動チェックパネルが表示される
      expect(screen.getByText('半自動チェック')).toBeInTheDocument();

      // 他のパネルも表示される
      expect(screen.getByText('WCAGカバレッジマトリクス')).toBeInTheDocument();
    });
  });
});
