/**
 * CryptoService テスト
 * AES-256-GCM暗号化・復号化とPBKDF2鍵導出のテスト
 */

import { describe, it, expect } from 'vitest';
import { CryptoService, type DecryptionError } from '../crypto';

describe('CryptoService', () => {
  const cryptoService = new CryptoService();

  describe('encrypt / decrypt 往復テスト', () => {
    it('暗号化したデータを同じパスフレーズで復号化できる', () => {
      const originalData = JSON.stringify({
        cookies: [{ name: 'session', value: 'abc123' }],
        origins: [],
      });
      const passphrase = 'test-passphrase-12345';

      const encrypted = cryptoService.encrypt(originalData, passphrase);
      expect(encrypted.data).toBeInstanceOf(Buffer);
      expect(encrypted.salt).toBeInstanceOf(Buffer);
      expect(encrypted.salt.length).toBe(64);

      const decrypted = cryptoService.decrypt(encrypted.data, encrypted.salt, passphrase);
      expect(decrypted.success).toBe(true);
      if (decrypted.success) {
        expect(decrypted.value).toBe(originalData);
      }
    });

    it('日本語を含むデータも正しく暗号化・復号化できる', () => {
      const originalData = JSON.stringify({
        message: 'こんにちは、世界！',
        data: { nested: '日本語テスト' },
      });
      const passphrase = '日本語パスフレーズ';

      const encrypted = cryptoService.encrypt(originalData, passphrase);
      const decrypted = cryptoService.decrypt(encrypted.data, encrypted.salt, passphrase);

      expect(decrypted.success).toBe(true);
      if (decrypted.success) {
        expect(decrypted.value).toBe(originalData);
      }
    });

    it('大きなデータも正しく処理できる', () => {
      const largeData = JSON.stringify({
        data: 'x'.repeat(100000),
      });
      const passphrase = 'large-data-test';

      const encrypted = cryptoService.encrypt(largeData, passphrase);
      const decrypted = cryptoService.decrypt(encrypted.data, encrypted.salt, passphrase);

      expect(decrypted.success).toBe(true);
      if (decrypted.success) {
        expect(decrypted.value).toBe(largeData);
      }
    });
  });

  describe('不正パスフレーズテスト', () => {
    it('間違ったパスフレーズで復号化するとinvalid_passphraseエラーを返す', () => {
      const originalData = 'secret data';
      const correctPassphrase = 'correct-passphrase';
      const wrongPassphrase = 'wrong-passphrase';

      const encrypted = cryptoService.encrypt(originalData, correctPassphrase);
      const decrypted = cryptoService.decrypt(encrypted.data, encrypted.salt, wrongPassphrase);

      expect(decrypted.success).toBe(false);
      if (!decrypted.success) {
        expect(decrypted.error.type).toBe('invalid_passphrase');
      }
    });
  });

  describe('改ざんデータテスト', () => {
    it('改ざんされたデータを復号化すると認証エラーを返す（GCMは改ざんとパスフレーズ不正を区別できない）', () => {
      const originalData = 'original data';
      const passphrase = 'test-passphrase';

      const encrypted = cryptoService.encrypt(originalData, passphrase);

      // データの中間部分を改ざん
      const tamperedData = Buffer.from(encrypted.data);
      tamperedData[20] = (tamperedData[20] + 1) % 256;

      const decrypted = cryptoService.decrypt(tamperedData, encrypted.salt, passphrase);

      expect(decrypted.success).toBe(false);
      if (!decrypted.success) {
        // GCMモードでは改ざんと不正パスフレーズは同じ認証エラーになる
        expect(['invalid_passphrase', 'corrupted_data']).toContain(decrypted.error.type);
      }
    });

    it('短すぎるデータはcorrupted_dataエラーを返す', () => {
      const tooShortData = Buffer.from([1, 2, 3, 4, 5]);
      const salt = Buffer.alloc(64);
      const passphrase = 'test';

      const decrypted = cryptoService.decrypt(tooShortData, salt, passphrase);

      expect(decrypted.success).toBe(false);
      if (!decrypted.success) {
        expect(decrypted.error.type).toBe('corrupted_data');
      }
    });
  });

  describe('空パスフレーズ拒否テスト', () => {
    it('空のパスフレーズで暗号化するとエラーを投げる', () => {
      const data = 'test data';

      expect(() => cryptoService.encrypt(data, '')).toThrow('パスフレーズは空にできません');
    });

    it('空のパスフレーズで復号化するとエラーを投げる', () => {
      const encryptedData = Buffer.alloc(50);
      const salt = Buffer.alloc(64);

      expect(() => cryptoService.decrypt(encryptedData, salt, '')).toThrow('パスフレーズは空にできません');
    });
  });

  describe('暗号化データフォーマットテスト', () => {
    it('暗号化データのフォーマットが正しい: [12-byte IV][ciphertext][16-byte authTag]', () => {
      const data = 'test';
      const passphrase = 'test-passphrase';

      const encrypted = cryptoService.encrypt(data, passphrase);

      // IV (12 bytes) + ciphertext (最低1byte) + authTag (16 bytes) = 最低29 bytes
      expect(encrypted.data.length).toBeGreaterThanOrEqual(29);

      // salt は 64 bytes
      expect(encrypted.salt.length).toBe(64);
    });
  });

  describe('deriveKey テスト', () => {
    it('同じパスフレーズとsaltで同じキーが導出される', () => {
      const passphrase = 'test-passphrase';
      const salt = Buffer.alloc(64, 1);

      const key1 = cryptoService.deriveKey(passphrase, salt);
      const key2 = cryptoService.deriveKey(passphrase, salt);

      expect(key1.equals(key2)).toBe(true);
    });

    it('異なるsaltでは異なるキーが導出される', () => {
      const passphrase = 'test-passphrase';
      const salt1 = Buffer.alloc(64, 1);
      const salt2 = Buffer.alloc(64, 2);

      const key1 = cryptoService.deriveKey(passphrase, salt1);
      const key2 = cryptoService.deriveKey(passphrase, salt2);

      expect(key1.equals(key2)).toBe(false);
    });

    it('導出されたキーは32バイト（AES-256用）', () => {
      const passphrase = 'test-passphrase';
      const salt = Buffer.alloc(64, 1);

      const key = cryptoService.deriveKey(passphrase, salt);

      expect(key.length).toBe(32);
    });
  });
});
