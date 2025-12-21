/**
 * Form Analyzer API テスト
 * フォーム解析APIエンドポイントのテスト
 *
 * Task 2.2: 解析APIエンドポイントのインテグレーションテスト
 * Requirements: 2.1, 1.3, 1.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';

// Playwrightのモック
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

describe('Form Analyzer API', () => {
  let app: Express;

  beforeEach(async () => {
    vi.resetAllMocks();

    // Expressアプリのセットアップ
    app = express();
    app.use(express.json());
  });

  afterEach(async () => {
    vi.resetAllMocks();
  });

  describe('POST /api/auth/analyze-form', () => {
    describe('バリデーション', () => {
      it('URLが空の場合は400エラー', async () => {
        const { createAuthRouter } = await import('../auth');
        app.use('/api/auth', createAuthRouter());

        const response = await request(app)
          .post('/api/auth/analyze-form')
          .send({ url: '' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
        expect(response.body.error.type).toBe('invalid_url');
      });

      it('URLが未指定の場合は400エラー', async () => {
        const { createAuthRouter } = await import('../auth');
        app.use('/api/auth', createAuthRouter());

        const response = await request(app)
          .post('/api/auth/analyze-form')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
        expect(response.body.error.type).toBe('invalid_url');
      });

      it('無効なURL形式の場合は400エラー', async () => {
        const { createAuthRouter } = await import('../auth');
        app.use('/api/auth', createAuthRouter());

        const response = await request(app)
          .post('/api/auth/analyze-form')
          .send({ url: 'not-a-valid-url' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.type).toBe('invalid_url');
      });

      it('HTTPプロトコルでないURL（file://）の場合は400エラー', async () => {
        const { createAuthRouter } = await import('../auth');
        app.use('/api/auth', createAuthRouter());

        const response = await request(app)
          .post('/api/auth/analyze-form')
          .send({ url: 'file:///etc/passwd' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.type).toBe('invalid_url');
      });
    });

    describe('正常系', () => {
      it('有効なURLで解析結果が返却される', async () => {
        const mockPage = {
          goto: vi.fn().mockResolvedValue(undefined),
          locator: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(1),
            nth: vi.fn().mockReturnValue({
              getAttribute: vi
                .fn()
                .mockImplementation((attr: string) => {
                  const attrs: Record<string, string> = {
                    name: 'username',
                    id: 'user-input',
                    type: 'text',
                    placeholder: 'ユーザー名を入力',
                  };
                  return Promise.resolve(attrs[attr] || null);
                }),
              textContent: vi.fn().mockResolvedValue('ログイン'),
              evaluate: vi.fn().mockResolvedValue('ユーザー名'),
            }),
          }),
          close: vi.fn(),
        };
        const mockContext = {
          newPage: vi.fn().mockResolvedValue(mockPage),
          close: vi.fn(),
        };
        const mockBrowser = {
          newContext: vi.fn().mockResolvedValue(mockContext),
          close: vi.fn(),
        };

        const { chromium } = await import('playwright');
        (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(
          mockBrowser
        );

        const { createAuthRouter } = await import('../auth');
        app.use('/api/auth', createAuthRouter());

        const response = await request(app)
          .post('/api/auth/analyze-form')
          .send({ url: 'https://example.com/login' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.result).toBeDefined();
        expect(response.body.result.usernameFields).toBeDefined();
        expect(response.body.result.passwordFields).toBeDefined();
        expect(response.body.result.submitButtons).toBeDefined();
        expect(response.body.result.confidence).toBeDefined();
      });
    });

    describe('エラー系', () => {
      it('タイムアウトの場合は408エラー', async () => {
        const mockPage = {
          goto: vi.fn().mockRejectedValue(new Error('Timeout exceeded')),
          close: vi.fn(),
        };
        const mockContext = {
          newPage: vi.fn().mockResolvedValue(mockPage),
          close: vi.fn(),
        };
        const mockBrowser = {
          newContext: vi.fn().mockResolvedValue(mockContext),
          close: vi.fn(),
        };

        const { chromium } = await import('playwright');
        (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(
          mockBrowser
        );

        const { createAuthRouter } = await import('../auth');
        app.use('/api/auth', createAuthRouter());

        const response = await request(app)
          .post('/api/auth/analyze-form')
          .send({ url: 'https://slow-server.example.com/login' });

        expect(response.status).toBe(408);
        expect(response.body.success).toBe(false);
        expect(response.body.error.type).toBe('timeout');
      });

      it('ナビゲーション失敗の場合は500エラー', async () => {
        const mockPage = {
          goto: vi.fn().mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED')),
          close: vi.fn(),
        };
        const mockContext = {
          newPage: vi.fn().mockResolvedValue(mockPage),
          close: vi.fn(),
        };
        const mockBrowser = {
          newContext: vi.fn().mockResolvedValue(mockContext),
          close: vi.fn(),
        };

        const { chromium } = await import('playwright');
        (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(
          mockBrowser
        );

        const { createAuthRouter } = await import('../auth');
        app.use('/api/auth', createAuthRouter());

        const response = await request(app)
          .post('/api/auth/analyze-form')
          .send({ url: 'https://nonexistent-domain.example.com/login' });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error.type).toBe('navigation_failed');
      });

      it('フォームが見つからない場合は404エラー', async () => {
        const mockPage = {
          goto: vi.fn().mockResolvedValue(undefined),
          locator: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(0),
            nth: vi.fn(),
          }),
          close: vi.fn(),
        };
        const mockContext = {
          newPage: vi.fn().mockResolvedValue(mockPage),
          close: vi.fn(),
        };
        const mockBrowser = {
          newContext: vi.fn().mockResolvedValue(mockContext),
          close: vi.fn(),
        };

        const { chromium } = await import('playwright');
        (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(
          mockBrowser
        );

        const { createAuthRouter } = await import('../auth');
        app.use('/api/auth', createAuthRouter());

        const response = await request(app)
          .post('/api/auth/analyze-form')
          .send({ url: 'https://no-form.example.com/' });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error.type).toBe('no_form_found');
      });
    });

    describe('ブラウザクローズの保証', () => {
      it('成功時にブラウザがクローズされる', async () => {
        const mockPage = {
          goto: vi.fn().mockResolvedValue(undefined),
          locator: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(1),
            nth: vi.fn().mockReturnValue({
              getAttribute: vi.fn().mockResolvedValue('password'),
              textContent: vi.fn().mockResolvedValue('送信'),
              evaluate: vi.fn().mockResolvedValue(null),
            }),
          }),
          close: vi.fn(),
        };
        const mockContext = {
          newPage: vi.fn().mockResolvedValue(mockPage),
          close: vi.fn(),
        };
        const mockBrowser = {
          newContext: vi.fn().mockResolvedValue(mockContext),
          close: vi.fn(),
        };

        const { chromium } = await import('playwright');
        (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(
          mockBrowser
        );

        const { createAuthRouter } = await import('../auth');
        app.use('/api/auth', createAuthRouter());

        await request(app)
          .post('/api/auth/analyze-form')
          .send({ url: 'https://example.com/login' });

        expect(mockBrowser.close).toHaveBeenCalled();
      });

      it('エラー時にブラウザがクローズされる', async () => {
        const mockPage = {
          goto: vi.fn().mockRejectedValue(new Error('Navigation failed')),
          close: vi.fn(),
        };
        const mockContext = {
          newPage: vi.fn().mockResolvedValue(mockPage),
          close: vi.fn(),
        };
        const mockBrowser = {
          newContext: vi.fn().mockResolvedValue(mockContext),
          close: vi.fn(),
        };

        const { chromium } = await import('playwright');
        (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(
          mockBrowser
        );

        const { createAuthRouter } = await import('../auth');
        app.use('/api/auth', createAuthRouter());

        await request(app)
          .post('/api/auth/analyze-form')
          .send({ url: 'https://example.com/login' });

        expect(mockBrowser.close).toHaveBeenCalled();
      });
    });
  });
});
