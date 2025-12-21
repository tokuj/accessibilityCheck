/**
 * Session Management API
 * セッションのCRUD操作を提供するREST APIエンドポイント
 *
 * Requirements:
 * - 2.1: ストレージステート復号化・読み込み
 * - 5.1-5.5: セッションプリセット管理
 */

import { Router, type Request, type Response } from 'express';
import { StorageStateManager } from '../auth/storage-state-manager';
import type { StorageState, SessionOptions } from '../auth/types';

/**
 * セッション作成リクエストボディ
 */
interface CreateSessionRequest {
  name: string;
  storageState: StorageState;
  passphrase: string;
  options?: SessionOptions;
}

/**
 * セッション読み込みリクエストボディ
 */
interface LoadSessionRequest {
  passphrase: string;
}

/**
 * Session Management Routerを作成
 * @param manager StorageStateManagerインスタンス（DIでテスト容易性を確保）
 * @returns Express Router
 */
export function createSessionsRouter(manager: StorageStateManager): Router {
  const router = Router();

  /**
   * GET /api/sessions
   * セッション一覧を取得
   */
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const sessions = await manager.list();
      res.json(sessions);
    } catch (error) {
      console.error('セッション一覧取得エラー:', error);
      res.status(500).json({
        error: 'セッション一覧の取得に失敗しました',
      });
    }
  });

  /**
   * POST /api/sessions
   * セッションを作成（暗号化保存）
   */
  router.post('/', async (req: Request, res: Response) => {
    const body = req.body as CreateSessionRequest;

    // パスフレーズのバリデーション
    if (!body.passphrase || body.passphrase.length === 0) {
      res.status(400).json({
        error: 'パスフレーズは空にできません',
      });
      return;
    }

    // セッション名のバリデーション
    if (!body.name || body.name.length === 0) {
      res.status(400).json({
        error: 'セッション名は空にできません',
      });
      return;
    }

    try {
      const result = await manager.save(
        body.name,
        body.storageState,
        body.passphrase,
        body.options
      );

      if (!result.success) {
        // エラータイプに応じたHTTPステータスコードを返す
        switch (result.error.type) {
          case 'duplicate_name':
            res.status(409).json({ error: result.error.message });
            return;
          case 'invalid_name':
          case 'encryption_failed':
          case 'limit_exceeded':
            res.status(400).json({ error: result.error.message });
            return;
          case 'io_error':
            res.status(500).json({ error: result.error.message });
            return;
          default:
            res.status(500).json({ error: '不明なエラーが発生しました' });
            return;
        }
      }

      res.status(201).json(result.value);
    } catch (error) {
      console.error('セッション作成エラー:', error);
      res.status(500).json({
        error: 'セッションの作成に失敗しました',
      });
    }
  });

  /**
   * GET /api/sessions/:id
   * セッションメタデータを取得
   */
  router.get('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const metadata = await manager.getMetadata(id);

      if (!metadata) {
        res.status(404).json({
          error: `セッション「${id}」が見つかりません`,
        });
        return;
      }

      res.json(metadata);
    } catch (error) {
      console.error('セッションメタデータ取得エラー:', error);
      res.status(500).json({
        error: 'セッションメタデータの取得に失敗しました',
      });
    }
  });

  /**
   * DELETE /api/sessions/:id
   * セッションを削除
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const result = await manager.delete(id);

      if (!result.success) {
        switch (result.error.type) {
          case 'not_found':
            res.status(404).json({ error: result.error.message });
            return;
          case 'io_error':
            res.status(500).json({ error: result.error.message });
            return;
          default:
            res.status(500).json({ error: '不明なエラーが発生しました' });
            return;
        }
      }

      res.status(204).send();
    } catch (error) {
      console.error('セッション削除エラー:', error);
      res.status(500).json({
        error: 'セッションの削除に失敗しました',
      });
    }
  });

  /**
   * POST /api/sessions/:id/load
   * セッションを復号化読み込み
   */
  router.post('/:id/load', async (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body as LoadSessionRequest;

    // パスフレーズのバリデーション
    if (!body.passphrase || body.passphrase.length === 0) {
      res.status(400).json({
        error: 'パスフレーズは空にできません',
      });
      return;
    }

    try {
      const result = await manager.load(id, body.passphrase);

      if (!result.success) {
        switch (result.error.type) {
          case 'not_found':
            res.status(404).json({ error: result.error.message });
            return;
          case 'decryption_failed':
            res.status(401).json({ error: result.error.message });
            return;
          case 'io_error':
            res.status(500).json({ error: result.error.message });
            return;
          default:
            res.status(500).json({ error: '不明なエラーが発生しました' });
            return;
        }
      }

      res.json({ storageState: result.value });
    } catch (error) {
      console.error('セッション読み込みエラー:', error);
      res.status(500).json({
        error: 'セッションの読み込みに失敗しました',
      });
    }
  });

  return router;
}
