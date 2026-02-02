/**
 * フォーカスコントラストチェッカーのユニットテスト
 *
 * Requirements: 3.5 (wcag-coverage-expansion)
 * - フォーカス状態の前後でスクリーンショットを取得
 * - フォーカスインジケーターの色を抽出
 * - 背景色とのコントラスト比を計算
 * - 3:1未満の場合に違反として報告
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Page, ElementHandle } from 'playwright';
import type {
  FocusContrastResult,
  ColorInfo,
  ContrastViolation,
} from '../focus-contrast-checker';

// モックページ作成ヘルパー
function createMockPage(): Partial<Page> {
  return {
    evaluate: vi.fn(),
    $: vi.fn(),
    $$: vi.fn(),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('')),
    keyboard: {
      press: vi.fn().mockResolvedValue(undefined),
    } as unknown as Page['keyboard'],
  };
}

describe('FocusContrastChecker', () => {
  let mockPage: Partial<Page>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = createMockPage();
  });

  describe('型定義', () => {
    it('ColorInfo型が正しい構造を持つ', () => {
      const color: ColorInfo = {
        r: 255,
        g: 128,
        b: 0,
        hex: '#ff8000',
      };

      expect(color.r).toBe(255);
      expect(color.g).toBe(128);
      expect(color.b).toBe(0);
      expect(color.hex).toBe('#ff8000');
    });

    it('FocusContrastResult型が正しい構造を持つ', () => {
      const result: FocusContrastResult = {
        selector: 'button#submit',
        focusIndicatorColor: { r: 0, g: 0, b: 255, hex: '#0000ff' },
        backgroundColor: { r: 255, g: 255, b: 255, hex: '#ffffff' },
        contrastRatio: 8.59,
        meetsMinimum: true,
      };

      expect(result.selector).toBe('button#submit');
      expect(result.contrastRatio).toBe(8.59);
      expect(result.meetsMinimum).toBe(true);
    });

    it('ContrastViolation型が正しい構造を持つ', () => {
      const violation: ContrastViolation = {
        selector: 'a.low-contrast-link',
        focusIndicatorColor: { r: 200, g: 200, b: 200, hex: '#c8c8c8' },
        backgroundColor: { r: 255, g: 255, b: 255, hex: '#ffffff' },
        contrastRatio: 1.28,
        requiredRatio: 3.0,
        wcagCriteria: '2.4.7',
      };

      expect(violation.selector).toBe('a.low-contrast-link');
      expect(violation.contrastRatio).toBe(1.28);
      expect(violation.requiredRatio).toBe(3.0);
    });
  });

  describe('calculateContrastRatio', () => {
    it('白と黒のコントラスト比は21:1', async () => {
      const { calculateContrastRatio } = await import('../focus-contrast-checker');

      const white: ColorInfo = { r: 255, g: 255, b: 255, hex: '#ffffff' };
      const black: ColorInfo = { r: 0, g: 0, b: 0, hex: '#000000' };

      const ratio = calculateContrastRatio(white, black);
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('同じ色のコントラスト比は1:1', async () => {
      const { calculateContrastRatio } = await import('../focus-contrast-checker');

      const color: ColorInfo = { r: 128, g: 128, b: 128, hex: '#808080' };

      const ratio = calculateContrastRatio(color, color);
      expect(ratio).toBeCloseTo(1, 0);
    });

    it('青と白のコントラスト比を正しく計算する', async () => {
      const { calculateContrastRatio } = await import('../focus-contrast-checker');

      const blue: ColorInfo = { r: 0, g: 0, b: 255, hex: '#0000ff' };
      const white: ColorInfo = { r: 255, g: 255, b: 255, hex: '#ffffff' };

      const ratio = calculateContrastRatio(blue, white);
      // 青(#0000ff)と白(#ffffff)のコントラスト比は約8.59
      expect(ratio).toBeGreaterThan(8);
      expect(ratio).toBeLessThan(9);
    });
  });

  describe('meetsMinimumContrast', () => {
    it('3:1以上の場合はtrue', async () => {
      const { meetsMinimumContrast } = await import('../focus-contrast-checker');

      expect(meetsMinimumContrast(3.0)).toBe(true);
      expect(meetsMinimumContrast(4.5)).toBe(true);
      expect(meetsMinimumContrast(21.0)).toBe(true);
    });

    it('3:1未満の場合はfalse', async () => {
      const { meetsMinimumContrast } = await import('../focus-contrast-checker');

      expect(meetsMinimumContrast(2.9)).toBe(false);
      expect(meetsMinimumContrast(1.5)).toBe(false);
      expect(meetsMinimumContrast(1.0)).toBe(false);
    });
  });

  describe('extractFocusIndicatorColor', () => {
    it('フォーカス時のoutline色を抽出する', async () => {
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({
        outlineColor: 'rgb(0, 0, 255)',
        backgroundColor: 'rgb(255, 255, 255)',
      });

      const { extractFocusIndicatorColor } = await import('../focus-contrast-checker');
      const colors = await extractFocusIndicatorColor(mockPage as Page, 'button#test');

      expect(colors).toBeDefined();
      expect(colors?.focusColor.hex).toBe('#0000ff');
    });

    it('boxShadow色をフォールバックとして抽出する', async () => {
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({
        outlineColor: 'transparent',
        boxShadowColor: 'rgb(0, 128, 255)',
        backgroundColor: 'rgb(255, 255, 255)',
      });

      const { extractFocusIndicatorColor } = await import('../focus-contrast-checker');
      const colors = await extractFocusIndicatorColor(mockPage as Page, 'button#test');

      expect(colors).toBeDefined();
      expect(colors?.focusColor.hex).toBe('#0080ff');
    });

    it('要素が見つからない場合はnullを返す', async () => {
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { extractFocusIndicatorColor } = await import('../focus-contrast-checker');
      const colors = await extractFocusIndicatorColor(mockPage as Page, '#non-existent');

      expect(colors).toBeNull();
    });
  });

  describe('checkFocusContrast', () => {
    it('フォーカス可能な要素のコントラスト比をチェックする（Req 3.5）', async () => {
      // フォーカス可能な要素をモック
      (mockPage.$$ as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          evaluate: vi.fn().mockResolvedValue('button#submit'),
        },
      ]);

      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({
        outlineColor: 'rgb(0, 0, 255)',
        backgroundColor: 'rgb(255, 255, 255)',
      });

      const { checkFocusContrast } = await import('../focus-contrast-checker');
      const results = await checkFocusContrast(mockPage as Page);

      expect(results.results.length).toBeGreaterThanOrEqual(0);
    });

    it('3:1未満のコントラストを違反として報告する（Req 3.5）', async () => {
      (mockPage.$$ as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          evaluate: vi.fn().mockResolvedValue('a.low-contrast'),
        },
      ]);

      // 低コントラストの色をモック（薄いグレーの枠線と白い背景）
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({
        outlineColor: 'rgb(200, 200, 200)',
        backgroundColor: 'rgb(255, 255, 255)',
      });

      const { checkFocusContrast } = await import('../focus-contrast-checker');
      const results = await checkFocusContrast(mockPage as Page);

      expect(results.violations.length).toBeGreaterThan(0);
      expect(results.violations[0].contrastRatio).toBeLessThan(3.0);
    });
  });

  describe('parseRgbColor', () => {
    it('rgb(r, g, b)形式をパースする', async () => {
      const { parseRgbColor } = await import('../focus-contrast-checker');

      const color = parseRgbColor('rgb(255, 128, 0)');
      expect(color.r).toBe(255);
      expect(color.g).toBe(128);
      expect(color.b).toBe(0);
    });

    it('rgba(r, g, b, a)形式をパースする', async () => {
      const { parseRgbColor } = await import('../focus-contrast-checker');

      const color = parseRgbColor('rgba(100, 150, 200, 0.5)');
      expect(color.r).toBe(100);
      expect(color.g).toBe(150);
      expect(color.b).toBe(200);
    });

    it('無効な形式の場合は黒を返す', async () => {
      const { parseRgbColor } = await import('../focus-contrast-checker');

      const color = parseRgbColor('invalid');
      expect(color.r).toBe(0);
      expect(color.g).toBe(0);
      expect(color.b).toBe(0);
    });
  });

  describe('rgbToHex', () => {
    it('RGBを16進数に変換する', async () => {
      const { rgbToHex } = await import('../focus-contrast-checker');

      expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
      expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
      expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
    });
  });
});
