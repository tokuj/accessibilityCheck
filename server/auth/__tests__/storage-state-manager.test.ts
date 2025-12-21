/**
 * StorageStateManager テスト
 * セッションの永続化・読み込み・管理のテスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { StorageStateManager } from '../storage-state-manager';
import type { StorageState } from '../types';

// テスト用のセッションディレクトリ
const TEST_SESSIONS_DIR = path.join(
  process.cwd(),
  'server/data/sessions-test'
);

describe('StorageStateManager', () => {
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
        localStorage: [
          { name: 'token', value: 'test-token' },
        ],
      },
    ],
  };

  beforeEach(async () => {
    // テスト用ディレクトリを作成
    await fs.mkdir(TEST_SESSIONS_DIR, { recursive: true });
    manager = new StorageStateManager(TEST_SESSIONS_DIR);
  });

  afterEach(async () => {
    // テスト用ディレクトリを削除
    try {
      await fs.rm(TEST_SESSIONS_DIR, { recursive: true, force: true });
    } catch {
      // 削除失敗は無視
    }
  });

  describe('save / load 往復テスト', () => {
    it('セッションを保存して同じパスフレーズで読み込める', async () => {
      const sessionName = 'test-session';
      const passphrase = 'test-passphrase-12345';

      const saveResult = await manager.save(
        sessionName,
        testStorageState,
        passphrase
      );

      expect(saveResult.success).toBe(true);
      if (!saveResult.success) return;

      expect(saveResult.value.name).toBe(sessionName);
      expect(saveResult.value.domain).toBe('example.com');

      const loadResult = await manager.load(saveResult.value.id, passphrase);

      expect(loadResult.success).toBe(true);
      if (!loadResult.success) return;

      expect(loadResult.value.cookies).toEqual(testStorageState.cookies);
      expect(loadResult.value.origins).toEqual(testStorageState.origins);
    });

    it('日本語セッション名でも正しく保存・読み込みできる', async () => {
      const sessionName = '管理者セッション';
      const passphrase = 'パスフレーズ123';

      const saveResult = await manager.save(
        sessionName,
        testStorageState,
        passphrase
      );

      expect(saveResult.success).toBe(true);
      if (!saveResult.success) return;

      expect(saveResult.value.name).toBe(sessionName);

      const loadResult = await manager.load(saveResult.value.id, passphrase);

      expect(loadResult.success).toBe(true);
      if (!loadResult.success) return;

      expect(loadResult.value.cookies).toEqual(testStorageState.cookies);
    });
  });

  describe('セッション一覧取得テスト', () => {
    it('保存したセッションが一覧に表示される', async () => {
      const passphrase = 'test-passphrase';

      await manager.save('session-1', testStorageState, passphrase);
      await manager.save('session-2', testStorageState, passphrase);

      const sessions = await manager.list();

      expect(sessions.length).toBe(2);
      expect(sessions.map((s) => s.name)).toContain('session-1');
      expect(sessions.map((s) => s.name)).toContain('session-2');
    });

    it('セッションがない場合は空配列を返す', async () => {
      const sessions = await manager.list();
      expect(sessions).toEqual([]);
    });
  });

  describe('セッション削除テスト', () => {
    it('セッションを削除できる', async () => {
      const passphrase = 'test-passphrase';

      const saveResult = await manager.save(
        'to-delete',
        testStorageState,
        passphrase
      );
      expect(saveResult.success).toBe(true);
      if (!saveResult.success) return;

      const deleteResult = await manager.delete(saveResult.value.id);
      expect(deleteResult.success).toBe(true);

      const sessions = await manager.list();
      expect(sessions.length).toBe(0);
    });

    it('存在しないセッションを削除するとnot_foundエラー', async () => {
      const deleteResult = await manager.delete('non-existent-id');

      expect(deleteResult.success).toBe(false);
      if (!deleteResult.success) {
        expect(deleteResult.error.type).toBe('not_found');
      }
    });
  });

  describe('重複名エラーテスト', () => {
    it('同じ名前のセッションを作成するとduplicate_nameエラー', async () => {
      const passphrase = 'test-passphrase';

      const first = await manager.save('duplicate', testStorageState, passphrase);
      expect(first.success).toBe(true);

      const second = await manager.save('duplicate', testStorageState, passphrase);
      expect(second.success).toBe(false);
      if (!second.success) {
        expect(second.error.type).toBe('duplicate_name');
      }
    });
  });

  describe('復号化失敗テスト', () => {
    it('間違ったパスフレーズで読み込むとdecryption_failedエラー', async () => {
      const correctPassphrase = 'correct-passphrase';
      const wrongPassphrase = 'wrong-passphrase';

      const saveResult = await manager.save(
        'encrypted-session',
        testStorageState,
        correctPassphrase
      );
      expect(saveResult.success).toBe(true);
      if (!saveResult.success) return;

      const loadResult = await manager.load(saveResult.value.id, wrongPassphrase);

      expect(loadResult.success).toBe(false);
      if (!loadResult.success) {
        expect(loadResult.error.type).toBe('decryption_failed');
      }
    });
  });

  describe('存在しないセッションの読み込み', () => {
    it('存在しないセッションを読み込むとnot_foundエラー', async () => {
      const loadResult = await manager.load('non-existent', 'passphrase');

      expect(loadResult.success).toBe(false);
      if (!loadResult.success) {
        expect(loadResult.error.type).toBe('not_found');
      }
    });
  });

  describe('セッション数上限テスト', () => {
    it('21個目のセッションを作成するとlimit_exceededエラー', async () => {
      const passphrase = 'test-passphrase';

      // 20個のセッションを作成
      for (let i = 0; i < 20; i++) {
        const result = await manager.save(
          `session-${i}`,
          testStorageState,
          passphrase
        );
        expect(result.success).toBe(true);
      }

      // 21個目の作成を試みる
      const result = await manager.save(
        'session-overflow',
        testStorageState,
        passphrase
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('limit_exceeded');
      }
    });
  });

  describe('メタデータテスト', () => {
    it('SessionMetadataに必要なフィールドが含まれる', async () => {
      const passphrase = 'test-passphrase';

      const saveResult = await manager.save(
        'metadata-test',
        testStorageState,
        passphrase,
        { autoDestroy: true, expiresAt: '2025-12-31T23:59:59Z' }
      );

      expect(saveResult.success).toBe(true);
      if (!saveResult.success) return;

      const metadata = saveResult.value;
      expect(metadata.id).toBeDefined();
      expect(metadata.name).toBe('metadata-test');
      expect(metadata.domain).toBe('example.com');
      expect(metadata.createdAt).toBeDefined();
      expect(metadata.updatedAt).toBeDefined();
      expect(metadata.schemaVersion).toBe(1);
      expect(metadata.authType).toBe('form');
      expect(metadata.autoDestroy).toBe(true);
      expect(metadata.expiresAt).toBe('2025-12-31T23:59:59Z');
    });

    it('getMetadataでメタデータを取得できる', async () => {
      const passphrase = 'test-passphrase';

      const saveResult = await manager.save(
        'get-metadata-test',
        testStorageState,
        passphrase
      );
      expect(saveResult.success).toBe(true);
      if (!saveResult.success) return;

      const metadata = await manager.getMetadata(saveResult.value.id);
      expect(metadata).not.toBeNull();
      expect(metadata?.name).toBe('get-metadata-test');
    });

    it('存在しないセッションのメタデータはnullを返す', async () => {
      const metadata = await manager.getMetadata('non-existent');
      expect(metadata).toBeNull();
    });
  });

  describe('オプションテスト', () => {
    it('autoDestroyがデフォルトでfalse', async () => {
      const passphrase = 'test-passphrase';

      const saveResult = await manager.save(
        'default-options',
        testStorageState,
        passphrase
      );

      expect(saveResult.success).toBe(true);
      if (!saveResult.success) return;

      expect(saveResult.value.autoDestroy).toBe(false);
    });
  });

  describe('セッション名バリデーションテスト', () => {
    it('空のセッション名はinvalid_nameエラー', async () => {
      const result = await manager.save('', testStorageState, 'passphrase');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('invalid_name');
      }
    });

    it('50文字を超えるセッション名はinvalid_nameエラー', async () => {
      const longName = 'a'.repeat(51);
      const result = await manager.save(longName, testStorageState, 'passphrase');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('invalid_name');
      }
    });
  });
});
