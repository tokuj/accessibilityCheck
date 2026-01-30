import * as fs from 'fs';
import * as path from 'path';
import type { Page, ElementHandle } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import type { AnalyzerResult, RuleResult, NodeInfo, BoundingBox } from './types';
import { extractWcagCriteria } from './types';
import { getAdBlockingConfig } from '../config';
import {
  createAnalyzerTiming,
  completeAnalyzerTiming,
  logAnalyzerStart,
  logAnalyzerComplete,
} from '../utils';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * axe-coreソースと日本語ロケールを読み込み、カスタムソースを生成する
 * @requirement 7.1 - axe-core日本語ロケール適用
 */
let axeSourceWithJaLocale: string | null = null;

function getAxeSourceWithJaLocale(): string {
  if (axeSourceWithJaLocale) {
    return axeSourceWithJaLocale;
  }

  try {
    // axe-coreソースを読み込み
    const axeCorePath = require.resolve('axe-core/axe.min.js');
    const axeCoreSource = fs.readFileSync(axeCorePath, 'utf8');

    // 日本語ロケールを読み込み
    const jaLocalePath = path.join(path.dirname(axeCorePath), 'locales', 'ja.json');
    const jaLocale = JSON.parse(fs.readFileSync(jaLocalePath, 'utf8'));

    // ロケール設定を含むカスタムソースを生成
    axeSourceWithJaLocale = `
      ${axeCoreSource}
      axe.configure({ locale: ${JSON.stringify(jaLocale)} });
    `;

    return axeSourceWithJaLocale;
  } catch (error) {
    console.warn('日本語ロケールの読み込みに失敗しました。デフォルト（英語）を使用します:', error);
    return '';
  }
}

export const AXE_VERSION = '4.11.0'; // @axe-core/playwright version

/** HTML抜粋の最大文字数 @requirement 1.3 */
const MAX_HTML_LENGTH = 200;

/** contextHtml抜粋の最大文字数 @requirement 6.5 */
const MAX_CONTEXT_HTML_LENGTH = 500;

/**
 * axe-coreのノード情報をNodeInfo型に変換する
 * @requirement 1.3 - バックエンドでノード情報を抽出
 */
function extractNodeInfo(
  nodes: Array<{ target: string[]; html: string; failureSummary?: string }>
): NodeInfo[] {
  return nodes.map((node) => {
    // target配列を " > " で結合して単一のCSSセレクタ文字列にする
    const target = node.target.join(' > ');

    // HTML抜粋を200文字に切り詰める
    let html = node.html;
    if (html.length > MAX_HTML_LENGTH) {
      html = html.substring(0, MAX_HTML_LENGTH - 3) + '...';
    }

    return {
      target,
      html,
      failureSummary: node.failureSummary,
    };
  });
}

/**
 * axe-core分析オプションの型定義
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */
export interface AxeAnalyzerOptions {
  /** legacyModeを有効にするか（デフォルト: true） */
  legacyMode?: boolean;

  /** 広告要素を除外するか（デフォルト: true） */
  excludeAds?: boolean;

  /** 追加の除外セレクタ */
  additionalExcludes?: readonly string[];

  /** color-contrastルールを無効化するか（デフォルト: false） */
  disableColorContrast?: boolean;
}

/**
 * axe-coreを使用してアクセシビリティ分析を実行する
 *
 * @param page - Playwrightページインスタンス
 * @param options - 分析オプション
 * @returns 分析結果
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */
export async function analyzeWithAxe(
  page: Page,
  options: AxeAnalyzerOptions = {}
): Promise<AnalyzerResult> {
  const startTime = Date.now();
  const adBlockingConfig = getAdBlockingConfig();
  const url = page.url();

  // Req 7.2: 分析開始ログを記録
  logAnalyzerStart('axe-core', url);
  const timing = createAnalyzerTiming('axe-core', url);

  // オプションのデフォルト値を設定
  const {
    legacyMode = true,
    excludeAds = true,
    additionalExcludes = [],
    disableColorContrast = false,
  } = options;

  // AxeBuilderを構築（日本語ロケール適用）@requirement 7.1
  const jaLocaleSource = getAxeSourceWithJaLocale();
  let axeBuilder = jaLocaleSource
    ? new AxeBuilder({ page, axeSource: jaLocaleSource }).withTags(WCAG_TAGS)
    : new AxeBuilder({ page }).withTags(WCAG_TAGS);

  // Req 1.1: setLegacyMode(true)をデフォルトで有効にする
  axeBuilder = axeBuilder.setLegacyMode(legacyMode);

  // Req 1.2, 1.3: 広告関連セレクタを除外する
  if (excludeAds && adBlockingConfig.enabled) {
    for (const selector of adBlockingConfig.adSelectors) {
      axeBuilder = axeBuilder.exclude(selector);
    }
  }

  // 追加の除外セレクタを適用
  for (const selector of additionalExcludes) {
    axeBuilder = axeBuilder.exclude(selector);
  }

  // Req 1.5: color-contrastルールの無効化オプション
  if (disableColorContrast) {
    axeBuilder = axeBuilder.disableRules('color-contrast');
  }

  const scanResults = await axeBuilder.analyze();

  // @requirement 1.3, 2.1: ノード情報を抽出して結果に含める
  const violations: RuleResult[] = scanResults.violations.map((v) => ({
    id: v.id,
    description: v.description,
    impact: v.impact as 'critical' | 'serious' | 'moderate' | 'minor' | undefined,
    nodeCount: v.nodes.length,
    helpUrl: v.helpUrl,
    wcagCriteria: extractWcagCriteria(v.tags),
    toolSource: 'axe-core' as const,
    nodes: extractNodeInfo(v.nodes),
  }));

  const passes: RuleResult[] = scanResults.passes.map((p) => ({
    id: p.id,
    description: p.description,
    nodeCount: p.nodes.length,
    helpUrl: p.helpUrl,
    wcagCriteria: extractWcagCriteria(p.tags),
    toolSource: 'axe-core' as const,
    nodes: extractNodeInfo(p.nodes),
  }));

  const incomplete: RuleResult[] = scanResults.incomplete.map((i) => ({
    id: i.id,
    description: i.description,
    impact: i.impact as 'critical' | 'serious' | 'moderate' | 'minor' | undefined,
    nodeCount: i.nodes.length,
    helpUrl: i.helpUrl,
    wcagCriteria: extractWcagCriteria(i.tags),
    toolSource: 'axe-core' as const,
    nodes: extractNodeInfo(i.nodes),
  }));

  const duration = Date.now() - startTime;

  // Req 7.2, 7.3: 分析完了ログを記録（60秒超過警告を含む）
  const completedTiming = completeAnalyzerTiming(timing, 'success');
  logAnalyzerComplete(completedTiming);

  return {
    violations,
    passes,
    incomplete,
    duration,
  };
}

/**
 * 要素からXPathを取得する
 * @requirement 6.4 - XPath表示とコピー機能
 */
async function getElementXPath(element: ElementHandle): Promise<string | undefined> {
  try {
    return await element.evaluate((el) => {
      const getXPath = (element: Element): string => {
        if (element.id) {
          return `//*[@id="${element.id}"]`;
        }
        if (element === document.body) {
          return '/html/body';
        }
        const parent = element.parentElement;
        if (!parent) {
          return '/' + element.tagName.toLowerCase();
        }
        const siblings = Array.from(parent.children).filter(
          (child) => child.tagName === element.tagName
        );
        const index = siblings.indexOf(element) + 1;
        const tagName = element.tagName.toLowerCase();
        const suffix = siblings.length > 1 ? `[${index}]` : '';
        return getXPath(parent) + '/' + tagName + suffix;
      };
      return getXPath(el);
    });
  } catch {
    return undefined;
  }
}

/**
 * 要素の周辺HTML（親要素のouterHTML）を取得する
 * @requirement 6.5 - 周辺HTMLコンテキスト表示
 */
async function getContextHtml(element: ElementHandle): Promise<string | undefined> {
  try {
    const html = await element.evaluate((el) => {
      const parent = el.parentElement;
      if (!parent) return el.outerHTML;
      return parent.outerHTML;
    });
    // 長すぎる場合は切り詰め
    if (html && html.length > MAX_CONTEXT_HTML_LENGTH) {
      return html.substring(0, MAX_CONTEXT_HTML_LENGTH - 3) + '...';
    }
    return html;
  } catch {
    return undefined;
  }
}

/**
 * 要素がビューポート内に表示されているかどうかを判定する
 * @requirement 6.7 - 非表示要素の明示
 */
function isElementHidden(
  boundingBox: BoundingBox | null,
  viewportSize: { width: number; height: number } | null
): boolean | undefined {
  if (!boundingBox) {
    // display:none や visibility:hidden の場合
    return true;
  }
  if (!viewportSize) {
    return undefined;
  }
  // 要素がビューポート外にあるかどうかを判定
  const isOutOfViewport =
    boundingBox.x + boundingBox.width < 0 ||
    boundingBox.y + boundingBox.height < 0 ||
    boundingBox.x > viewportSize.width ||
    boundingBox.y > viewportSize.height;
  return isOutOfViewport;
}

/**
 * タグ名→日本語ラベル変換テーブル
 * @requirement 7.7 - 要素説明でタグ名を日本語ラベルで表示
 */
const TAG_LABELS: Record<string, string> = {
  'a': 'リンク',
  'img': '画像',
  'button': 'ボタン',
  'input': '入力欄',
  'select': 'セレクトボックス',
  'textarea': 'テキストエリア',
  'form': 'フォーム',
  'table': 'テーブル',
  'nav': 'ナビゲーション',
  'header': 'ヘッダー',
  'footer': 'フッター',
  'main': 'メインコンテンツ',
  'section': 'セクション',
  'article': '記事',
  'aside': 'サイドバー',
  'h1': '見出し1',
  'h2': '見出し2',
  'h3': '見出し3',
  'h4': '見出し4',
  'h5': '見出し5',
  'h6': '見出し6',
  'p': '段落',
  'ul': 'リスト',
  'ol': '番号付きリスト',
  'li': 'リスト項目',
  'div': 'ブロック要素',
  'span': 'インライン要素',
  'iframe': 'インラインフレーム',
  'video': '動画',
  'audio': '音声',
  'label': 'ラベル',
  'fieldset': 'フィールドセット',
  'legend': '凡例',
  'dialog': 'ダイアログ',
  'menu': 'メニュー',
  'summary': 'サマリー',
  'details': '詳細',
  'figure': '図',
  'figcaption': '図のキャプション',
  'caption': 'キャプション',
  'th': 'テーブルヘッダーセル',
  'td': 'テーブルセル',
  'tr': 'テーブル行',
  'thead': 'テーブルヘッダー',
  'tbody': 'テーブル本体',
  'tfoot': 'テーブルフッター',
};

/**
 * 要素の説明テキストを生成する
 * @requirement 7.2, 7.7 - 人間が読める要素説明を生成
 */
async function generateElementDescription(element: ElementHandle): Promise<string> {
  try {
    return await element.evaluate((el) => {
      const tagName = el.tagName.toLowerCase();
      // TAG_LABELSはブラウザコンテキストでは使用できないので、インラインで定義
      const labels: Record<string, string> = {
        'a': 'リンク',
        'img': '画像',
        'button': 'ボタン',
        'input': '入力欄',
        'select': 'セレクトボックス',
        'textarea': 'テキストエリア',
        'form': 'フォーム',
        'table': 'テーブル',
        'nav': 'ナビゲーション',
        'header': 'ヘッダー',
        'footer': 'フッター',
        'main': 'メインコンテンツ',
        'section': 'セクション',
        'article': '記事',
        'aside': 'サイドバー',
        'h1': '見出し1',
        'h2': '見出し2',
        'h3': '見出し3',
        'h4': '見出し4',
        'h5': '見出し5',
        'h6': '見出し6',
        'p': '段落',
        'ul': 'リスト',
        'ol': '番号付きリスト',
        'li': 'リスト項目',
        'div': 'ブロック要素',
        'span': 'インライン要素',
        'iframe': 'インラインフレーム',
        'video': '動画',
        'audio': '音声',
        'label': 'ラベル',
        'fieldset': 'フィールドセット',
        'legend': '凡例',
        'dialog': 'ダイアログ',
        'menu': 'メニュー',
        'summary': 'サマリー',
        'details': '詳細',
        'figure': '図',
        'figcaption': '図のキャプション',
        'caption': 'キャプション',
        'th': 'テーブルヘッダーセル',
        'td': 'テーブルセル',
        'tr': 'テーブル行',
        'thead': 'テーブルヘッダー',
        'tbody': 'テーブル本体',
        'tfoot': 'テーブルフッター',
      };
      const tagLabel = labels[tagName] || tagName;

      // 優先順位: aria-label > alt > title > placeholder > textContent
      const ariaLabel = el.getAttribute('aria-label');
      const alt = el.getAttribute('alt');
      const title = el.getAttribute('title');
      const placeholder = el.getAttribute('placeholder');
      const textContent = el.textContent?.trim() || '';

      const label = ariaLabel || alt || title || placeholder || textContent;

      if (label) {
        const truncatedLabel = label.length > 20 ? label.slice(0, 20) + '...' : label;
        return `${tagLabel}「${truncatedLabel}」`;
      }

      return tagLabel;
    });
  } catch {
    return '';
  }
}

/**
 * 拡張ノード情報を抽出する（XPath、バウンディングボックス、contextHtml、isHidden、elementDescription）
 * @requirement 6.1, 6.4, 6.5, 6.7, 7.2, 7.7
 */
async function extractEnhancedNodeInfo(
  page: Page,
  nodes: Array<{ target: string[]; html: string; failureSummary?: string }>
): Promise<NodeInfo[]> {
  const viewportSize = page.viewportSize();
  const enhancedNodes: NodeInfo[] = [];

  for (const node of nodes) {
    // target配列を " > " で結合して単一のCSSセレクタ文字列にする
    const target = node.target.join(' > ');

    // HTML抜粋を200文字に切り詰める
    let html = node.html;
    if (html.length > MAX_HTML_LENGTH) {
      html = html.substring(0, MAX_HTML_LENGTH - 3) + '...';
    }

    const nodeInfo: NodeInfo = {
      target,
      html,
      failureSummary: node.failureSummary,
    };

    // Playwrightで要素を取得して拡張情報を抽出
    try {
      // axe-coreのtargetは複数セレクタの配列
      // Shadow DOMの場合: [["#host", "#element"]] - 入れ子配列
      // 通常の場合: ["#element"] - 単純な配列
      let lastTarget = node.target[node.target.length - 1];

      // 入れ子配列の場合（Shadow DOM）、さらに最後の要素を取得
      if (Array.isArray(lastTarget)) {
        lastTarget = lastTarget[lastTarget.length - 1];
      }

      const selector = typeof lastTarget === 'string' ? lastTarget : null;

      if (!selector) {
        // セレクタが取得できない場合はスキップ
        enhancedNodes.push(nodeInfo);
        continue;
      }

      // 通常のセレクタで試行、失敗したらshadow-piercingセレクタを試行
      let element = await page.$(selector);
      if (!element) {
        // Shadow DOM対応: locatorのpierceオプションを使用
        try {
          const locator = page.locator(selector);
          if (await locator.count() > 0) {
            element = await locator.first().elementHandle();
          }
        } catch {
          // セレクタが無効な場合は無視
        }
      }

      if (element) {
        // XPathを取得
        const xpath = await getElementXPath(element);
        if (xpath) {
          nodeInfo.xpath = xpath;
        }

        // バウンディングボックスを取得
        const boundingBox = await element.boundingBox();
        if (boundingBox) {
          nodeInfo.boundingBox = {
            x: boundingBox.x,
            y: boundingBox.y,
            width: boundingBox.width,
            height: boundingBox.height,
          };
        }

        // contextHtmlを取得
        const contextHtml = await getContextHtml(element);
        if (contextHtml) {
          nodeInfo.contextHtml = contextHtml;
        }

        // isHiddenを判定
        const isHidden = isElementHidden(boundingBox, viewportSize);
        if (isHidden !== undefined) {
          nodeInfo.isHidden = isHidden;
        }

        // elementDescriptionを生成 @requirement 7.2, 7.7
        const elementDescription = await generateElementDescription(element);
        if (elementDescription) {
          nodeInfo.elementDescription = elementDescription;
        }

        // 要素個別のスクリーンショットを取得（赤枠ハイライト + 周囲コンテキスト付き）@requirement 7.4
        console.log('[axe] スクリーンショット取得開始:', selector);
        try {
          const PADDING = 80; // 周囲80pxのコンテキスト

          // 要素をビューポートにスクロール
          await element.scrollIntoViewIfNeeded();

          // 1. 一時的に赤枠を追加
          await page.evaluate((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.dataset._origOutline = htmlEl.style.outline || '';
            htmlEl.dataset._origOutlineOffset = htmlEl.style.outlineOffset || '';
            htmlEl.style.outline = '3px solid red';
            htmlEl.style.outlineOffset = '2px';
          }, element);

          // 2. バウンディングボックスを再取得（スクロール後）
          const boxAfterScroll = await element.boundingBox();
          if (boxAfterScroll && viewportSize) {
            // 3. パディングを含むクリップ領域を計算
            const clip = {
              x: Math.max(boxAfterScroll.x - PADDING, 0),
              y: Math.max(boxAfterScroll.y - PADDING, 0),
              width: Math.min(boxAfterScroll.width + 2 * PADDING, viewportSize.width),
              height: Math.min(boxAfterScroll.height + 2 * PADDING, viewportSize.height),
            };

            // 4. クリップ領域でスクリーンショット
            const screenshotBuffer = await page.screenshot({
              type: 'png',
              clip,
            });
            nodeInfo.elementScreenshot = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
            console.log('[axe] スクリーンショット取得成功:', selector, 'サイズ:', screenshotBuffer.length);
          } else {
            console.log('[axe] バウンディングボックスなし:', selector);
          }

          // 5. 一時的なスタイルを削除
          await page.evaluate((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.outline = htmlEl.dataset._origOutline || '';
            htmlEl.style.outlineOffset = htmlEl.dataset._origOutlineOffset || '';
            delete htmlEl.dataset._origOutline;
            delete htmlEl.dataset._origOutlineOffset;
          }, element);
        } catch {
          // スクリーンショット取得失敗は無視（非表示要素など）
        }
      }
    } catch {
      // 要素が見つからない場合は基本情報のみ
    }

    enhancedNodes.push(nodeInfo);
  }

  return enhancedNodes;
}

/**
 * axe-coreを使用してアクセシビリティ分析を実行する（拡張版）
 * バウンディングボックス、XPath、contextHtml、isHidden情報を含む
 *
 * @param page - Playwrightページインスタンス
 * @param options - 分析オプション
 * @returns 分析結果（拡張ノード情報付き）
 *
 * Requirements: 6.1, 6.4, 6.5, 6.7
 */
export async function analyzeWithAxeEnhanced(
  page: Page,
  options: AxeAnalyzerOptions = {}
): Promise<AnalyzerResult> {
  const startTime = Date.now();
  const adBlockingConfig = getAdBlockingConfig();
  const url = page.url();

  // Req 7.2: 分析開始ログを記録
  logAnalyzerStart('axe-core (enhanced)', url);
  const timing = createAnalyzerTiming('axe-core', url);

  // オプションのデフォルト値を設定
  const {
    legacyMode = true,
    excludeAds = true,
    additionalExcludes = [],
    disableColorContrast = false,
  } = options;

  // AxeBuilderを構築（日本語ロケール適用）@requirement 7.1
  const jaLocaleSource = getAxeSourceWithJaLocale();
  let axeBuilder = jaLocaleSource
    ? new AxeBuilder({ page, axeSource: jaLocaleSource }).withTags(WCAG_TAGS)
    : new AxeBuilder({ page }).withTags(WCAG_TAGS);

  // Req 1.1: setLegacyMode(true)をデフォルトで有効にする
  axeBuilder = axeBuilder.setLegacyMode(legacyMode);

  // Req 1.2, 1.3: 広告関連セレクタを除外する
  if (excludeAds && adBlockingConfig.enabled) {
    for (const selector of adBlockingConfig.adSelectors) {
      axeBuilder = axeBuilder.exclude(selector);
    }
  }

  // 追加の除外セレクタを適用
  for (const selector of additionalExcludes) {
    axeBuilder = axeBuilder.exclude(selector);
  }

  // Req 1.5: color-contrastルールの無効化オプション
  if (disableColorContrast) {
    axeBuilder = axeBuilder.disableRules('color-contrast');
  }

  const scanResults = await axeBuilder.analyze();

  // @requirement 6.1, 6.4, 6.5, 6.7: 拡張ノード情報を抽出
  const violations: RuleResult[] = await Promise.all(
    scanResults.violations.map(async (v) => ({
      id: v.id,
      description: v.description,
      impact: v.impact as 'critical' | 'serious' | 'moderate' | 'minor' | undefined,
      nodeCount: v.nodes.length,
      helpUrl: v.helpUrl,
      wcagCriteria: extractWcagCriteria(v.tags),
      toolSource: 'axe-core' as const,
      nodes: await extractEnhancedNodeInfo(page, v.nodes),
    }))
  );

  const passes: RuleResult[] = await Promise.all(
    scanResults.passes.map(async (p) => ({
      id: p.id,
      description: p.description,
      nodeCount: p.nodes.length,
      helpUrl: p.helpUrl,
      wcagCriteria: extractWcagCriteria(p.tags),
      toolSource: 'axe-core' as const,
      nodes: await extractEnhancedNodeInfo(page, p.nodes),
    }))
  );

  const incomplete: RuleResult[] = await Promise.all(
    scanResults.incomplete.map(async (i) => ({
      id: i.id,
      description: i.description,
      impact: i.impact as 'critical' | 'serious' | 'moderate' | 'minor' | undefined,
      nodeCount: i.nodes.length,
      helpUrl: i.helpUrl,
      wcagCriteria: extractWcagCriteria(i.tags),
      toolSource: 'axe-core' as const,
      nodes: await extractEnhancedNodeInfo(page, i.nodes),
    }))
  );

  const duration = Date.now() - startTime;

  // Req 7.2, 7.3: 分析完了ログを記録（60秒超過警告を含む）
  const completedTiming = completeAnalyzerTiming(timing, 'success');
  logAnalyzerComplete(completedTiming);

  return {
    violations,
    passes,
    incomplete,
    duration,
  };
}
