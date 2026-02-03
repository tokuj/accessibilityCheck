/**
 * カスタムルールサービス
 *
 * axe-coreのカスタムルール機能を使用して追加ルールを実行する
 *
 * Requirements: wcag-coverage-expansion 9.1, 9.2, 9.3, 9.4
 * - 9.1: axe-coreのカスタムルール機能を使用して追加ルールを実行する
 * - 9.2: デフォルトのカスタムルール（曖昧なリンクテキスト、見出しスキップ、長すぎるalt、空のボタン）
 * - 9.3: カスタムルールが違反を検出した場合、toolSource: 'custom'として報告
 * - 9.4: カスタムルールの有効/無効を個別に設定できる
 */

import type { ToolSource, ImpactLevel } from './types';

/**
 * カスタムルールID定数
 */
export const CUSTOM_RULE_IDS = {
  /** 曖昧なリンクテキスト検出 */
  AMBIGUOUS_LINK: 'custom-ambiguous-link',
  /** 見出しレベルスキップ検出 */
  HEADING_SKIP: 'custom-heading-skip',
  /** 長すぎるalt属性検出 */
  LONG_ALT: 'custom-long-alt',
  /** 空のボタン/リンク検出 */
  EMPTY_INTERACTIVE: 'custom-empty-interactive',
} as const;

/**
 * カスタムルールオプション
 */
export interface CustomRulesOptions {
  /** 曖昧なリンクテキスト検出を有効にするか */
  enableAmbiguousLink: boolean;
  /** 見出しレベルスキップ検出を有効にするか */
  enableHeadingSkip: boolean;
  /** 長すぎるalt属性検出を有効にするか */
  enableLongAlt: boolean;
  /** 空のボタン/リンク検出を有効にするか */
  enableEmptyInteractive: boolean;
  /** alt属性の最大文字数 */
  maxAltLength: number;
}

/**
 * デフォルトのカスタムルールオプション
 */
export const DEFAULT_CUSTOM_RULES_OPTIONS: CustomRulesOptions = {
  enableAmbiguousLink: true,
  enableHeadingSkip: true,
  enableLongAlt: true,
  enableEmptyInteractive: true,
  maxAltLength: 100,
};

/**
 * カスタムルール違反情報
 */
export interface CustomRuleViolation {
  /** ルールID */
  ruleId: string;
  /** 違反の説明 */
  description: string;
  /** 影響度 */
  impact: ImpactLevel;
  /** ツールソース（常に'custom'） */
  toolSource: ToolSource;
  /** 関連するWCAG成功基準 */
  wcagCriteria: string[];
  /** ヘルプURL */
  helpUrl: string;
  /** CSSセレクタ */
  selector: string;
  /** HTML抜粋 */
  html: string;
}

/**
 * 曖昧なリンクテキストのパターン（日本語・英語）
 */
const AMBIGUOUS_LINK_PATTERNS = [
  // 日本語
  /^こちら$/,
  /^詳細$/,
  /^クリック$/,
  /^もっと見る$/,
  /^続きを読む$/,
  /^ここをクリック$/,
  /^リンク$/,
  // 英語（大文字小文字を区別しない）
  /^click here$/i,
  /^read more$/i,
  /^here$/i,
  /^more$/i,
  /^click$/i,
  /^link$/i,
  /^details$/i,
  /^learn more$/i,
];

/**
 * HTMLからテキストを抽出するためのシンプルなパーサー
 */
function extractTextContent(html: string): string {
  // タグを除去してテキストのみを抽出
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * HTMLからリンク要素を抽出
 */
function extractLinks(html: string): Array<{ tag: string; text: string; html: string }> {
  const links: Array<{ tag: string; text: string; html: string }> = [];
  const linkRegex = /<a\s[^>]*href[^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const fullMatch = match[0];
    const textContent = extractTextContent(match[1]);
    links.push({
      tag: 'a',
      text: textContent,
      html: fullMatch.length > 200 ? fullMatch.substring(0, 197) + '...' : fullMatch,
    });
  }

  return links;
}

/**
 * HTMLから見出し要素を抽出
 */
function extractHeadings(html: string): Array<{ level: number; text: string; html: string }> {
  const headings: Array<{ level: number; text: string; html: string }> = [];
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;

  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const textContent = extractTextContent(match[2]);
    headings.push({
      level,
      text: textContent,
      html: match[0].length > 200 ? match[0].substring(0, 197) + '...' : match[0],
    });
  }

  return headings;
}

/**
 * HTMLから画像要素を抽出
 */
function extractImages(html: string): Array<{ alt: string; html: string }> {
  const images: Array<{ alt: string; html: string }> = [];
  const imgRegex = /<img\s[^>]*>/gi;

  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const fullMatch = match[0];
    // alt属性を抽出
    const altMatch = fullMatch.match(/alt\s*=\s*["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    images.push({
      alt,
      html: fullMatch.length > 200 ? fullMatch.substring(0, 197) + '...' : fullMatch,
    });
  }

  return images;
}

/**
 * HTMLからボタン要素を抽出
 */
function extractButtons(html: string): Array<{ text: string; ariaLabel: string; title: string; html: string }> {
  const buttons: Array<{ text: string; ariaLabel: string; title: string; html: string }> = [];
  const buttonRegex = /<button[^>]*>([\s\S]*?)<\/button>/gi;

  let match;
  while ((match = buttonRegex.exec(html)) !== null) {
    const fullMatch = match[0];
    const textContent = extractTextContent(match[1]);
    // 子要素にalt付きの画像があるかチェック
    const imgAltMatch = match[1].match(/<img[^>]*alt\s*=\s*["']([^"']+)["'][^>]*>/i);
    const imgAlt = imgAltMatch ? imgAltMatch[1] : '';

    // aria-label属性を抽出
    const ariaLabelMatch = fullMatch.match(/aria-label\s*=\s*["']([^"']*)["']/i);
    const ariaLabel = ariaLabelMatch ? ariaLabelMatch[1] : '';

    // title属性を抽出
    const titleMatch = fullMatch.match(/title\s*=\s*["']([^"']*)["']/i);
    const title = titleMatch ? titleMatch[1] : '';

    buttons.push({
      text: textContent || imgAlt,
      ariaLabel,
      title,
      html: fullMatch.length > 200 ? fullMatch.substring(0, 197) + '...' : fullMatch,
    });
  }

  return buttons;
}

/**
 * HTMLからリンク要素（テキストなし）を抽出
 */
function extractEmptyLinks(html: string): Array<{ text: string; ariaLabel: string; title: string; html: string }> {
  const links: Array<{ text: string; ariaLabel: string; title: string; html: string }> = [];
  const linkRegex = /<a\s[^>]*href[^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const fullMatch = match[0];
    const textContent = extractTextContent(match[1]);

    // 子要素にalt付きの画像があるかチェック
    const imgAltMatch = match[1].match(/<img[^>]*alt\s*=\s*["']([^"']+)["'][^>]*>/i);
    const imgAlt = imgAltMatch ? imgAltMatch[1] : '';

    // aria-label属性を抽出
    const ariaLabelMatch = fullMatch.match(/aria-label\s*=\s*["']([^"']*)["']/i);
    const ariaLabel = ariaLabelMatch ? ariaLabelMatch[1] : '';

    // title属性を抽出
    const titleMatch = fullMatch.match(/title\s*=\s*["']([^"']*)["']/i);
    const title = titleMatch ? titleMatch[1] : '';

    links.push({
      text: textContent || imgAlt,
      ariaLabel,
      title,
      html: fullMatch.length > 200 ? fullMatch.substring(0, 197) + '...' : fullMatch,
    });
  }

  return links;
}

/**
 * カスタムルールサービス
 */
export class CustomRulesService {
  /**
   * 曖昧なリンクテキストを検出する
   *
   * @requirement 9.2.1
   * - 「こちら」「詳細」「クリック」等のみのリンクを検出
   */
  static checkAmbiguousLink(html: string): CustomRuleViolation[] {
    const violations: CustomRuleViolation[] = [];
    const links = extractLinks(html);

    for (const link of links) {
      const text = link.text.trim();
      if (!text) continue;

      for (const pattern of AMBIGUOUS_LINK_PATTERNS) {
        if (pattern.test(text)) {
          violations.push({
            ruleId: CUSTOM_RULE_IDS.AMBIGUOUS_LINK,
            description: `リンクテキスト「${text}」は曖昧です。リンク先の内容を具体的に説明するテキストを使用してください。`,
            impact: 'moderate',
            toolSource: 'custom',
            wcagCriteria: ['2.4.4', '2.4.9'],
            helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html',
            selector: 'a',
            html: link.html,
          });
          break;
        }
      }
    }

    return violations;
  }

  /**
   * 見出しレベルのスキップを検出する
   *
   * @requirement 9.2.2
   * - h1→h3等、レベルを飛ばしている見出しを検出
   */
  static checkHeadingSkip(html: string): CustomRuleViolation[] {
    const violations: CustomRuleViolation[] = [];
    const headings = extractHeadings(html);

    let prevLevel = 0;
    for (const heading of headings) {
      // 最初の見出し、または同じ/低いレベルへの移行は問題なし
      if (prevLevel > 0 && heading.level > prevLevel + 1) {
        violations.push({
          ruleId: CUSTOM_RULE_IDS.HEADING_SKIP,
          description: `見出しレベルがh${prevLevel}からh${heading.level}にスキップしています。見出しレベルは1つずつ増やすべきです。`,
          impact: 'moderate',
          toolSource: 'custom',
          wcagCriteria: ['1.3.1', '2.4.6'],
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html',
          selector: `h${heading.level}`,
          html: heading.html,
        });
      }
      prevLevel = heading.level;
    }

    return violations;
  }

  /**
   * 長すぎるalt属性を検出する
   *
   * @requirement 9.2.3
   * - 100文字以上のalt属性を検出
   */
  static checkLongAlt(html: string, options: { maxAltLength?: number } = {}): CustomRuleViolation[] {
    const maxLength = options.maxAltLength ?? DEFAULT_CUSTOM_RULES_OPTIONS.maxAltLength;
    const violations: CustomRuleViolation[] = [];
    const images = extractImages(html);

    for (const image of images) {
      // 空のalt（装飾画像）は問題なし
      if (!image.alt) continue;

      if (image.alt.length > maxLength) {
        violations.push({
          ruleId: CUSTOM_RULE_IDS.LONG_ALT,
          description: `alt属性が${image.alt.length}文字あります（推奨: ${maxLength}文字以内）。長すぎるalt属性はスクリーンリーダーユーザーにとって負担になります。`,
          impact: 'minor',
          toolSource: 'custom',
          wcagCriteria: ['1.1.1'],
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html',
          selector: 'img',
          html: image.html,
        });
      }
    }

    return violations;
  }

  /**
   * 空のボタン/リンクを検出する
   *
   * @requirement 9.2.4
   * - テキストもaria-labelもtitleもないボタン/リンクを検出
   */
  static checkEmptyInteractive(html: string): CustomRuleViolation[] {
    const violations: CustomRuleViolation[] = [];

    // ボタンをチェック
    const buttons = extractButtons(html);
    for (const button of buttons) {
      const hasAccessibleName = button.text.trim() || button.ariaLabel.trim() || button.title.trim();
      if (!hasAccessibleName) {
        violations.push({
          ruleId: CUSTOM_RULE_IDS.EMPTY_INTERACTIVE,
          description: 'ボタンにアクセシブルな名前がありません。テキスト、aria-label、またはtitle属性を追加してください。',
          impact: 'critical',
          toolSource: 'custom',
          wcagCriteria: ['4.1.2', '1.1.1'],
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html',
          selector: 'button',
          html: button.html,
        });
      }
    }

    // リンクをチェック
    const links = extractEmptyLinks(html);
    for (const link of links) {
      const hasAccessibleName = link.text.trim() || link.ariaLabel.trim() || link.title.trim();
      if (!hasAccessibleName) {
        violations.push({
          ruleId: CUSTOM_RULE_IDS.EMPTY_INTERACTIVE,
          description: 'リンクにアクセシブルな名前がありません。テキスト、aria-label、またはtitle属性を追加してください。',
          impact: 'critical',
          toolSource: 'custom',
          wcagCriteria: ['4.1.2', '1.1.1', '2.4.4'],
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html',
          selector: 'a',
          html: link.html,
        });
      }
    }

    return violations;
  }

  /**
   * 全てのカスタムルールチェックを実行する
   *
   * @requirement 9.1, 9.4
   */
  static runAllChecks(html: string, options: CustomRulesOptions = DEFAULT_CUSTOM_RULES_OPTIONS): CustomRuleViolation[] {
    const violations: CustomRuleViolation[] = [];

    if (options.enableAmbiguousLink) {
      violations.push(...this.checkAmbiguousLink(html));
    }

    if (options.enableHeadingSkip) {
      violations.push(...this.checkHeadingSkip(html));
    }

    if (options.enableLongAlt) {
      violations.push(...this.checkLongAlt(html, { maxAltLength: options.maxAltLength }));
    }

    if (options.enableEmptyInteractive) {
      violations.push(...this.checkEmptyInteractive(html));
    }

    return violations;
  }
}
