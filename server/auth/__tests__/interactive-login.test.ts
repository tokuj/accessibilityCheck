/**
 * InteractiveLogin テスト
 * headedブラウザでのユーザー手動ログインとセッションキャプチャのテスト
 *
 * Task 7: InteractiveLoginサービス実装
 * Requirements: 1.1-1.3, 2.5, 3.3, 4.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Browser, BrowserContext, Page } from 'playwright';

// テスト用の型定義（実装前）
interface LoginSession {
  id: string;
  loginUrl: string;
  startedAt: string;
  status: 'waiting_for_login' | 'ready_to_capture' | 'captured' | 'cancelled';
}

interface LoginOptions {
  timeout?: number;
  browserType?: 'chromium' | 'firefox' | 'webkit';
}

type LoginError =
  | { type: 'browser_launch_failed'; message: string }
  | { type: 'navigation_failed'; message: string }
  | { type: 'headless_environment'; message: string };

type CaptureError =
  | { type: 'session_not_found'; message: string }
  | { type: 'capture_failed'; message: string }
  | { type: 'save_failed'; message: string };

// Playwrightのモック
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

describe('InteractiveLogin', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('headless環境検出テスト', () => {
    it('ALLOW_HEADED_BROWSER環境変数が未設定の場合、headless_environmentエラーを返す', async () => {
      delete process.env.ALLOW_HEADED_BROWSER;

      // 実装後にこのテストが動作するようにインポートを遅延
      const { InteractiveLoginService } = await import('../interactive-login');
      const service = new InteractiveLoginService();

      const result = await service.startLogin('https://example.com/login');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('headless_environment');
      }
    });

    it('ALLOW_HEADED_BROWSER=trueの場合、headedブラウザを起動できる', async () => {
      process.env.ALLOW_HEADED_BROWSER = 'true';

      const mockPage = {
        goto: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
      };
      const mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        storageState: vi.fn().mockResolvedValue({
          cookies: [],
          origins: [],
        }),
        close: vi.fn(),
      };
      const mockBrowser = {
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn(),
      };

      const { chromium } = await import('playwright');
      (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(mockBrowser);

      const { InteractiveLoginService } = await import('../interactive-login');
      const service = new InteractiveLoginService();

      const result = await service.startLogin('https://example.com/login');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.status).toBe('waiting_for_login');
        expect(result.value.loginUrl).toBe('https://example.com/login');
      }

      // クリーンアップ
      await service.cancelLogin(result.success ? result.value.id : '');
    });
  });

  describe('セッションライフサイクルテスト', () => {
    beforeEach(() => {
      process.env.ALLOW_HEADED_BROWSER = 'true';
    });

    it('startLoginで新しいLoginSessionが作成される', async () => {
      const mockPage = {
        goto: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
      };
      const mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        storageState: vi.fn().mockResolvedValue({
          cookies: [],
          origins: [],
        }),
        close: vi.fn(),
      };
      const mockBrowser = {
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn(),
      };

      const { chromium } = await import('playwright');
      (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(mockBrowser);

      const { InteractiveLoginService } = await import('../interactive-login');
      const service = new InteractiveLoginService();

      const result = await service.startLogin('https://example.com/login');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBeDefined();
        expect(result.value.loginUrl).toBe('https://example.com/login');
        expect(result.value.status).toBe('waiting_for_login');
        expect(result.value.startedAt).toBeDefined();
      }

      await service.cancelLogin(result.success ? result.value.id : '');
    });

    it('同時に1つのLoginSessionのみアクティブ', async () => {
      const mockPage = {
        goto: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
      };
      const mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        storageState: vi.fn().mockResolvedValue({
          cookies: [],
          origins: [],
        }),
        close: vi.fn(),
      };
      const mockBrowser = {
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn(),
      };

      const { chromium } = await import('playwright');
      (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(mockBrowser);

      const { InteractiveLoginService } = await import('../interactive-login');
      const service = new InteractiveLoginService();

      const result1 = await service.startLogin('https://example.com/login1');
      expect(result1.success).toBe(true);

      // 2つ目のセッションを開始しようとするとエラー
      const result2 = await service.startLogin('https://example.com/login2');
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error.type).toBe('browser_launch_failed');
        expect(result2.error.message).toContain('既にアクティブなセッション');
      }

      await service.cancelLogin(result1.success ? result1.value.id : '');
    });

    it('getActiveSessionでアクティブセッションを取得できる', async () => {
      const mockPage = {
        goto: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
      };
      const mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        storageState: vi.fn().mockResolvedValue({
          cookies: [],
          origins: [],
        }),
        close: vi.fn(),
      };
      const mockBrowser = {
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn(),
      };

      const { chromium } = await import('playwright');
      (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(mockBrowser);

      const { InteractiveLoginService } = await import('../interactive-login');
      const service = new InteractiveLoginService();

      // セッションがない状態
      expect(service.getActiveSession()).toBeNull();

      // セッション開始
      const result = await service.startLogin('https://example.com/login');
      expect(result.success).toBe(true);

      // アクティブセッションが取得できる
      const activeSession = service.getActiveSession();
      expect(activeSession).not.toBeNull();
      expect(activeSession?.loginUrl).toBe('https://example.com/login');

      await service.cancelLogin(result.success ? result.value.id : '');
    });

    it('cancelLoginでブラウザが閉じられる', async () => {
      const mockPage = {
        goto: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
      };
      const mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        storageState: vi.fn().mockResolvedValue({
          cookies: [],
          origins: [],
        }),
        close: vi.fn(),
      };
      const mockBrowser = {
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn(),
      };

      const { chromium } = await import('playwright');
      (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(mockBrowser);

      const { InteractiveLoginService } = await import('../interactive-login');
      const service = new InteractiveLoginService();

      const result = await service.startLogin('https://example.com/login');
      expect(result.success).toBe(true);

      const sessionId = result.success ? result.value.id : '';
      await service.cancelLogin(sessionId);

      // ブラウザがクローズされる
      expect(mockBrowser.close).toHaveBeenCalled();

      // アクティブセッションがnullになる
      expect(service.getActiveSession()).toBeNull();
    });
  });

  describe('captureSessionテスト', () => {
    beforeEach(() => {
      process.env.ALLOW_HEADED_BROWSER = 'true';
    });

    it('セッションが存在しない場合session_not_foundエラー', async () => {
      const { InteractiveLoginService } = await import('../interactive-login');
      const service = new InteractiveLoginService();

      const result = await service.captureSession(
        'non-existent-id',
        'test-session',
        'passphrase'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('session_not_found');
      }
    });

    it('storageStateをキャプチャしてセッションを保存する', async () => {
      const mockStorageState = {
        cookies: [
          {
            name: 'session',
            value: 'abc123',
            domain: 'example.com',
            path: '/',
          },
        ],
        origins: [],
      };

      const mockPage = {
        goto: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
      };
      const mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        storageState: vi.fn().mockResolvedValue(mockStorageState),
        close: vi.fn(),
      };
      const mockBrowser = {
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn(),
      };

      const { chromium } = await import('playwright');
      (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(mockBrowser);

      // StorageStateManagerのモック
      const mockStorageStateManager = {
        save: vi.fn().mockResolvedValue({
          success: true,
          value: {
            id: 'saved-session-id',
            name: 'test-session',
            domain: 'example.com',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            schemaVersion: 1,
            authType: 'form' as const,
            autoDestroy: false,
          },
        }),
      };

      const { InteractiveLoginService } = await import('../interactive-login');
      const service = new InteractiveLoginService(mockStorageStateManager as any);

      const startResult = await service.startLogin('https://example.com/login');
      expect(startResult.success).toBe(true);

      const sessionId = startResult.success ? startResult.value.id : '';
      const captureResult = await service.captureSession(
        sessionId,
        'test-session',
        'passphrase'
      );

      expect(captureResult.success).toBe(true);
      if (captureResult.success) {
        expect(captureResult.value.name).toBe('test-session');
      }

      // storageStateがキャプチャされた
      expect(mockContext.storageState).toHaveBeenCalled();

      // StorageStateManagerで保存された
      expect(mockStorageStateManager.save).toHaveBeenCalledWith(
        'test-session',
        mockStorageState,
        'passphrase',
        expect.any(Object)
      );

      // ブラウザがクローズされた
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('タイムアウトテスト', () => {
    beforeEach(() => {
      process.env.ALLOW_HEADED_BROWSER = 'true';
    });

    it('デフォルトタイムアウトは5分（300000ms）', async () => {
      const { InteractiveLoginService, DEFAULT_TIMEOUT } = await import('../interactive-login');
      expect(DEFAULT_TIMEOUT).toBe(300000);
    });

    it('カスタムタイムアウトを設定できる', async () => {
      const mockPage = {
        goto: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
      };
      const mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        storageState: vi.fn().mockResolvedValue({
          cookies: [],
          origins: [],
        }),
        close: vi.fn(),
      };
      const mockBrowser = {
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn(),
      };

      const { chromium } = await import('playwright');
      (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(mockBrowser);

      const { InteractiveLoginService } = await import('../interactive-login');
      const service = new InteractiveLoginService();

      const result = await service.startLogin('https://example.com/login', {
        timeout: 60000,
      });

      expect(result.success).toBe(true);

      await service.cancelLogin(result.success ? result.value.id : '');
    });
  });

  describe('URL検証テスト', () => {
    beforeEach(() => {
      process.env.ALLOW_HEADED_BROWSER = 'true';
    });

    it('無効なURLの場合navigation_failedエラー', async () => {
      const { InteractiveLoginService } = await import('../interactive-login');
      const service = new InteractiveLoginService();

      const result = await service.startLogin('not-a-valid-url');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('navigation_failed');
      }
    });

    it('HTTP/HTTPSスキームのみ許可', async () => {
      const { InteractiveLoginService } = await import('../interactive-login');
      const service = new InteractiveLoginService();

      const result = await service.startLogin('file:///etc/passwd');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('navigation_failed');
      }
    });
  });
});
