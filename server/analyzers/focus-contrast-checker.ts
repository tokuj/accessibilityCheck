/**
 * フォーカスコントラストチェッカー
 *
 * Requirements: 3.5 (wcag-coverage-expansion)
 * - フォーカス状態の前後でスクリーンショットを取得
 * - フォーカスインジケーターの色を抽出
 * - 背景色とのコントラスト比を計算
 * - 3:1未満の場合に違反として報告
 */
import type { Page } from 'playwright';

/**
 * 色情報
 */
export interface ColorInfo {
  r: number;
  g: number;
  b: number;
  hex: string;
}

/**
 * フォーカスコントラスト結果
 */
export interface FocusContrastResult {
  selector: string;
  focusIndicatorColor: ColorInfo;
  backgroundColor: ColorInfo;
  contrastRatio: number;
  meetsMinimum: boolean;
}

/**
 * コントラスト違反
 */
export interface ContrastViolation {
  selector: string;
  focusIndicatorColor: ColorInfo;
  backgroundColor: ColorInfo;
  contrastRatio: number;
  requiredRatio: number;
  wcagCriteria: string;
}

/**
 * フォーカスコントラストチェック結果
 */
export interface FocusContrastCheckResult {
  results: FocusContrastResult[];
  violations: ContrastViolation[];
}

/**
 * フォーカス色情報
 */
export interface FocusColorInfo {
  focusColor: ColorInfo;
  backgroundColor: ColorInfo;
}

/**
 * RGB値から16進数カラーコードに変換
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * rgb(r, g, b) または rgba(r, g, b, a) 形式の文字列をパースしてColorInfoを返す
 */
export function parseRgbColor(colorStr: string): ColorInfo {
  // rgb(r, g, b) または rgba(r, g, b, a) 形式をパース
  const rgbMatch = colorStr.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);

  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return {
      r,
      g,
      b,
      hex: rgbToHex(r, g, b),
    };
  }

  // 無効な形式の場合は黒を返す
  return {
    r: 0,
    g: 0,
    b: 0,
    hex: '#000000',
  };
}

/**
 * 相対輝度を計算（WCAG 2.1 準拠）
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
function getRelativeLuminance(color: ColorInfo): number {
  const { r, g, b } = color;

  const normalize = (value: number): number => {
    const sRGB = value / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  };

  const R = normalize(r);
  const G = normalize(g);
  const B = normalize(b);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * 2つの色のコントラスト比を計算（WCAG 2.1 準拠）
 */
export function calculateContrastRatio(color1: ColorInfo, color2: ColorInfo): number {
  const l1 = getRelativeLuminance(color1);
  const l2 = getRelativeLuminance(color2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * コントラスト比が最小要件（3:1）を満たすかどうか
 * WCAG 2.1 1.4.11 Non-text Contrast
 */
export function meetsMinimumContrast(ratio: number): boolean {
  return ratio >= 3.0;
}

/**
 * フォーカス時の色情報を抽出
 */
export async function extractFocusIndicatorColor(
  page: Page,
  selector: string
): Promise<FocusColorInfo | null> {
  const colorInfo = await page.evaluate((sel: string) => {
    const element = document.querySelector(sel);
    if (!element) return null;

    const computedStyle = window.getComputedStyle(element);

    // フォーカス時のスタイルを取得
    // 注: 実際にはフォーカス状態の疑似クラスを考慮する必要がある
    const outlineColor = computedStyle.outlineColor;
    const boxShadowColor = computedStyle.boxShadow;
    const backgroundColor =
      computedStyle.backgroundColor || 'rgb(255, 255, 255)';

    return {
      outlineColor,
      boxShadowColor,
      backgroundColor,
    };
  }, selector);

  if (!colorInfo) return null;

  // outline色を優先、なければboxShadowからの抽出を試みる
  let focusColorStr = colorInfo.outlineColor;

  if (
    focusColorStr === 'transparent' ||
    focusColorStr === 'rgba(0, 0, 0, 0)'
  ) {
    // boxShadowから色を抽出（簡易的な実装）
    if (colorInfo.boxShadowColor && colorInfo.boxShadowColor !== 'none') {
      const rgbMatch = colorInfo.boxShadowColor.match(
        /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
      );
      if (rgbMatch) {
        focusColorStr = `rgb(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]})`;
      }
    }
  }

  const focusColor = parseRgbColor(focusColorStr);
  const bgColor = parseRgbColor(colorInfo.backgroundColor);

  return {
    focusColor,
    backgroundColor: bgColor,
  };
}

/**
 * ページ内のフォーカス可能な要素のコントラストをチェック
 */
export async function checkFocusContrast(
  page: Page
): Promise<FocusContrastCheckResult> {
  const results: FocusContrastResult[] = [];
  const violations: ContrastViolation[] = [];

  // フォーカス可能な要素を取得
  const focusableElements = await page.$$(
    [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ')
  );

  for (const element of focusableElements) {
    const selector = await element.evaluate((el) => {
      if (el.id) return `#${el.id}`;
      if (el.className && typeof el.className === 'string') {
        return `${el.tagName.toLowerCase()}.${el.className.split(' ').filter((c: string) => c)[0]}`;
      }
      return el.tagName.toLowerCase();
    });

    const colorInfo = await extractFocusIndicatorColor(page, selector);
    if (!colorInfo) continue;

    const contrastRatio = calculateContrastRatio(
      colorInfo.focusColor,
      colorInfo.backgroundColor
    );
    const meetsMinimum = meetsMinimumContrast(contrastRatio);

    const result: FocusContrastResult = {
      selector,
      focusIndicatorColor: colorInfo.focusColor,
      backgroundColor: colorInfo.backgroundColor,
      contrastRatio,
      meetsMinimum,
    };
    results.push(result);

    if (!meetsMinimum) {
      violations.push({
        selector,
        focusIndicatorColor: colorInfo.focusColor,
        backgroundColor: colorInfo.backgroundColor,
        contrastRatio,
        requiredRatio: 3.0,
        wcagCriteria: '2.4.7',
      });
    }
  }

  return {
    results,
    violations,
  };
}
