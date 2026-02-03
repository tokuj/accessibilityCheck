/**
 * キーボードナビゲーションテスター
 *
 * Requirements: 3.1 (wcag-coverage-expansion)
 * - Tabキーを順次押下してフォーカス可能要素のリストを生成
 * - 各要素のフォーカス順序を記録
 * - キーボードトラップの検出（同一要素への循環検知）を実装
 * - フォーカスインジケーターのCSS検証（outline/box-shadow/border）を実装
 * - フォーカススタイルがない場合に違反として報告
 */
import type { Page } from 'playwright';

/**
 * フォーカススタイル情報
 */
export interface FocusStyles {
  outline: string;
  boxShadow: string;
  border: string;
}

/**
 * フォーカス可能な要素の情報
 */
export interface FocusableElement {
  /** CSSセレクタ */
  selector: string;
  /** Tab順序（1から開始） */
  order: number;
  /** フォーカスインジケーターが有効かどうか */
  hasFocusIndicator: boolean;
  /** フォーカス時のスタイル */
  focusStyles: FocusStyles;
}

/**
 * キーボードトラップ情報
 */
export interface KeyboardTrap {
  /** トラップされた要素のセレクタ */
  selector: string;
  /** 説明 */
  description: string;
}

/**
 * フォーカス問題情報
 */
export interface FocusIssue {
  /** 問題がある要素のセレクタ */
  selector: string;
  /** 問題の説明 */
  issue: string;
}

/**
 * キーボードナビゲーションテスト結果
 */
export interface KeyboardTestResult {
  /** Tab順序どおりのフォーカス可能要素リスト */
  tabOrder: FocusableElement[];
  /** 検出されたキーボードトラップ */
  traps: KeyboardTrap[];
  /** フォーカスインジケーターの問題 */
  focusIssues: FocusIssue[];
}

/**
 * テストオプション
 */
export interface KeyboardTestOptions {
  /** 検査する最大要素数（デフォルト: 100） */
  maxElements?: number;
  /** トラップ検出の閾値（同じ要素に連続してフォーカスした回数、デフォルト: 3） */
  trapDetectionThreshold?: number;
}

/**
 * アクティブ要素の情報
 */
interface ActiveElementInfo {
  selector: string;
  tagName: string;
  focusStyles: FocusStyles;
}

/**
 * フォーカスインジケーターが有効かどうかを検証
 * outline、boxShadow、borderのいずれかが有効であればtrue
 */
export function validateFocusIndicator(styles: FocusStyles): boolean {
  const { outline, boxShadow, border } = styles;

  // outlineが有効かチェック
  if (outline && outline !== 'none' && outline !== '0' && outline !== '0px' && !outline.startsWith('0px ')) {
    return true;
  }

  // boxShadowが有効かチェック
  if (boxShadow && boxShadow !== 'none') {
    return true;
  }

  // borderが有効かチェック
  if (border && border !== 'none' && border !== '0' && border !== '0px' && !border.startsWith('0px ')) {
    return true;
  }

  return false;
}

/**
 * ページ内のフォーカス可能な全要素のセレクタを取得
 */
export async function getFocusableElements(page: Page): Promise<string[]> {
  const elements = await page.$$([
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(', '));

  const selectors: string[] = [];
  for (const element of elements) {
    const selector = await element.evaluate((el) => {
      // 一意なセレクタを生成
      if (el.id) {
        return `${el.tagName.toLowerCase()}#${el.id}`;
      }
      if (el.className && typeof el.className === 'string') {
        const classes = el.className.split(' ').filter(c => c).join('.');
        if (classes) {
          return `${el.tagName.toLowerCase()}.${classes}`;
        }
      }
      return el.tagName.toLowerCase();
    });
    selectors.push(selector);
  }

  return selectors;
}

/**
 * キーボードナビゲーションをテスト
 */
export async function testKeyboardNavigation(
  page: Page,
  options: KeyboardTestOptions = {}
): Promise<KeyboardTestResult> {
  const {
    maxElements = 100,
    trapDetectionThreshold = 3,
  } = options;

  const tabOrder: FocusableElement[] = [];
  const traps: KeyboardTrap[] = [];
  const focusIssues: FocusIssue[] = [];

  // 連続して同じ要素にフォーカスした回数をカウント
  let lastSelector: string | null = null;
  let sameElementCount = 0;
  let order = 0;

  // フォーカス可能な要素を順にテスト
  for (let i = 0; i < maxElements; i++) {
    // Tabキーを押下
    await page.keyboard.press('Tab');

    // 現在フォーカスされている要素の情報を取得
    const activeElementInfo = await page.evaluate((): ActiveElementInfo | null => {
      const el = document.activeElement;
      if (!el || el === document.body) {
        return null;
      }

      // セレクタを生成
      let selector: string;
      if (el.id) {
        selector = `${el.tagName.toLowerCase()}#${el.id}`;
      } else if (el.className && typeof el.className === 'string') {
        const classes = el.className.split(' ').filter(c => c).join('.');
        selector = classes ? `${el.tagName.toLowerCase()}.${classes}` : el.tagName.toLowerCase();
      } else {
        selector = el.tagName.toLowerCase();
      }

      // フォーカススタイルを取得
      const computedStyle = window.getComputedStyle(el);
      const focusStyles: FocusStyles = {
        outline: computedStyle.outline,
        boxShadow: computedStyle.boxShadow,
        border: computedStyle.border,
      };

      return {
        selector,
        tagName: el.tagName,
        focusStyles,
      };
    });

    // フォーカス可能な要素がなくなった場合は終了
    if (!activeElementInfo) {
      break;
    }

    const { selector, focusStyles } = activeElementInfo;

    // キーボードトラップの検出
    if (selector === lastSelector) {
      sameElementCount++;
      if (sameElementCount >= trapDetectionThreshold) {
        traps.push({
          selector,
          description: `キーボードトラップが検出されました: ${selector}に${sameElementCount}回連続でフォーカス`,
        });
        break; // トラップを検出したら終了
      }
    } else {
      sameElementCount = 1;
      lastSelector = selector;
    }

    // フォーカスインジケーターの検証
    const hasFocusIndicator = validateFocusIndicator(focusStyles);

    order++;
    tabOrder.push({
      selector,
      order,
      hasFocusIndicator,
      focusStyles,
    });

    // フォーカスインジケーターがない場合は問題として記録
    if (!hasFocusIndicator) {
      focusIssues.push({
        selector,
        issue: `フォーカスインジケーターがありません: outline、boxShadow、borderがすべて無効です`,
      });
    }
  }

  return {
    tabOrder,
    traps,
    focusIssues,
  };
}
