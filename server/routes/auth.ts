/**
 * Interactive Login API
 * インタラクティブログインの開始・キャプチャ・キャンセルを行うAPIエンドポイント
 *
 * Task 8: Interactive Login API実装
 * Requirements: 1.1-1.4
 */

import { Router, type Request, type Response } from 'express';
import {
  InteractiveLoginService,
  interactiveLoginService,
} from '../auth/interactive-login';
import type { LoginOptions } from '../auth/types';

/**
 * ログイン開始リクエストボディ
 */
interface StartLoginRequest {
  loginUrl: string;
  options?: LoginOptions;
}

/**
 * セッションキャプチャリクエストボディ
 */
interface CaptureSessionRequest {
  sessionName: string;
  passphrase: string;
}

/**
 * Interactive Login Routerを作成
 * @param service InteractiveLoginServiceインスタンス（DIでテスト容易性を確保）
 * @returns Express Router
 */
export function createAuthRouter(
  service: InteractiveLoginService = interactiveLoginService
): Router {
  const router = Router();

  /**
   * POST /api/auth/interactive-login
   * ログインセッションを開始
   */
  router.post('/interactive-login', async (req: Request, res: Response) => {
    const body = req.body as StartLoginRequest;

    // loginUrlのバリデーション
    if (!body.loginUrl || body.loginUrl.length === 0) {
      res.status(400).json({
        error: 'loginURLは空にできません',
      });
      return;
    }

    try {
      const result = await service.startLogin(body.loginUrl, body.options);

      if (!result.success) {
        // エラータイプに応じたHTTPステータスコードを返す
        switch (result.error.type) {
          case 'headless_environment':
            res.status(503).json({ error: result.error.message });
            return;
          case 'navigation_failed':
            res.status(400).json({ error: result.error.message });
            return;
          case 'browser_launch_failed':
            res.status(500).json({ error: result.error.message });
            return;
          default:
            res.status(500).json({ error: '不明なエラーが発生しました' });
            return;
        }
      }

      res.status(200).json(result.value);
    } catch (error) {
      console.error('ログインセッション開始エラー:', error);
      res.status(500).json({
        error: 'ログインセッションの開始に失敗しました',
      });
    }
  });

  /**
   * POST /api/auth/capture-session
   * セッションをキャプチャして保存
   */
  router.post('/capture-session', async (req: Request, res: Response) => {
    const body = req.body as CaptureSessionRequest;

    // パスフレーズのバリデーション
    if (!body.passphrase || body.passphrase.length === 0) {
      res.status(400).json({
        error: 'パスフレーズは空にできません',
      });
      return;
    }

    // セッション名のバリデーション
    if (!body.sessionName || body.sessionName.length === 0) {
      res.status(400).json({
        error: 'セッション名は空にできません',
      });
      return;
    }

    // アクティブなセッションがあるか確認
    const activeSession = service.getActiveSession();
    if (!activeSession) {
      res.status(404).json({
        error: 'アクティブなログインセッションがありません',
      });
      return;
    }

    try {
      const result = await service.captureSession(
        activeSession.id,
        body.sessionName,
        body.passphrase
      );

      if (!result.success) {
        switch (result.error.type) {
          case 'session_not_found':
            res.status(404).json({ error: result.error.message });
            return;
          case 'capture_failed':
          case 'save_failed':
            res.status(500).json({ error: result.error.message });
            return;
          default:
            res.status(500).json({ error: '不明なエラーが発生しました' });
            return;
        }
      }

      res.status(201).json(result.value);
    } catch (error) {
      console.error('セッションキャプチャエラー:', error);
      res.status(500).json({
        error: 'セッションのキャプチャに失敗しました',
      });
    }
  });

  /**
   * DELETE /api/auth/interactive-login
   * ログインセッションをキャンセル
   */
  router.delete('/interactive-login', async (req: Request, res: Response) => {
    const activeSession = service.getActiveSession();

    if (!activeSession) {
      res.status(404).json({
        error: 'アクティブなログインセッションがありません',
      });
      return;
    }

    try {
      await service.cancelLogin(activeSession.id);
      res.status(204).send();
    } catch (error) {
      console.error('ログインセッションキャンセルエラー:', error);
      res.status(500).json({
        error: 'ログインセッションのキャンセルに失敗しました',
      });
    }
  });

  /**
   * GET /api/auth/interactive-login
   * アクティブなログインセッションを取得
   */
  router.get('/interactive-login', (_req: Request, res: Response) => {
    const activeSession = service.getActiveSession();
    res.status(200).json({ session: activeSession });
  });

  return router;
}
