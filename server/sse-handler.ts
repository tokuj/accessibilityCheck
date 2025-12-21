import type { Request, Response, RequestHandler } from 'express';
import type { SSEEvent, ProgressCallback } from './analyzers/sse-types';
import type { AuthConfig, StorageState } from './auth/types';
import type { AccessibilityReport } from './analyzers/types';
import { storageStateManager } from './auth/storage-state-manager';

/**
 * SSEイベントをdata形式にフォーマットする
 */
export function formatSSEData(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * レスポンスにSSEイベントを送信する
 */
export function sendSSEEvent(res: Response, event: SSEEvent): void {
  res.write(formatSSEData(event));
}

/**
 * SSEレスポンスのヘッダーを設定する
 */
export function setSSEHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx向けバッファリング無効化
  res.flushHeaders();
}

/**
 * クエリパラメータから認証設定を取得する
 */
export function parseAuthFromQuery(query: Request['query']): AuthConfig | undefined {
  const authType = query.authType as string | undefined;
  if (!authType || authType === 'none') {
    return undefined;
  }

  const config: AuthConfig = {
    type: authType as AuthConfig['type'],
  };

  // Basic認証
  if (authType === 'basic') {
    config.username = query.authUsername as string;
    config.password = query.authPassword as string;
  }

  // Bearer Token認証
  if (authType === 'bearer') {
    config.token = query.authToken as string;
  }

  // Cookie認証
  if (authType === 'cookie') {
    config.cookies = query.authCookies as string;
  }

  // フォーム認証
  if (authType === 'form') {
    config.loginUrl = query.authLoginUrl as string;
    config.username = query.authUsername as string;
    config.password = query.authPassword as string;
    config.usernameSelector = query.authUsernameSelector as string;
    config.passwordSelector = query.authPasswordSelector as string;
    config.submitSelector = query.authSubmitSelector as string;
    config.successUrlPattern = query.authSuccessUrlPattern as string;
  }

  return config;
}

/**
 * セッション認証情報の型定義
 */
export interface SessionAuthInfo {
  sessionId: string;
  passphrase?: string;
}

/**
 * クエリパラメータからセッション認証情報を取得する
 */
export function parseSessionFromQuery(query: Request['query']): SessionAuthInfo | undefined {
  const sessionId = query.sessionId as string | undefined;
  if (!sessionId) {
    return undefined;
  }

  return {
    sessionId,
    passphrase: query.passphrase as string | undefined,
  };
}

/**
 * 分析関数の型定義
 */
export type AnalyzeFunction = (
  url: string,
  auth: AuthConfig | undefined,
  onProgress: ProgressCallback,
  res: Response,
  storageState?: StorageState
) => Promise<AccessibilityReport>;

/**
 * SSEストリーミングエンドポイントのハンドラーを作成する
 */
export function createSSEHandler(analyzeFn: AnalyzeFunction): RequestHandler {
  return async (req: Request, res: Response) => {
    const url = req.query.url as string;

    // URLバリデーション
    if (!url) {
      res.status(400).json({ status: 'error', error: 'URLが指定されていません' });
      return;
    }

    try {
      new URL(url);
    } catch {
      res.status(400).json({ status: 'error', error: '無効なURL形式です' });
      return;
    }

    // セッション認証情報を取得
    const sessionInfo = parseSessionFromQuery(req.query);
    // 手動認証設定を取得
    const auth = parseAuthFromQuery(req.query);

    // SSEヘッダーを設定
    setSSEHeaders(res);

    // 進捗コールバック
    const onProgress: ProgressCallback = (event: SSEEvent) => {
      sendSSEEvent(res, event);
    };

    // セッションからstorageStateを復号化
    let storageState: StorageState | undefined;
    if (sessionInfo) {
      console.log(`[SSE] セッションベース認証: sessionId=${sessionInfo.sessionId}`);

      if (!sessionInfo.passphrase) {
        // パスフレーズが空の場合はエラー
        sendSSEEvent(res, {
          type: 'error',
          message: 'セッションのパスフレーズが指定されていません',
          code: 'MISSING_PASSPHRASE',
        });
        res.end();
        return;
      }

      const loadResult = await storageStateManager.load(sessionInfo.sessionId, sessionInfo.passphrase);
      if (!loadResult.success) {
        // 復号化失敗
        if (loadResult.error.type === 'decryption_failed') {
          sendSSEEvent(res, {
            type: 'error',
            message: 'パスフレーズが正しくありません',
            code: 'INVALID_PASSPHRASE',
          });
        } else if (loadResult.error.type === 'not_found') {
          sendSSEEvent(res, {
            type: 'error',
            message: 'セッションが見つかりません',
            code: 'SESSION_NOT_FOUND',
          });
        } else {
          sendSSEEvent(res, {
            type: 'error',
            message: loadResult.error.message,
            code: 'SESSION_LOAD_ERROR',
          });
        }
        res.end();
        return;
      }

      storageState = loadResult.value;
      console.log(`[SSE] セッション復号化成功: sessionId=${sessionInfo.sessionId}`);
    }

    try {
      // 分析開始ログ
      const authInfo = sessionInfo
        ? `session:${sessionInfo.sessionId}`
        : auth?.type || 'none';
      console.log(`[SSE] 分析開始: ${url} (認証: ${authInfo})`);

      sendSSEEvent(res, {
        type: 'log',
        message: `分析開始: ${url}`,
        timestamp: new Date().toISOString(),
      });

      // 分析実行（storageStateがある場合はそれを使用）
      const report = await analyzeFn(url, auth, onProgress, res, storageState);

      // 完了イベントを送信
      sendSSEEvent(res, {
        type: 'complete',
        report,
      });

      console.log(`[SSE] 分析完了: 違反${report.summary.totalViolations}件`);
    } catch (error) {
      console.error('[SSE] 分析エラー:', error);

      // 401/403エラーの検出（セッション期限切れ）
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (sessionInfo && (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('Unauthorized') || errorMessage.includes('Forbidden'))) {
        sendSSEEvent(res, {
          type: 'session_expired',
          message: 'セッションが期限切れの可能性があります。再ログインしてください。',
        });
      } else {
        // 通常のエラーイベントを送信
        sendSSEEvent(res, {
          type: 'error',
          message: error instanceof Error ? error.message : '分析中にエラーが発生しました',
          code: 'ANALYSIS_ERROR',
        });
      }
    } finally {
      res.end();
    }
  };
}
