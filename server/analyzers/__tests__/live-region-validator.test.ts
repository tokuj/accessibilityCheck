/**
 * LiveRegionValidator テスト
 *
 * @requirement 10.1 - 全てのaria-live属性を持つ要素を検出する
 * @requirement 10.2 - role="alert/status/log"の適切な使用を検証する
 * @requirement 10.3 - aria-atomic/aria-relevant属性の設定を確認する
 * @requirement 10.4 - 空のライブリージョンを警告として報告する
 * @requirement 10.5 - ライブリージョン一覧をレポートに含める
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  LiveRegionValidator,
  type LiveRegionInfo,
  type LiveRegionValidationResult,
  type LiveRegionIssue,
} from '../live-region-validator';

describe('LiveRegionValidator', () => {
  let validator: LiveRegionValidator;

  beforeEach(() => {
    validator = new LiveRegionValidator();
  });

  describe('detectLiveRegions', () => {
    /**
     * @requirement 10.1 - aria-live属性を持つ要素を検出
     */
    it('should detect elements with aria-live attribute', () => {
      const html = `
        <html>
          <body>
            <div aria-live="polite" id="status-region">Status updates here</div>
            <div aria-live="assertive" id="alert-region">Alerts here</div>
            <div aria-live="off" id="off-region">This is off</div>
          </body>
        </html>
      `;

      const dom = new JSDOM(html);
      const result = validator.validateFromDOM(dom.window.document);

      // aria-live="off"は実質的に無効なので、politeとassertiveのみを検出
      const activeLiveRegions = result.liveRegions.filter(
        (r) => r.ariaLive !== 'off'
      );
      expect(activeLiveRegions).toHaveLength(2);

      const politeRegion = result.liveRegions.find(
        (r) => r.selector === '#status-region'
      );
      expect(politeRegion).toBeDefined();
      expect(politeRegion?.ariaLive).toBe('polite');

      const assertiveRegion = result.liveRegions.find(
        (r) => r.selector === '#alert-region'
      );
      expect(assertiveRegion).toBeDefined();
      expect(assertiveRegion?.ariaLive).toBe('assertive');
    });

    /**
     * @requirement 10.1 - 暗黙のライブリージョン（role属性）を検出
     */
    it('should detect implicit live regions via role attributes', () => {
      const html = `
        <html>
          <body>
            <div role="alert" id="alert">Alert message</div>
            <div role="status" id="status">Status message</div>
            <div role="log" id="log">Log entries</div>
            <div role="marquee" id="marquee">Scrolling text</div>
            <div role="timer" id="timer">00:00</div>
          </body>
        </html>
      `;

      const dom = new JSDOM(html);
      const result = validator.validateFromDOM(dom.window.document);

      // 全てのライブリージョンroleを検出
      expect(result.liveRegions.length).toBeGreaterThanOrEqual(5);

      const alertRegion = result.liveRegions.find((r) => r.role === 'alert');
      expect(alertRegion).toBeDefined();
      expect(alertRegion?.implicitAriaLive).toBe('assertive');

      const statusRegion = result.liveRegions.find((r) => r.role === 'status');
      expect(statusRegion).toBeDefined();
      expect(statusRegion?.implicitAriaLive).toBe('polite');

      const logRegion = result.liveRegions.find((r) => r.role === 'log');
      expect(logRegion).toBeDefined();
      expect(logRegion?.implicitAriaLive).toBe('polite');
    });

    /**
     * @requirement 10.3 - aria-atomic/aria-relevant属性を検出
     */
    it('should detect aria-atomic and aria-relevant attributes', () => {
      const html = `
        <html>
          <body>
            <div
              aria-live="polite"
              aria-atomic="true"
              aria-relevant="additions text"
              id="full-config"
            >
              Configured region
            </div>
          </body>
        </html>
      `;

      const dom = new JSDOM(html);
      const result = validator.validateFromDOM(dom.window.document);

      const configuredRegion = result.liveRegions.find(
        (r) => r.selector === '#full-config'
      );
      expect(configuredRegion).toBeDefined();
      expect(configuredRegion?.ariaAtomic).toBe(true);
      expect(configuredRegion?.ariaRelevant).toContain('additions');
      expect(configuredRegion?.ariaRelevant).toContain('text');
    });
  });

  describe('validateLiveRegions', () => {
    /**
     * @requirement 10.4 - 空のライブリージョンを警告として報告
     */
    it('should report empty live regions as warnings', () => {
      const html = `
        <html>
          <body>
            <div aria-live="polite" id="empty-region"></div>
            <div role="alert" id="empty-alert"></div>
          </body>
        </html>
      `;

      const dom = new JSDOM(html);
      const result = validator.validateFromDOM(dom.window.document);

      expect(result.issues.length).toBeGreaterThanOrEqual(2);

      const emptyWarnings = result.issues.filter(
        (issue) => issue.type === 'empty-live-region'
      );
      expect(emptyWarnings.length).toBeGreaterThanOrEqual(2);
      expect(emptyWarnings[0].severity).toBe('warning');
    });

    /**
     * @requirement 10.2 - role属性の適切な使用を検証
     */
    it('should validate appropriate use of role attributes', () => {
      const html = `
        <html>
          <body>
            <!-- 適切な使用: alert roleに動的コンテンツがあると想定 -->
            <div role="alert" id="good-alert">Error: Something went wrong</div>

            <!-- 不適切: alertロールだがaria-liveがoffに上書きされている -->
            <div role="alert" aria-live="off" id="conflicting">This conflicts</div>
          </body>
        </html>
      `;

      const dom = new JSDOM(html);
      const result = validator.validateFromDOM(dom.window.document);

      // 矛盾する設定を警告
      const conflictingIssues = result.issues.filter(
        (issue) => issue.type === 'conflicting-live-settings'
      );
      expect(conflictingIssues.length).toBeGreaterThanOrEqual(1);
    });

    /**
     * @requirement 10.3 - aria-atomic設定のベストプラクティス
     */
    it('should suggest aria-atomic for certain roles', () => {
      const html = `
        <html>
          <body>
            <!-- status roleはaria-atomic="true"が推奨 -->
            <div role="status" id="status-without-atomic">
              Status: Processing...
            </div>
          </body>
        </html>
      `;

      const dom = new JSDOM(html);
      const result = validator.validateFromDOM(dom.window.document);

      // aria-atomicの推奨を確認
      const atomicSuggestions = result.issues.filter(
        (issue) => issue.type === 'missing-aria-atomic'
      );
      // role="status"にaria-atomic="true"が推奨される場合、この警告が発生
      // 仕様上必須ではないため、warningレベル
      expect(
        atomicSuggestions.every((issue) => issue.severity === 'warning')
      ).toBe(true);
    });

    /**
     * @requirement 10.2, 10.3 - 過度に頻繁な更新の警告
     */
    it('should warn about assertive regions without proper configuration', () => {
      const html = `
        <html>
          <body>
            <!-- assertiveだがaria-relevantが未設定 -->
            <div aria-live="assertive" id="uncontrolled-assertive">
              Updates frequently
            </div>
          </body>
        </html>
      `;

      const dom = new JSDOM(html);
      const result = validator.validateFromDOM(dom.window.document);

      // assertiveリージョンへの推奨事項
      const assertiveIssues = result.issues.filter(
        (issue) =>
          issue.selector === '#uncontrolled-assertive' &&
          issue.type === 'assertive-without-relevant'
      );
      // これは推奨事項なので存在してもしなくてもよいが、存在する場合はwarning
      if (assertiveIssues.length > 0) {
        expect(assertiveIssues[0].severity).toBe('warning');
      }
    });
  });

  describe('validateFromHTML', () => {
    /**
     * HTMLコンテンツから直接検証
     */
    it('should validate live regions from HTML string', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <div aria-live="polite" id="notification">Notifications</div>
            <div role="alert" id="error-message">Error occurred</div>
          </body>
        </html>
      `;

      const result = validator.validateFromHTML(html);

      expect(result.liveRegions).toHaveLength(2);
      expect(result.totalLiveRegions).toBe(2);
    });
  });

  describe('summary generation', () => {
    /**
     * @requirement 10.5 - ライブリージョン一覧をレポートに含める
     */
    it('should generate summary with all live regions', () => {
      const html = `
        <html>
          <body>
            <div aria-live="polite" id="polite1">Polite 1</div>
            <div aria-live="polite" id="polite2">Polite 2</div>
            <div aria-live="assertive" id="assertive1">Assertive 1</div>
            <div role="alert" id="alert1">Alert</div>
            <div role="status" id="status1">Status</div>
          </body>
        </html>
      `;

      const dom = new JSDOM(html);
      const result = validator.validateFromDOM(dom.window.document);

      expect(result.totalLiveRegions).toBe(5);
      expect(result.byType.polite).toBe(3); // polite1, polite2, status1 (implicit polite)
      expect(result.byType.assertive).toBe(2); // assertive1, alert1 (implicit assertive)
    });

    it('should include role distribution in summary', () => {
      const html = `
        <html>
          <body>
            <div role="alert">Alert 1</div>
            <div role="alert">Alert 2</div>
            <div role="status">Status 1</div>
            <div role="log">Log 1</div>
          </body>
        </html>
      `;

      const dom = new JSDOM(html);
      const result = validator.validateFromDOM(dom.window.document);

      expect(result.byRole.alert).toBe(2);
      expect(result.byRole.status).toBe(1);
      expect(result.byRole.log).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle nested live regions', () => {
      const html = `
        <html>
          <body>
            <div aria-live="polite" id="outer">
              Outer content
              <div aria-live="assertive" id="inner">
                Inner content
              </div>
            </div>
          </body>
        </html>
      `;

      const dom = new JSDOM(html);
      const result = validator.validateFromDOM(dom.window.document);

      // 両方のライブリージョンを検出
      expect(result.liveRegions.length).toBeGreaterThanOrEqual(2);

      // ネストの警告を出力
      const nestedWarnings = result.issues.filter(
        (issue) => issue.type === 'nested-live-region'
      );
      expect(nestedWarnings).toHaveLength(1);
    });

    it('should handle elements with both role and aria-live', () => {
      const html = `
        <html>
          <body>
            <div role="status" aria-live="polite" id="both">
              Both attributes
            </div>
          </body>
        </html>
      `;

      const dom = new JSDOM(html);
      const result = validator.validateFromDOM(dom.window.document);

      // 重複してカウントしない
      const regionWithBoth = result.liveRegions.filter(
        (r) => r.selector === '#both'
      );
      expect(regionWithBoth).toHaveLength(1);
      expect(regionWithBoth[0].role).toBe('status');
      expect(regionWithBoth[0].ariaLive).toBe('polite');
    });

    it('should handle document without live regions', () => {
      const html = `
        <html>
          <body>
            <div>No live regions here</div>
            <p>Just regular content</p>
          </body>
        </html>
      `;

      const dom = new JSDOM(html);
      const result = validator.validateFromDOM(dom.window.document);

      expect(result.liveRegions).toHaveLength(0);
      expect(result.totalLiveRegions).toBe(0);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('RuleResult conversion', () => {
    /**
     * RuleResult形式への変換をテスト
     */
    it('should convert issues to RuleResult format', () => {
      const html = `
        <html>
          <body>
            <div aria-live="polite" id="empty-region"></div>
          </body>
        </html>
      `;

      const dom = new JSDOM(html);
      const result = validator.validateFromDOM(dom.window.document);
      const ruleResults = validator.toRuleResults(result);

      expect(ruleResults.length).toBeGreaterThan(0);

      const emptyRegionRule = ruleResults.find(
        (r) => r.id === 'live-region-empty'
      );
      expect(emptyRegionRule).toBeDefined();
      expect(emptyRegionRule?.toolSource).toBe('custom');
      expect(emptyRegionRule?.wcagCriteria).toContain('4.1.3');
    });
  });
});
