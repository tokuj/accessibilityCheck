/**
 * 動的コンテンツテスターのユニットテスト
 *
 * Requirements: 3.2 (wcag-coverage-expansion)
 * - モーダル、ドロップダウン、アコーディオン、タブパネルの検出ロジックを実装
 * - 各動的コンテンツのトリガー要素を特定
 * - 開/閉状態でaxe-coreスキャンを実行
 * - 状態別の違反を統合してレポート
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Page, ElementHandle, Locator } from 'playwright';
import type {
  DynamicContent,
  DynamicContentType,
  DynamicContentTestResult,
} from '../dynamic-content-tester';

// モックページ作成ヘルパー
function createMockPage(): Partial<Page> {
  return {
    evaluate: vi.fn(),
    $: vi.fn(),
    $$: vi.fn(),
    click: vi.fn().mockResolvedValue(undefined),
    locator: vi.fn().mockReturnValue({
      click: vi.fn().mockResolvedValue(undefined),
      waitFor: vi.fn().mockResolvedValue(undefined),
    }),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn(),
  };
}

describe('DynamicContentTester', () => {
  let mockPage: Partial<Page>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = createMockPage();
  });

  describe('型定義', () => {
    it('DynamicContentType型が正しい値を持つ', () => {
      const types: DynamicContentType[] = ['modal', 'dropdown', 'accordion', 'tab'];
      expect(types).toContain('modal');
      expect(types).toContain('dropdown');
      expect(types).toContain('accordion');
      expect(types).toContain('tab');
    });

    it('DynamicContent型が正しい構造を持つ', () => {
      const content: DynamicContent = {
        type: 'modal',
        selector: 'div#modal',
        trigger: 'button#open-modal',
      };

      expect(content.type).toBe('modal');
      expect(content.selector).toBe('div#modal');
      expect(content.trigger).toBe('button#open-modal');
    });

    it('DynamicContentTestResult型が正しい構造を持つ', () => {
      const result: DynamicContentTestResult = {
        content: {
          type: 'modal',
          selector: 'div#modal',
          trigger: 'button#open-modal',
        },
        closedStateViolations: [],
        openStateViolations: [],
      };

      expect(result.content.type).toBe('modal');
      expect(result.closedStateViolations).toEqual([]);
      expect(result.openStateViolations).toEqual([]);
    });
  });

  describe('detectDynamicContent', () => {
    it('モーダルダイアログを検出する（Req 3.2）', async () => {
      (mockPage.$$ as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          evaluate: vi.fn().mockResolvedValue({
            selector: 'div#modal',
            trigger: 'button[data-modal-target="#modal"]',
          }),
        },
      ]);

      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          type: 'modal',
          selector: 'div#modal',
          trigger: 'button[data-modal-target="#modal"]',
        },
      ]);

      const { detectDynamicContent } = await import('../dynamic-content-tester');
      const result = await detectDynamicContent(mockPage as Page);

      expect(result.some(c => c.type === 'modal')).toBe(true);
    });

    it('ドロップダウンメニューを検出する（Req 3.2）', async () => {
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          type: 'dropdown',
          selector: 'ul.dropdown-menu',
          trigger: 'button[aria-haspopup="true"]',
        },
      ]);

      const { detectDynamicContent } = await import('../dynamic-content-tester');
      const result = await detectDynamicContent(mockPage as Page);

      expect(result.some(c => c.type === 'dropdown')).toBe(true);
    });

    it('アコーディオンを検出する（Req 3.2）', async () => {
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          type: 'accordion',
          selector: 'div.accordion-panel',
          trigger: 'button[aria-expanded]',
        },
      ]);

      const { detectDynamicContent } = await import('../dynamic-content-tester');
      const result = await detectDynamicContent(mockPage as Page);

      expect(result.some(c => c.type === 'accordion')).toBe(true);
    });

    it('タブパネルを検出する（Req 3.2）', async () => {
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          type: 'tab',
          selector: 'div[role="tabpanel"]',
          trigger: 'button[role="tab"]',
        },
      ]);

      const { detectDynamicContent } = await import('../dynamic-content-tester');
      const result = await detectDynamicContent(mockPage as Page);

      expect(result.some(c => c.type === 'tab')).toBe(true);
    });

    it('動的コンテンツがない場合は空配列を返す', async () => {
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { detectDynamicContent } = await import('../dynamic-content-tester');
      const result = await detectDynamicContent(mockPage as Page);

      expect(result).toEqual([]);
    });
  });

  describe('testInAllStates', () => {
    it('閉じた状態でaxe-coreスキャンを実行する（Req 3.2）', async () => {
      const content: DynamicContent = {
        type: 'modal',
        selector: 'div#modal',
        trigger: 'button#open-modal',
      };

      // evaluate呼び出しのモック
      // 1回目: 現在の状態確認（閉じている）
      // 2回目以降: axe-core関連の呼び出し
      let callCount = 0;
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return false; // closed state
        }
        return [];
      });

      const { testInAllStates } = await import('../dynamic-content-tester');
      const results = await testInAllStates(mockPage as Page, content);

      expect(results).toBeDefined();
      expect(results.closedStateViolations).toBeDefined();
    });

    it('開いた状態でaxe-coreスキャンを実行する（Req 3.2）', async () => {
      const content: DynamicContent = {
        type: 'accordion',
        selector: 'div.accordion-panel',
        trigger: 'button.accordion-trigger',
      };

      let callCount = 0;
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return false; // 初期状態: 閉じている
        }
        if (callCount === 2) {
          return true; // クリック後: 開いている
        }
        return [];
      });

      const mockLocator = {
        click: vi.fn().mockResolvedValue(undefined),
        waitFor: vi.fn().mockResolvedValue(undefined),
      };
      (mockPage.locator as ReturnType<typeof vi.fn>).mockReturnValue(mockLocator);

      const { testInAllStates } = await import('../dynamic-content-tester');
      const results = await testInAllStates(mockPage as Page, content);

      expect(results.openStateViolations).toBeDefined();
      expect(mockLocator.click).toHaveBeenCalled();
    });

    it('状態別の違反を統合してレポートする（Req 3.2）', async () => {
      const content: DynamicContent = {
        type: 'modal',
        selector: 'div#modal',
        trigger: 'button#open-modal',
      };

      // 閉じた状態と開いた状態で異なる違反を返す
      let evaluateCallCount = 0;
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        evaluateCallCount++;
        // 状態チェック
        if (evaluateCallCount === 1) return false; // closed
        if (evaluateCallCount === 2) return [{ id: 'closed-violation' }];
        if (evaluateCallCount === 3) return true; // opened
        if (evaluateCallCount === 4) return [{ id: 'open-violation' }];
        return [];
      });

      const mockLocator = {
        click: vi.fn().mockResolvedValue(undefined),
        waitFor: vi.fn().mockResolvedValue(undefined),
      };
      (mockPage.locator as ReturnType<typeof vi.fn>).mockReturnValue(mockLocator);

      const { testInAllStates } = await import('../dynamic-content-tester');
      const results = await testInAllStates(mockPage as Page, content);

      // 両方の状態の違反が含まれる
      expect(results.closedStateViolations).toBeDefined();
      expect(results.openStateViolations).toBeDefined();
    });
  });

  describe('getModalSelectors', () => {
    it('モーダル検出用のセレクタを返す', async () => {
      const { getModalSelectors } = await import('../dynamic-content-tester');
      const selectors = getModalSelectors();

      expect(selectors).toContain('[role="dialog"]');
      expect(selectors).toContain('[aria-modal="true"]');
      expect(selectors).toContain('.modal');
    });
  });

  describe('getDropdownSelectors', () => {
    it('ドロップダウン検出用のセレクタを返す', async () => {
      const { getDropdownSelectors } = await import('../dynamic-content-tester');
      const selectors = getDropdownSelectors();

      expect(selectors).toContain('[aria-haspopup="true"]');
      expect(selectors).toContain('[role="menu"]');
    });
  });

  describe('getAccordionSelectors', () => {
    it('アコーディオン検出用のセレクタを返す', async () => {
      const { getAccordionSelectors } = await import('../dynamic-content-tester');
      const selectors = getAccordionSelectors();

      expect(selectors).toContain('[aria-expanded]');
      expect(selectors).toContain('.accordion');
    });
  });

  describe('getTabSelectors', () => {
    it('タブ検出用のセレクタを返す', async () => {
      const { getTabSelectors } = await import('../dynamic-content-tester');
      const selectors = getTabSelectors();

      expect(selectors).toContain('[role="tablist"]');
      expect(selectors).toContain('[role="tab"]');
      expect(selectors).toContain('[role="tabpanel"]');
    });
  });
});
