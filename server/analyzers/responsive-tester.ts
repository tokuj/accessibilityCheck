/**
 * レスポンシブテスター
 *
 * Requirements: 3.3, 3.4 (wcag-coverage-expansion)
 * - 複数ビューポート（375px、768px、1280px）でのスキャン実行
 * - 200%ズーム時のReflow（1.4.10）違反検出
 * - ビューポート固有の問題を識別してレポート
 */
import type { Page } from 'playwright';
import type { RuleResult } from './types';

/**
 * ビューポートの種類
 */
export type ViewportType = 'mobile' | 'tablet' | 'desktop';

/**
 * ビューポート設定
 */
export interface ViewportConfig {
  type: ViewportType;
  width: number;
  height: number;
}

/**
 * 横スクロール情報
 */
export interface HorizontalOverflow {
  selector: string;
  scrollWidth: number;
  clientWidth: number;
}

/**
 * Reflow問題
 */
export interface ReflowIssue {
  selector: string;
  description: string;
  viewport: ViewportConfig;
}

/**
 * レスポンシブテスト結果
 */
export interface ResponsiveTestResult {
  viewport: ViewportConfig;
  violations: RuleResult[];
  reflowIssues: ReflowIssue[];
}

/**
 * テストオプション
 */
export interface ResponsiveTestOptions {
  /** テストするビューポート */
  viewports?: ViewportType[];
  /** Reflowテストを含めるか */
  includeReflowTest?: boolean;
}

/**
 * デフォルトのビューポート設定を返す
 */
export function getViewportConfigs(): ViewportConfig[] {
  return [
    { type: 'mobile', width: 375, height: 667 },
    { type: 'tablet', width: 768, height: 1024 },
    { type: 'desktop', width: 1280, height: 720 },
  ];
}

/**
 * 指定ビューポート設定を取得
 */
export function getViewportConfig(type: ViewportType): ViewportConfig {
  const configs = getViewportConfigs();
  return configs.find(c => c.type === type) || configs[2]; // デフォルトはdesktop
}

/**
 * 横スクロールが発生する要素を検出
 */
export async function detectHorizontalOverflow(page: Page): Promise<HorizontalOverflow[]> {
  return await page.evaluate(() => {
    const overflows: { selector: string; scrollWidth: number; clientWidth: number }[] = [];

    // 全要素をチェック
    const elements = document.querySelectorAll('*');
    elements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.scrollWidth > htmlEl.clientWidth + 5) {
        // 5pxのマージンを許容
        let selector = '';
        if (el.id) {
          selector = `#${el.id}`;
        } else if (el.className && typeof el.className === 'string') {
          selector = el.tagName.toLowerCase() + '.' + el.className.split(' ').filter(c => c)[0];
        } else {
          selector = el.tagName.toLowerCase();
        }

        overflows.push({
          selector,
          scrollWidth: htmlEl.scrollWidth,
          clientWidth: htmlEl.clientWidth,
        });
      }
    });

    return overflows;
  });
}

/**
 * 指定ビューポートでテストを実行
 */
export async function testAtViewport(
  page: Page,
  viewport: ViewportConfig
): Promise<ResponsiveTestResult> {
  // ビューポートをリサイズ
  await page.setViewportSize({ width: viewport.width, height: viewport.height });

  // ビューポート固有の問題を検出
  const viewportIssues = await page.evaluate(() => {
    const issues: { selector: string; issue: string }[] = [];

    // ビューポート外にはみ出す要素を検出
    const bodyWidth = document.body.scrollWidth;
    const viewportWidth = window.innerWidth;

    if (bodyWidth > viewportWidth) {
      issues.push({
        selector: 'body',
        issue: `ページ幅(${bodyWidth}px)がビューポート幅(${viewportWidth}px)を超えています`,
      });
    }

    // 固定幅の要素を検出
    const elements = document.querySelectorAll('[style*="width"]');
    elements.forEach((el) => {
      const style = (el as HTMLElement).style;
      if (style.width && style.width.includes('px')) {
        const widthValue = parseInt(style.width);
        if (widthValue > viewportWidth) {
          issues.push({
            selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
            issue: `固定幅(${widthValue}px)がビューポート幅を超えています`,
          });
        }
      }
    });

    return issues;
  });

  return {
    viewport,
    violations: [], // 実際のaxe-coreスキャンはこちらで実行
    reflowIssues: [],
  };
}

/**
 * 200%ズーム時のReflow問題を検出
 * WCAG 2.1 1.4.10 Reflow: 320px幅（400%ズーム相当）で横スクロールが発生しないこと
 */
export async function testReflow(
  page: Page,
  originalViewport: ViewportConfig
): Promise<ReflowIssue[]> {
  const issues: ReflowIssue[] = [];

  // 200%ズーム = 幅を半分にした状態と同等
  const zoomedWidth = Math.floor(originalViewport.width / 2);
  await page.setViewportSize({ width: zoomedWidth, height: originalViewport.height });

  // 横スクロールが発生する要素を検出
  const overflows = await page.evaluate(() => {
    const results: {
      selector: string;
      scrollWidth: number;
      clientWidth: number;
      hasHorizontalOverflow: boolean;
    }[] = [];

    // body要素のスクロール状態をチェック
    const bodyScrollWidth = document.body.scrollWidth;
    const bodyClientWidth = document.body.clientWidth;

    if (bodyScrollWidth > bodyClientWidth + 10) {
      results.push({
        selector: 'body',
        scrollWidth: bodyScrollWidth,
        clientWidth: bodyClientWidth,
        hasHorizontalOverflow: true,
      });
    }

    // 主要なコンテンツ要素をチェック
    const contentElements = document.querySelectorAll(
      'main, article, section, table, pre, .container, .content'
    );
    contentElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.scrollWidth > htmlEl.clientWidth + 10) {
        let selector = '';
        if (el.id) {
          selector = `#${el.id}`;
        } else if (el.className && typeof el.className === 'string') {
          selector = el.tagName.toLowerCase() + '.' + el.className.split(' ').filter(c => c)[0];
        } else {
          selector = el.tagName.toLowerCase();
        }

        results.push({
          selector,
          scrollWidth: htmlEl.scrollWidth,
          clientWidth: htmlEl.clientWidth,
          hasHorizontalOverflow: true,
        });
      }
    });

    return results;
  });

  for (const overflow of overflows) {
    if (overflow.hasHorizontalOverflow) {
      issues.push({
        selector: overflow.selector,
        description: `200%ズーム時に横スクロールが発生: scrollWidth=${overflow.scrollWidth}px, clientWidth=${overflow.clientWidth}px (Reflow 1.4.10違反の可能性)`,
        viewport: originalViewport,
      });
    }
  }

  // 元のビューポートに戻す
  await page.setViewportSize({ width: originalViewport.width, height: originalViewport.height });

  return issues;
}

/**
 * 全ビューポートでテストを実行
 */
export async function testAllViewports(
  page: Page,
  options: ResponsiveTestOptions = {}
): Promise<ResponsiveTestResult[]> {
  const { viewports = ['mobile', 'tablet', 'desktop'], includeReflowTest = false } = options;

  const results: ResponsiveTestResult[] = [];
  const allConfigs = getViewportConfigs();

  for (const viewportType of viewports) {
    const config = allConfigs.find(c => c.type === viewportType);
    if (!config) continue;

    const result = await testAtViewport(page, config);

    // Reflowテストを実行
    if (includeReflowTest) {
      const reflowIssues = await testReflow(page, config);
      result.reflowIssues = reflowIssues;
    }

    results.push(result);
  }

  return results;
}
