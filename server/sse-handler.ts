import type { Request, Response, RequestHandler } from 'express';
import type { SSEEvent, ProgressCallback } from './analyzers/sse-types';
import type { AuthConfig } from './auth/types';
import type { AccessibilityReport } from './analyzers/types';

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
 * 分析関数の型定義
 */
export type AnalyzeFunction = (
  url: string,
  auth: AuthConfig | undefined,
  onProgress: ProgressCallback,
  res: Response
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

    // 認証設定を取得
    const auth = parseAuthFromQuery(req.query);

    // SSEヘッダーを設定
    setSSEHeaders(res);

    // 進捗コールバック
    const onProgress: ProgressCallback = (event: SSEEvent) => {
      sendSSEEvent(res, event);
    };

    try {
      // 分析開始ログ
      const authType = auth?.type || 'none';
      console.log(`[SSE] 分析開始: ${url} (認証: ${authType})`);

      sendSSEEvent(res, {
        type: 'log',
        message: `分析開始: ${url}`,
        timestamp: new Date().toISOString(),
      });

      // 分析実行
      const report = await analyzeFn(url, auth, onProgress, res);

      // 完了イベントを送信
      sendSSEEvent(res, {
        type: 'complete',
        report,
      });

      console.log(`[SSE] 分析完了: 違反${report.summary.totalViolations}件`);
    } catch (error) {
      console.error('[SSE] 分析エラー:', error);

      // エラーイベントを送信
      sendSSEEvent(res, {
        type: 'error',
        message: error instanceof Error ? error.message : '分析中にエラーが発生しました',
        code: 'ANALYSIS_ERROR',
      });
    } finally {
      res.end();
    }
  };
}
