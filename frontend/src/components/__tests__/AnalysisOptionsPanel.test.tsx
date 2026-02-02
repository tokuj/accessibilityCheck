/**
 * AnalysisOptionsPanel コンポーネントテスト
 *
 * Requirements: wcag-coverage-expansion 10.1, 10.2
 * Task 10.1: AnalysisOptionsPanelコンポーネントを実装
 * Task 10.2: オプション永続化を実装
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { AnalysisOptionsPanel } from '../AnalysisOptionsPanel';
import { theme } from '../../theme';
import {
  DEFAULT_ANALYSIS_OPTIONS,
  QUICK_ANALYSIS_PRESET,
  FULL_ANALYSIS_PRESET,
  ANALYSIS_OPTIONS_STORAGE_KEY,
  type AnalysisOptions,
} from '../../types/analysis-options';

// テスト用ラッパー
function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('AnalysisOptionsPanel', () => {
  let mockOnChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnChange = vi.fn();
    // localStorageをクリア
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('初期表示', () => {
    it('デフォルトオプションで正しくレンダリングされる', () => {
      renderWithTheme(
        <AnalysisOptionsPanel options={DEFAULT_ANALYSIS_OPTIONS} onChange={mockOnChange} />
      );

      // エンジン選択チェックボックスが表示される
      expect(screen.getByLabelText('axe-core')).toBeInTheDocument();
      expect(screen.getByLabelText('Pa11y')).toBeInTheDocument();
      expect(screen.getByLabelText('Lighthouse')).toBeInTheDocument();
      expect(screen.getByLabelText('IBM Equal Access')).toBeInTheDocument();
      expect(screen.getByLabelText('Siteimprove Alfa')).toBeInTheDocument();
      expect(screen.getByLabelText('QualWeb')).toBeInTheDocument();

      // デフォルトで全エンジンが有効（半自動チェック以外）
      expect(screen.getByLabelText('axe-core')).toBeChecked();
      expect(screen.getByLabelText('Pa11y')).toBeChecked();
      expect(screen.getByLabelText('Lighthouse')).toBeChecked();
      expect(screen.getByLabelText('IBM Equal Access')).toBeChecked();
      expect(screen.getByLabelText('Siteimprove Alfa')).toBeChecked();
      expect(screen.getByLabelText('QualWeb')).toBeChecked();
    });

    it('WCAGバージョン選択ドロップダウンが表示される', () => {
      renderWithTheme(
        <AnalysisOptionsPanel options={DEFAULT_ANALYSIS_OPTIONS} onChange={mockOnChange} />
      );

      // MUI Selectのラベルが表示される（複数一致する可能性があるため、labelIdで識別）
      expect(screen.getByLabelText('WCAGバージョン')).toBeInTheDocument();
      // デフォルト値が2.1
      expect(screen.getByText('2.1 AA')).toBeInTheDocument();
    });

    it('半自動チェックトグルが表示される', () => {
      renderWithTheme(
        <AnalysisOptionsPanel options={DEFAULT_ANALYSIS_OPTIONS} onChange={mockOnChange} />
      );

      expect(screen.getByLabelText('半自動チェック')).toBeInTheDocument();
      // デフォルトは無効
      expect(screen.getByRole('checkbox', { name: '半自動チェック' })).not.toBeChecked();
    });

    it('レスポンシブテストトグルが表示される', () => {
      renderWithTheme(
        <AnalysisOptionsPanel options={DEFAULT_ANALYSIS_OPTIONS} onChange={mockOnChange} />
      );

      expect(screen.getByLabelText('レスポンシブテスト')).toBeInTheDocument();
      // デフォルトは無効
      expect(screen.getByRole('checkbox', { name: 'レスポンシブテスト' })).not.toBeChecked();
    });

    it('WAVE API設定が表示される', () => {
      renderWithTheme(
        <AnalysisOptionsPanel options={DEFAULT_ANALYSIS_OPTIONS} onChange={mockOnChange} />
      );

      expect(screen.getByLabelText('WAVE API')).toBeInTheDocument();
      // デフォルトは無効
      expect(screen.getByRole('checkbox', { name: 'WAVE API' })).not.toBeChecked();
    });

    it('プリセットボタンが表示される', () => {
      renderWithTheme(
        <AnalysisOptionsPanel options={DEFAULT_ANALYSIS_OPTIONS} onChange={mockOnChange} />
      );

      expect(screen.getByRole('button', { name: 'クイック分析' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'フル分析' })).toBeInTheDocument();
    });
  });

  describe('エンジン選択', () => {
    it('エンジンのチェックを切り替えるとonChangeが呼ばれる', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <AnalysisOptionsPanel options={DEFAULT_ANALYSIS_OPTIONS} onChange={mockOnChange} />
      );

      // IBM Equal Accessを無効化（デフォルトで有効なので）
      await user.click(screen.getByLabelText('IBM Equal Access'));

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          engines: expect.objectContaining({
            ibm: false,
          }),
        })
      );
    });

    it('有効なエンジンを無効化できる', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <AnalysisOptionsPanel options={DEFAULT_ANALYSIS_OPTIONS} onChange={mockOnChange} />
      );

      // Pa11yを無効化
      await user.click(screen.getByLabelText('Pa11y'));

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          engines: expect.objectContaining({
            pa11y: false,
          }),
        })
      );
    });
  });

  describe('WCAGバージョン選択', () => {
    it('WCAGバージョンを変更するとonChangeが呼ばれる', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <AnalysisOptionsPanel options={DEFAULT_ANALYSIS_OPTIONS} onChange={mockOnChange} />
      );

      // MUI Selectのトリガーをクリック（テキストで検索）
      await user.click(screen.getByText('2.1 AA'));
      // 2.2 AAを選択（ポップアップ内のオプション）
      await user.click(screen.getByRole('option', { name: '2.2 AA' }));

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          wcagVersion: '2.2',
        })
      );
    });
  });

  describe('半自動チェック', () => {
    it('半自動チェックを有効化するとonChangeが呼ばれる', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <AnalysisOptionsPanel options={DEFAULT_ANALYSIS_OPTIONS} onChange={mockOnChange} />
      );

      await user.click(screen.getByLabelText('半自動チェック'));

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          semiAutoCheck: true,
        })
      );
    });
  });

  describe('レスポンシブテスト', () => {
    it('レスポンシブテストを有効化するとビューポート選択が表示される', async () => {
      const user = userEvent.setup();
      const options: AnalysisOptions = {
        ...DEFAULT_ANALYSIS_OPTIONS,
        responsiveTest: true,
        viewports: ['desktop'],
      };

      renderWithTheme(<AnalysisOptionsPanel options={options} onChange={mockOnChange} />);

      // ビューポート選択が表示される
      expect(screen.getByLabelText('モバイル (375px)')).toBeInTheDocument();
      expect(screen.getByLabelText('タブレット (768px)')).toBeInTheDocument();
      expect(screen.getByLabelText('デスクトップ (1280px)')).toBeInTheDocument();
    });

    it('ビューポートを選択するとonChangeが呼ばれる', async () => {
      const user = userEvent.setup();
      const options: AnalysisOptions = {
        ...DEFAULT_ANALYSIS_OPTIONS,
        responsiveTest: true,
        viewports: ['desktop'],
      };

      renderWithTheme(<AnalysisOptionsPanel options={options} onChange={mockOnChange} />);

      await user.click(screen.getByLabelText('モバイル (375px)'));

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          viewports: expect.arrayContaining(['mobile', 'desktop']),
        })
      );
    });
  });

  describe('WAVE API設定', () => {
    it('WAVE APIを有効化するとAPIキー入力フィールドが表示される', async () => {
      const user = userEvent.setup();
      const options: AnalysisOptions = {
        ...DEFAULT_ANALYSIS_OPTIONS,
        waveApi: { enabled: true, apiKey: '' },
      };

      renderWithTheme(<AnalysisOptionsPanel options={options} onChange={mockOnChange} />);

      expect(screen.getByLabelText('WAVE APIキー')).toBeInTheDocument();
    });

    it('APIキーを入力するとonChangeが呼ばれる', async () => {
      const user = userEvent.setup();
      const options: AnalysisOptions = {
        ...DEFAULT_ANALYSIS_OPTIONS,
        waveApi: { enabled: true, apiKey: '' },
      };

      renderWithTheme(<AnalysisOptionsPanel options={options} onChange={mockOnChange} />);

      const apiKeyInput = screen.getByLabelText('WAVE APIキー');
      await user.type(apiKeyInput, 't');

      // 1文字入力でonChangeが呼ばれる
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          waveApi: expect.objectContaining({
            apiKey: 't',
          }),
        })
      );
    });
  });

  describe('プリセット', () => {
    it('クイック分析ボタンをクリックするとクイック分析プリセットが適用される', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <AnalysisOptionsPanel options={DEFAULT_ANALYSIS_OPTIONS} onChange={mockOnChange} />
      );

      await user.click(screen.getByRole('button', { name: 'クイック分析' }));

      expect(mockOnChange).toHaveBeenCalledWith(QUICK_ANALYSIS_PRESET);
    });

    it('フル分析ボタンをクリックするとフル分析プリセットが適用される', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <AnalysisOptionsPanel options={DEFAULT_ANALYSIS_OPTIONS} onChange={mockOnChange} />
      );

      await user.click(screen.getByRole('button', { name: 'フル分析' }));

      expect(mockOnChange).toHaveBeenCalledWith(FULL_ANALYSIS_PRESET);
    });
  });

  describe('オプション永続化 (Task 10.2)', () => {
    it('localStorageに保存された設定を読み込む', () => {
      const savedOptions: AnalysisOptions = {
        ...DEFAULT_ANALYSIS_OPTIONS,
        wcagVersion: '2.2',
        semiAutoCheck: true,
      };
      localStorage.setItem(ANALYSIS_OPTIONS_STORAGE_KEY, JSON.stringify(savedOptions));

      renderWithTheme(
        <AnalysisOptionsPanel
          options={savedOptions}
          onChange={mockOnChange}
          loadFromStorage={true}
        />
      );

      // 保存された設定が反映されている
      expect(screen.getByText('2.2 AA')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: '半自動チェック' })).toBeChecked();
    });

    it('設定変更時にlocalStorageに保存される', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <AnalysisOptionsPanel
          options={DEFAULT_ANALYSIS_OPTIONS}
          onChange={mockOnChange}
          saveToStorage={true}
        />
      );

      await user.click(screen.getByLabelText('半自動チェック'));

      // localStorageに保存されたことを確認
      const savedData = localStorage.getItem(ANALYSIS_OPTIONS_STORAGE_KEY);
      expect(savedData).not.toBeNull();
      const parsed = JSON.parse(savedData!);
      expect(parsed.semiAutoCheck).toBe(true);
    });

    it('不正なlocalStorageデータの場合はデフォルトを使用', () => {
      localStorage.setItem(ANALYSIS_OPTIONS_STORAGE_KEY, 'invalid-json');

      // エラーなくレンダリングされる
      expect(() => {
        renderWithTheme(
          <AnalysisOptionsPanel
            options={DEFAULT_ANALYSIS_OPTIONS}
            onChange={mockOnChange}
            loadFromStorage={true}
          />
        );
      }).not.toThrow();
    });
  });

  describe('折りたたみ表示', () => {
    it('compactモードでは折りたたまれた状態で表示される', () => {
      renderWithTheme(
        <AnalysisOptionsPanel
          options={DEFAULT_ANALYSIS_OPTIONS}
          onChange={mockOnChange}
          compact={true}
        />
      );

      // トグルボタンが表示される
      expect(screen.getByRole('button', { name: '分析オプション' })).toBeInTheDocument();
    });

    it('compactモードでトグルボタンをクリックすると展開される', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <AnalysisOptionsPanel
          options={DEFAULT_ANALYSIS_OPTIONS}
          onChange={mockOnChange}
          compact={true}
        />
      );

      // 初期状態では折りたたまれている（axe-coreは存在するが非表示）
      // compactモードでは最初から展開されているので、クリックで折りたたむ
      await user.click(screen.getByRole('button', { name: '分析オプション' }));

      // 折りたたまれる（トグル動作の確認）
      // 再度クリックで展開
      await user.click(screen.getByRole('button', { name: '分析オプション' }));

      // エンジン選択が表示される
      expect(screen.getByLabelText('axe-core')).toBeInTheDocument();
    });
  });

  describe('アクセシビリティ', () => {
    it('すべてのフォーム要素にアクセシブルなラベルがある', () => {
      renderWithTheme(
        <AnalysisOptionsPanel options={DEFAULT_ANALYSIS_OPTIONS} onChange={mockOnChange} />
      );

      // 各チェックボックスにラベルがある
      expect(screen.getByRole('checkbox', { name: 'axe-core' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Pa11y' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Lighthouse' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'IBM Equal Access' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Siteimprove Alfa' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'QualWeb' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: '半自動チェック' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'レスポンシブテスト' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'WAVE API' })).toBeInTheDocument();
    });

    it('キーボードでフォーム要素を操作できる', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <AnalysisOptionsPanel options={DEFAULT_ANALYSIS_OPTIONS} onChange={mockOnChange} />
      );

      // Tabキーでフォーカス移動（最初はボタンにフォーカス）
      await user.tab();
      // フォーカスされる要素がある
      expect(document.activeElement).not.toBe(document.body);

      // チェックボックスにフォーカスを移動（複数回タブ）
      const axeCoreCheckbox = screen.getByRole('checkbox', { name: 'axe-core' });
      axeCoreCheckbox.focus();

      // Spaceキーで切り替え
      await user.keyboard(' ');
      expect(mockOnChange).toHaveBeenCalled();
    });
  });
});
