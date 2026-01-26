import { SecretManagerService, type Result } from './secret-manager';
import type { RuleResult, LighthouseScores, AISummary, ImpactSummary, DetectedIssue } from '../analyzers/types';

// Geminiエラー型
export type GeminiError =
  | { type: 'api_error'; message: string; statusCode: number }
  | { type: 'timeout'; message: string }
  | { type: 'rate_limit'; message: string; retryAfter: number }
  | { type: 'parse_error'; message: string; position?: number; excerpt?: string };

// Gemini APIのモデル名
const GEMINI_MODEL = 'gemini-2.0-flash';

// APIのタイムアウト（ミリ秒）
const API_TIMEOUT_MS = 30000;

// 出力トークン上限（レスポンストランケーション防止のため8192に設定）
const MAX_OUTPUT_TOKENS = 8192;

// detectedIssuesの最大件数（レスポンスサイズ制限のため）
const MAX_DETECTED_ISSUES = 30;

// リトライ設定
const RETRY_DELAY_MS = 1000;  // 1秒
const MAX_RETRIES = 3;        // 3回

// Gemini APIのエンドポイント
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * JSON文字列値内の制御文字をエスケープする
 * @param text - Gemini APIからの生レスポンステキスト
 * @returns サニタイズ済みテキスト
 */
export function sanitizeJsonResponse(text: string): string {
  if (!text) {
    return text;
  }

  let sanitized = text;

  // 1. Markdownバッククォート（```json ... ``` または ``` ... ```）の除去
  const markdownMatch = sanitized.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  if (markdownMatch) {
    sanitized = markdownMatch[1];
  }

  // 2. JSON文字列値内の制御文字をエスケープ
  // JSON構造を壊さないように、文字列値内のみを処理
  // 文字列値は "..." で囲まれた部分
  sanitized = sanitized.replace(
    /"(?:[^"\\]|\\.)*"/g,
    (match) => {
      // 既にエスケープされた文字列は変更しない
      // 未エスケープの制御文字のみをエスケープ
      return match
        // リテラル改行をエスケープ（既にエスケープされた\nは除く）
        .replace(/(?<!\\)\n/g, '\\n')
        // リテラルタブをエスケープ
        .replace(/(?<!\\)\t/g, '\\t')
        // リテラル復帰をエスケープ
        .replace(/(?<!\\)\r/g, '\\r');
    }
  );

  return sanitized;
}

/**
 * フォールバック発動時のログ出力
 * @param reason - フォールバック発動の理由（エラーメッセージ）
 * @param details - オプションの詳細情報（位置情報、抜粋）
 */
export function logFallbackActivation(
  reason: string,
  details?: { position?: number; excerpt?: string }
): void {
  const logData: { reason: string; position?: number; excerpt?: string } = { reason };

  if (details?.position !== undefined) {
    logData.position = details.position;
  }
  if (details?.excerpt !== undefined) {
    logData.excerpt = details.excerpt;
  }

  console.warn('Gemini: フォールバックAISummaryを生成しました', logData);
}

/**
 * フォールバック用のAISummaryを生成する
 * パース失敗時に違反情報から基本的なAISummaryを生成する
 * @param violations - 検出された違反情報
 * @returns フォールバックAISummary（isFallback: true）
 */
export function generateFallbackSummary(violations: RuleResult[]): AISummary {
  const impactSummary = countByImpact(violations);
  const totalCount = violations.length;

  // 違反件数に応じた評価文を生成
  let overallAssessment: string;
  if (totalCount === 0) {
    overallAssessment = '検出された違反は0件です。アクセシビリティ基準を満たしています。';
  } else {
    const criticalCount = impactSummary.critical;
    const seriousCount = impactSummary.serious;

    const highPriorityParts: string[] = [];
    if (criticalCount > 0) {
      highPriorityParts.push(`致命的な問題が${criticalCount}件`);
    }
    if (seriousCount > 0) {
      highPriorityParts.push(`重大な問題が${seriousCount}件`);
    }

    if (highPriorityParts.length > 0) {
      overallAssessment = `検出された違反は${totalCount}件で、${highPriorityParts.join('、')}含まれています。優先的な対応が必要です。`;
    } else {
      overallAssessment = `検出された違反は${totalCount}件で、中程度以下の問題です。順次改善を推奨します。`;
    }
  }

  return {
    overallAssessment,
    detectedIssues: [],
    prioritizedImprovements: [],
    specificRecommendations: [],
    impactSummary,
    generatedAt: new Date().toISOString(),
    isFallback: true,
  };
}

/**
 * リトライ対象のエラーかどうかを判定する
 * @param error - GeminiError型のエラー
 * @returns リトライ可能な場合はtrue
 */
export function isRetryableError(error: GeminiError): boolean {
  // タイムアウトエラーはリトライ対象
  if (error.type === 'timeout') {
    return true;
  }

  // api_errorの場合
  if (error.type === 'api_error') {
    // 5xxエラー（サーバーエラー）はリトライ対象
    if (error.statusCode >= 500) {
      return true;
    }
    // statusCode 0 はネットワークエラーを示すのでリトライ対象
    if (error.statusCode === 0) {
      return true;
    }
    // 4xxエラーはリトライ対象外
    return false;
  }

  // rate_limitエラーはリトライ対象外（Retry-Afterに従う）
  if (error.type === 'rate_limit') {
    return false;
  }

  // parse_errorはリトライ対象外
  if (error.type === 'parse_error') {
    return false;
  }

  return false;
}

/**
 * バックオフ待機用のスリープ関数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 単一のGemini API呼び出しを実行する
 * @param apiKey - Gemini APIキー
 * @param prompt - プロンプト
 * @param violations - 違反情報（パース用）
 * @returns API呼び出し結果
 */
async function callGeminiAPI(
  apiKey: string,
  prompt: string,
  violations: RuleResult[]
): Promise<Result<AISummary, GeminiError>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    // レート制限チェック
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      return {
        success: false,
        error: {
          type: 'rate_limit',
          message: 'レート制限に達しました',
          retryAfter,
        },
      };
    }

    // その他のエラー
    if (!response.ok) {
      return {
        success: false,
        error: {
          type: 'api_error',
          message: `Gemini API エラー: ${response.statusText}`,
          statusCode: response.status,
        },
      };
    }

    // レスポンスをパース
    const data = await response.json();
    const aiSummary = parseGeminiResponse(data, violations);

    if (!aiSummary) {
      return {
        success: false,
        error: {
          type: 'api_error',
          message: 'Gemini APIからの応答をパースできませんでした',
          statusCode: 0,
        },
      };
    }

    return { success: true, value: aiSummary };
  } catch (error) {
    clearTimeout(timeoutId);

    // タイムアウト
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        success: false,
        error: {
          type: 'timeout',
          message: 'Gemini APIへのリクエストがタイムアウトしました',
        },
      };
    }

    // その他のエラー（ネットワークエラーなど）
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: {
        type: 'api_error',
        message: `Gemini API呼び出し中にエラーが発生しました: ${message}`,
        statusCode: 0,
      },
    };
  }
}

/**
 * 参照リンクの型定義（Grounding対応：ドメイン情報を含む）
 */
export interface ReferenceLink {
  uri: string;
  domain?: string;
  title?: string;
}

/**
 * チャットレスポンスの型定義（Grounding対応）
 */
export interface ChatResponseValue {
  answer: string;
  referenceUrls: string[];  // 後方互換性のため維持
  referenceLinks: ReferenceLink[];  // 新しい形式（ドメイン情報を含む）
}

/**
 * チャット用のGemini API呼び出しを実行する（Grounding対応）
 * @param apiKey - Gemini APIキー
 * @param systemPrompt - システムプロンプト
 * @param userPrompt - ユーザープロンプト
 * @returns API呼び出し結果（answerとreferenceUrls）
 */
async function callGeminiChatAPI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<Result<ChatResponseValue, GeminiError>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n質問: ${userPrompt}` }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 512,
          },
          tools: [{ google_search: {} }],
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    // レート制限チェック
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      return {
        success: false,
        error: {
          type: 'rate_limit',
          message: 'レート制限に達しました',
          retryAfter,
        },
      };
    }

    // その他のエラー
    if (!response.ok) {
      return {
        success: false,
        error: {
          type: 'api_error',
          message: `Gemini API エラー: ${response.statusText}`,
          statusCode: response.status,
        },
      };
    }

    // レスポンスをパース（Grounding対応）
    const data = await response.json();
    const candidate = (data as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
        groundingMetadata?: {
          groundingChunks?: Array<{
            web?: { uri?: string; title?: string; domain?: string };
          }>;
        };
      }>;
    }).candidates?.[0];

    const text = candidate?.content?.parts?.[0]?.text;

    if (!text) {
      return {
        success: false,
        error: {
          type: 'api_error',
          message: 'Gemini APIからの応答にテキストがありません',
          statusCode: 0,
        },
      };
    }

    // groundingChunksから参照URL情報を抽出
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
    const referenceLinks: ReferenceLink[] = groundingChunks
      .filter((chunk) => chunk.web?.uri)
      .map((chunk) => ({
        uri: chunk.web!.uri!,
        domain: chunk.web!.domain,
        title: chunk.web!.title,
      }));

    // 後方互換性のためreferenceUrlsも維持
    const referenceUrls: string[] = referenceLinks.map((link) => link.uri);

    return {
      success: true,
      value: {
        answer: text,
        referenceUrls,
        referenceLinks,
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);

    // タイムアウト
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        success: false,
        error: {
          type: 'timeout',
          message: 'Gemini APIへのリクエストがタイムアウトしました',
        },
      };
    }

    // その他のエラー（ネットワークエラーなど）
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: {
        type: 'api_error',
        message: `Gemini API呼び出し中にエラーが発生しました: ${message}`,
        statusCode: 0,
      },
    };
  }
}

export const GeminiService = {
  /**
   * インラインAI対話用：システムプロンプトとユーザープロンプトから回答を生成する（Grounding対応）
   * @returns 成功時はanswerとreferenceUrlsを含むオブジェクト
   */
  async generateChatResponse(
    systemPrompt: string,
    userPrompt: string
  ): Promise<Result<ChatResponseValue, GeminiError>> {
    // 1. APIキーを取得
    const secretResult = await SecretManagerService.getSecret('google_api_key_toku');
    if (!secretResult.success) {
      console.error('Gemini: APIキー取得失敗');
      return {
        success: false,
        error: {
          type: 'api_error',
          message: `APIキー取得に失敗しました: ${secretResult.error.message}`,
          statusCode: 0,
        },
      };
    }

    const apiKey = secretResult.value;

    // 2. Gemini APIを呼び出し（リトライ付き）
    let lastError: GeminiError | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // リトライの場合は待機
      if (attempt > 0 && lastError) {
        console.info('Gemini: リトライを実行します', {
          attempt,
          delay: RETRY_DELAY_MS,
          previousError: lastError.type,
        });
        await sleep(RETRY_DELAY_MS);
      }

      const result = await callGeminiChatAPI(apiKey, systemPrompt, userPrompt);

      if (result.success) {
        console.log('Gemini: チャット応答生成完了');
        return result;
      }

      // エラーの場合
      lastError = result.error;

      // リトライ対象外のエラーはすぐに返却
      if (!isRetryableError(result.error)) {
        console.error('Gemini: API呼び出しエラー:', result.error.message);
        return result;
      }

      // リトライ回数を超えた場合
      if (attempt === MAX_RETRIES) {
        console.error('Gemini: リトライ上限に達しました:', result.error.message);
        return result;
      }
    }

    // ここには到達しないはずだが、型安全のため
    return {
      success: false,
      error: lastError || {
        type: 'api_error',
        message: '予期しないエラーが発生しました',
        statusCode: 0,
      },
    };
  },

  /**
   * 違反情報とスコアからAI総評を生成する
   */
  async generateAISummary(
    violations: RuleResult[],
    scores?: LighthouseScores
  ): Promise<Result<AISummary, GeminiError>> {
    // 1. APIキーを取得
    const secretResult = await SecretManagerService.getSecret('google_api_key_toku');
    if (!secretResult.success) {
      console.error('Gemini: APIキー取得失敗');
      return {
        success: false,
        error: {
          type: 'api_error',
          message: `APIキー取得に失敗しました: ${secretResult.error.message}`,
          statusCode: 0,
        },
      };
    }

    const apiKey = secretResult.value;

    // 2. プロンプトを構築
    const prompt = buildPrompt(violations, scores);

    // 3. Gemini APIを呼び出し（リトライ付き）
    let lastError: GeminiError | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // リトライの場合は待機
      if (attempt > 0 && lastError) {
        console.info('Gemini: リトライを実行します', {
          attempt,
          delay: RETRY_DELAY_MS,
          previousError: lastError.type,
        });
        await sleep(RETRY_DELAY_MS);
      }

      const result = await callGeminiAPI(apiKey, prompt, violations);

      if (result.success) {
        console.log('Gemini: AI総評生成完了');
        return result;
      }

      // エラーの場合
      lastError = result.error;

      // リトライ対象外のエラーはすぐに返却
      if (!isRetryableError(result.error)) {
        console.error('Gemini: API呼び出しエラー:', result.error.message);
        return result;
      }

      // リトライ回数を超えた場合
      if (attempt === MAX_RETRIES) {
        console.error('Gemini: リトライ上限に達しました:', result.error.message);
        return result;
      }
    }

    // ここには到達しないはずだが、型安全のため
    return {
      success: false,
      error: lastError || {
        type: 'api_error',
        message: '予期しないエラーが発生しました',
        statusCode: 0,
      },
    };
  },
};

/**
 * AI総評生成用のプロンプトを構築
 * @param violations - 検出された違反情報（axe-core, pa11y, lighthouseの全ツールからのデータ）
 * @param scores - Lighthouseスコア（オプショナル、現在プロンプトでは未使用）
 */
function buildPrompt(violations: RuleResult[], scores?: LighthouseScores): string {
  // 影響度別に違反を集計
  const impactSummary = countByImpact(violations);

  // ツール別に違反を集計
  const axeViolations = violations.filter(v => v.toolSource === 'axe-core');
  const pa11yViolations = violations.filter(v => v.toolSource === 'pa11y');
  const lighthouseViolations = violations.filter(v => v.toolSource === 'lighthouse');

  // 全違反情報を整形（ツールソースを含む）
  const violationsSummary = violations
    .map((v, i) => `${i + 1}. ルールID: ${v.id}
   検出ツール: ${v.toolSource}
   説明: ${v.description}
   影響度: ${v.impact || '不明'}
   検出箇所数: ${v.nodeCount}
   WCAG: ${v.wcagCriteria.join(', ') || 'N/A'}`)
    .join('\n\n');

  return `あなたはWebアクセシビリティの専門家です。以下の分析結果を元に、開発者が即座にアクションを取れる具体的な総評を日本語で作成してください。

## 重要な指示
- **すべての出力は日本語で記述すること**（ruleIdのみ英語可）
- **overallAssessmentは必ず「検出された違反は〇件で、」から開始すること**
- **Lighthouseスコアから始めることは禁止**
- **Lighthouseスコアへの言及は禁止（プロンプトに含まれていない）**
- 3つのツール（axe-core、pa11y、lighthouse）を同等に扱うこと
- いずれのツールも"主要"または"補助"的と表現しないこと
- 抽象的な表現（「改善が必要です」「問題があります」など）は禁止
- 各問題について「何が起きているか」「修正に必要なもの」「どう修正するか」を必ず具体的に記述
- コード例やHTML/CSS修正例を含めること
- 英語のルール名や技術用語には日本語の説明を追加すること

## 使用ツール
本分析では以下の3つのアクセシビリティ検証ツールを使用しています（アルファベット順）：
- **axe-core**: 業界標準のアクセシビリティエンジン（検出: ${axeViolations.length}件）
- **lighthouse**: Google Chrome DevTools のアクセシビリティ監査（検出: ${lighthouseViolations.length}件）
- **pa11y**: HTML CodeSniffer ベースの検証ツール（検出: ${pa11yViolations.length}件）

※ axe-coreとlighthouseは一部同一ルールを共有するため、件数には重複が含まれる可能性があります。

## 分析結果サマリー
- 3ツール合計の検出違反数: ${violations.length}件
  - Critical（致命的）: ${impactSummary.critical}件
  - Serious（重大）: ${impactSummary.serious}件
  - Moderate（中程度）: ${impactSummary.moderate}件
  - Minor（軽微）: ${impactSummary.minor}件

## 検出された違反（全${violations.length}件）
${violationsSummary || '違反は検出されませんでした'}

## 出力形式（JSON）
以下の形式で回答してください。**detectedIssuesは最大${MAX_DETECTED_ISSUES}件まで**とし、影響度の高い順（critical→serious→moderate→minor）に優先して記述してください：

{
  "overallAssessment": "全体評価（必ず「検出された違反は〇件で、」から開始し、主要な問題タイプと影響度を説明する）",
  "detectedIssues": [
    {
      "ruleId": "検出されたルールID（例: color-contrast）",
      "whatIsHappening": "何が起きているか（具体的な問題の説明）",
      "whatIsNeeded": "修正に必要なもの（必要なリソース・知識・基準値）",
      "howToFix": "どう修正するか（具体的なコード例やCSS修正例を含む）"
    }
  ],
  "prioritizedImprovements": [
    "影響度順の改善タスク（具体的なアクションを記述）"
  ],
  "specificRecommendations": [
    "開発ワークフローへの推奨事項"
  ],
  "impactSummary": {
    "critical": ${impactSummary.critical},
    "serious": ${impactSummary.serious},
    "moderate": ${impactSummary.moderate},
    "minor": ${impactSummary.minor}
  }
}

回答はJSON形式のみで、他のテキストは含めないでください。`;
}

/**
 * 影響度別に違反を集計
 */
function countByImpact(violations: RuleResult[]): ImpactSummary {
  return violations.reduce(
    (acc, v) => {
      const impact = v.impact || 'minor';
      acc[impact] = (acc[impact] || 0) + 1;
      return acc;
    },
    { critical: 0, serious: 0, moderate: 0, minor: 0 } as ImpactSummary
  );
}

/**
 * パースエラーから位置情報を抽出する
 */
function extractParseErrorPosition(error: unknown): number | undefined {
  if (error instanceof SyntaxError) {
    // Node.jsのJSON.parseエラーメッセージから位置を抽出
    // 例: "Unexpected token at position 5035"
    // 例: "Unterminated string in JSON at position 5035 (line 48 column 154)"
    const message = error.message;
    const positionMatch = message.match(/position (\d+)/);
    if (positionMatch) {
      return parseInt(positionMatch[1], 10);
    }
  }
  return undefined;
}

/**
 * エラー位置周辺の文字列を抜粋（最大100文字）
 */
function extractExcerpt(text: string, position?: number): string {
  if (position === undefined) {
    // 位置不明の場合は先頭から100文字
    return text.slice(0, 100);
  }

  // 位置の前後50文字ずつを抽出
  const start = Math.max(0, position - 50);
  const end = Math.min(text.length, position + 50);
  let excerpt = text.slice(start, end);

  // 先頭・末尾が切れている場合は省略記号を追加
  if (start > 0) {
    excerpt = '...' + excerpt;
  }
  if (end < text.length) {
    excerpt = excerpt + '...';
  }

  // 最大100文字に制限
  return excerpt.slice(0, 100);
}

/**
 * Gemini APIのレスポンスをパース
 * Task 6: サニタイズ処理の統合、詳細ログ出力、フォールバック生成
 */
function parseGeminiResponse(
  data: unknown,
  violations: RuleResult[]
): AISummary | null {
  // レスポンス構造を型アサーション
  const response = data as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    console.error('Gemini: レスポンスにテキストがありません');
    // テキストがない場合はフォールバック生成
    logFallbackActivation('レスポンスにテキストがありません');
    return generateFallbackSummary(violations);
  }

  // Task 6.1: サニタイズ処理の統合
  // JSON.parse実行前にsanitizeJsonResponseを呼び出す
  const sanitizedText = sanitizeJsonResponse(rawText);

  try {
    // JSONをパース
    const parsed = JSON.parse(sanitizedText) as {
      overallAssessment?: string;
      detectedIssues?: Array<{
        ruleId?: string;
        whatIsHappening?: string;
        whatIsNeeded?: string;
        howToFix?: string;
      }>;
      prioritizedImprovements?: string[];
      specificRecommendations?: string[];
      impactSummary?: Partial<ImpactSummary>;
    };

    // 必須フィールドの検証
    if (!parsed.overallAssessment) {
      console.error('Gemini: overallAssessmentが見つかりません');
      // Task 6.3: 必須フィールド欠落時もフォールバック生成
      logFallbackActivation('overallAssessmentが見つかりません');
      return generateFallbackSummary(violations);
    }

    // 影響度サマリーがない場合は再計算
    const impactSummary: ImpactSummary = parsed.impactSummary
      ? {
          critical: parsed.impactSummary.critical ?? 0,
          serious: parsed.impactSummary.serious ?? 0,
          moderate: parsed.impactSummary.moderate ?? 0,
          minor: parsed.impactSummary.minor ?? 0,
        }
      : countByImpact(violations);

    // detectedIssuesをパース（存在しない場合は空配列）
    const detectedIssues: DetectedIssue[] = (parsed.detectedIssues || [])
      .filter((issue) => issue.ruleId && issue.whatIsHappening && issue.whatIsNeeded && issue.howToFix)
      .map((issue) => ({
        ruleId: issue.ruleId!,
        whatIsHappening: issue.whatIsHappening!,
        whatIsNeeded: issue.whatIsNeeded!,
        howToFix: issue.howToFix!,
      }));

    return {
      overallAssessment: parsed.overallAssessment,
      detectedIssues,
      prioritizedImprovements: parsed.prioritizedImprovements || [],
      specificRecommendations: parsed.specificRecommendations || [],
      impactSummary,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    // Task 6.2: パースエラー時の詳細ログ出力
    const position = extractParseErrorPosition(error);
    const excerpt = extractExcerpt(sanitizedText, position);
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('Gemini: JSONパースエラー', {
      message: errorMessage,
      position,
      excerpt,
    });

    // Task 6.3: フォールバック生成の統合
    // パース失敗時はフォールバックAISummaryを生成して返却
    logFallbackActivation(errorMessage, { position, excerpt });
    return generateFallbackSummary(violations);
  }
}
