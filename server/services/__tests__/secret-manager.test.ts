import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SecretManagerService } from '../secret-manager';

describe('SecretManagerService', () => {
  let mockAccessSecretVersion: ReturnType<typeof vi.fn>;
  let mockClient: { accessSecretVersion: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // 環境変数をクリア
    delete process.env.GOOGLE_API_KEY;

    // キャッシュをクリア
    SecretManagerService.clearCache();

    // モッククライアントを作成
    mockAccessSecretVersion = vi.fn();
    mockClient = { accessSecretVersion: mockAccessSecretVersion };

    // モッククライアントを注入
    SecretManagerService._setClient(mockClient as unknown as import('@google-cloud/secret-manager').SecretManagerServiceClient);
  });

  afterEach(() => {
    // クライアントをリセット
    SecretManagerService._setClient(null);
    vi.resetAllMocks();
  });

  describe('getSecret', () => {
    it('環境変数が設定されている場合はそれを使用する', async () => {
      process.env.GOOGLE_API_KEY = 'test-env-api-key';

      const result = await SecretManagerService.getSecret('google_api_key_toku');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('test-env-api-key');
      }
      // Secret Manager APIは呼ばれない
      expect(mockAccessSecretVersion).not.toHaveBeenCalled();
    });

    it('Secret Managerからシークレットを取得できる', async () => {
      mockAccessSecretVersion.mockResolvedValueOnce([
        {
          payload: {
            data: Buffer.from('test-secret-value'),
          },
        },
      ]);

      const result = await SecretManagerService.getSecret('google_api_key_toku');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('test-secret-value');
      }
      expect(mockAccessSecretVersion).toHaveBeenCalledWith({
        name: 'projects/itgproto/secrets/google_api_key_toku/versions/latest',
      });
    });

    it('キャッシュが有効な場合は再取得しない', async () => {
      mockAccessSecretVersion.mockResolvedValue([
        {
          payload: {
            data: Buffer.from('cached-secret'),
          },
        },
      ]);

      // 1回目の呼び出し
      await SecretManagerService.getSecret('google_api_key_toku');
      // 2回目の呼び出し
      await SecretManagerService.getSecret('google_api_key_toku');

      // 1回しか呼ばれない（キャッシュが効いている）
      expect(mockAccessSecretVersion).toHaveBeenCalledTimes(1);
    });

    it('Secret Managerでエラーが発生した場合はエラーを返す', async () => {
      mockAccessSecretVersion.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await SecretManagerService.getSecret('google_api_key_toku');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('permission_denied');
        expect(result.error.message).toContain('Permission denied');
      }
    });

    it('シークレットが見つからない場合はnot_foundエラーを返す', async () => {
      const notFoundError = new Error('NOT_FOUND: Secret not found');
      (notFoundError as unknown as { code: number }).code = 5;
      mockAccessSecretVersion.mockRejectedValueOnce(notFoundError);

      const result = await SecretManagerService.getSecret('nonexistent_secret');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('not_found');
      }
    });

    it('APIキーをログに出力しない', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const consoleErrorSpy = vi.spyOn(console, 'error');

      mockAccessSecretVersion.mockResolvedValueOnce([
        {
          payload: {
            data: Buffer.from('super-secret-api-key'),
          },
        },
      ]);

      await SecretManagerService.getSecret('google_api_key_toku');

      // ログにAPIキーが含まれていないことを確認
      const allLogs = [
        ...consoleSpy.mock.calls.map(call => call.join(' ')),
        ...consoleErrorSpy.mock.calls.map(call => call.join(' ')),
      ];

      for (const log of allLogs) {
        expect(log).not.toContain('super-secret-api-key');
      }

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('payloadがない場合はnot_foundエラーを返す', async () => {
      mockAccessSecretVersion.mockResolvedValueOnce([
        {
          payload: {
            data: null,
          },
        },
      ]);

      const result = await SecretManagerService.getSecret('empty_secret');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('not_found');
        expect(result.error.message).toContain('データがありません');
      }
    });
  });
});
