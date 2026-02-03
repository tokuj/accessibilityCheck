/**
 * LiveRegionValidator
 *
 * ARIAライブリージョンを検証するサービス
 *
 * @requirement 10.1 - ページ内の全てのaria-live属性を持つ要素を検出
 * @requirement 10.2 - role属性（alert/status/log）の適切な使用を検証
 * @requirement 10.3 - aria-atomicとaria-relevant属性の設定を確認
 * @requirement 10.4 - 空のライブリージョンを警告として報告
 * @requirement 10.5 - ライブリージョン一覧をレポートに含める
 */

import { JSDOM } from 'jsdom';
import type { RuleResult, ImpactLevel } from './types';

/**
 * ライブリージョンの種類
 */
export type LiveRegionType = 'polite' | 'assertive' | 'off';

/**
 * ライブリージョンに関連するrole
 */
export type LiveRegionRole =
  | 'alert'
  | 'status'
  | 'log'
  | 'marquee'
  | 'timer'
  | 'alertdialog';

/**
 * 各roleの暗黙のaria-live値
 */
const IMPLICIT_LIVE_VALUES: Record<LiveRegionRole, LiveRegionType> = {
  alert: 'assertive',
  alertdialog: 'assertive',
  status: 'polite',
  log: 'polite',
  marquee: 'off',
  timer: 'off',
};

/**
 * 各roleで推奨されるaria-atomic値
 */
const RECOMMENDED_ATOMIC: Record<string, boolean> = {
  alert: true,
  status: true,
};

/**
 * ライブリージョン情報
 */
export interface LiveRegionInfo {
  /** CSSセレクタ */
  selector: string;
  /** HTML抜粋 */
  html: string;
  /** aria-live属性値 */
  ariaLive?: LiveRegionType;
  /** 暗黙のaria-live値（roleによる） */
  implicitAriaLive?: LiveRegionType;
  /** role属性値 */
  role?: LiveRegionRole;
  /** aria-atomic属性値 */
  ariaAtomic?: boolean;
  /** aria-relevant属性値 */
  ariaRelevant?: string[];
  /** 要素が空かどうか */
  isEmpty: boolean;
  /** テキストコンテンツ */
  textContent?: string;
  /** ネストされているかどうか */
  isNested?: boolean;
  /** 親ライブリージョンのセレクタ（ネストされている場合） */
  parentLiveRegion?: string;
}

/**
 * ライブリージョンの問題の種類
 */
export type LiveRegionIssueType =
  | 'empty-live-region'
  | 'conflicting-live-settings'
  | 'missing-aria-atomic'
  | 'assertive-without-relevant'
  | 'nested-live-region';

/**
 * ライブリージョン検証で検出された問題
 */
export interface LiveRegionIssue {
  /** 問題の種類 */
  type: LiveRegionIssueType;
  /** 重要度（warning/error） */
  severity: 'warning' | 'error';
  /** CSSセレクタ */
  selector: string;
  /** 問題の説明 */
  description: string;
  /** WCAG成功基準 */
  wcagCriteria: string[];
  /** 改善提案 */
  suggestion: string;
}

/**
 * ライブリージョン検証結果
 */
export interface LiveRegionValidationResult {
  /** 検出されたライブリージョン一覧 */
  liveRegions: LiveRegionInfo[];
  /** 検出された問題 */
  issues: LiveRegionIssue[];
  /** ライブリージョン総数 */
  totalLiveRegions: number;
  /** タイプ別集計 */
  byType: {
    polite: number;
    assertive: number;
    off: number;
  };
  /** role別集計 */
  byRole: Record<string, number>;
}

/**
 * CSSセレクタを生成するヘルパー関数
 */
function generateSelector(element: Element): string {
  // IDがあればIDを使用
  if (element.id) {
    return `#${element.id}`;
  }

  // クラスがあれば最初のクラスを使用
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/);
    if (classes.length > 0 && classes[0]) {
      const selector = `${element.tagName.toLowerCase()}.${classes[0]}`;
      // ドキュメント内で一意か確認
      const doc = element.ownerDocument;
      if (doc && doc.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }
  }

  // タグ名とインデックスを使用
  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (child) => child.tagName === element.tagName
    );
    const index = siblings.indexOf(element);
    if (index > 0 || siblings.length > 1) {
      return `${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
    }
  }

  return element.tagName.toLowerCase();
}

/**
 * HTML文字列を短縮するヘルパー関数
 */
function truncateHtml(html: string, maxLength = 200): string {
  if (html.length <= maxLength) {
    return html;
  }
  return html.substring(0, maxLength) + '...';
}

/**
 * LiveRegionValidator クラス
 */
export class LiveRegionValidator {
  /**
   * HTMLコンテンツからライブリージョンを検証
   */
  validateFromHTML(html: string): LiveRegionValidationResult {
    const dom = new JSDOM(html);
    return this.validateFromDOM(dom.window.document);
  }

  /**
   * DOMドキュメントからライブリージョンを検証
   */
  validateFromDOM(document: Document): LiveRegionValidationResult {
    const liveRegions: LiveRegionInfo[] = [];
    const issues: LiveRegionIssue[] = [];
    const processedElements = new Set<Element>();
    // 要素参照を保持（ネスト検出用）
    const elementToInfoMap = new Map<Element, LiveRegionInfo>();

    // 1. aria-live属性を持つ要素を検出
    const ariaLiveElements = document.querySelectorAll('[aria-live]');
    ariaLiveElements.forEach((element) => {
      if (!processedElements.has(element)) {
        const info = this.extractLiveRegionInfo(element);
        liveRegions.push(info);
        processedElements.add(element);
        elementToInfoMap.set(element, info);
      }
    });

    // 2. ライブリージョンroleを持つ要素を検出
    const liveRoles: LiveRegionRole[] = [
      'alert',
      'status',
      'log',
      'marquee',
      'timer',
      'alertdialog',
    ];
    liveRoles.forEach((role) => {
      const roleElements = document.querySelectorAll(`[role="${role}"]`);
      roleElements.forEach((element) => {
        if (!processedElements.has(element)) {
          const info = this.extractLiveRegionInfo(element, role);
          liveRegions.push(info);
          processedElements.add(element);
          elementToInfoMap.set(element, info);
        }
      });
    });

    // 3. ネストされたライブリージョンを検出
    this.detectNestedLiveRegionsFromDOM(processedElements, elementToInfoMap, issues);

    // 4. 各ライブリージョンの問題を検証
    liveRegions.forEach((region) => {
      this.validateLiveRegion(region, issues);
    });

    // 5. 集計を計算
    const byType = { polite: 0, assertive: 0, off: 0 };
    const byRole: Record<string, number> = {};

    liveRegions.forEach((region) => {
      // 実効的なaria-live値を取得
      const effectiveLive = region.ariaLive || region.implicitAriaLive || 'off';
      byType[effectiveLive]++;

      // role別集計
      if (region.role) {
        byRole[region.role] = (byRole[region.role] || 0) + 1;
      }
    });

    return {
      liveRegions,
      issues,
      totalLiveRegions: liveRegions.length,
      byType,
      byRole,
    };
  }

  /**
   * ライブリージョン情報を抽出
   */
  private extractLiveRegionInfo(
    element: Element,
    role?: LiveRegionRole
  ): LiveRegionInfo {
    const selector = generateSelector(element);
    const html = truncateHtml(element.outerHTML);
    const textContent = element.textContent?.trim() || '';
    const isEmpty = textContent.length === 0;

    // aria-live属性
    const ariaLiveAttr = element.getAttribute('aria-live');
    const ariaLive = ariaLiveAttr as LiveRegionType | undefined;

    // role属性（引数で渡されていなければ要素から取得）
    const elementRole = role || (element.getAttribute('role') as LiveRegionRole | null);
    const implicitAriaLive = elementRole
      ? IMPLICIT_LIVE_VALUES[elementRole]
      : undefined;

    // aria-atomic属性
    const ariaAtomicAttr = element.getAttribute('aria-atomic');
    const ariaAtomic = ariaAtomicAttr === 'true';

    // aria-relevant属性
    const ariaRelevantAttr = element.getAttribute('aria-relevant');
    const ariaRelevant = ariaRelevantAttr
      ? ariaRelevantAttr.split(/\s+/)
      : undefined;

    return {
      selector,
      html,
      ariaLive,
      implicitAriaLive,
      role: elementRole || undefined,
      ariaAtomic: ariaAtomicAttr !== null ? ariaAtomic : undefined,
      ariaRelevant,
      isEmpty,
      textContent: textContent.substring(0, 100),
    };
  }

  /**
   * DOMからネストされたライブリージョンを検出
   */
  private detectNestedLiveRegionsFromDOM(
    liveRegionElements: Set<Element>,
    elementToInfoMap: Map<Element, LiveRegionInfo>,
    issues: LiveRegionIssue[]
  ): void {
    // 各ライブリージョン要素について、親にもライブリージョンがあるかチェック
    for (const element of liveRegionElements) {
      let parent = element.parentElement;
      while (parent) {
        if (liveRegionElements.has(parent)) {
          // ネストされたライブリージョンを発見
          const childInfo = elementToInfoMap.get(element);
          const parentInfo = elementToInfoMap.get(parent);

          if (childInfo) {
            childInfo.isNested = true;
            childInfo.parentLiveRegion = parentInfo?.selector;

            issues.push({
              type: 'nested-live-region',
              severity: 'warning',
              selector: childInfo.selector,
              description: `ライブリージョンが別のライブリージョン（${parentInfo?.selector || '親要素'}）内にネストされています`,
              wcagCriteria: ['4.1.3'],
              suggestion:
                'ネストされたライブリージョンはスクリーンリーダーで予期しない動作を引き起こす可能性があります。構造を見直してください。',
            });
          }
          break; // 最初の親ライブリージョンを見つけたら終了
        }
        parent = parent.parentElement;
      }
    }
  }

  /**
   * 個別のライブリージョンを検証
   */
  private validateLiveRegion(
    region: LiveRegionInfo,
    issues: LiveRegionIssue[]
  ): void {
    // 1. 空のライブリージョンを警告
    if (region.isEmpty) {
      issues.push({
        type: 'empty-live-region',
        severity: 'warning',
        selector: region.selector,
        description: 'ライブリージョンが空です',
        wcagCriteria: ['4.1.3'],
        suggestion:
          '空のライブリージョンは意味がありません。動的にコンテンツが追加されることを確認してください。',
      });
    }

    // 2. roleとaria-liveの矛盾を検出
    if (region.role && region.ariaLive) {
      const implicitValue = IMPLICIT_LIVE_VALUES[region.role];
      if (implicitValue && region.ariaLive === 'off') {
        issues.push({
          type: 'conflicting-live-settings',
          severity: 'warning',
          selector: region.selector,
          description: `role="${region.role}"は暗黙的にaria-live="${implicitValue}"ですが、aria-live="off"が設定されています`,
          wcagCriteria: ['4.1.3'],
          suggestion:
            '矛盾する設定は予期しない動作を引き起こす可能性があります。意図的でなければaria-live属性を削除してください。',
        });
      }
    }

    // 3. aria-atomicの推奨
    if (region.role && RECOMMENDED_ATOMIC[region.role] && !region.ariaAtomic) {
      issues.push({
        type: 'missing-aria-atomic',
        severity: 'warning',
        selector: region.selector,
        description: `role="${region.role}"にはaria-atomic="true"が推奨されます`,
        wcagCriteria: ['4.1.3'],
        suggestion:
          'aria-atomic="true"を追加すると、リージョン全体が読み上げられ、コンテキストが維持されます。',
      });
    }

    // 4. assertiveリージョンでaria-relevantがない場合の警告
    const effectiveLive = region.ariaLive || region.implicitAriaLive;
    if (effectiveLive === 'assertive' && !region.ariaRelevant) {
      issues.push({
        type: 'assertive-without-relevant',
        severity: 'warning',
        selector: region.selector,
        description:
          'assertiveリージョンにaria-relevantが設定されていません',
        wcagCriteria: ['4.1.3'],
        suggestion:
          'aria-relevant属性を設定すると、どの変更を通知するかを制御できます。頻繁な更新がある場合は特に重要です。',
      });
    }
  }

  /**
   * 検証結果をRuleResult形式に変換
   */
  toRuleResults(result: LiveRegionValidationResult): RuleResult[] {
    const ruleResults: RuleResult[] = [];

    // 問題ごとにRuleResultを生成
    result.issues.forEach((issue) => {
      const ruleId = this.issueTypeToRuleId(issue.type);
      const impact: ImpactLevel =
        issue.severity === 'error' ? 'serious' : 'moderate';

      ruleResults.push({
        id: ruleId,
        description: issue.description,
        impact,
        nodeCount: 1,
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA19',
        wcagCriteria: issue.wcagCriteria,
        toolSource: 'custom',
        nodes: [
          {
            target: issue.selector,
            html: issue.suggestion,
          },
        ],
      });
    });

    return ruleResults;
  }

  /**
   * 問題タイプをルールIDに変換
   */
  private issueTypeToRuleId(type: LiveRegionIssueType): string {
    const mapping: Record<LiveRegionIssueType, string> = {
      'empty-live-region': 'live-region-empty',
      'conflicting-live-settings': 'live-region-conflicting',
      'missing-aria-atomic': 'live-region-missing-atomic',
      'assertive-without-relevant': 'live-region-assertive-no-relevant',
      'nested-live-region': 'live-region-nested',
    };
    return mapping[type];
  }
}

export default LiveRegionValidator;
