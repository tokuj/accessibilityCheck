/**
 * CryptoService
 * AES-256-GCM暗号化・復号化とPBKDF2鍵導出を提供
 *
 * 要件:
 * - 4.1: AES-256で暗号化
 * - 4.6: メモリ内でシークレット保持
 * - 1.5: 生パスワード非保存
 */

import crypto from 'node:crypto';

/**
 * 暗号化結果
 */
export interface EncryptionResult {
  /** IV (12 bytes) + ciphertext + authTag (16 bytes) */
  data: Buffer;
  /** PBKDF2 salt (64 bytes) */
  salt: Buffer;
}

/**
 * 復号化エラー型
 */
export type DecryptionError =
  | { type: 'invalid_passphrase'; message: string }
  | { type: 'corrupted_data'; message: string }
  | { type: 'unsupported_version'; message: string };

/**
 * Result型（成功または失敗）
 */
export type Result<T, E> =
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * 暗号化設定
 */
const CRYPTO_CONFIG = {
  /** AES-256-GCM アルゴリズム */
  ALGORITHM: 'aes-256-gcm' as const,
  /** IV長（12バイト、GCM推奨値） */
  IV_LENGTH: 12,
  /** 認証タグ長（16バイト） */
  AUTH_TAG_LENGTH: 16,
  /** salt長（64バイト） */
  SALT_LENGTH: 64,
  /** 鍵長（32バイト = 256ビット） */
  KEY_LENGTH: 32,
  /** PBKDF2反復回数（OWASP推奨: 310,000） */
  PBKDF2_ITERATIONS: 310000,
  /** PBKDF2ハッシュアルゴリズム */
  PBKDF2_DIGEST: 'sha256' as const,
} as const;

/**
 * CryptoService クラス
 * AES-256-GCM暗号化・復号化とPBKDF2鍵導出を提供
 */
export class CryptoService {
  /**
   * データを暗号化する
   * @param data 暗号化対象のデータ（文字列）
   * @param passphrase パスフレーズ
   * @returns 暗号化結果（暗号化データとsalt）
   * @throws パスフレーズが空の場合
   */
  encrypt(data: string, passphrase: string): EncryptionResult {
    if (!passphrase) {
      throw new Error('パスフレーズは空にできません');
    }

    // ランダムなsaltとIVを生成
    const salt = crypto.randomBytes(CRYPTO_CONFIG.SALT_LENGTH);
    const iv = crypto.randomBytes(CRYPTO_CONFIG.IV_LENGTH);

    // パスフレーズから鍵を導出
    const key = this.deriveKey(passphrase, salt);

    // AES-256-GCMで暗号化
    const cipher = crypto.createCipheriv(CRYPTO_CONFIG.ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // フォーマット: [IV (12 bytes)][ciphertext][authTag (16 bytes)]
    const encryptedData = Buffer.concat([iv, encrypted, authTag]);

    return {
      data: encryptedData,
      salt,
    };
  }

  /**
   * データを復号化する
   * @param encryptedData 暗号化データ（IV + ciphertext + authTag）
   * @param salt PBKDF2 salt
   * @param passphrase パスフレーズ
   * @returns 復号化結果（成功時は元データ、失敗時はエラー）
   * @throws パスフレーズが空の場合
   */
  decrypt(
    encryptedData: Buffer,
    salt: Buffer,
    passphrase: string
  ): Result<string, DecryptionError> {
    if (!passphrase) {
      throw new Error('パスフレーズは空にできません');
    }

    // データ長チェック（最小: IV + 1byte ciphertext + authTag = 29 bytes）
    const minLength =
      CRYPTO_CONFIG.IV_LENGTH + 1 + CRYPTO_CONFIG.AUTH_TAG_LENGTH;
    if (encryptedData.length < minLength) {
      return {
        success: false,
        error: {
          type: 'corrupted_data',
          message: `暗号化データが短すぎます（最小${minLength}バイト必要）`,
        },
      };
    }

    try {
      // データを分解
      const iv = encryptedData.subarray(0, CRYPTO_CONFIG.IV_LENGTH);
      const authTag = encryptedData.subarray(-CRYPTO_CONFIG.AUTH_TAG_LENGTH);
      const ciphertext = encryptedData.subarray(
        CRYPTO_CONFIG.IV_LENGTH,
        -CRYPTO_CONFIG.AUTH_TAG_LENGTH
      );

      // パスフレーズから鍵を導出
      const key = this.deriveKey(passphrase, salt);

      // AES-256-GCMで復号化
      const decipher = crypto.createDecipheriv(
        CRYPTO_CONFIG.ALGORITHM,
        key,
        iv
      );
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return {
        success: true,
        value: decrypted.toString('utf8'),
      };
    } catch (error) {
      // GCM認証失敗はパスフレーズ不正または改ざん
      if (
        error instanceof Error &&
        error.message.includes('Unsupported state or unable to authenticate')
      ) {
        return {
          success: false,
          error: {
            type: 'invalid_passphrase',
            message: 'パスフレーズが正しくないか、データが改ざんされています',
          },
        };
      }

      return {
        success: false,
        error: {
          type: 'corrupted_data',
          message: `復号化に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * パスフレーズとsaltから鍵を導出する
   * PBKDF2-SHA256、310,000反復（OWASP推奨）
   * @param passphrase パスフレーズ
   * @param salt PBKDF2 salt
   * @returns 導出された鍵（32バイト）
   */
  deriveKey(passphrase: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(
      passphrase,
      salt,
      CRYPTO_CONFIG.PBKDF2_ITERATIONS,
      CRYPTO_CONFIG.KEY_LENGTH,
      CRYPTO_CONFIG.PBKDF2_DIGEST
    );
  }
}

/**
 * CryptoServiceのシングルトンインスタンス
 */
export const cryptoService = new CryptoService();
