/**
 * 複数URL順次分析機能
 * @requirement 5.2 - 各URLを順番に分析し、進捗をSSEで通知する
 * @requirement 5.3 - 各URLの分析結果を配列としてレスポンスに含める
 * @requirement 5.4 - 認証情報を全てのURL分析に共通で適用する
 * @requirement 5.5 - いずれかのURLの分析が失敗した場合、他のURLの分析を継続
 */

import type { AccessibilityReport, PageResult, RuleResult, ToolInfo, LighthouseScores, AISummary } from './analyzers/types';
import type { ProgressCallback, SSEEvent, PageProgressEvent } from './analyzers/sse-types';
import type { AuthConfig, StorageState } from './auth/types';
import { analyzeUrl } from './analyzer';

/**
 * 複数URL分析のオプション
 */
export interface MultiAnalyzeOptions {
  authConfig?: AuthConfig;
  onProgress?: ProgressCallback;
  storageState?: StorageState;
}

/**
 * エラー情報を含むPageResult拡張型
 * @requirement 5.5 - 失敗したURLについてはエラー情報を含める
 */
export interface PageResultWithError extends PageResult {
  error?: {
    message: string;
    code: string;
  };
}

/**
 * 複数URL分析の結果レポート
 */
export interface MultiUrlReport extends Omit<AccessibilityReport, 'pages'> {
  pages: PageResultWithError[];
}

/**
 * ページ進捗イベントを送信する
 */
function emitPageProgress(
  onProgress: ProgressCallback | undefined,
  pageIndex: number,
  totalPages: number,
  pageUrl: string,
  pageTitle: string,
  status: PageProgressEvent['status']
): void {
  if (onProgress) {
    const event: PageProgressEvent = {
      type: 'page_progress',
      pageIndex,
      totalPages,
      pageUrl,
      pageTitle,
      status,
    };
    onProgress(event);
  }
}

/**
 * 複数URLを順次分析し、結果を集約する
 * @param urls 分析対象のURLリスト（1-4件）
 * @param options 分析オプション（認証、進捗コールバック、storageState）
 * @returns 全ページの分析結果を含むレポート
 */
export async function analyzeMultipleUrls(
  urls: string[],
  options: MultiAnalyzeOptions = {}
): Promise<MultiUrlReport> {
  const { authConfig, onProgress, storageState } = options;
  const totalPages = urls.length;

  const pages: PageResultWithError[] = [];
  const allToolsUsed: ToolInfo[] = [];
  let combinedLighthouseScores: LighthouseScores | undefined;
  let combinedAiSummary: AISummary | undefined;
  let firstScreenshot: string | undefined;

  // サマリー用の集計
  let totalViolations = 0;
  let totalPasses = 0;
  let totalIncomplete = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];

    // 分析開始イベント
    emitPageProgress(onProgress, i, totalPages, url, '', 'started');

    try {
      // 各URL分析の進捗を親コールバックに転送
      const pageOnProgress: ProgressCallback = (event: SSEEvent) => {
        if (onProgress) {
          onProgress(event);
        }
      };

      // 単一URL分析を実行（storageStateを共有）
      const report = await analyzeUrl(url, authConfig, pageOnProgress, storageState);

      // ページ結果を取得（通常は1ページのみ）
      // pageResultにはscreenshot, lighthouseScores, aiSummaryが含まれる（analyzer.tsで設定済み）
      const pageResult = report.pages[0];
      if (pageResult) {
        pages.push({
          ...pageResult,
          name: pageResult.name,
        });

        // サマリー集計
        totalViolations += report.summary.totalViolations;
        totalPasses += report.summary.totalPasses;
        totalIncomplete += report.summary.totalIncomplete;

        // ツール情報をマージ（初回のみ）
        if (allToolsUsed.length === 0 && report.toolsUsed) {
          allToolsUsed.push(...report.toolsUsed);
        }

        // レポートレベルのスクリーンショットは最初のページのものを使用（後方互換性）
        if (!firstScreenshot && pageResult.screenshot) {
          firstScreenshot = pageResult.screenshot;
        }

        // レポートレベルのLighthouseスコアは最初のページのものを使用（後方互換性）
        if (!combinedLighthouseScores && pageResult.lighthouseScores) {
          combinedLighthouseScores = pageResult.lighthouseScores;
        }

        // レポートレベルのAI総評は最初のページのものを使用（後方互換性）
        // 各ページのAI総評はpageResult.aiSummaryに含まれる
        if (!combinedAiSummary && pageResult.aiSummary) {
          combinedAiSummary = pageResult.aiSummary;
        }

        // 分析完了イベント（ページタイトル付き）
        emitPageProgress(onProgress, i, totalPages, url, pageResult.name, 'completed');
      }
    } catch (error) {
      // 分析失敗時もページを追加（エラー情報付き）
      const errorMessage = error instanceof Error ? error.message : String(error);

      pages.push({
        name: new URL(url).hostname,
        url,
        violations: [],
        passes: [],
        incomplete: [],
        error: {
          message: errorMessage,
          code: 'ANALYSIS_ERROR',
        },
      });

      // 分析失敗イベント
      emitPageProgress(onProgress, i, totalPages, url, '', 'failed');

      console.error(`[MultiAnalyzer] URL分析失敗: ${url}`, error);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalViolations,
      totalPasses,
      totalIncomplete,
    },
    pages,
    screenshot: firstScreenshot,
    toolsUsed: allToolsUsed,
    lighthouseScores: combinedLighthouseScores,
    aiSummary: combinedAiSummary,
  };
}
