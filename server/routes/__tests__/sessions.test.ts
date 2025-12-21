/**
 * Session Management API テスト
 * セッションのCRUD操作を提供するREST APIエンドポイントのテスト
 *
 * Requirements: 2.1, 5.1-5.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createSessionsRouter } from '../sessions';
import { StorageStateManager } from '../../auth/storage-state-manager';
import type { StorageState } from '../../auth/types';

// テスト用のセッションディレクトリ
const TEST_SESSIONS_DIR = path.join(
  process.cwd(),
  'server/data/sessions-api-test'
);

describe('Session Management API', () => {
  let app: Express;
  let manager: StorageStateManager;

  // テスト用のストレージステート
  const testStorageState: StorageState = {
    cookies: [
      {
        name: 'session',
        value: 'test-session-value',
        domain: 'example.com',
        path: '/',
        expires: Date.now() / 1000 + 3600,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ],
    origins: [
      {
        origin: 'https://example.com',
        localStorage: [{ name: 'token', value: 'test-token' }],
      },
    ],
  };

  beforeEach(async () => {
    // テスト用ディレクトリを作成
    await fs.mkdir(TEST_SESSIONS_DIR, { recursive: true });
    manager = new StorageStateManager(TEST_SESSIONS_DIR);

    // Expressアプリのセットアップ
    app = express();
    app.use(express.json());
    app.use('/api/sessions', createSessionsRouter(manager));
  });

  afterEach(async () => {
    // テスト用ディレクトリを削除
    try {
      await fs.rm(TEST_SESSIONS_DIR, { recursive: true, force: true });
    } catch {
      // 削除失敗は無視
    }
  });

  describe('GET /api/sessions', () => {
    it('セッションがない場合は空配列を返す', async () => {
      const response = await request(app).get('/api/sessions');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('保存済みセッションの一覧を返す', async () => {
      // 事前にセッションを作成
      await manager.save('session-1', testStorageState, 'passphrase');
      await manager.save('session-2', testStorageState, 'passphrase');

      const response = await request(app).get('/api/sessions');

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
      expect(response.body.map((s: { name: string }) => s.name)).toContain(
        'session-1'
      );
      expect(response.body.map((s: { name: string }) => s.name)).toContain(
        'session-2'
      );
    });
  });

  describe('POST /api/sessions', () => {
    it('セッションを作成して暗号化保存する', async () => {
      const response = await request(app).post('/api/sessions').send({
        name: 'new-session',
        storageState: testStorageState,
        passphrase: 'test-passphrase',
      });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('new-session');
      expect(response.body.id).toBeDefined();
      expect(response.body.domain).toBe('example.com');
    });

    it('パスフレーズが空の場合は400エラー', async () => {
      const response = await request(app).post('/api/sessions').send({
        name: 'new-session',
        storageState: testStorageState,
        passphrase: '',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('セッション名が無効な場合は400エラー', async () => {
      const response = await request(app).post('/api/sessions').send({
        name: '',
        storageState: testStorageState,
        passphrase: 'test-passphrase',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('セッション名が重複する場合は409エラー', async () => {
      // 最初のセッションを作成
      await manager.save('duplicate-name', testStorageState, 'passphrase');

      const response = await request(app).post('/api/sessions').send({
        name: 'duplicate-name',
        storageState: testStorageState,
        passphrase: 'test-passphrase',
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toBeDefined();
    });

    it('オプションを指定してセッションを作成できる', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          name: 'session-with-options',
          storageState: testStorageState,
          passphrase: 'test-passphrase',
          options: {
            autoDestroy: true,
            expiresAt: '2025-12-31T23:59:59Z',
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.autoDestroy).toBe(true);
      expect(response.body.expiresAt).toBe('2025-12-31T23:59:59Z');
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('セッションメタデータを取得する', async () => {
      const saveResult = await manager.save(
        'get-session',
        testStorageState,
        'passphrase'
      );
      if (!saveResult.success) throw new Error('Failed to save session');

      const response = await request(app).get(
        `/api/sessions/${saveResult.value.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('get-session');
      expect(response.body.id).toBe(saveResult.value.id);
    });

    it('存在しないセッションは404エラー', async () => {
      const response = await request(app).get(
        '/api/sessions/non-existent-id-12345'
      );

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    it('セッションを削除する', async () => {
      const saveResult = await manager.save(
        'to-delete',
        testStorageState,
        'passphrase'
      );
      if (!saveResult.success) throw new Error('Failed to save session');

      const response = await request(app).delete(
        `/api/sessions/${saveResult.value.id}`
      );

      expect(response.status).toBe(204);

      // 削除後は一覧から消えている
      const sessions = await manager.list();
      expect(sessions.length).toBe(0);
    });

    it('存在しないセッションの削除は404エラー', async () => {
      const response = await request(app).delete(
        '/api/sessions/non-existent-id-12345'
      );

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/sessions/:id/load', () => {
    it('正しいパスフレーズでセッションを復号化読み込み', async () => {
      const passphrase = 'correct-passphrase';
      const saveResult = await manager.save(
        'load-session',
        testStorageState,
        passphrase
      );
      if (!saveResult.success) throw new Error('Failed to save session');

      const response = await request(app)
        .post(`/api/sessions/${saveResult.value.id}/load`)
        .send({ passphrase });

      expect(response.status).toBe(200);
      expect(response.body.storageState).toBeDefined();
      expect(response.body.storageState.cookies).toEqual(
        testStorageState.cookies
      );
      expect(response.body.storageState.origins).toEqual(
        testStorageState.origins
      );
    });

    it('パスフレーズが空の場合は400エラー', async () => {
      const saveResult = await manager.save(
        'load-session-empty',
        testStorageState,
        'passphrase'
      );
      if (!saveResult.success) throw new Error('Failed to save session');

      const response = await request(app)
        .post(`/api/sessions/${saveResult.value.id}/load`)
        .send({ passphrase: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('パスフレーズ不正の場合は401エラー', async () => {
      const saveResult = await manager.save(
        'load-session-wrong',
        testStorageState,
        'correct-passphrase'
      );
      if (!saveResult.success) throw new Error('Failed to save session');

      const response = await request(app)
        .post(`/api/sessions/${saveResult.value.id}/load`)
        .send({ passphrase: 'wrong-passphrase' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('存在しないセッションは404エラー', async () => {
      const response = await request(app)
        .post('/api/sessions/non-existent-id-12345/load')
        .send({ passphrase: 'test' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });
});
