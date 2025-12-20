import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// Result型の定義
export type SecretError =
  | { type: 'not_found'; message: string }
  | { type: 'permission_denied'; message: string }
  | { type: 'network_error'; message: string };

export type Result<T, E> =
  | { success: true; value: T }
  | { success: false; error: E };

// GCPプロジェクトID
const GCP_PROJECT_ID = 'itgproto';

// シークレットのキャッシュ（メモリ内）
const secretCache = new Map<string, string>();

/**
 * Secret Managerからシークレットを取得するサービス
 *
 * - Cloud Runではサービスアカウント経由で自動認証
 * - ローカル開発時は環境変数からのフォールバックを実装
 * - 取得したキーをメモリにキャッシュして再利用
 * - APIキーをログに出力しないセキュリティ対策
 */
export const SecretManagerService = {
  // テスト用のクライアント注入
  _client: null as SecretManagerServiceClient | null,

  /**
   * クライアントを取得（テスト用に注入可能）
   */
  _getClient(): SecretManagerServiceClient {
    if (!this._client) {
      this._client = new SecretManagerServiceClient();
    }
    return this._client;
  },

  /**
   * クライアントを設定（テスト用）
   */
  _setClient(client: SecretManagerServiceClient | null): void {
    this._client = client;
  },

  /**
   * シークレットを取得する
   * @param secretName シークレット名（例: 'google_api_key_toku'）
   * @returns シークレット値またはエラー
   */
  async getSecret(secretName: string): Promise<Result<string, SecretError>> {
    // 1. 環境変数からのフォールバック（ローカル開発用）
    const envKey = secretName.toUpperCase().replace(/_toku$/i, '');
    const envValue = process.env[envKey];
    if (envValue) {
      console.log(`シークレット取得: 環境変数 ${envKey} を使用`);
      return { success: true, value: envValue };
    }

    // 2. キャッシュをチェック
    const cachedValue = secretCache.get(secretName);
    if (cachedValue) {
      console.log(`シークレット取得: キャッシュから ${secretName} を使用`);
      return { success: true, value: cachedValue };
    }

    // 3. Secret Managerから取得
    try {
      const secretPath = `projects/${GCP_PROJECT_ID}/secrets/${secretName}/versions/latest`;
      console.log(`シークレット取得: Secret Manager から ${secretName} を取得中...`);

      const secretClient = this._getClient();
      const [version] = await secretClient.accessSecretVersion({
        name: secretPath,
      });

      const payload = version.payload?.data;
      if (!payload) {
        return {
          success: false,
          error: { type: 'not_found', message: `シークレット ${secretName} にデータがありません` },
        };
      }

      // Buffer/Uint8Array を文字列に変換
      const secretValue = typeof payload === 'string'
        ? payload
        : Buffer.from(payload).toString('utf-8');

      // キャッシュに保存
      secretCache.set(secretName, secretValue);
      console.log(`シークレット取得: ${secretName} を取得・キャッシュしました`);

      return { success: true, value: secretValue };
    } catch (error) {
      // エラーの種類を判定
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as unknown as { code?: number }).code;

      // NOT_FOUNDエラー (gRPCコード5)
      if (errorCode === 5 || errorMessage.includes('NOT_FOUND')) {
        return {
          success: false,
          error: { type: 'not_found', message: `シークレット ${secretName} が見つかりません: ${errorMessage}` },
        };
      }

      // 権限エラー (gRPCコード7)
      if (errorCode === 7 || errorMessage.includes('Permission denied') || errorMessage.includes('PERMISSION_DENIED')) {
        return {
          success: false,
          error: { type: 'permission_denied', message: `シークレット ${secretName} へのアクセスが拒否されました: ${errorMessage}` },
        };
      }

      // その他のエラー（ネットワークエラーとして扱う）
      console.error(`シークレット取得エラー: ${errorMessage}`);
      return {
        success: false,
        error: { type: 'network_error', message: `シークレット取得中にエラーが発生しました: ${errorMessage}` },
      };
    }
  },

  /**
   * キャッシュをクリアする（テスト用）
   */
  clearCache(): void {
    secretCache.clear();
  },
};
