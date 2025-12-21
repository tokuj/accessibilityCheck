/**
 * StorageStateManager
 * 暗号化されたセッションファイルの永続化・読み込み・管理
 *
 * 要件:
 * - 1.4: 暗号化してストレージステート保存
 * - 2.1: ストレージステート復号化・読み込み
 * - 5.1-5.5: セッションプリセット管理
 * - 6.1: スキーマバージョン・タイムスタンプ
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { cryptoService } from './crypto';
import type {
  StorageState,
  SessionMetadata,
  SessionOptions,
  SessionIndex,
  EncryptedSessionPayload,
  SaveError,
  LoadError,
  DeleteError,
  Result,
  AuthType,
} from './types';

/** 現在のスキーマバージョン */
const SCHEMA_VERSION = 1;

/** セッション数の上限 */
const MAX_SESSIONS = 20;

/** セッション名の最大長 */
const MAX_SESSION_NAME_LENGTH = 50;

/** デフォルトのセッションディレクトリ */
const DEFAULT_SESSIONS_DIR = path.join(process.cwd(), 'server/data/sessions');

/**
 * StorageStateManager クラス
 * セッションファイルの永続化・読み込み・管理を行う
 */
export class StorageStateManager {
  private sessionsDir: string;
  private indexPath: string;

  /**
   * コンストラクタ
   * @param sessionsDir セッションファイルを保存するディレクトリ
   */
  constructor(sessionsDir: string = DEFAULT_SESSIONS_DIR) {
    this.sessionsDir = sessionsDir;
    this.indexPath = path.join(this.sessionsDir, 'index.json');
  }

  /**
   * セッションを暗号化して保存する
   * @param sessionName セッション名（1-50文字）
   * @param storageState Playwrightストレージステート
   * @param passphrase 暗号化パスフレーズ
   * @param options セッションオプション
   * @returns 保存結果（成功時はSessionMetadata、失敗時はSaveError）
   */
  async save(
    sessionName: string,
    storageState: StorageState,
    passphrase: string,
    options: SessionOptions = {}
  ): Promise<Result<SessionMetadata, SaveError>> {
    // セッション名のバリデーション
    if (!sessionName || sessionName.length === 0) {
      return {
        success: false,
        error: {
          type: 'invalid_name',
          message: 'セッション名は空にできません',
        },
      };
    }
    if (sessionName.length > MAX_SESSION_NAME_LENGTH) {
      return {
        success: false,
        error: {
          type: 'invalid_name',
          message: `セッション名は${MAX_SESSION_NAME_LENGTH}文字以内にしてください`,
        },
      };
    }

    try {
      // ディレクトリの確保
      await this.ensureDirectory();

      // インデックスの読み込み
      const index = await this.loadIndex();

      // 重複チェック
      if (index.sessions.some((s) => s.name === sessionName)) {
        return {
          success: false,
          error: {
            type: 'duplicate_name',
            message: `セッション名「${sessionName}」は既に使用されています`,
          },
        };
      }

      // セッション数上限チェック
      if (index.sessions.length >= MAX_SESSIONS) {
        return {
          success: false,
          error: {
            type: 'limit_exceeded',
            message: `セッション数の上限（${MAX_SESSIONS}）に達しています`,
          },
        };
      }

      // セッションIDの生成
      const sessionId = crypto.randomUUID();
      const now = new Date().toISOString();

      // ドメインの抽出
      const domain = this.extractDomain(storageState);

      // 認証タイプの推定
      const authType = this.inferAuthType(storageState);

      // メタデータの作成
      const metadata: SessionMetadata = {
        id: sessionId,
        name: sessionName,
        domain,
        createdAt: now,
        updatedAt: now,
        expiresAt: options.expiresAt,
        schemaVersion: SCHEMA_VERSION,
        authType,
        autoDestroy: options.autoDestroy ?? false,
      };

      // ペイロードの作成と暗号化
      const payload: EncryptedSessionPayload = {
        version: SCHEMA_VERSION,
        storageState,
      };
      const payloadJson = JSON.stringify(payload);

      const encrypted = cryptoService.encrypt(payloadJson, passphrase);

      // 暗号化ファイルの保存（フォーマット: [salt][data]）
      const fileContent = Buffer.concat([encrypted.salt, encrypted.data]);
      const filePath = path.join(this.sessionsDir, `${sessionId}.enc`);
      await fs.writeFile(filePath, fileContent, { mode: 0o600 });

      // インデックスの更新
      index.sessions.push(metadata);
      await this.saveIndex(index);

      return { success: true, value: metadata };
    } catch (error) {
      if (error instanceof Error && error.message.includes('パスフレーズ')) {
        return {
          success: false,
          error: {
            type: 'encryption_failed',
            message: error.message,
          },
        };
      }
      return {
        success: false,
        error: {
          type: 'io_error',
          message: `セッションの保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * セッションを復号化して読み込む
   * @param sessionId セッションID
   * @param passphrase 復号化パスフレーズ
   * @returns 読み込み結果（成功時はStorageState、失敗時はLoadError）
   */
  async load(
    sessionId: string,
    passphrase: string
  ): Promise<Result<StorageState, LoadError>> {
    try {
      // インデックスの読み込み
      const index = await this.loadIndex();
      const metadata = index.sessions.find((s) => s.id === sessionId);

      if (!metadata) {
        return {
          success: false,
          error: {
            type: 'not_found',
            message: `セッション「${sessionId}」が見つかりません`,
          },
        };
      }

      // 暗号化ファイルの読み込み
      const filePath = path.join(this.sessionsDir, `${sessionId}.enc`);
      let fileContent: Buffer;
      try {
        fileContent = await fs.readFile(filePath);
      } catch {
        return {
          success: false,
          error: {
            type: 'not_found',
            message: `セッションファイルが見つかりません: ${sessionId}`,
          },
        };
      }

      // saltとデータの分離（salt: 64バイト）
      const SALT_LENGTH = 64;
      if (fileContent.length < SALT_LENGTH) {
        return {
          success: false,
          error: {
            type: 'io_error',
            message: 'セッションファイルが破損しています',
          },
        };
      }
      const salt = fileContent.subarray(0, SALT_LENGTH);
      const encryptedData = fileContent.subarray(SALT_LENGTH);

      // 復号化
      const decrypted = cryptoService.decrypt(encryptedData, salt, passphrase);

      if (!decrypted.success) {
        return {
          success: false,
          error: {
            type: 'decryption_failed',
            message: decrypted.error.message,
          },
        };
      }

      // ペイロードのパース
      const payload: EncryptedSessionPayload = JSON.parse(decrypted.value);

      return { success: true, value: payload.storageState };
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'io_error',
          message: `セッションの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * セッション一覧を取得する
   * @returns セッションメタデータの配列
   */
  async list(): Promise<SessionMetadata[]> {
    try {
      const index = await this.loadIndex();
      return index.sessions;
    } catch {
      return [];
    }
  }

  /**
   * セッションを削除する
   * @param sessionId セッションID
   * @returns 削除結果
   */
  async delete(sessionId: string): Promise<Result<void, DeleteError>> {
    try {
      // インデックスの読み込み
      const index = await this.loadIndex();
      const sessionIndex = index.sessions.findIndex((s) => s.id === sessionId);

      if (sessionIndex === -1) {
        return {
          success: false,
          error: {
            type: 'not_found',
            message: `セッション「${sessionId}」が見つかりません`,
          },
        };
      }

      // ファイルの削除
      const filePath = path.join(this.sessionsDir, `${sessionId}.enc`);
      try {
        await fs.unlink(filePath);
      } catch {
        // ファイルが存在しない場合も続行
      }

      // インデックスからの削除
      index.sessions.splice(sessionIndex, 1);
      await this.saveIndex(index);

      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'io_error',
          message: `セッションの削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * セッションのメタデータを取得する
   * @param sessionId セッションID
   * @returns セッションメタデータ（存在しない場合はnull）
   */
  async getMetadata(sessionId: string): Promise<SessionMetadata | null> {
    try {
      const index = await this.loadIndex();
      return index.sessions.find((s) => s.id === sessionId) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * セッションディレクトリの存在を確保する
   */
  private async ensureDirectory(): Promise<void> {
    await fs.mkdir(this.sessionsDir, { recursive: true });
  }

  /**
   * インデックスファイルを読み込む
   */
  private async loadIndex(): Promise<SessionIndex> {
    try {
      const content = await fs.readFile(this.indexPath, 'utf-8');
      return JSON.parse(content) as SessionIndex;
    } catch {
      // ファイルが存在しない場合は空のインデックスを返す
      return { version: SCHEMA_VERSION, sessions: [] };
    }
  }

  /**
   * インデックスファイルを保存する
   */
  private async saveIndex(index: SessionIndex): Promise<void> {
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
  }

  /**
   * ストレージステートからドメインを抽出する
   */
  private extractDomain(storageState: StorageState): string {
    // Cookieからドメインを取得（最初のCookieを使用）
    if (storageState.cookies.length > 0) {
      return storageState.cookies[0].domain.replace(/^\./, '');
    }

    // originsからドメインを取得
    if (storageState.origins.length > 0) {
      try {
        const url = new URL(storageState.origins[0].origin);
        return url.hostname;
      } catch {
        // パース失敗時はoriginをそのまま返す
        return storageState.origins[0].origin;
      }
    }

    return 'unknown';
  }

  /**
   * ストレージステートから認証タイプを推定する
   */
  private inferAuthType(storageState: StorageState): AuthType {
    // Cookieがある場合はform認証と推定
    if (storageState.cookies.length > 0) {
      return 'form';
    }

    // localStorageにトークンがある場合はbearer認証と推定
    for (const origin of storageState.origins) {
      for (const entry of origin.localStorage) {
        const name = entry.name.toLowerCase();
        if (
          name.includes('token') ||
          name.includes('auth') ||
          name.includes('jwt')
        ) {
          return 'bearer';
        }
      }
    }

    return 'none';
  }
}

/**
 * StorageStateManagerのデフォルトインスタンス
 */
export const storageStateManager = new StorageStateManager();
