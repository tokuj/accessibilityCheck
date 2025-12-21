/**
 * Interactive Login API テスト
 * インタラクティブログインの開始・キャプチャ・キャンセルAPIエンドポイントのテスト
 *
 * Task 8: Interactive Login API実装
 * Requirements: 1.1-1.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

// Playwrightのモック
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

describe('Interactive Login API', () => {
  let app: Express;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    vi.resetAllMocks();

    // テスト用ディレクトリを作成
    const testSessionsDir = path.join(
      process.cwd(),
      'server/data/sessions-auth-test'
    );
    await fs.mkdir(testSessionsDir, { recursive: true });

    // Expressアプリのセットアップ（実装後に動作）
    app = express();
    app.use(express.json());
  });

  afterEach(async () => {
    process.env = originalEnv;

    // テスト用ディレクトリを削除
    const testSessionsDir = path.join(
      process.cwd(),
      'server/data/sessions-auth-test'
    );
    try {
      await fs.rm(testSessionsDir, { recursive: true, force: true });
    } catch {
      // 削除失敗は無視
    }
  });

  describe('POST /api/auth/interactive-login', () => {
    it('ALLOW_HEADED_BROWSERが未設定の場合は503エラー', async () => {
      delete process.env.ALLOW_HEADED_BROWSER;

      const { createAuthRouter } = await import('../auth');
      const { InteractiveLoginService } = await import(
        '../../auth/interactive-login'
      );
      const service = new InteractiveLoginService();

      app.use('/api/auth', createAuthRouter(service));

      const response = await request(app)
        .post('/api/auth/interactive-login')
        .send({ loginUrl: 'https://example.com/login' });

      expect(response.status).toBe(503);
      expect(response.body.error).toBeDefined();
    });

    it('loginUrlが無効な場合は400エラー', async () => {
      process.env.ALLOW_HEADED_BROWSER = 'true';

      const { createAuthRouter } = await import('../auth');
      const { InteractiveLoginService } = await import(
        '../../auth/interactive-login'
      );
      const service = new InteractiveLoginService();

      app.use('/api/auth', createAuthRouter(service));

      const response = await request(app)
        .post('/api/auth/interactive-login')
        .send({ loginUrl: 'not-a-valid-url' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('有効なリクエストでログインセッションを開始', async () => {
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
      (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBrowser
      );

      const { createAuthRouter } = await import('../auth');
      const { InteractiveLoginService } = await import(
        '../../auth/interactive-login'
      );
      const service = new InteractiveLoginService();

      app.use('/api/auth', createAuthRouter(service));

      const response = await request(app)
        .post('/api/auth/interactive-login')
        .send({ loginUrl: 'https://example.com/login' });

      expect(response.status).toBe(200);
      expect(response.body.id).toBeDefined();
      expect(response.body.loginUrl).toBe('https://example.com/login');
      expect(response.body.status).toBe('waiting_for_login');

      // クリーンアップ
      await service.cancelLogin(response.body.id);
    });
  });

  describe('POST /api/auth/capture-session', () => {
    it('ログインセッションが存在しない場合は404エラー', async () => {
      process.env.ALLOW_HEADED_BROWSER = 'true';

      const { createAuthRouter } = await import('../auth');
      const { InteractiveLoginService } = await import(
        '../../auth/interactive-login'
      );
      const service = new InteractiveLoginService();

      app.use('/api/auth', createAuthRouter(service));

      const response = await request(app)
        .post('/api/auth/capture-session')
        .send({
          sessionName: 'test-session',
          passphrase: 'test-passphrase',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });

    it('パスフレーズが空の場合は400エラー', async () => {
      process.env.ALLOW_HEADED_BROWSER = 'true';

      const { createAuthRouter } = await import('../auth');
      const { InteractiveLoginService } = await import(
        '../../auth/interactive-login'
      );
      const service = new InteractiveLoginService();

      app.use('/api/auth', createAuthRouter(service));

      const response = await request(app)
        .post('/api/auth/capture-session')
        .send({
          sessionName: 'test-session',
          passphrase: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('セッション名が空の場合は400エラー', async () => {
      process.env.ALLOW_HEADED_BROWSER = 'true';

      const { createAuthRouter } = await import('../auth');
      const { InteractiveLoginService } = await import(
        '../../auth/interactive-login'
      );
      const service = new InteractiveLoginService();

      app.use('/api/auth', createAuthRouter(service));

      const response = await request(app)
        .post('/api/auth/capture-session')
        .send({
          sessionName: '',
          passphrase: 'test-passphrase',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('DELETE /api/auth/interactive-login', () => {
    it('ログインセッションが存在しない場合は404エラー', async () => {
      process.env.ALLOW_HEADED_BROWSER = 'true';

      const { createAuthRouter } = await import('../auth');
      const { InteractiveLoginService } = await import(
        '../../auth/interactive-login'
      );
      const service = new InteractiveLoginService();

      app.use('/api/auth', createAuthRouter(service));

      const response = await request(app).delete('/api/auth/interactive-login');

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });

    it('アクティブなセッションをキャンセルする', async () => {
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
      (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBrowser
      );

      const { createAuthRouter } = await import('../auth');
      const { InteractiveLoginService } = await import(
        '../../auth/interactive-login'
      );
      const service = new InteractiveLoginService();

      app.use('/api/auth', createAuthRouter(service));

      // 先にログインセッションを開始
      const startResponse = await request(app)
        .post('/api/auth/interactive-login')
        .send({ loginUrl: 'https://example.com/login' });

      expect(startResponse.status).toBe(200);

      // セッションをキャンセル
      const cancelResponse = await request(app).delete(
        '/api/auth/interactive-login'
      );

      expect(cancelResponse.status).toBe(204);

      // ブラウザがクローズされた
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('GET /api/auth/interactive-login', () => {
    it('アクティブなセッションがない場合はnullを返す', async () => {
      process.env.ALLOW_HEADED_BROWSER = 'true';

      const { createAuthRouter } = await import('../auth');
      const { InteractiveLoginService } = await import(
        '../../auth/interactive-login'
      );
      const service = new InteractiveLoginService();

      app.use('/api/auth', createAuthRouter(service));

      const response = await request(app).get('/api/auth/interactive-login');

      expect(response.status).toBe(200);
      expect(response.body.session).toBeNull();
    });

    it('アクティブなセッションがある場合はセッション情報を返す', async () => {
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
      (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBrowser
      );

      const { createAuthRouter } = await import('../auth');
      const { InteractiveLoginService } = await import(
        '../../auth/interactive-login'
      );
      const service = new InteractiveLoginService();

      app.use('/api/auth', createAuthRouter(service));

      // 先にログインセッションを開始
      await request(app)
        .post('/api/auth/interactive-login')
        .send({ loginUrl: 'https://example.com/login' });

      // セッション情報を取得
      const response = await request(app).get('/api/auth/interactive-login');

      expect(response.status).toBe(200);
      expect(response.body.session).not.toBeNull();
      expect(response.body.session.loginUrl).toBe('https://example.com/login');

      // クリーンアップ
      await service.cancelLogin(response.body.session.id);
    });
  });
});
