import { describe, it, expect } from 'vitest';
import { extractOriginalUrl, extractHostname, getDisplayDomain } from './url-utils';

describe('url-utils', () => {
  describe('extractOriginalUrl', () => {
    it('targetOriginUrlパラメータから実際のURLを抽出する', () => {
      const redirectUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc?targetOriginUrl=https%3A%2F%2Fwww.w3.org%2FWAI%2FWCAG21%2F';
      expect(extractOriginalUrl(redirectUrl)).toBe('https://www.w3.org/WAI/WCAG21/');
    });

    it('MDNのURLを抽出する', () => {
      const redirectUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/xyz?targetOriginUrl=https%3A%2F%2Fdeveloper.mozilla.org%2Fen-US%2Fdocs%2FWeb%2FAccessibility';
      expect(extractOriginalUrl(redirectUrl)).toBe('https://developer.mozilla.org/en-US/docs/Web/Accessibility');
    });

    it('デジタル庁ガイドラインのURLを抽出する', () => {
      const redirectUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/123?targetOriginUrl=https%3A%2F%2Fwww.digital.go.jp%2Fresources%2Faccessibility_guideline';
      expect(extractOriginalUrl(redirectUrl)).toBe('https://www.digital.go.jp/resources/accessibility_guideline');
    });

    it('targetOriginUrlがない場合はnullを返す', () => {
      expect(extractOriginalUrl('https://example.com/path')).toBeNull();
    });

    it('targetOriginUrlパラメータが空の場合はnullを返す', () => {
      expect(extractOriginalUrl('https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc?targetOriginUrl=')).toBeNull();
    });

    it('無効なURLの場合はnullを返す', () => {
      expect(extractOriginalUrl('not-a-url')).toBeNull();
    });

    it('空文字列の場合はnullを返す', () => {
      expect(extractOriginalUrl('')).toBeNull();
    });
  });

  describe('extractHostname', () => {
    it('URLからホスト名を抽出する', () => {
      expect(extractHostname('https://www.w3.org/WAI/WCAG21/')).toBe('www.w3.org');
    });

    it('MDN URLからホスト名を抽出する', () => {
      expect(extractHostname('https://developer.mozilla.org/en-US/docs')).toBe('developer.mozilla.org');
    });

    it('ポート番号付きURLからホスト名を抽出する', () => {
      expect(extractHostname('http://localhost:3000/path')).toBe('localhost');
    });

    it('無効なURLの場合は入力をそのまま返す', () => {
      expect(extractHostname('not-a-url')).toBe('not-a-url');
    });

    it('空文字列の場合は空文字列を返す', () => {
      expect(extractHostname('')).toBe('');
    });
  });

  describe('getDisplayDomain', () => {
    it('リダイレクトURLから実際のドメインを取得する（W3C）', () => {
      const redirectUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc?targetOriginUrl=https%3A%2F%2Fwww.w3.org%2FWAI%2FWCAG21%2F';
      expect(getDisplayDomain(redirectUrl)).toBe('www.w3.org');
    });

    it('リダイレクトURLから実際のドメインを取得する（MDN）', () => {
      const redirectUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/xyz?targetOriginUrl=https%3A%2F%2Fdeveloper.mozilla.org%2Fen-US%2Fdocs';
      expect(getDisplayDomain(redirectUrl)).toBe('developer.mozilla.org');
    });

    it('リダイレクトURLから実際のドメインを取得する（デジタル庁）', () => {
      const redirectUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/123?targetOriginUrl=https%3A%2F%2Fwww.digital.go.jp%2Fresources';
      expect(getDisplayDomain(redirectUrl)).toBe('www.digital.go.jp');
    });

    it('リダイレクトURLから実際のドメインを取得する（Ameba a11y-guidelines）', () => {
      const redirectUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/456?targetOriginUrl=https%3A%2F%2Fa11y-guidelines.ameba.design%2F';
      expect(getDisplayDomain(redirectUrl)).toBe('a11y-guidelines.ameba.design');
    });

    it('targetOriginUrlがない場合はリダイレクトURLのホスト名を返す', () => {
      const redirectUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc';
      expect(getDisplayDomain(redirectUrl)).toBe('vertexaisearch.cloud.google.com');
    });

    it('通常のURLの場合はそのホスト名を返す', () => {
      expect(getDisplayDomain('https://www.w3.org/WAI/WCAG21/')).toBe('www.w3.org');
    });

    it('無効なURLの場合は入力をそのまま返す', () => {
      expect(getDisplayDomain('not-a-url')).toBe('not-a-url');
    });
  });
});
