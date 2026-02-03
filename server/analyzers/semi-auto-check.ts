/**
 * 半自動チェックサービス
 *
 * 自動テストの`incomplete`結果から半自動チェック項目を抽出し、
 * ユーザー回答を記録・管理する
 *
 * Requirements: wcag-coverage-expansion 5.1, 5.2, 5.3, 5.4, 5.6, 9.1, 9.2
 * - 5.1: 分析完了後、半自動確認が可能な項目をリストアップする
 * - 5.2: 各半自動チェック項目についてスクリーンショット、HTML抜粋、質問を表示
 * - 5.3: ユーザーが選択肢を選択した場合、回答を記録しレポートに反映
 * - 5.4: alt属性、リンクテキスト、見出し、フォーカス可視性の確認項目を生成
 * - 5.6: 進捗状況（完了数/全体数）を表示
 * - 9.1: incomplete結果から半自動確認が可能な項目を抽出
 * - 9.2: 回答記録と進捗管理
 */

import type { RuleResult } from './types';

/**
 * 半自動チェックの回答タイプ
 * @requirement 5.3
 */
export type SemiAutoAnswer = 'appropriate' | 'inappropriate' | 'cannot-determine';

/**
 * 半自動チェック項目
 * @requirement 5.2
 */
export interface SemiAutoItem {
  /** 一意なID */
  id: string;
  /** 元のルールID */
  ruleId: string;
  /** WCAG成功基準 */
  wcagCriteria: string[];
  /** 確認用の質問文 */
  question: string;
  /** スクリーンショット（Base64、オプション） */
  screenshot?: string;
  /** HTML抜粋 */
  html: string;
  /** 人間が読める要素説明 */
  elementDescription: string;
  /** CSSセレクタ */
  selector: string;
  /** ユーザーの回答 */
  answer?: SemiAutoAnswer;
  /** 回答日時 */
  answeredAt?: string;
}

/**
 * 半自動チェック結果
 * @requirement 5.3
 */
export interface SemiAutoResult {
  /** 項目ID */
  itemId: string;
  /** ルールID */
  ruleId: string;
  /** WCAG成功基準 */
  wcagCriteria: string[];
  /** 回答 */
  answer: SemiAutoAnswer;
  /** 回答日時 */
  answeredAt: string;
}

/**
 * 半自動チェックオプション
 */
export interface SemiAutoCheckOptions {
  /** alt属性チェックを有効にするか */
  enableAltCheck: boolean;
  /** リンクテキストチェックを有効にするか */
  enableLinkTextCheck: boolean;
  /** 見出しチェックを有効にするか */
  enableHeadingCheck: boolean;
  /** フォーカス可視性チェックを有効にするか */
  enableFocusVisibilityCheck: boolean;
}

/**
 * デフォルトの半自動チェックオプション
 */
export const DEFAULT_SEMI_AUTO_CHECK_OPTIONS: SemiAutoCheckOptions = {
  enableAltCheck: true,
  enableLinkTextCheck: true,
  enableHeadingCheck: true,
  enableFocusVisibilityCheck: true,
};

/**
 * 進捗状況
 * @requirement 5.6
 */
export interface SemiAutoProgress {
  /** 完了した項目数 */
  completed: number;
  /** 全体の項目数 */
  total: number;
}

/**
 * ルールIDと半自動チェックカテゴリのマッピング
 */
export const SEMI_AUTO_RULE_MAPPING: Record<string, {
  category: 'alt' | 'link' | 'heading' | 'focus';
  questionTemplate: string;
}> = {
  // alt属性関連
  'image-alt': {
    category: 'alt',
    questionTemplate: 'この画像のalt属性「{alt}」は、画像の内容を適切に説明していますか？',
  },
  'input-image-alt': {
    category: 'alt',
    questionTemplate: 'この入力画像のalt属性は、ボタンの機能を適切に説明していますか？',
  },
  'area-alt': {
    category: 'alt',
    questionTemplate: 'この画像マップエリアのalt属性は、リンク先の内容を適切に説明していますか？',
  },
  'object-alt': {
    category: 'alt',
    questionTemplate: 'このオブジェクトの代替テキストは、コンテンツを適切に説明していますか？',
  },
  'svg-img-alt': {
    category: 'alt',
    questionTemplate: 'このSVG画像の代替テキストは、画像の内容を適切に説明していますか？',
  },
  // リンクテキスト関連
  'link-name': {
    category: 'link',
    questionTemplate: 'このリンクテキストは、リンク先の内容を明確に説明していますか？',
  },
  'link-in-text-block': {
    category: 'link',
    questionTemplate: 'このリンクは、周囲のテキストと視覚的に区別できますか？',
  },
  // 見出し関連
  'empty-heading': {
    category: 'heading',
    questionTemplate: 'この見出しのテキストは、セクションの内容を適切に要約していますか？',
  },
  'heading-order': {
    category: 'heading',
    questionTemplate: 'この見出し構造は、ページの論理的な階層を正しく反映していますか？',
  },
  'page-has-heading-one': {
    category: 'heading',
    questionTemplate: 'ページにh1見出しがあり、ページの主要な内容を説明していますか？',
  },
  // フォーカス可視性関連
  'focus-visible': {
    category: 'focus',
    questionTemplate: 'この要素にフォーカスしたとき、フォーカスインジケーターが見えますか？',
  },
  'focus-order-semantics': {
    category: 'focus',
    questionTemplate: 'この要素のフォーカス順序は、視覚的なレイアウトと一致していますか？',
  },
  'tabindex': {
    category: 'focus',
    questionTemplate: 'このtabindex設定は、自然なフォーカス順序を維持していますか？',
  },
};

/**
 * HTMLからalt属性を抽出
 */
function extractAltFromHtml(html: string): string {
  const altMatch = html.match(/alt\s*=\s*["']([^"']*)["']/i);
  return altMatch ? altMatch[1] : '';
}

/**
 * HTMLから要素の説明を生成
 */
function generateElementDescription(html: string, ruleId: string): string {
  // altを含む場合
  const alt = extractAltFromHtml(html);
  if (alt) {
    return `画像（alt: "${alt.substring(0, 50)}${alt.length > 50 ? '...' : ''}"）`;
  }

  // タグ名を抽出
  const tagMatch = html.match(/<(\w+)/);
  const tagName = tagMatch ? tagMatch[1].toLowerCase() : 'element';

  // テキストコンテンツを抽出
  const textMatch = html.match(/>([^<]*)</);
  const text = textMatch ? textMatch[1].trim() : '';

  if (text) {
    return `${tagName}要素「${text.substring(0, 30)}${text.length > 30 ? '...' : ''}」`;
  }

  return `${tagName}要素`;
}

/**
 * 質問文を生成
 */
function generateQuestion(ruleId: string, html: string): string {
  const mapping = SEMI_AUTO_RULE_MAPPING[ruleId];
  if (mapping) {
    // alt属性を質問文に埋め込む
    const alt = extractAltFromHtml(html);
    return mapping.questionTemplate.replace('{alt}', alt || '(なし)');
  }

  // マッピングがない場合のデフォルト質問
  return 'この要素のアクセシビリティ対応は適切ですか？';
}

/**
 * 一意なIDを生成
 */
function generateId(): string {
  return `semi-auto-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 半自動チェックサービス
 * @requirement 5.1, 5.2, 5.3, 5.4, 5.6, 9.1, 9.2
 */
export class SemiAutoCheckService {
  private items: SemiAutoItem[] = [];
  private options: SemiAutoCheckOptions;

  constructor(options: SemiAutoCheckOptions = DEFAULT_SEMI_AUTO_CHECK_OPTIONS) {
    this.options = options;
  }

  /**
   * violationsとincompleteから半自動チェック項目を抽出
   * @requirement 9.1, 5.1
   */
  extractItems(violations: RuleResult[], incomplete: RuleResult[]): SemiAutoItem[] {
    this.items = [];

    const allRules = [...violations, ...incomplete];

    for (const rule of allRules) {
      // ノードがない場合はスキップ
      if (!rule.nodes || rule.nodes.length === 0) {
        continue;
      }

      // マッピングがあるルールのみ処理
      const mapping = SEMI_AUTO_RULE_MAPPING[rule.id];
      if (!mapping) {
        continue;
      }

      // カテゴリに応じてオプションチェック
      if (mapping.category === 'alt' && !this.options.enableAltCheck) {
        continue;
      }
      if (mapping.category === 'link' && !this.options.enableLinkTextCheck) {
        continue;
      }
      if (mapping.category === 'heading' && !this.options.enableHeadingCheck) {
        continue;
      }
      if (mapping.category === 'focus' && !this.options.enableFocusVisibilityCheck) {
        continue;
      }

      // 各ノードに対して項目を生成
      for (const node of rule.nodes) {
        const item: SemiAutoItem = {
          id: generateId(),
          ruleId: rule.id,
          wcagCriteria: rule.wcagCriteria,
          question: generateQuestion(rule.id, node.html),
          html: node.html,
          elementDescription: node.elementDescription || generateElementDescription(node.html, rule.id),
          selector: node.target,
          screenshot: node.elementScreenshot,
        };

        this.items.push(item);
      }
    }

    return this.items;
  }

  /**
   * 現在の項目一覧を取得
   */
  getItems(): SemiAutoItem[] {
    return this.items;
  }

  /**
   * 回答を記録
   * @requirement 9.2, 5.3
   */
  recordAnswer(itemId: string, answer: SemiAutoAnswer): void {
    const item = this.items.find(i => i.id === itemId);
    if (item) {
      item.answer = answer;
      item.answeredAt = new Date().toISOString();
    }
  }

  /**
   * 進捗状況を取得
   * @requirement 9.2, 5.6
   */
  getProgress(): SemiAutoProgress {
    const total = this.items.length;
    const completed = this.items.filter(item => item.answer !== undefined).length;

    return { completed, total };
  }

  /**
   * 回答済み項目の結果を取得
   * @requirement 5.3
   */
  getResults(): SemiAutoResult[] {
    return this.items
      .filter(item => item.answer !== undefined)
      .map(item => ({
        itemId: item.id,
        ruleId: item.ruleId,
        wcagCriteria: item.wcagCriteria,
        answer: item.answer!,
        answeredAt: item.answeredAt!,
      }));
  }

  /**
   * 全項目をクリア
   */
  clear(): void {
    this.items = [];
  }
}
