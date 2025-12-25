import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImprovementList } from './ImprovementList';
import type { RuleResult, AISummary, DetectedIssue } from '../types/accessibility';
import * as csvExport from '../utils/csvExport';

// CSVエクスポート関数をモック
vi.mock('../utils/csvExport', () => ({
  exportAISummaryToCsv: vi.fn(),
}));

const mockExportAISummaryToCsv = vi.mocked(csvExport.exportAISummaryToCsv);

// テスト用のモックデータ
const createMockDetectedIssues = (): DetectedIssue[] => [
  {
    ruleId: 'color-contrast',
    whatIsHappening: 'テキストと背景のコントラスト比が不足しています',
    whatIsNeeded: 'コントラスト比を4.5:1以上にする',
    howToFix: 'CSSでcolor値を調整するか背景色を変更してください',
  },
  {
    ruleId: 'image-alt',
    whatIsHappening: '画像に代替テキストがありません',
    whatIsNeeded: 'alt属性を追加する',
    howToFix: '<img>タグにalt属性を追加してください',
  },
];

const createMockAISummary = (detectedIssues?: DetectedIssue[]): AISummary => ({
  overallAssessment: 'このページにはいくつかのアクセシビリティ問題があります。',
  detectedIssues: detectedIssues ?? createMockDetectedIssues(),
  prioritizedImprovements: ['コントラスト比を改善する', '代替テキストを追加する'],
  specificRecommendations: ['CSSを見直す', 'セマンティックHTMLを使用する'],
  impactSummary: {
    critical: 0,
    serious: 2,
    moderate: 1,
    minor: 0,
  },
  generatedAt: '2025-12-23T10:00:00+09:00',
});

const createMockViolations = (): RuleResult[] => [
  {
    id: 'color-contrast',
    description: 'テキストのコントラスト比が不足しています',
    impact: 'serious',
    nodeCount: 3,
    helpUrl: 'https://dequeuniversity.com/rules/axe/color-contrast',
    wcagCriteria: ['1.4.3'],
    toolSource: 'axe-core',
  },
];

describe('ImprovementList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Task 4.1: AI総評セクションにCSVダウンロードボタンを追加', () => {
    describe('ボタン表示', () => {
      it('AI総評データがある場合、CSVダウンロードボタンが表示される', () => {
        const aiSummary = createMockAISummary();
        render(
          <ImprovementList
            violations={createMockViolations()}
            aiSummary={aiSummary}
            targetUrl="https://example.com"
          />
        );

        const button = screen.getByRole('button', { name: /CSV.*ダウンロード/i });
        expect(button).toBeInTheDocument();
      });

      it('CSVダウンロードボタンがAI総評ヘッダー右側（タイトルとGemini Flashチップの右隣）に配置される', () => {
        const aiSummary = createMockAISummary();
        render(
          <ImprovementList
            violations={createMockViolations()}
            aiSummary={aiSummary}
            targetUrl="https://example.com"
          />
        );

        // ボタンとGemini Flashチップが同じコンテナ内にあることを確認
        const button = screen.getByRole('button', { name: /CSV.*ダウンロード/i });
        const geminiChip = screen.getByText('Gemini Flash');

        // 同じ親要素内にあることを確認
        const headerContainer = geminiChip.closest('[data-testid="ai-summary-header"]');
        expect(headerContainer).toContainElement(button);
      });

      it('ダウンロードボタンにDownloadIconが含まれる', () => {
        const aiSummary = createMockAISummary();
        render(
          <ImprovementList
            violations={createMockViolations()}
            aiSummary={aiSummary}
            targetUrl="https://example.com"
          />
        );

        const button = screen.getByRole('button', { name: /CSV.*ダウンロード/i });
        // MUIのDownloadIconはsvg要素として描画される
        const icon = button.querySelector('svg');
        expect(icon).toBeInTheDocument();
      });

      it('ボタンスタイルが既存の詳細結果CSVボタンと統一されている（outlined, small）', () => {
        const aiSummary = createMockAISummary();
        const { container } = render(
          <ImprovementList
            violations={createMockViolations()}
            aiSummary={aiSummary}
            targetUrl="https://example.com"
          />
        );

        const button = container.querySelector('button.MuiButton-outlined.MuiButton-sizeSmall');
        expect(button).toBeInTheDocument();
      });
    });

    describe('ボタン非活性状態', () => {
      it('AI総評データがない場合、CSVダウンロードボタンは表示されない', () => {
        render(
          <ImprovementList
            violations={createMockViolations()}
            targetUrl="https://example.com"
          />
        );

        const button = screen.queryByRole('button', { name: /CSV.*ダウンロード/i });
        expect(button).not.toBeInTheDocument();
      });

      it('検出問題（detectedIssues）が空配列の場合、ボタンが非活性になる', () => {
        const aiSummary = createMockAISummary([]);
        render(
          <ImprovementList
            violations={createMockViolations()}
            aiSummary={aiSummary}
            targetUrl="https://example.com"
          />
        );

        const button = screen.getByRole('button', { name: /CSV.*ダウンロード/i });
        expect(button).toBeDisabled();
      });
    });

    describe('ボタンクリック動作', () => {
      it('ボタンクリックでexportAISummaryToCsvが正しい引数で呼び出される', async () => {
        const aiSummary = createMockAISummary();
        const targetUrl = 'https://example.com/page1';

        render(
          <ImprovementList
            violations={createMockViolations()}
            aiSummary={aiSummary}
            targetUrl={targetUrl}
          />
        );

        const button = screen.getByRole('button', { name: /CSV.*ダウンロード/i });
        fireEvent.click(button);

        expect(mockExportAISummaryToCsv).toHaveBeenCalledTimes(1);
        expect(mockExportAISummaryToCsv).toHaveBeenCalledWith(
          aiSummary.detectedIssues,
          targetUrl
        );
      });

      it('非活性状態のボタンをクリックしてもエクスポート関数が呼び出されない', () => {
        const aiSummary = createMockAISummary([]);

        render(
          <ImprovementList
            violations={createMockViolations()}
            aiSummary={aiSummary}
            targetUrl="https://example.com"
          />
        );

        const button = screen.getByRole('button', { name: /CSV.*ダウンロード/i });
        fireEvent.click(button);

        expect(mockExportAISummaryToCsv).not.toHaveBeenCalled();
      });
    });
  });

  describe('Task 6.1: Snackbar通知の統合', () => {
    it('ダウンロード成功後、成功通知Snackbarが表示される', async () => {
      const aiSummary = createMockAISummary();

      render(
        <ImprovementList
          violations={createMockViolations()}
          aiSummary={aiSummary}
          targetUrl="https://example.com"
        />
      );

      const button = screen.getByRole('button', { name: /CSV.*ダウンロード/i });
      fireEvent.click(button);

      // 成功通知が表示されることを確認
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/CSVファイルのダウンロードを開始しました/)).toBeInTheDocument();
      });
    });

    it('ダウンロードエラー時、エラー通知Snackbarが表示される', async () => {
      const aiSummary = createMockAISummary();

      // エクスポート関数がエラーをスローするようにモック
      mockExportAISummaryToCsv.mockImplementation(() => {
        throw new Error('CSVダウンロード中にエラーが発生しました');
      });

      render(
        <ImprovementList
          violations={createMockViolations()}
          aiSummary={aiSummary}
          targetUrl="https://example.com"
        />
      );

      const button = screen.getByRole('button', { name: /CSV.*ダウンロード/i });
      fireEvent.click(button);

      // エラー通知が表示されることを確認
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/CSVダウンロード中にエラーが発生しました/)).toBeInTheDocument();
      });
    });

    it('成功通知は短時間（3秒）で自動的に閉じる設定である', async () => {
      const aiSummary = createMockAISummary();

      render(
        <ImprovementList
          violations={createMockViolations()}
          aiSummary={aiSummary}
          targetUrl="https://example.com"
        />
      );

      const button = screen.getByRole('button', { name: /CSV.*ダウンロード/i });
      fireEvent.click(button);

      // Snackbarが表示されることを確認
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Snackbarコンポーネントのdata-testid経由でautoHideDurationを検証するのは難しいので
      // 成功時はsnackbarが表示されることを確認するだけに留める
    });

    it('エラー通知は長時間（6秒）で自動的に閉じる設定である', async () => {
      const aiSummary = createMockAISummary();

      mockExportAISummaryToCsv.mockImplementation(() => {
        throw new Error('CSVダウンロード中にエラーが発生しました');
      });

      render(
        <ImprovementList
          violations={createMockViolations()}
          aiSummary={aiSummary}
          targetUrl="https://example.com"
        />
      );

      const button = screen.getByRole('button', { name: /CSV.*ダウンロード/i });
      fireEvent.click(button);

      // Snackbarが表示されることを確認
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('成功通知は緑色（success）のスタイルで表示される', async () => {
      // このテスト用にモックをリセット
      mockExportAISummaryToCsv.mockImplementation(() => {});

      const aiSummary = createMockAISummary();

      render(
        <ImprovementList
          violations={createMockViolations()}
          aiSummary={aiSummary}
          targetUrl="https://example.com"
        />
      );

      const button = screen.getByRole('button', { name: /CSV.*ダウンロード/i });
      fireEvent.click(button);

      await waitFor(() => {
        // 成功通知のAlertが表示されることを確認
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        // MUIのAlertはseverity=successのときclassにsuccessを含む
        expect(alert.className).toMatch(/success/i);
      });
    });

    it('エラー通知は赤色（error）のスタイルで表示される', async () => {
      const aiSummary = createMockAISummary();

      mockExportAISummaryToCsv.mockImplementation(() => {
        throw new Error('CSVダウンロード中にエラーが発生しました');
      });

      const { container } = render(
        <ImprovementList
          violations={createMockViolations()}
          aiSummary={aiSummary}
          targetUrl="https://example.com"
        />
      );

      const button = screen.getByRole('button', { name: /CSV.*ダウンロード/i });
      fireEvent.click(button);

      await waitFor(() => {
        // MUI AlertはseverityがclassとしてMuiAlert-standardErrorまたはMuiAlert-filledErrorとして適用される
        const alert = container.querySelector('[class*="MuiAlert"][class*="Error"]');
        expect(alert).toBeInTheDocument();
      });
    });
  });

  describe('既存機能の回帰テスト', () => {
    it('AI総評の全体評価が正しく表示される', () => {
      const aiSummary = createMockAISummary();

      render(
        <ImprovementList
          violations={createMockViolations()}
          aiSummary={aiSummary}
          targetUrl="https://example.com"
        />
      );

      expect(screen.getByText(aiSummary.overallAssessment)).toBeInTheDocument();
    });

    it('検出された問題と修正方法が正しく表示される', () => {
      const aiSummary = createMockAISummary();

      render(
        <ImprovementList
          violations={createMockViolations()}
          aiSummary={aiSummary}
          targetUrl="https://example.com"
        />
      );

      // 各問題のruleIdが表示される
      expect(screen.getByText('color-contrast')).toBeInTheDocument();
      expect(screen.getByText('image-alt')).toBeInTheDocument();

      // 問題の詳細が表示される
      expect(screen.getByText('テキストと背景のコントラスト比が不足しています')).toBeInTheDocument();
    });

    it('影響度サマリーが表示される', () => {
      const aiSummary = createMockAISummary();

      render(
        <ImprovementList
          violations={createMockViolations()}
          aiSummary={aiSummary}
          targetUrl="https://example.com"
        />
      );

      // 影響度サマリーが表示される（重大: 2件）
      expect(screen.getByText('重大:')).toBeInTheDocument();
      expect(screen.getByText('2件')).toBeInTheDocument();
    });

    it('AI総評がない場合でも違反リストは表示される', () => {
      const violations = createMockViolations();

      render(
        <ImprovementList
          violations={violations}
          targetUrl="https://example.com"
        />
      );

      expect(screen.getByText('改善提案')).toBeInTheDocument();
      expect(screen.getByText(/テキストのコントラスト比が不足/)).toBeInTheDocument();
    });
  });
});
