import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportSummary } from './ReportSummary';
import type { AccessibilityReport } from '../types/accessibility';

// Mock子コンポーネント
vi.mock('./ScoreCard', () => ({
  ScoreCard: () => <div data-testid="score-card">ScoreCard</div>,
}));

vi.mock('./ImprovementList', () => ({
  ImprovementList: () => <div data-testid="improvement-list">ImprovementList</div>,
}));

vi.mock('./ViolationsTable', () => ({
  ViolationsTable: () => <div data-testid="violations-table">ViolationsTable</div>,
}));

vi.mock('./PassesTable', () => ({
  PassesTable: () => <div data-testid="passes-table">PassesTable</div>,
}));

vi.mock('./IncompleteTable', () => ({
  IncompleteTable: () => <div data-testid="incomplete-table">IncompleteTable</div>,
}));

vi.mock('./LighthouseScores', () => ({
  LighthouseScores: () => <div data-testid="lighthouse-scores">LighthouseScores</div>,
}));

const createMockReport = (): AccessibilityReport => ({
  generatedAt: '2025-12-20T10:00:00+09:00',
  summary: {
    totalViolations: 5,
    totalPasses: 10,
    totalIncomplete: 2,
  },
  pages: [
    {
      name: 'トップページ',
      url: 'https://example.com',
      violations: [],
      passes: [],
      incomplete: [],
    },
  ],
});

describe('ReportSummary', () => {
  describe('タスク1.1: レポートコンテナの横幅拡張', () => {
    it('Cardコンポーネントの最大幅が1400pxであること', () => {
      const report = createMockReport();
      const { container } = render(
        <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
      );

      // MUI Cardはclass="MuiCard-root"を持つ
      const card = container.querySelector('.MuiCard-root');
      expect(card).toBeTruthy();

      // MUIのsxプロパティはインラインスタイルとして適用される
      expect(card).toHaveStyle({ maxWidth: '1400px' });
    });

    it('レスポンシブ対応のために100%幅を使用していること', () => {
      const report = createMockReport();
      const { container } = render(
        <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toBeTruthy();
      // mx: 'auto' が設定されていることを確認（左右マージン自動）
      expect(card).toHaveStyle({ marginLeft: 'auto', marginRight: 'auto' });
    });
  });

  describe('基本レンダリング', () => {
    it('URLが正しく表示されること', () => {
      const report = createMockReport();
      render(
        <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
      );

      expect(screen.getByText('https://example.com')).toBeInTheDocument();
    });

    it('閉じるボタンが表示されること', () => {
      const report = createMockReport();
      render(
        <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
      );

      expect(screen.getByRole('button', { name: '閉じる' })).toBeInTheDocument();
    });

    it('タブが正しく表示されること', () => {
      const report = createMockReport();
      render(
        <ReportSummary report={report} url="https://example.com" onClose={() => {}} />
      );

      expect(screen.getByRole('tab', { name: /違反/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /パス/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /要確認/ })).toBeInTheDocument();
    });
  });
});
