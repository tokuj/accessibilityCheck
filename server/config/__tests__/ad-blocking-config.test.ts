import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getAdBlockingConfig,
  DEFAULT_AD_SELECTORS,
  DEFAULT_BLOCKED_URL_PATTERNS,
  DEFAULT_BLOCKED_MEDIA_EXTENSIONS,
  type AdBlockingConfig,
} from '../ad-blocking-config';

describe('AdBlockingConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 環境変数をリセット
    process.env = { ...originalEnv };
    delete process.env.DISABLE_AD_BLOCKING;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('DEFAULT_AD_SELECTORS', () => {
    it('広告関連iframeセレクタが含まれる', () => {
      expect(DEFAULT_AD_SELECTORS).toContain('iframe[src*="ads"]');
      expect(DEFAULT_AD_SELECTORS).toContain('iframe[src*="doubleclick"]');
      expect(DEFAULT_AD_SELECTORS).toContain('iframe[src*="googlesyndication"]');
    });

    it('class属性ベースの広告セレクタが含まれる', () => {
      expect(DEFAULT_AD_SELECTORS).toContain('[class*="ad-"]');
      expect(DEFAULT_AD_SELECTORS).toContain('[class*="ads-"]');
      expect(DEFAULT_AD_SELECTORS).toContain('.adsbygoogle');
      expect(DEFAULT_AD_SELECTORS).toContain('.ad-container');
      expect(DEFAULT_AD_SELECTORS).toContain('.advertisement');
    });

    it('id属性ベースの広告セレクタが含まれる', () => {
      expect(DEFAULT_AD_SELECTORS).toContain('[id*="ad-"]');
      expect(DEFAULT_AD_SELECTORS).toContain('[id*="ads-"]');
    });

    it('data属性ベースの広告セレクタが含まれる', () => {
      expect(DEFAULT_AD_SELECTORS).toContain('[data-ad-slot]');
      expect(DEFAULT_AD_SELECTORS).toContain('[data-ad-client]');
    });

    it('セレクタリストはイミュータブルである', () => {
      expect(Object.isFrozen(DEFAULT_AD_SELECTORS)).toBe(true);
    });
  });

  describe('DEFAULT_BLOCKED_URL_PATTERNS', () => {
    it('主要な広告ドメインパターンが含まれる', () => {
      expect(DEFAULT_BLOCKED_URL_PATTERNS).toContain('*doubleclick.net/*');
      expect(DEFAULT_BLOCKED_URL_PATTERNS).toContain('*googlesyndication.com/*');
      expect(DEFAULT_BLOCKED_URL_PATTERNS).toContain('*adservice.google.*');
      expect(DEFAULT_BLOCKED_URL_PATTERNS).toContain('*googleadservices.com/*');
      expect(DEFAULT_BLOCKED_URL_PATTERNS).toContain('*amazon-adsystem.com/*');
      expect(DEFAULT_BLOCKED_URL_PATTERNS).toContain('*ads.yahoo.com/*');
    });

    it('汎用的な広告URLパターンが含まれる', () => {
      expect(DEFAULT_BLOCKED_URL_PATTERNS).toContain('**/*ads*/**');
    });

    it('URLパターンリストはイミュータブルである', () => {
      expect(Object.isFrozen(DEFAULT_BLOCKED_URL_PATTERNS)).toBe(true);
    });
  });

  describe('DEFAULT_BLOCKED_MEDIA_EXTENSIONS', () => {
    it('動画ファイル拡張子が含まれる', () => {
      expect(DEFAULT_BLOCKED_MEDIA_EXTENSIONS).toContain('.mp4');
      expect(DEFAULT_BLOCKED_MEDIA_EXTENSIONS).toContain('.webm');
      expect(DEFAULT_BLOCKED_MEDIA_EXTENSIONS).toContain('.avi');
      expect(DEFAULT_BLOCKED_MEDIA_EXTENSIONS).toContain('.mov');
    });

    it('メディア拡張子リストはイミュータブルである', () => {
      expect(Object.isFrozen(DEFAULT_BLOCKED_MEDIA_EXTENSIONS)).toBe(true);
    });
  });

  describe('getAdBlockingConfig', () => {
    it('環境変数が未設定の場合、広告ブロックは有効', () => {
      const config = getAdBlockingConfig();

      expect(config.enabled).toBe(true);
    });

    it('デフォルトで広告セレクタリストを返す', () => {
      const config = getAdBlockingConfig();

      expect(config.adSelectors).toEqual(DEFAULT_AD_SELECTORS);
    });

    it('デフォルトでブロックURLパターンリストを返す', () => {
      const config = getAdBlockingConfig();

      expect(config.blockedUrlPatterns).toEqual(DEFAULT_BLOCKED_URL_PATTERNS);
    });

    it('デフォルトでメディア拡張子リストを返す', () => {
      const config = getAdBlockingConfig();

      expect(config.blockedMediaExtensions).toEqual(DEFAULT_BLOCKED_MEDIA_EXTENSIONS);
    });

    it('DISABLE_AD_BLOCKING=trueで広告ブロックを無効化できる', () => {
      process.env.DISABLE_AD_BLOCKING = 'true';

      const config = getAdBlockingConfig();

      expect(config.enabled).toBe(false);
    });

    it('DISABLE_AD_BLOCKING=1で広告ブロックを無効化できる', () => {
      process.env.DISABLE_AD_BLOCKING = '1';

      const config = getAdBlockingConfig();

      expect(config.enabled).toBe(false);
    });

    it('DISABLE_AD_BLOCKING=falseの場合、広告ブロックは有効', () => {
      process.env.DISABLE_AD_BLOCKING = 'false';

      const config = getAdBlockingConfig();

      expect(config.enabled).toBe(true);
    });

    it('DISABLE_AD_BLOCKING=無効値の場合、広告ブロックは有効', () => {
      process.env.DISABLE_AD_BLOCKING = 'invalid';

      const config = getAdBlockingConfig();

      expect(config.enabled).toBe(true);
    });

    it('広告ブロック無効時もセレクタリストは返す（他で参照可能）', () => {
      process.env.DISABLE_AD_BLOCKING = 'true';

      const config = getAdBlockingConfig();

      expect(config.adSelectors.length).toBeGreaterThan(0);
      expect(config.blockedUrlPatterns.length).toBeGreaterThan(0);
    });
  });
});
