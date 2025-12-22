import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTimeoutConfig, DEFAULT_TIMEOUTS, type TimeoutConfig } from '../timeout-config';

describe('TimeoutConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 環境変数をリセット
    process.env = { ...originalEnv };
    // テスト用にタイムアウト関連の環境変数を削除
    delete process.env.AXE_TIMEOUT_MS;
    delete process.env.PA11Y_TIMEOUT_MS;
    delete process.env.LIGHTHOUSE_TIMEOUT_MS;
    delete process.env.PAGE_LOAD_TIMEOUT_MS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('DEFAULT_TIMEOUTS', () => {
    it('ページ読み込みタイムアウトのデフォルト値は90秒', () => {
      expect(DEFAULT_TIMEOUTS.pageLoadTimeout).toBe(90000);
    });

    it('axe-coreタイムアウトのデフォルト値は120秒', () => {
      expect(DEFAULT_TIMEOUTS.axeTimeout).toBe(120000);
    });

    it('Pa11yタイムアウトのデフォルト値は90秒', () => {
      expect(DEFAULT_TIMEOUTS.pa11yTimeout).toBe(90000);
    });

    it('Pa11y安定化待機時間のデフォルト値は3秒', () => {
      expect(DEFAULT_TIMEOUTS.pa11yWait).toBe(3000);
    });

    it('Lighthouse maxWaitForLoadのデフォルト値は90秒', () => {
      expect(DEFAULT_TIMEOUTS.lighthouseMaxWaitForLoad).toBe(90000);
    });

    it('Lighthouse maxWaitForFcpのデフォルト値は60秒', () => {
      expect(DEFAULT_TIMEOUTS.lighthouseMaxWaitForFcp).toBe(60000);
    });
  });

  describe('getTimeoutConfig', () => {
    it('環境変数が未設定の場合、デフォルト値を返す', () => {
      const config = getTimeoutConfig();

      expect(config.pageLoadTimeout).toBe(90000);
      expect(config.axeTimeout).toBe(120000);
      expect(config.pa11yTimeout).toBe(90000);
      expect(config.pa11yWait).toBe(3000);
      expect(config.lighthouseMaxWaitForLoad).toBe(90000);
      expect(config.lighthouseMaxWaitForFcp).toBe(60000);
    });

    it('AXE_TIMEOUT_MSでaxe-coreタイムアウトを上書きできる', () => {
      process.env.AXE_TIMEOUT_MS = '180000';

      const config = getTimeoutConfig();

      expect(config.axeTimeout).toBe(180000);
      expect(config.pa11yTimeout).toBe(90000); // 他は変更なし
    });

    it('PA11Y_TIMEOUT_MSでPa11yタイムアウトを上書きできる', () => {
      process.env.PA11Y_TIMEOUT_MS = '120000';

      const config = getTimeoutConfig();

      expect(config.pa11yTimeout).toBe(120000);
      expect(config.axeTimeout).toBe(120000); // 他は変更なし
    });

    it('LIGHTHOUSE_TIMEOUT_MSでLighthouseタイムアウトを上書きできる', () => {
      process.env.LIGHTHOUSE_TIMEOUT_MS = '150000';

      const config = getTimeoutConfig();

      expect(config.lighthouseMaxWaitForLoad).toBe(150000);
      expect(config.pa11yTimeout).toBe(90000); // 他は変更なし
    });

    it('PAGE_LOAD_TIMEOUT_MSでページ読み込みタイムアウトを上書きできる', () => {
      process.env.PAGE_LOAD_TIMEOUT_MS = '120000';

      const config = getTimeoutConfig();

      expect(config.pageLoadTimeout).toBe(120000);
    });

    it('無効な値の場合はデフォルト値を使用する', () => {
      process.env.AXE_TIMEOUT_MS = 'invalid';

      const config = getTimeoutConfig();

      expect(config.axeTimeout).toBe(120000);
    });

    it('負の値の場合はデフォルト値を使用する', () => {
      process.env.AXE_TIMEOUT_MS = '-1000';

      const config = getTimeoutConfig();

      expect(config.axeTimeout).toBe(120000);
    });

    it('複数の環境変数を同時に設定できる', () => {
      process.env.AXE_TIMEOUT_MS = '180000';
      process.env.PA11Y_TIMEOUT_MS = '120000';
      process.env.LIGHTHOUSE_TIMEOUT_MS = '150000';
      process.env.PAGE_LOAD_TIMEOUT_MS = '100000';

      const config = getTimeoutConfig();

      expect(config.axeTimeout).toBe(180000);
      expect(config.pa11yTimeout).toBe(120000);
      expect(config.lighthouseMaxWaitForLoad).toBe(150000);
      expect(config.pageLoadTimeout).toBe(100000);
    });

    it('設定はイミュータブルである', () => {
      const config = getTimeoutConfig();

      // TypeScriptの型チェックでイミュータブル性が保証されるが、
      // ランタイムでも確認
      expect(Object.isFrozen(DEFAULT_TIMEOUTS)).toBe(true);
    });
  });
});
