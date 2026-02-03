/**
 * キーボードナビゲーションテスターのユニットテスト
 *
 * Requirements: 3.1 (wcag-coverage-expansion)
 * - Tab順序の記録（全フォーカス可能要素のリスト生成）
 * - キーボードトラップの検出（同一要素への循環を検知）
 * - フォーカスインジケーターのCSS検証（outline/box-shadow/borderが有効か）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Page, Keyboard, ElementHandle } from 'playwright';
import type { FocusableElement, KeyboardTestResult } from '../keyboard-tester';

// Playwrightページのモック
function createMockPage(): Partial<Page> {
  const keyboardMock: Partial<Keyboard> = {
    press: vi.fn().mockResolvedValue(undefined),
  };

  return {
    keyboard: keyboardMock as Keyboard,
    evaluate: vi.fn(),
    $: vi.fn(),
    $$: vi.fn(),
    waitForSelector: vi.fn(),
    focus: vi.fn(),
  };
}

describe('KeyboardTester', () => {
  let mockPage: Partial<Page>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = createMockPage();
  });

  describe('型定義', () => {
    it('FocusableElement型が正しい構造を持つ', () => {
      const element: FocusableElement = {
        selector: 'button#submit',
        order: 1,
        hasFocusIndicator: true,
        focusStyles: {
          outline: '2px solid blue',
          boxShadow: 'none',
          border: '1px solid gray',
        },
      };

      expect(element.selector).toBe('button#submit');
      expect(element.order).toBe(1);
      expect(element.hasFocusIndicator).toBe(true);
      expect(element.focusStyles.outline).toBe('2px solid blue');
    });

    it('KeyboardTestResult型が正しい構造を持つ', () => {
      const result: KeyboardTestResult = {
        tabOrder: [],
        traps: [],
        focusIssues: [],
      };

      expect(result.tabOrder).toEqual([]);
      expect(result.traps).toEqual([]);
      expect(result.focusIssues).toEqual([]);
    });
  });

  describe('testKeyboardNavigation', () => {
    it('Tab順序を正しく記録する（Req 3.1）', async () => {
      // フォーカス可能な要素をシミュレート
      const focusableElements = [
        { selector: 'a#link1', tagName: 'A' },
        { selector: 'button#btn1', tagName: 'BUTTON' },
        { selector: 'input#input1', tagName: 'INPUT' },
      ];

      let tabIndex = -1;
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        // Tab押下後にインデックスが進んでいるので、現在の要素を返す
        if (tabIndex >= 0 && tabIndex < focusableElements.length) {
          const elem = focusableElements[tabIndex];
          return {
            selector: elem.selector,
            tagName: elem.tagName,
            focusStyles: {
              outline: '2px solid blue',
              boxShadow: 'none',
              border: '1px solid gray',
            },
          };
        }
        return null;
      });

      // Tab押下のシミュレート（押下時にインデックスを進める）
      (mockPage.keyboard!.press as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        tabIndex++;
      });

      const { testKeyboardNavigation } = await import('../keyboard-tester');
      const result = await testKeyboardNavigation(mockPage as Page, { maxElements: 3 });

      expect(result.tabOrder).toHaveLength(3);
      expect(result.tabOrder[0].selector).toBe('a#link1');
      expect(result.tabOrder[0].order).toBe(1);
      expect(result.tabOrder[1].selector).toBe('button#btn1');
      expect(result.tabOrder[1].order).toBe(2);
      expect(result.tabOrder[2].selector).toBe('input#input1');
      expect(result.tabOrder[2].order).toBe(3);
    });

    it('キーボードトラップを検出する（Req 3.1）', async () => {
      // モーダル内でトラップされるシナリオをシミュレート
      const trappedSelector = 'div#modal input#trapped';
      let tabCount = 0;

      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        // 常に同じ要素を返す（トラップ状態）
        return {
          selector: trappedSelector,
          tagName: 'INPUT',
          focusStyles: {
            outline: '2px solid blue',
            boxShadow: 'none',
            border: 'none',
          },
        };
      });

      (mockPage.keyboard!.press as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        tabCount++;
      });

      const { testKeyboardNavigation } = await import('../keyboard-tester');
      const result = await testKeyboardNavigation(mockPage as Page, { trapDetectionThreshold: 3 });

      // トラップが検出されることを確認
      expect(result.traps.length).toBeGreaterThan(0);
      expect(result.traps[0].selector).toBe(trappedSelector);
      expect(result.traps[0].description).toContain('キーボードトラップ');
    });

    it('フォーカスインジケーターのCSS検証を行う（Req 3.1）', async () => {
      let tabIndex = -1;
      const elements = [
        {
          selector: 'button#no-focus-style',
          tagName: 'BUTTON',
          focusStyles: {
            outline: 'none',
            boxShadow: 'none',
            border: 'none',
          },
        },
        {
          selector: 'button#with-focus-style',
          tagName: 'BUTTON',
          focusStyles: {
            outline: '2px solid blue',
            boxShadow: 'none',
            border: '1px solid gray',
          },
        },
      ];

      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        if (tabIndex >= 0 && tabIndex < elements.length) {
          return elements[tabIndex];
        }
        return null;
      });

      (mockPage.keyboard!.press as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        tabIndex++;
      });

      const { testKeyboardNavigation } = await import('../keyboard-tester');
      const result = await testKeyboardNavigation(mockPage as Page, { maxElements: 2 });

      // フォーカスインジケーターがない要素が問題として報告される
      expect(result.focusIssues.length).toBeGreaterThan(0);
      expect(result.focusIssues.some(issue => issue.selector === 'button#no-focus-style')).toBe(true);
      expect(result.focusIssues.some(issue => issue.issue.includes('フォーカスインジケーター'))).toBe(true);

      // フォーカスインジケーターがある要素は問題なし
      expect(result.tabOrder.some(elem => elem.selector === 'button#with-focus-style' && elem.hasFocusIndicator === true)).toBe(true);
    });

    it('outline、boxShadow、borderのいずれかがあればフォーカスインジケーターあり', async () => {
      let tabIndex = -1;
      const elements = [
        {
          selector: 'button#outline-only',
          focusStyles: { outline: '2px solid blue', boxShadow: 'none', border: 'none' },
        },
        {
          selector: 'button#boxshadow-only',
          focusStyles: { outline: 'none', boxShadow: '0 0 5px blue', border: 'none' },
        },
        {
          selector: 'button#border-only',
          focusStyles: { outline: 'none', boxShadow: 'none', border: '2px solid blue' },
        },
      ];

      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        if (tabIndex >= 0 && tabIndex < elements.length) {
          return { ...elements[tabIndex], tagName: 'BUTTON' };
        }
        return null;
      });

      (mockPage.keyboard!.press as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        tabIndex++;
      });

      const { testKeyboardNavigation } = await import('../keyboard-tester');
      const result = await testKeyboardNavigation(mockPage as Page, { maxElements: 3 });

      // 全ての要素にフォーカスインジケーターがある
      expect(result.tabOrder).toHaveLength(3);
      result.tabOrder.forEach(elem => {
        expect(elem.hasFocusIndicator).toBe(true);
      });
      expect(result.focusIssues).toHaveLength(0);
    });

    it('フォーカス可能な要素がない場合は空のリストを返す', async () => {
      // 即座にnullを返す（フォーカス可能な要素なし）
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { testKeyboardNavigation } = await import('../keyboard-tester');
      const result = await testKeyboardNavigation(mockPage as Page);

      expect(result.tabOrder).toHaveLength(0);
      expect(result.traps).toHaveLength(0);
      expect(result.focusIssues).toHaveLength(0);
    });

    it('maxElementsオプションで検査する最大要素数を制限できる', async () => {
      let tabIndex = -1;
      const elements = Array.from({ length: 100 }, (_, i) => ({
        selector: `button#btn${i}`,
        tagName: 'BUTTON',
        focusStyles: { outline: '2px solid blue', boxShadow: 'none', border: 'none' },
      }));

      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        if (tabIndex >= 0 && tabIndex < elements.length) {
          return elements[tabIndex];
        }
        return null;
      });

      (mockPage.keyboard!.press as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        tabIndex++;
      });

      const { testKeyboardNavigation } = await import('../keyboard-tester');
      const result = await testKeyboardNavigation(mockPage as Page, { maxElements: 10 });

      expect(result.tabOrder).toHaveLength(10);
    });
  });

  describe('validateFocusIndicator', () => {
    it('有効なoutlineスタイルを検出する', async () => {
      const { validateFocusIndicator } = await import('../keyboard-tester');

      const styles = {
        outline: '2px solid blue',
        boxShadow: 'none',
        border: 'none',
      };

      expect(validateFocusIndicator(styles)).toBe(true);
    });

    it('"none"や"0px"のoutlineを無効として検出する', async () => {
      const { validateFocusIndicator } = await import('../keyboard-tester');

      expect(validateFocusIndicator({ outline: 'none', boxShadow: 'none', border: 'none' })).toBe(false);
      expect(validateFocusIndicator({ outline: '0px', boxShadow: 'none', border: 'none' })).toBe(false);
      expect(validateFocusIndicator({ outline: '0', boxShadow: 'none', border: 'none' })).toBe(false);
    });

    it('有効なboxShadowスタイルを検出する', async () => {
      const { validateFocusIndicator } = await import('../keyboard-tester');

      const styles = {
        outline: 'none',
        boxShadow: '0 0 5px 2px rgba(0, 0, 255, 0.5)',
        border: 'none',
      };

      expect(validateFocusIndicator(styles)).toBe(true);
    });

    it('有効なborderスタイルを検出する', async () => {
      const { validateFocusIndicator } = await import('../keyboard-tester');

      const styles = {
        outline: 'none',
        boxShadow: 'none',
        border: '2px solid blue',
      };

      expect(validateFocusIndicator(styles)).toBe(true);
    });
  });

  describe('getFocusableElements', () => {
    it('フォーカス可能な全要素のセレクタリストを返す', async () => {
      (mockPage.$$ as ReturnType<typeof vi.fn>).mockResolvedValue([
        { evaluate: vi.fn().mockResolvedValue('a#link1') },
        { evaluate: vi.fn().mockResolvedValue('button#btn1') },
        { evaluate: vi.fn().mockResolvedValue('input#input1') },
      ]);

      const { getFocusableElements } = await import('../keyboard-tester');
      const selectors = await getFocusableElements(mockPage as Page);

      expect(selectors).toHaveLength(3);
      expect(selectors).toContain('a#link1');
      expect(selectors).toContain('button#btn1');
      expect(selectors).toContain('input#input1');
    });
  });
});
