/**
 * FormAnalyzerService テスト
 * Task 1.2: フォーム要素検出ロジック
 * Task 1.3: エラーハンドリング
 * Task 1.4: ユニットテスト
 *
 * TDDアプローチ: まずテストを作成し、実装を進める
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Browser, BrowserContext, Page, Locator } from 'playwright';

// FormAnalyzerServiceをモック可能な形でインポート
// 実際のPlaywrightを使わずにテストするためのモック構造
describe('FormAnalyzerService', () => {
  // モック用のブラウザ/ページオブジェクト
  let mockBrowser: Partial<Browser>;
  let mockContext: Partial<BrowserContext>;
  let mockPage: Partial<Page>;

  beforeEach(() => {
    // 各テスト前にモックをリセット
    mockPage = {
      goto: vi.fn().mockResolvedValue(null),
      locator: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
    };

    mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeLoginForm - 正常系', () => {
    it('パスワードフィールドを正しく検出できること', async () => {
      // このテストは実装後に有効化
      const { FormAnalyzerService } = await import('../form-analyzer');

      // モックセットアップ
      const mockPasswordLocator = {
        count: vi.fn().mockResolvedValue(1),
        nth: vi.fn().mockReturnValue({
          getAttribute: vi.fn()
            .mockResolvedValueOnce('password') // name
            .mockResolvedValueOnce('password') // id
            .mockResolvedValueOnce('password') // type
            .mockResolvedValueOnce(null), // placeholder
          evaluate: vi.fn().mockResolvedValue(null), // label
        }),
      };

      mockPage.locator = vi.fn().mockImplementation((selector: string) => {
        if (selector === 'input[type="password"]') {
          return mockPasswordLocator;
        }
        return { count: vi.fn().mockResolvedValue(0) };
      });

      const service = new FormAnalyzerService();
      // 内部のブラウザ起動をモック
      vi.spyOn(service as any, 'launchBrowser').mockResolvedValue(mockBrowser);

      const result = await service.analyzeLoginForm('https://example.com/login');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.passwordFields.length).toBeGreaterThan(0);
        expect(result.value.passwordFields[0].type).toBe('password');
      }
    });

    it('ユーザー名フィールドを正しく検出できること（email type）', async () => {
      const { FormAnalyzerService } = await import('../form-analyzer');

      const mockEmailLocator = {
        count: vi.fn().mockResolvedValue(1),
        nth: vi.fn().mockReturnValue({
          getAttribute: vi.fn()
            .mockResolvedValueOnce('email') // name
            .mockResolvedValueOnce('email') // id
            .mockResolvedValueOnce('email') // type
            .mockResolvedValueOnce('Enter email'), // placeholder
          evaluate: vi.fn().mockResolvedValue('Email'),
        }),
      };

      const mockPasswordLocator = {
        count: vi.fn().mockResolvedValue(1),
        nth: vi.fn().mockReturnValue({
          getAttribute: vi.fn()
            .mockResolvedValueOnce('password')
            .mockResolvedValueOnce('password')
            .mockResolvedValueOnce('password')
            .mockResolvedValueOnce(null),
          evaluate: vi.fn().mockResolvedValue(null),
        }),
      };

      mockPage.locator = vi.fn().mockImplementation((selector: string) => {
        if (selector.includes('email')) {
          return mockEmailLocator;
        }
        if (selector === 'input[type="password"]') {
          return mockPasswordLocator;
        }
        return { count: vi.fn().mockResolvedValue(0) };
      });

      const service = new FormAnalyzerService();
      vi.spyOn(service as any, 'launchBrowser').mockResolvedValue(mockBrowser);

      const result = await service.analyzeLoginForm('https://example.com/login');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.usernameFields.length).toBeGreaterThan(0);
        expect(result.value.usernameFields[0].type).toBe('email');
      }
    });

    it('送信ボタンを正しく検出できること', async () => {
      const { FormAnalyzerService } = await import('../form-analyzer');

      const mockSubmitLocator = {
        count: vi.fn().mockResolvedValue(1),
        nth: vi.fn().mockReturnValue({
          getAttribute: vi.fn()
            .mockResolvedValueOnce(null) // name
            .mockResolvedValueOnce('submit-btn') // id
            .mockResolvedValueOnce('submit') // type
            .mockResolvedValueOnce(null), // placeholder
          evaluate: vi.fn().mockResolvedValue(null),
          textContent: vi.fn().mockResolvedValue('ログイン'),
        }),
      };

      const mockPasswordLocator = {
        count: vi.fn().mockResolvedValue(1),
        nth: vi.fn().mockReturnValue({
          getAttribute: vi.fn()
            .mockResolvedValueOnce('password')
            .mockResolvedValueOnce('password')
            .mockResolvedValueOnce('password')
            .mockResolvedValueOnce(null),
          evaluate: vi.fn().mockResolvedValue(null),
        }),
      };

      mockPage.locator = vi.fn().mockImplementation((selector: string) => {
        if (selector.includes('submit')) {
          return mockSubmitLocator;
        }
        if (selector === 'input[type="password"]') {
          return mockPasswordLocator;
        }
        return { count: vi.fn().mockResolvedValue(0) };
      });

      const service = new FormAnalyzerService();
      vi.spyOn(service as any, 'launchBrowser').mockResolvedValue(mockBrowser);

      const result = await service.analyzeLoginForm('https://example.com/login');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.submitButtons.length).toBeGreaterThan(0);
      }
    });

    it('信頼度スコアが正しく算出されること', async () => {
      const { FormAnalyzerService } = await import('../form-analyzer');

      const mockPasswordLocator = {
        count: vi.fn().mockResolvedValue(1),
        nth: vi.fn().mockReturnValue({
          getAttribute: vi.fn()
            .mockResolvedValueOnce('password')
            .mockResolvedValueOnce('password')
            .mockResolvedValueOnce('password')
            .mockResolvedValueOnce(null),
          evaluate: vi.fn().mockResolvedValue('Password'),
        }),
      };

      mockPage.locator = vi.fn().mockImplementation((selector: string) => {
        if (selector === 'input[type="password"]') {
          return mockPasswordLocator;
        }
        return { count: vi.fn().mockResolvedValue(0) };
      });

      const service = new FormAnalyzerService();
      vi.spyOn(service as any, 'launchBrowser').mockResolvedValue(mockBrowser);

      const result = await service.analyzeLoginForm('https://example.com/login');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.passwordFields[0].confidence).toBeGreaterThan(0);
        expect(result.value.passwordFields[0].confidence).toBeLessThanOrEqual(1);
      }
    });

    it('複数の候補が信頼度順にソートされること', async () => {
      const { FormAnalyzerService } = await import('../form-analyzer');

      const mockPasswordLocator = {
        count: vi.fn().mockResolvedValue(2),
        nth: vi.fn().mockImplementation((index: number) => ({
          getAttribute: vi.fn()
            .mockResolvedValueOnce(index === 0 ? 'pass1' : 'pass2')
            .mockResolvedValueOnce(index === 0 ? 'pass1' : 'pass2')
            .mockResolvedValueOnce('password')
            .mockResolvedValueOnce(null),
          evaluate: vi.fn().mockResolvedValue(index === 0 ? null : 'Password'),
        })),
      };

      mockPage.locator = vi.fn().mockImplementation((selector: string) => {
        if (selector === 'input[type="password"]') {
          return mockPasswordLocator;
        }
        return { count: vi.fn().mockResolvedValue(0) };
      });

      const service = new FormAnalyzerService();
      vi.spyOn(service as any, 'launchBrowser').mockResolvedValue(mockBrowser);

      const result = await service.analyzeLoginForm('https://example.com/login');

      expect(result.success).toBe(true);
      if (result.success && result.value.passwordFields.length >= 2) {
        // 信頼度が高い順にソートされている
        expect(result.value.passwordFields[0].confidence)
          .toBeGreaterThanOrEqual(result.value.passwordFields[1].confidence);
      }
    });
  });

  describe('analyzeLoginForm - エラーハンドリング（Task 1.3）', () => {
    it('ナビゲーション失敗時にnavigation_failedエラーを返すこと', async () => {
      const { FormAnalyzerService } = await import('../form-analyzer');

      mockPage.goto = vi.fn().mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED'));

      const service = new FormAnalyzerService();
      vi.spyOn(service as any, 'launchBrowser').mockResolvedValue(mockBrowser);

      const result = await service.analyzeLoginForm('https://invalid-domain-xyz.com/login');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('navigation_failed');
      }
    });

    it('タイムアウト時にtimeoutエラーを返すこと', async () => {
      const { FormAnalyzerService } = await import('../form-analyzer');

      mockPage.goto = vi.fn().mockRejectedValue(new Error('Timeout 30000ms exceeded'));

      const service = new FormAnalyzerService();
      vi.spyOn(service as any, 'launchBrowser').mockResolvedValue(mockBrowser);

      const result = await service.analyzeLoginForm('https://slow-site.com/login', { timeout: 100 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('timeout');
      }
    });

    it('パスワードフィールドが見つからない場合にno_form_foundエラーを返すこと', async () => {
      const { FormAnalyzerService } = await import('../form-analyzer');

      // 全てのセレクタで要素が見つからない
      mockPage.locator = vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(0),
      });

      const service = new FormAnalyzerService();
      vi.spyOn(service as any, 'launchBrowser').mockResolvedValue(mockBrowser);

      const result = await service.analyzeLoginForm('https://example.com/no-form');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('no_form_found');
      }
    });

    it('ブラウザクローズが確実に行われること', async () => {
      const { FormAnalyzerService } = await import('../form-analyzer');

      mockPage.locator = vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(0),
      });

      const service = new FormAnalyzerService();
      vi.spyOn(service as any, 'launchBrowser').mockResolvedValue(mockBrowser);

      await service.analyzeLoginForm('https://example.com/login');

      // ブラウザがクローズされていることを確認
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('エラー発生時でもブラウザがクローズされること', async () => {
      const { FormAnalyzerService } = await import('../form-analyzer');

      mockPage.goto = vi.fn().mockRejectedValue(new Error('Some error'));

      const service = new FormAnalyzerService();
      vi.spyOn(service as any, 'launchBrowser').mockResolvedValue(mockBrowser);

      await service.analyzeLoginForm('https://example.com/login');

      // エラー発生時もブラウザがクローズされている
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('セレクタ生成', () => {
    it('idがある場合は#id形式のセレクタを生成すること', async () => {
      const { FormAnalyzerService } = await import('../form-analyzer');

      const mockPasswordLocator = {
        count: vi.fn().mockResolvedValue(1),
        nth: vi.fn().mockReturnValue({
          getAttribute: vi.fn()
            .mockResolvedValueOnce('pwd') // name
            .mockResolvedValueOnce('password-input') // id
            .mockResolvedValueOnce('password') // type
            .mockResolvedValueOnce(null), // placeholder
          evaluate: vi.fn().mockResolvedValue(null),
        }),
      };

      mockPage.locator = vi.fn().mockImplementation((selector: string) => {
        if (selector === 'input[type="password"]') {
          return mockPasswordLocator;
        }
        return { count: vi.fn().mockResolvedValue(0) };
      });

      const service = new FormAnalyzerService();
      vi.spyOn(service as any, 'launchBrowser').mockResolvedValue(mockBrowser);

      const result = await service.analyzeLoginForm('https://example.com/login');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.passwordFields[0].selector).toBe('#password-input');
      }
    });

    it('idがなくnameがある場合はname属性でセレクタを生成すること', async () => {
      const { FormAnalyzerService } = await import('../form-analyzer');

      const mockPasswordLocator = {
        count: vi.fn().mockResolvedValue(1),
        nth: vi.fn().mockReturnValue({
          getAttribute: vi.fn()
            .mockResolvedValueOnce('user_password') // name
            .mockResolvedValueOnce(null) // id
            .mockResolvedValueOnce('password') // type
            .mockResolvedValueOnce(null), // placeholder
          evaluate: vi.fn().mockResolvedValue(null),
        }),
      };

      mockPage.locator = vi.fn().mockImplementation((selector: string) => {
        if (selector === 'input[type="password"]') {
          return mockPasswordLocator;
        }
        return { count: vi.fn().mockResolvedValue(0) };
      });

      const service = new FormAnalyzerService();
      vi.spyOn(service as any, 'launchBrowser').mockResolvedValue(mockBrowser);

      const result = await service.analyzeLoginForm('https://example.com/login');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.passwordFields[0].selector).toBe('input[name="user_password"]');
      }
    });
  });

  describe('全体の信頼度', () => {
    it('全要素が検出された場合はhigh信頼度を返すこと', async () => {
      const { FormAnalyzerService } = await import('../form-analyzer');

      const createMockLocator = (hasElement: boolean) => ({
        count: vi.fn().mockResolvedValue(hasElement ? 1 : 0),
        nth: vi.fn().mockReturnValue({
          getAttribute: vi.fn()
            .mockResolvedValueOnce('name')
            .mockResolvedValueOnce('id')
            .mockResolvedValueOnce('type')
            .mockResolvedValueOnce(null),
          evaluate: vi.fn().mockResolvedValue('Label'),
          textContent: vi.fn().mockResolvedValue('Button'),
        }),
      });

      mockPage.locator = vi.fn().mockImplementation((selector: string) => {
        // 全てのセレクタで要素を返す
        return createMockLocator(true);
      });

      const service = new FormAnalyzerService();
      vi.spyOn(service as any, 'launchBrowser').mockResolvedValue(mockBrowser);

      const result = await service.analyzeLoginForm('https://example.com/login');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.confidence).toBe('high');
      }
    });

    it('パスワードのみ検出された場合はlow信頼度を返すこと', async () => {
      const { FormAnalyzerService } = await import('../form-analyzer');

      const mockPasswordLocator = {
        count: vi.fn().mockResolvedValue(1),
        nth: vi.fn().mockReturnValue({
          getAttribute: vi.fn()
            .mockResolvedValueOnce('password')
            .mockResolvedValueOnce('password')
            .mockResolvedValueOnce('password')
            .mockResolvedValueOnce(null),
          evaluate: vi.fn().mockResolvedValue(null),
        }),
      };

      mockPage.locator = vi.fn().mockImplementation((selector: string) => {
        if (selector === 'input[type="password"]') {
          return mockPasswordLocator;
        }
        return { count: vi.fn().mockResolvedValue(0) };
      });

      const service = new FormAnalyzerService();
      vi.spyOn(service as any, 'launchBrowser').mockResolvedValue(mockBrowser);

      const result = await service.analyzeLoginForm('https://example.com/login');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.confidence).toBe('low');
      }
    });
  });
});
