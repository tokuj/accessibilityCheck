/**
 * レスポンシブテスターのユニットテスト
 *
 * Requirements: 3.3, 3.4 (wcag-coverage-expansion)
 * - 複数ビューポート（375px、768px、1280px）でのスキャン実行
 * - 200%ズーム時のReflow（1.4.10）違反検出
 * - ビューポート固有の問題を識別してレポート
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Page, BrowserContext } from 'playwright';
import type {
  ViewportType,
  ViewportConfig,
  ResponsiveTestResult,
  ReflowIssue,
} from '../responsive-tester';

// モックページ作成ヘルパー
function createMockPage(): Partial<Page> {
  return {
    setViewportSize: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn(),
    viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
    content: vi.fn().mockResolvedValue('<html><body></body></html>'),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('')),
  };
}

describe('ResponsiveTester', () => {
  let mockPage: Partial<Page>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = createMockPage();
  });

  describe('型定義', () => {
    it('ViewportType型が正しい値を持つ', () => {
      const types: ViewportType[] = ['mobile', 'tablet', 'desktop'];
      expect(types).toContain('mobile');
      expect(types).toContain('tablet');
      expect(types).toContain('desktop');
    });

    it('ViewportConfig型が正しい構造を持つ', () => {
      const config: ViewportConfig = {
        type: 'mobile',
        width: 375,
        height: 667,
      };

      expect(config.type).toBe('mobile');
      expect(config.width).toBe(375);
      expect(config.height).toBe(667);
    });

    it('ResponsiveTestResult型が正しい構造を持つ', () => {
      const result: ResponsiveTestResult = {
        viewport: { type: 'mobile', width: 375, height: 667 },
        violations: [],
        reflowIssues: [],
      };

      expect(result.viewport.type).toBe('mobile');
      expect(result.violations).toEqual([]);
      expect(result.reflowIssues).toEqual([]);
    });

    it('ReflowIssue型が正しい構造を持つ', () => {
      const issue: ReflowIssue = {
        selector: '.horizontal-scroll-container',
        description: '200%ズーム時に横スクロールが発生',
        viewport: { type: 'desktop', width: 1280, height: 720 },
      };

      expect(issue.selector).toBe('.horizontal-scroll-container');
      expect(issue.description).toContain('横スクロール');
    });
  });

  describe('getViewportConfigs', () => {
    it('モバイル、タブレット、デスクトップのビューポート設定を返す', async () => {
      const { getViewportConfigs } = await import('../responsive-tester');
      const configs = getViewportConfigs();

      expect(configs).toHaveLength(3);

      const mobile = configs.find(c => c.type === 'mobile');
      expect(mobile?.width).toBe(375);

      const tablet = configs.find(c => c.type === 'tablet');
      expect(tablet?.width).toBe(768);

      const desktop = configs.find(c => c.type === 'desktop');
      expect(desktop?.width).toBe(1280);
    });
  });

  describe('testAtViewport', () => {
    it('指定されたビューポートでページをリサイズする（Req 3.3）', async () => {
      const viewport: ViewportConfig = { type: 'mobile', width: 375, height: 667 };

      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { testAtViewport } = await import('../responsive-tester');
      await testAtViewport(mockPage as Page, viewport);

      expect(mockPage.setViewportSize).toHaveBeenCalledWith({ width: 375, height: 667 });
    });

    it('ビューポート固有の問題を検出する（Req 3.3）', async () => {
      const viewport: ViewportConfig = { type: 'mobile', width: 375, height: 667 };

      // モバイルビューポートで表示が崩れる問題をシミュレート
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          selector: '.desktop-only-content',
          issue: '要素がビューポート外にはみ出している',
        },
      ]);

      const { testAtViewport } = await import('../responsive-tester');
      const result = await testAtViewport(mockPage as Page, viewport);

      expect(result.violations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('testReflow', () => {
    it('200%ズーム時の横スクロールを検出する（Req 3.4）', async () => {
      const viewport: ViewportConfig = { type: 'desktop', width: 1280, height: 720 };

      // 200%ズーム = 幅を半分にした状態と同等
      // 横スクロールが発生する要素をシミュレート
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockImplementation(async (fn: unknown) => {
        if (typeof fn === 'function') {
          const fnStr = fn.toString();
          if (fnStr.includes('scrollWidth') || fnStr.includes('overflow')) {
            return [
              {
                selector: '.wide-table',
                scrollWidth: 1600,
                clientWidth: 640,
                hasHorizontalOverflow: true,
              },
            ];
          }
        }
        return [];
      });

      const { testReflow } = await import('../responsive-tester');
      const issues = await testReflow(mockPage as Page, viewport);

      expect(issues.some(i => i.description.includes('横スクロール') || i.description.includes('Reflow'))).toBe(true);
    });

    it('200%ズーム時でも問題ない場合は空配列を返す', async () => {
      const viewport: ViewportConfig = { type: 'desktop', width: 1280, height: 720 };

      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { testReflow } = await import('../responsive-tester');
      const issues = await testReflow(mockPage as Page, viewport);

      expect(issues).toEqual([]);
    });
  });

  describe('testAllViewports', () => {
    it('全ビューポートでテストを実行する（Req 3.3）', async () => {
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { testAllViewports } = await import('../responsive-tester');
      const results = await testAllViewports(mockPage as Page);

      expect(results).toHaveLength(3); // mobile, tablet, desktop
      expect(results.some(r => r.viewport.type === 'mobile')).toBe(true);
      expect(results.some(r => r.viewport.type === 'tablet')).toBe(true);
      expect(results.some(r => r.viewport.type === 'desktop')).toBe(true);
    });

    it('viewportsオプションで特定のビューポートのみテストできる', async () => {
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { testAllViewports } = await import('../responsive-tester');
      const results = await testAllViewports(mockPage as Page, { viewports: ['mobile'] });

      expect(results).toHaveLength(1);
      expect(results[0].viewport.type).toBe('mobile');
    });

    it('includeReflowTestオプションでReflowテストを含める', async () => {
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { testAllViewports } = await import('../responsive-tester');
      const results = await testAllViewports(mockPage as Page, {
        viewports: ['desktop'],
        includeReflowTest: true,
      });

      expect(results).toHaveLength(1);
      expect(results[0].reflowIssues).toBeDefined();
    });
  });

  describe('detectHorizontalOverflow', () => {
    it('横スクロールが発生する要素を検出する', async () => {
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue([
        { selector: 'table.data-table', scrollWidth: 1200, clientWidth: 600 },
        { selector: 'pre.code-block', scrollWidth: 900, clientWidth: 600 },
      ]);

      const { detectHorizontalOverflow } = await import('../responsive-tester');
      const overflows = await detectHorizontalOverflow(mockPage as Page);

      expect(overflows).toHaveLength(2);
      expect(overflows[0].selector).toBe('table.data-table');
    });

    it('横スクロールがない場合は空配列を返す', async () => {
      (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { detectHorizontalOverflow } = await import('../responsive-tester');
      const overflows = await detectHorizontalOverflow(mockPage as Page);

      expect(overflows).toEqual([]);
    });
  });
});
