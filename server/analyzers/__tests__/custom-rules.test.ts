/**
 * カスタムルールサービスのテスト
 *
 * Requirements: wcag-coverage-expansion 9.1, 9.2, 9.3, 9.4
 * - 9.1: axe-coreのカスタムルール機能を使用して追加ルールを実行する
 * - 9.2: デフォルトのカスタムルール（曖昧なリンクテキスト、見出しスキップ、長すぎるalt、空のボタン）
 * - 9.3: カスタムルールが違反を検出した場合、toolSource: 'custom'として報告
 * - 9.4: カスタムルールの有効/無効を個別に設定できる
 */

import { describe, it, expect } from 'vitest';
import {
  CustomRulesService,
  type CustomRulesOptions,
  CUSTOM_RULE_IDS,
  DEFAULT_CUSTOM_RULES_OPTIONS,
  type CustomRuleViolation,
} from '../custom-rules';

describe('CustomRulesService', () => {
  describe('型定義とインターフェース', () => {
    it('CUSTOM_RULE_IDSが定義されていること', () => {
      expect(CUSTOM_RULE_IDS).toBeDefined();
      expect(CUSTOM_RULE_IDS.AMBIGUOUS_LINK).toBe('custom-ambiguous-link');
      expect(CUSTOM_RULE_IDS.HEADING_SKIP).toBe('custom-heading-skip');
      expect(CUSTOM_RULE_IDS.LONG_ALT).toBe('custom-long-alt');
      expect(CUSTOM_RULE_IDS.EMPTY_INTERACTIVE).toBe('custom-empty-interactive');
    });

    it('DEFAULT_CUSTOM_RULES_OPTIONSが正しく定義されていること', () => {
      expect(DEFAULT_CUSTOM_RULES_OPTIONS).toBeDefined();
      expect(DEFAULT_CUSTOM_RULES_OPTIONS.enableAmbiguousLink).toBe(true);
      expect(DEFAULT_CUSTOM_RULES_OPTIONS.enableHeadingSkip).toBe(true);
      expect(DEFAULT_CUSTOM_RULES_OPTIONS.enableLongAlt).toBe(true);
      expect(DEFAULT_CUSTOM_RULES_OPTIONS.enableEmptyInteractive).toBe(true);
      expect(DEFAULT_CUSTOM_RULES_OPTIONS.maxAltLength).toBe(100);
    });
  });

  describe('曖昧なリンクテキスト検出 (9.2.1)', () => {
    it('「こちら」のみのリンクを検出すること', () => {
      const html = '<a href="/page">こちら</a>';
      const violations = CustomRulesService.checkAmbiguousLink(html);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe(CUSTOM_RULE_IDS.AMBIGUOUS_LINK);
      expect(violations[0].toolSource).toBe('custom');
    });

    it('「詳細」のみのリンクを検出すること', () => {
      const html = '<a href="/page">詳細</a>';
      const violations = CustomRulesService.checkAmbiguousLink(html);

      expect(violations.length).toBeGreaterThan(0);
    });

    it('「クリック」のみのリンクを検出すること', () => {
      const html = '<a href="/page">クリック</a>';
      const violations = CustomRulesService.checkAmbiguousLink(html);

      expect(violations.length).toBeGreaterThan(0);
    });

    it('「もっと見る」のみのリンクを検出すること', () => {
      const html = '<a href="/page">もっと見る</a>';
      const violations = CustomRulesService.checkAmbiguousLink(html);

      expect(violations.length).toBeGreaterThan(0);
    });

    it('「read more」のみのリンクを検出すること', () => {
      const html = '<a href="/page">read more</a>';
      const violations = CustomRulesService.checkAmbiguousLink(html);

      expect(violations.length).toBeGreaterThan(0);
    });

    it('「click here」のみのリンクを検出すること', () => {
      const html = '<a href="/page">click here</a>';
      const violations = CustomRulesService.checkAmbiguousLink(html);

      expect(violations.length).toBeGreaterThan(0);
    });

    it('具体的なリンクテキストは検出しないこと', () => {
      const html = '<a href="/products">製品一覧を見る</a>';
      const violations = CustomRulesService.checkAmbiguousLink(html);

      expect(violations.length).toBe(0);
    });

    it('複数のリンクから曖昧なものだけ検出すること', () => {
      const html = `
        <a href="/page1">こちら</a>
        <a href="/page2">製品詳細ページへ</a>
        <a href="/page3">詳細</a>
      `;
      const violations = CustomRulesService.checkAmbiguousLink(html);

      expect(violations.length).toBe(2);
    });
  });

  describe('見出しレベルスキップ検出 (9.2.2)', () => {
    it('h1からh3へのスキップを検出すること', () => {
      const html = `
        <h1>タイトル</h1>
        <h3>サブセクション</h3>
      `;
      const violations = CustomRulesService.checkHeadingSkip(html);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe(CUSTOM_RULE_IDS.HEADING_SKIP);
      expect(violations[0].toolSource).toBe('custom');
    });

    it('h2からh4へのスキップを検出すること', () => {
      const html = `
        <h2>セクション</h2>
        <h4>サブサブセクション</h4>
      `;
      const violations = CustomRulesService.checkHeadingSkip(html);

      expect(violations.length).toBeGreaterThan(0);
    });

    it('正しい見出し階層は検出しないこと', () => {
      const html = `
        <h1>タイトル</h1>
        <h2>セクション</h2>
        <h3>サブセクション</h3>
      `;
      const violations = CustomRulesService.checkHeadingSkip(html);

      expect(violations.length).toBe(0);
    });

    it('同じレベルの見出しは問題ないこと', () => {
      const html = `
        <h1>タイトル</h1>
        <h2>セクション1</h2>
        <h2>セクション2</h2>
      `;
      const violations = CustomRulesService.checkHeadingSkip(html);

      expect(violations.length).toBe(0);
    });

    it('レベルが下がる場合は問題ないこと', () => {
      const html = `
        <h1>タイトル</h1>
        <h2>セクション</h2>
        <h3>サブセクション</h3>
        <h2>次のセクション</h2>
      `;
      const violations = CustomRulesService.checkHeadingSkip(html);

      expect(violations.length).toBe(0);
    });
  });

  describe('長すぎるalt属性検出 (9.2.3)', () => {
    it('100文字以上のalt属性を検出すること', () => {
      const longAlt = 'a'.repeat(101);
      const html = `<img src="test.jpg" alt="${longAlt}">`;
      const violations = CustomRulesService.checkLongAlt(html);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe(CUSTOM_RULE_IDS.LONG_ALT);
      expect(violations[0].toolSource).toBe('custom');
    });

    it('カスタム閾値で検出できること', () => {
      const alt50chars = 'a'.repeat(51);
      const html = `<img src="test.jpg" alt="${alt50chars}">`;
      const violations = CustomRulesService.checkLongAlt(html, { maxAltLength: 50 });

      expect(violations.length).toBeGreaterThan(0);
    });

    it('100文字未満のalt属性は検出しないこと', () => {
      const shortAlt = 'この画像は製品の外観を示しています。';
      const html = `<img src="test.jpg" alt="${shortAlt}">`;
      const violations = CustomRulesService.checkLongAlt(html);

      expect(violations.length).toBe(0);
    });

    it('空のalt属性（装飾画像）は検出しないこと', () => {
      const html = '<img src="decoration.jpg" alt="">';
      const violations = CustomRulesService.checkLongAlt(html);

      expect(violations.length).toBe(0);
    });
  });

  describe('空のボタン/リンク検出 (9.2.4)', () => {
    it('テキストのないボタンを検出すること', () => {
      const html = '<button></button>';
      const violations = CustomRulesService.checkEmptyInteractive(html);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe(CUSTOM_RULE_IDS.EMPTY_INTERACTIVE);
      expect(violations[0].toolSource).toBe('custom');
    });

    it('テキストのないリンクを検出すること', () => {
      const html = '<a href="/page"></a>';
      const violations = CustomRulesService.checkEmptyInteractive(html);

      expect(violations.length).toBeGreaterThan(0);
    });

    it('aria-labelがあるボタンは検出しないこと', () => {
      const html = '<button aria-label="閉じる"><svg>...</svg></button>';
      const violations = CustomRulesService.checkEmptyInteractive(html);

      expect(violations.length).toBe(0);
    });

    it('title属性があるリンクは検出しないこと', () => {
      const html = '<a href="/page" title="ホームに戻る"><img src="home.png"></a>';
      const violations = CustomRulesService.checkEmptyInteractive(html);

      expect(violations.length).toBe(0);
    });

    it('テキストがあるボタンは検出しないこと', () => {
      const html = '<button>送信</button>';
      const violations = CustomRulesService.checkEmptyInteractive(html);

      expect(violations.length).toBe(0);
    });

    it('画像にaltがあるリンクは検出しないこと', () => {
      const html = '<a href="/page"><img src="icon.png" alt="ホーム"></a>';
      const violations = CustomRulesService.checkEmptyInteractive(html);

      expect(violations.length).toBe(0);
    });

    it('空白のみのボタンを検出すること', () => {
      const html = '<button>   </button>';
      const violations = CustomRulesService.checkEmptyInteractive(html);

      expect(violations.length).toBeGreaterThan(0);
    });
  });

  describe('カスタムルール有効/無効設定 (9.4)', () => {
    it('個別ルールを無効にできること', () => {
      const html = '<a href="/page">こちら</a>';
      const options: CustomRulesOptions = {
        ...DEFAULT_CUSTOM_RULES_OPTIONS,
        enableAmbiguousLink: false,
      };
      const violations = CustomRulesService.runAllChecks(html, options);

      // 曖昧なリンクチェックが無効なので検出されない
      const ambiguousLinkViolations = violations.filter(
        v => v.ruleId === CUSTOM_RULE_IDS.AMBIGUOUS_LINK
      );
      expect(ambiguousLinkViolations.length).toBe(0);
    });

    it('すべてのルールを無効にできること', () => {
      const html = `
        <a href="/page">こちら</a>
        <h1>タイトル</h1><h3>サブ</h3>
        <img src="test.jpg" alt="${'a'.repeat(150)}">
        <button></button>
      `;
      const options: CustomRulesOptions = {
        enableAmbiguousLink: false,
        enableHeadingSkip: false,
        enableLongAlt: false,
        enableEmptyInteractive: false,
        maxAltLength: 100,
      };
      const violations = CustomRulesService.runAllChecks(html, options);

      expect(violations.length).toBe(0);
    });
  });

  describe('runAllChecks統合テスト', () => {
    it('複数の違反を一度に検出すること', () => {
      const html = `
        <a href="/page1">こちら</a>
        <h1>タイトル</h1>
        <h3>スキップされた見出し</h3>
        <img src="test.jpg" alt="${'a'.repeat(150)}">
        <button></button>
      `;
      const violations = CustomRulesService.runAllChecks(html);

      expect(violations.length).toBe(4);

      const ruleIds = violations.map(v => v.ruleId);
      expect(ruleIds).toContain(CUSTOM_RULE_IDS.AMBIGUOUS_LINK);
      expect(ruleIds).toContain(CUSTOM_RULE_IDS.HEADING_SKIP);
      expect(ruleIds).toContain(CUSTOM_RULE_IDS.LONG_ALT);
      expect(ruleIds).toContain(CUSTOM_RULE_IDS.EMPTY_INTERACTIVE);

      // 全ての違反がtoolSource: 'custom'であること (9.3)
      expect(violations.every(v => v.toolSource === 'custom')).toBe(true);
    });

    it('違反がない場合は空配列を返すこと', () => {
      const html = `
        <a href="/products">製品一覧</a>
        <h1>タイトル</h1>
        <h2>セクション</h2>
        <img src="test.jpg" alt="製品画像">
        <button>送信</button>
      `;
      const violations = CustomRulesService.runAllChecks(html);

      expect(violations.length).toBe(0);
    });
  });

  describe('違反結果の形式', () => {
    it('CustomRuleViolation型の全フィールドが設定されていること', () => {
      const html = '<a href="/page">こちら</a>';
      const violations = CustomRulesService.checkAmbiguousLink(html);

      expect(violations.length).toBeGreaterThan(0);
      const violation = violations[0];

      expect(violation.ruleId).toBeDefined();
      expect(violation.description).toBeDefined();
      expect(violation.impact).toBeDefined();
      expect(violation.toolSource).toBe('custom');
      expect(violation.wcagCriteria).toBeDefined();
      expect(Array.isArray(violation.wcagCriteria)).toBe(true);
      expect(violation.helpUrl).toBeDefined();
      expect(violation.selector).toBeDefined();
      expect(violation.html).toBeDefined();
    });

    it('WCAG成功基準が正しく設定されていること', () => {
      // 曖昧なリンク: WCAG 2.4.4 Link Purpose (In Context)
      const linkHtml = '<a href="/page">こちら</a>';
      const linkViolations = CustomRulesService.checkAmbiguousLink(linkHtml);
      expect(linkViolations[0].wcagCriteria).toContain('2.4.4');

      // 見出しスキップ: WCAG 1.3.1 Info and Relationships
      const headingHtml = '<h1>タイトル</h1><h3>サブ</h3>';
      const headingViolations = CustomRulesService.checkHeadingSkip(headingHtml);
      expect(headingViolations[0].wcagCriteria).toContain('1.3.1');

      // 長いalt: WCAG 1.1.1 Non-text Content
      const altHtml = `<img src="test.jpg" alt="${'a'.repeat(150)}">`;
      const altViolations = CustomRulesService.checkLongAlt(altHtml);
      expect(altViolations[0].wcagCriteria).toContain('1.1.1');

      // 空のインタラクティブ: WCAG 4.1.2 Name, Role, Value
      const emptyHtml = '<button></button>';
      const emptyViolations = CustomRulesService.checkEmptyInteractive(emptyHtml);
      expect(emptyViolations[0].wcagCriteria).toContain('4.1.2');
    });
  });
});
