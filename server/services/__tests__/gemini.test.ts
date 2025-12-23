import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiService, type GeminiError, sanitizeJsonResponse, generateFallbackSummary, logFallbackActivation } from '../gemini';
import { SecretManagerService } from '../secret-manager';
import type { RuleResult, LighthouseScores, AISummary } from '../../analyzers/types';

// SecretManagerServiceをモック
vi.mock('../secret-manager', () => ({
  SecretManagerService: {
    getSecret: vi.fn(),
  },
}));

// globalのfetchをモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GeminiService', () => {
  const mockViolations: RuleResult[] = [
    {
      id: 'color-contrast',
      description: 'Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds',
      impact: 'serious',
      nodeCount: 3,
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/color-contrast',
      wcagCriteria: ['1.4.3'],
      toolSource: 'axe-core',
    },
    {
      id: 'link-name',
      description: 'Ensure links have discernible text',
      impact: 'critical',
      nodeCount: 1,
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/link-name',
      wcagCriteria: ['2.4.4'],
      toolSource: 'axe-core',
    },
    {
      id: 'image-alt',
      description: 'Images must have alternate text',
      impact: 'moderate',
      nodeCount: 2,
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/image-alt',
      wcagCriteria: ['1.1.1'],
      toolSource: 'pa11y',
    },
  ];

  const mockScores: LighthouseScores = {
    performance: 85,
    accessibility: 72,
    bestPractices: 90,
    seo: 95,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトでAPIキー取得成功
    vi.mocked(SecretManagerService.getSecret).mockResolvedValue({
      success: true,
      value: 'test-api-key',
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('generateAISummary', () => {
    it('違反情報からAI総評を生成できる', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    overallAssessment: 'このサイトには3つのアクセシビリティ問題があります。',
                    prioritizedImprovements: [
                      'リンクに適切なテキストを追加する',
                      'コントラスト比を改善する',
                    ],
                    specificRecommendations: [
                      'aria-labelを使用してリンクに説明を追加してください',
                      '背景色と文字色のコントラスト比を4.5:1以上にしてください',
                    ],
                    impactSummary: {
                      critical: 1,
                      serious: 1,
                      moderate: 1,
                      minor: 0,
                    },
                  }),
                },
              ],
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await GeminiService.generateAISummary(mockViolations, mockScores);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.overallAssessment).toContain('3つのアクセシビリティ問題');
        expect(result.value.prioritizedImprovements).toHaveLength(2);
        expect(result.value.impactSummary.critical).toBe(1);
        expect(result.value.generatedAt).toBeDefined();
      }
    });

    it('APIキー取得に失敗した場合はエラーを返す', async () => {
      vi.mocked(SecretManagerService.getSecret).mockResolvedValue({
        success: false,
        error: { type: 'not_found', message: 'Secret not found' },
      });

      const result = await GeminiService.generateAISummary(mockViolations, mockScores);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('api_error');
      }
    });

    it('APIリクエストが失敗した場合はエラーを返す（4xxエラー）', async () => {
      // 4xxエラーはリトライ対象外なので1回で返却される
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      const result = await GeminiService.generateAISummary(mockViolations, mockScores);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('api_error');
        expect(result.error.statusCode).toBe(403);
      }
    });

    it('レート制限エラーの場合は専用のエラーを返す', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          get: (name: string) => name === 'Retry-After' ? '60' : null,
        },
      });

      const result = await GeminiService.generateAISummary(mockViolations, mockScores);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('rate_limit');
      }
    });

    it('タイムアウトした場合はタイムアウトエラーを返す', async () => {
      mockFetch.mockImplementation(() => new Promise((_, reject) => {
        setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 100);
      }));

      const result = await GeminiService.generateAISummary(mockViolations, mockScores);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('timeout');
      }
    });

    it('レスポンスのJSONが不正な場合はフォールバックAISummaryを返す', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'これは不正なJSONです',
                },
              ],
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // フォールバック発動時のログをモック
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await GeminiService.generateAISummary(mockViolations, mockScores);

      // Task 6により、パース失敗時はフォールバックAISummaryを成功として返却
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.isFallback).toBe(true);
        expect(result.value.overallAssessment).toBeDefined();
      }

      consoleWarnSpy.mockRestore();
    });

    it('日本語でプロンプトを構築する', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    overallAssessment: 'テスト',
                    prioritizedImprovements: [],
                    specificRecommendations: [],
                    impactSummary: { critical: 0, serious: 0, moderate: 0, minor: 0 },
                  }),
                },
              ],
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await GeminiService.generateAISummary(mockViolations, mockScores);

      // fetchが呼ばれたことを確認
      expect(mockFetch).toHaveBeenCalled();
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      // プロンプトに日本語が含まれていることを確認
      const promptText = requestBody.contents[0].parts[0].text;
      expect(promptText).toContain('アクセシビリティ');
    });
  });

  describe('GeminiError型', () => {
    it('parse_error型を持つことができる', () => {
      // parse_error型の定義が正しく動作することを確認
      const parseError: GeminiError = {
        type: 'parse_error',
        message: 'JSONパースに失敗しました',
        position: 5035,
        excerpt: '..."howToFix": "以下のコード例を参照...',
      };

      expect(parseError.type).toBe('parse_error');
      expect(parseError.message).toBe('JSONパースに失敗しました');
      expect(parseError.position).toBe(5035);
      expect(parseError.excerpt).toBe('..."howToFix": "以下のコード例を参照...');
    });

    it('parse_error型でpositionとexcerptはオプショナル', () => {
      const parseError: GeminiError = {
        type: 'parse_error',
        message: 'JSONパースに失敗しました',
      };

      expect(parseError.type).toBe('parse_error');
      expect(parseError.message).toBe('JSONパースに失敗しました');
    });
  });

  describe('定数設定', () => {
    it('maxOutputTokensが8192に設定されている', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    overallAssessment: 'テスト',
                    prioritizedImprovements: [],
                    specificRecommendations: [],
                    impactSummary: { critical: 0, serious: 0, moderate: 0, minor: 0 },
                  }),
                },
              ],
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await GeminiService.generateAISummary(mockViolations, mockScores);

      // fetchが呼ばれたことを確認
      expect(mockFetch).toHaveBeenCalled();
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      // maxOutputTokensが8192であることを確認
      expect(requestBody.generationConfig.maxOutputTokens).toBe(8192);
    });
  });

  describe('AISummary型', () => {
    it('isFallbackフラグをオプショナルで持つことができる', () => {
      // isFallbackフラグがオプショナルで設定可能であることを確認
      const fallbackSummary: AISummary = {
        overallAssessment: 'フォールバック生成されたサマリー',
        detectedIssues: [],
        prioritizedImprovements: [],
        specificRecommendations: [],
        impactSummary: { critical: 0, serious: 0, moderate: 0, minor: 0 },
        generatedAt: new Date().toISOString(),
        isFallback: true,
      };

      expect(fallbackSummary.isFallback).toBe(true);
    });

    it('isFallbackフラグは省略可能', () => {
      // 既存のAISummaryは影響を受けない
      const normalSummary: AISummary = {
        overallAssessment: '通常生成されたサマリー',
        detectedIssues: [],
        prioritizedImprovements: [],
        specificRecommendations: [],
        impactSummary: { critical: 0, serious: 0, moderate: 0, minor: 0 },
        generatedAt: new Date().toISOString(),
      };

      expect(normalSummary.isFallback).toBeUndefined();
    });
  });

  describe('sanitizeJsonResponse', () => {
    it('有効なJSONを入力した場合は変更されない', () => {
      const validJson = '{"key": "value", "number": 123}';
      const result = sanitizeJsonResponse(validJson);
      expect(result).toBe(validJson);
    });

    it('Markdownバッククォートで囲まれた入力からバッククォートが除去される', () => {
      const markdownWrapped = '```json\n{"key": "value"}\n```';
      const result = sanitizeJsonResponse(markdownWrapped);
      expect(result).toBe('{"key": "value"}');
    });

    it('json指定なしのMarkdownバッククォートも除去される', () => {
      const markdownWrapped = '```\n{"key": "value"}\n```';
      const result = sanitizeJsonResponse(markdownWrapped);
      expect(result).toBe('{"key": "value"}');
    });

    it('未エスケープ改行を含む入力が正しくエスケープされる', () => {
      // JSON文字列値内のリテラル改行をエスケープ
      const jsonWithNewline = '{"howToFix": "修正方法:\n1. 最初のステップ"}';
      const result = sanitizeJsonResponse(jsonWithNewline);
      const parsed = JSON.parse(result);
      expect(parsed.howToFix).toContain('修正方法:');
    });

    it('未エスケープタブを含む入力が正しくエスケープされる', () => {
      const jsonWithTab = '{"code": "function() {\treturn true;\t}"}';
      const result = sanitizeJsonResponse(jsonWithTab);
      const parsed = JSON.parse(result);
      expect(parsed.code).toContain('function()');
    });

    it('既にエスケープ済みのバックスラッシュは変更されない', () => {
      // JSON文字列として正しくエスケープされたバックスラッシュ
      const jsonWithEscapedBackslash = '{"path": "C:\\\\Users\\\\test"}';
      const result = sanitizeJsonResponse(jsonWithEscapedBackslash);
      const parsed = JSON.parse(result);
      expect(parsed.path).toBe('C:\\Users\\test');
    });

    it('複合的なケース: 改行、タブ、バックスラッシュを含む入力を正しく処理する', () => {
      // 実際のGemini応答に近い複雑なケース
      const complexJson = `{
        "overallAssessment": "検出された違反は3件です",
        "detectedIssues": [
          {
            "ruleId": "color-contrast",
            "howToFix": "以下のCSSを追加してください:\n.button { color: #333; }"
          }
        ]
      }`;
      const result = sanitizeJsonResponse(complexJson);
      const parsed = JSON.parse(result);
      expect(parsed.overallAssessment).toBe('検出された違反は3件です');
      expect(parsed.detectedIssues[0].ruleId).toBe('color-contrast');
    });

    it('空文字列を入力した場合は空文字列を返す', () => {
      const result = sanitizeJsonResponse('');
      expect(result).toBe('');
    });
  });

  describe('generateFallbackSummary', () => {
    it('違反ありの入力で違反件数を含む評価文が生成される', () => {
      const violations: RuleResult[] = [
        {
          id: 'color-contrast',
          description: 'Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds',
          impact: 'serious',
          nodeCount: 3,
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/color-contrast',
          wcagCriteria: ['1.4.3'],
          toolSource: 'axe-core',
        },
        {
          id: 'link-name',
          description: 'Ensure links have discernible text',
          impact: 'critical',
          nodeCount: 1,
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/link-name',
          wcagCriteria: ['2.4.4'],
          toolSource: 'axe-core',
        },
      ];

      const result = generateFallbackSummary(violations);

      expect(result.overallAssessment).toContain('検出された違反は2件で');
      expect(result.isFallback).toBe(true);
      expect(result.generatedAt).toBeDefined();
    });

    it('違反なしの入力で適切なメッセージが生成される', () => {
      const violations: RuleResult[] = [];

      const result = generateFallbackSummary(violations);

      expect(result.overallAssessment).toContain('検出された違反は0件');
      expect(result.isFallback).toBe(true);
    });

    it('isFallback: trueが設定される', () => {
      const violations: RuleResult[] = [];

      const result = generateFallbackSummary(violations);

      expect(result.isFallback).toBe(true);
    });

    it('generatedAtが現在時刻に設定される', () => {
      const violations: RuleResult[] = [];
      const before = new Date().toISOString();

      const result = generateFallbackSummary(violations);

      const after = new Date().toISOString();
      expect(result.generatedAt).toBeDefined();
      // generatedAtがbeforeとafterの間にあることを確認
      expect(result.generatedAt >= before).toBe(true);
      expect(result.generatedAt <= after).toBe(true);
    });

    it('影響度サマリーが正しく計算される', () => {
      const violations: RuleResult[] = [
        {
          id: 'critical-rule',
          description: 'Critical issue',
          impact: 'critical',
          nodeCount: 1,
          helpUrl: 'https://example.com',
          wcagCriteria: ['1.1.1'],
          toolSource: 'axe-core',
        },
        {
          id: 'serious-rule',
          description: 'Serious issue',
          impact: 'serious',
          nodeCount: 2,
          helpUrl: 'https://example.com',
          wcagCriteria: ['1.2.1'],
          toolSource: 'pa11y',
        },
        {
          id: 'moderate-rule',
          description: 'Moderate issue',
          impact: 'moderate',
          nodeCount: 1,
          helpUrl: 'https://example.com',
          wcagCriteria: ['1.3.1'],
          toolSource: 'lighthouse',
        },
      ];

      const result = generateFallbackSummary(violations);

      expect(result.impactSummary.critical).toBe(1);
      expect(result.impactSummary.serious).toBe(1);
      expect(result.impactSummary.moderate).toBe(1);
      expect(result.impactSummary.minor).toBe(0);
    });

    it('空のdetectedIssues、prioritizedImprovements、specificRecommendationsを持つ', () => {
      const violations: RuleResult[] = [];

      const result = generateFallbackSummary(violations);

      expect(result.detectedIssues).toEqual([]);
      expect(result.prioritizedImprovements).toEqual([]);
      expect(result.specificRecommendations).toEqual([]);
    });
  });

  describe('isRetryableError', () => {
    // isRetryableError関数をインポートするため、後で更新が必要
    it('タイムアウトエラーはリトライ対象である', async () => {
      // 実装後にテストを追加
      const { isRetryableError } = await import('../gemini');
      const error: GeminiError = { type: 'timeout', message: 'タイムアウト' };
      expect(isRetryableError(error)).toBe(true);
    });

    it('5xxエラー（api_error + statusCode >= 500）はリトライ対象である', async () => {
      const { isRetryableError } = await import('../gemini');
      const error: GeminiError = { type: 'api_error', message: 'サーバーエラー', statusCode: 500 };
      expect(isRetryableError(error)).toBe(true);
    });

    it('503エラーはリトライ対象である', async () => {
      const { isRetryableError } = await import('../gemini');
      const error: GeminiError = { type: 'api_error', message: 'サービス利用不可', statusCode: 503 };
      expect(isRetryableError(error)).toBe(true);
    });

    it('4xxエラーはリトライ対象外である', async () => {
      const { isRetryableError } = await import('../gemini');
      const error: GeminiError = { type: 'api_error', message: 'バッドリクエスト', statusCode: 400 };
      expect(isRetryableError(error)).toBe(false);
    });

    it('404エラーはリトライ対象外である', async () => {
      const { isRetryableError } = await import('../gemini');
      const error: GeminiError = { type: 'api_error', message: 'リソースが見つかりません', statusCode: 404 };
      expect(isRetryableError(error)).toBe(false);
    });

    it('rate_limitエラーはリトライ対象外である', async () => {
      const { isRetryableError } = await import('../gemini');
      const error: GeminiError = { type: 'rate_limit', message: 'レート制限', retryAfter: 60 };
      expect(isRetryableError(error)).toBe(false);
    });

    it('parse_errorはリトライ対象外である', async () => {
      const { isRetryableError } = await import('../gemini');
      const error: GeminiError = { type: 'parse_error', message: 'パースエラー' };
      expect(isRetryableError(error)).toBe(false);
    });

    it('statusCode 0のapi_error（ネットワークエラー）はリトライ対象である', async () => {
      const { isRetryableError } = await import('../gemini');
      // ネットワークエラーの場合、statusCode: 0で表現される
      const error: GeminiError = { type: 'api_error', message: 'ネットワークエラー', statusCode: 0 };
      // ネットワークエラーはリトライすべき
      expect(isRetryableError(error)).toBe(true);
    });
  });

  describe('リトライ機構', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('タイムアウトエラー発生時に1回リトライが実行される', async () => {
      // 1回目: タイムアウト、2回目: 成功
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    overallAssessment: 'テスト',
                    prioritizedImprovements: [],
                    specificRecommendations: [],
                    impactSummary: { critical: 0, serious: 0, moderate: 0, minor: 0 },
                  }),
                },
              ],
            },
          },
        ],
      };

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new DOMException('Aborted', 'AbortError'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        });
      });

      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const resultPromise = GeminiService.generateAISummary(mockViolations, mockScores);

      // リトライの待機時間を進める
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('リトライ'),
        expect.anything()
      );

      consoleInfoSpy.mockRestore();
    });

    it('5xxエラー発生時に1回リトライが実行される', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    overallAssessment: 'テスト',
                    prioritizedImprovements: [],
                    specificRecommendations: [],
                    impactSummary: { critical: 0, serious: 0, moderate: 0, minor: 0 },
                  }),
                },
              ],
            },
          },
        ],
      };

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        });
      });

      const resultPromise = GeminiService.generateAISummary(mockViolations, mockScores);

      // リトライの待機時間を進める
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it('4xxエラー発生時にリトライが実行されない', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const result = await GeminiService.generateAISummary(mockViolations, mockScores);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('api_error');
      }
    });

    it('rate_limitエラー発生時にリトライが実行されない', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          get: (name: string) => name === 'Retry-After' ? '60' : null,
        },
      });

      const result = await GeminiService.generateAISummary(mockViolations, mockScores);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('rate_limit');
      }
    });

    it('リトライ間隔が約1秒である', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    overallAssessment: 'テスト',
                    prioritizedImprovements: [],
                    specificRecommendations: [],
                    impactSummary: { critical: 0, serious: 0, moderate: 0, minor: 0 },
                  }),
                },
              ],
            },
          },
        ],
      };

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new DOMException('Aborted', 'AbortError'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        });
      });

      const resultPromise = GeminiService.generateAISummary(mockViolations, mockScores);

      // 500ms進める - まだ2回目は呼ばれない
      await vi.advanceTimersByTimeAsync(500);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // さらに600ms進める - 2回目が呼ばれるはず
      await vi.advanceTimersByTimeAsync(600);
      await resultPromise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('リトライ後も失敗した場合は適切なエラーを返却する', async () => {
      // 2回ともタイムアウト
      mockFetch.mockImplementation(() => {
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      });

      const resultPromise = GeminiService.generateAISummary(mockViolations, mockScores);

      // リトライの待機時間を進める
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      // MAX_RETRIES=3 なので、初回 + 3回リトライ = 4回
      expect(mockFetch).toHaveBeenCalledTimes(4);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('timeout');
      }
    });

    it('リトライ実行時に情報ログを出力する', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    overallAssessment: 'テスト',
                    prioritizedImprovements: [],
                    specificRecommendations: [],
                    impactSummary: { critical: 0, serious: 0, moderate: 0, minor: 0 },
                  }),
                },
              ],
            },
          },
        ],
      };

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new DOMException('Aborted', 'AbortError'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        });
      });

      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const resultPromise = GeminiService.generateAISummary(mockViolations, mockScores);

      await vi.runAllTimersAsync();
      await resultPromise;

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        'Gemini: リトライを実行します',
        expect.objectContaining({
          attempt: 1,
          delay: 1000,
        })
      );

      consoleInfoSpy.mockRestore();
    });
  });

  describe('logFallbackActivation', () => {
    it('フォールバック発動時に警告ログを出力する', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logFallbackActivation('JSONパースに失敗しました');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Gemini: フォールバックAISummaryを生成しました',
        expect.objectContaining({
          reason: 'JSONパースに失敗しました',
        })
      );

      consoleWarnSpy.mockRestore();
    });

    it('元のパースエラーの位置情報をログに含める', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logFallbackActivation('JSONパースに失敗しました', {
        position: 5035,
        excerpt: '..."howToFix": "以下のコード例を参照...',
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Gemini: フォールバックAISummaryを生成しました',
        expect.objectContaining({
          reason: 'JSONパースに失敗しました',
          position: 5035,
          excerpt: '..."howToFix": "以下のコード例を参照...',
        })
      );

      consoleWarnSpy.mockRestore();
    });

    it('位置情報がない場合でも正常に動作する', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logFallbackActivation('不明なエラー');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Gemini: フォールバックAISummaryを生成しました',
        expect.objectContaining({
          reason: '不明なエラー',
        })
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('parseGeminiResponse拡張（Task 6）', () => {
    describe('Task 6.1: サニタイズ処理の統合', () => {
      it('JSON.parse実行前にsanitizeJsonResponseを呼び出す', async () => {
        // 未エスケープ改行を含むレスポンスが正常にパースできることを検証
        const mockResponse = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    // 実際のGeminiレスポンスに含まれる可能性のある未エスケープ改行
                    text: `{
  "overallAssessment": "検出された違反は3件で、修正が必要です。",
  "detectedIssues": [
    {
      "ruleId": "color-contrast",
      "whatIsHappening": "コントラストが不足しています",
      "whatIsNeeded": "WCAG AA基準（4.5:1）を満たす必要があります",
      "howToFix": "以下のCSSを追加してください:\n.button { color: #333; }"
    }
  ],
  "prioritizedImprovements": ["コントラスト比を改善"],
  "specificRecommendations": ["色設計を見直す"],
  "impactSummary": { "critical": 0, "serious": 1, "moderate": 1, "minor": 1 }
}`,
                  },
                ],
              },
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await GeminiService.generateAISummary(mockViolations, mockScores);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.overallAssessment).toContain('検出された違反は3件');
          expect(result.value.detectedIssues[0].howToFix).toContain('.button');
        }
      });

      it('Markdownバッククォートで囲まれたレスポンスも正常にパースできる', async () => {
        const mockResponse = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '```json\n{"overallAssessment": "検出された違反は0件です", "detectedIssues": [], "prioritizedImprovements": [], "specificRecommendations": [], "impactSummary": {"critical": 0, "serious": 0, "moderate": 0, "minor": 0}}\n```',
                  },
                ],
              },
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await GeminiService.generateAISummary(mockViolations, mockScores);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.overallAssessment).toContain('検出された違反は0件');
        }
      });

      it('サニタイズ後もパース失敗した場合はフォールバック処理に進む', async () => {
        const mockResponse = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    // サニタイズでも修正できない完全に不正なJSON
                    text: '{ 完全に不正なJSON !!!',
                  },
                ],
              },
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await GeminiService.generateAISummary(mockViolations, mockScores);

        // パース失敗時はフォールバックAISummaryが返される
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.isFallback).toBe(true);
        }

        consoleWarnSpy.mockRestore();
      });
    });

    describe('Task 6.2: パースエラー時の詳細ログ出力', () => {
      it('パースエラー発生時にエラーの位置情報を含むログを出力する', async () => {
        const mockResponse = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    // 不正なJSON（中途半端な状態）
                    text: '{"overallAssessment": "テスト',
                  },
                ],
              },
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await GeminiService.generateAISummary(mockViolations, mockScores);

        // パースエラー時の詳細ログが出力されることを確認
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Gemini: JSONパースエラー',
          expect.objectContaining({
            message: expect.any(String),
          })
        );

        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
      });

      it('問題箇所周辺の文字列（最大100文字）を抜粋してログに出力する', async () => {
        // 長い不正なJSONで位置情報が意味を持つケース
        const longInvalidJson = '{"key": "' + 'a'.repeat(50) + '不正な部分' + 'b'.repeat(50);
        const mockResponse = {
          candidates: [
            {
              content: {
                parts: [{ text: longInvalidJson }],
              },
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await GeminiService.generateAISummary(mockViolations, mockScores);

        // 抜粋がログに含まれることを確認
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Gemini: JSONパースエラー',
          expect.objectContaining({
            excerpt: expect.any(String),
          })
        );

        // excerptが100文字以下であることを確認
        const errorCall = consoleErrorSpy.mock.calls.find(
          call => call[0] === 'Gemini: JSONパースエラー'
        );
        if (errorCall) {
          expect((errorCall[1] as { excerpt?: string }).excerpt?.length).toBeLessThanOrEqual(100);
        }

        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
      });
    });

    describe('Task 6.3: フォールバック生成の統合', () => {
      it('パース失敗時にgenerateFallbackSummaryを呼び出してAISummaryを返却する', async () => {
        const mockResponse = {
          candidates: [
            {
              content: {
                parts: [{ text: '不正なJSON' }],
              },
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await GeminiService.generateAISummary(mockViolations, mockScores);

        // フォールバックAISummaryが成功として返却される
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.isFallback).toBe(true);
          expect(result.value.overallAssessment).toContain('検出された違反は3件');
        }

        consoleWarnSpy.mockRestore();
      });

      it('フォールバック発動時にlogFallbackActivationが呼ばれる', async () => {
        const mockResponse = {
          candidates: [
            {
              content: {
                parts: [{ text: '不正なJSON' }],
              },
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await GeminiService.generateAISummary(mockViolations, mockScores);

        // フォールバック発動ログが出力されることを確認
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Gemini: フォールバックAISummaryを生成しました',
          expect.anything()
        );

        consoleWarnSpy.mockRestore();
      });

      it('成功応答としてフォールバックAISummaryを返す（エラーではなく値として返却）', async () => {
        const mockResponse = {
          candidates: [
            {
              content: {
                parts: [{ text: 'これは有効なJSONではありません' }],
              },
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await GeminiService.generateAISummary(mockViolations, mockScores);

        // 重要: エラーではなく成功として返却される
        expect(result.success).toBe(true);
        if (result.success) {
          // 必要なフィールドがすべて存在する
          expect(result.value.overallAssessment).toBeDefined();
          expect(result.value.impactSummary).toBeDefined();
          expect(result.value.generatedAt).toBeDefined();
          expect(result.value.isFallback).toBe(true);
        }

        consoleWarnSpy.mockRestore();
      });

      it('overallAssessmentが欠落した応答でもフォールバックで処理される', async () => {
        // overallAssessmentがないJSON（必須フィールド欠落）
        const mockResponse = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '{"detectedIssues": [], "prioritizedImprovements": []}',
                  },
                ],
              },
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await GeminiService.generateAISummary(mockViolations, mockScores);

        // 必須フィールド欠落時もフォールバックで成功
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.isFallback).toBe(true);
        }

        consoleWarnSpy.mockRestore();
      });
    });
  });

  // Task 8: 統合テスト
  describe('統合テスト（Task 8）', () => {
    describe('8.1: 正常系の一連フローテスト', () => {
      it('Gemini API呼び出し → サニタイズ → パース → 成功の一連フローを検証する', async () => {
        // 実際のGeminiレスポンスに近いモックを用意
        // 未エスケープ改行を含むJSON（サニタイズが必要なケース）
        const mockGeminiResponse = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: `{
  "overallAssessment": "検出された違反は3件で、致命的な問題が1件、重大な問題が1件含まれています。優先的な対応が必要です。",
  "detectedIssues": [
    {
      "ruleId": "color-contrast",
      "whatIsHappening": "テキストと背景のコントラスト比が不足しています",
      "whatIsNeeded": "WCAG 2.1 AA基準では4.5:1以上のコントラスト比が必要です",
      "howToFix": "以下のCSSを追加してください:\n.text { color: #333; background: #fff; }"
    },
    {
      "ruleId": "link-name",
      "whatIsHappening": "リンクに認識可能なテキストがありません",
      "whatIsNeeded": "aria-labelまたはリンクテキストの追加が必要です",
      "howToFix": "<a href='...' aria-label='ホームへ戻る'>ホーム</a>"
    },
    {
      "ruleId": "image-alt",
      "whatIsHappening": "画像に代替テキストがありません",
      "whatIsNeeded": "alt属性を追加する必要があります",
      "howToFix": "<img src='...' alt='製品画像の説明'>"
    }
  ],
  "prioritizedImprovements": [
    "1. リンクにアクセシブルな名前を追加",
    "2. コントラスト比を改善",
    "3. 画像にalt属性を追加"
  ],
  "specificRecommendations": [
    "開発ワークフローにaxe-coreを組み込む",
    "CSSカラーパレットを見直す"
  ],
  "impactSummary": {
    "critical": 1,
    "serious": 1,
    "moderate": 1,
    "minor": 0
  }
}`,
                  },
                ],
              },
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockGeminiResponse,
        });

        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const result = await GeminiService.generateAISummary(mockViolations, mockScores);

        // 検証: 成功すること
        expect(result.success).toBe(true);

        if (result.success) {
          // 検証: AISummaryが正しく生成されていること
          expect(result.value.overallAssessment).toContain('検出された違反は3件');
          expect(result.value.overallAssessment).toContain('致命的な問題が1件');

          // 検証: detectedIssuesが3件あること
          expect(result.value.detectedIssues).toHaveLength(3);
          expect(result.value.detectedIssues[0].ruleId).toBe('color-contrast');
          expect(result.value.detectedIssues[0].howToFix).toContain('.text');

          // 検証: 未エスケープ改行が正しく処理されていること
          expect(result.value.detectedIssues[0].howToFix).toContain('color: #333');

          // 検証: 影響度サマリーが正しいこと
          expect(result.value.impactSummary.critical).toBe(1);
          expect(result.value.impactSummary.serious).toBe(1);
          expect(result.value.impactSummary.moderate).toBe(1);

          // 検証: フォールバックではないこと
          expect(result.value.isFallback).toBeUndefined();

          // 検証: generatedAtが設定されていること
          expect(result.value.generatedAt).toBeDefined();
        }

        // 検証: APIが1回だけ呼ばれたこと（リトライなし）
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // 検証: 成功ログが出力されていること
        expect(consoleLogSpy).toHaveBeenCalledWith('Gemini: AI総評生成完了');

        consoleLogSpy.mockRestore();
      });

      it('Markdownバッククォート付きレスポンスの一連フロー', async () => {
        // Markdownで囲まれたJSONレスポンス（サニタイズでバッククォート除去が必要）
        const mockGeminiResponse = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '```json\n{"overallAssessment": "検出された違反は0件です。アクセシビリティ基準を満たしています。", "detectedIssues": [], "prioritizedImprovements": ["現状維持を推奨"], "specificRecommendations": ["定期的なテストを継続"], "impactSummary": {"critical": 0, "serious": 0, "moderate": 0, "minor": 0}}\n```',
                  },
                ],
              },
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockGeminiResponse,
        });

        const result = await GeminiService.generateAISummary([], mockScores);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.overallAssessment).toContain('検出された違反は0件');
          expect(result.value.isFallback).toBeUndefined();
        }
      });
    });

    describe('8.2: フォールバック発動フローテスト', () => {
      it('パース失敗 → フォールバック生成 → 成功応答の一連フローを検証する', async () => {
        // 完全に不正なJSONレスポンス（サニタイズでも修正不可能）
        const mockGeminiResponse = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '{"overallAssessment": "これは途中で切れた不正なJSON',
                  },
                ],
              },
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockGeminiResponse,
        });

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await GeminiService.generateAISummary(mockViolations, mockScores);

        // 検証: 成功として返却される（エラーではない）
        expect(result.success).toBe(true);

        if (result.success) {
          // 検証: フォールバックAISummaryであること
          expect(result.value.isFallback).toBe(true);

          // 検証: 違反件数が正しく反映されていること
          expect(result.value.overallAssessment).toContain('検出された違反は3件');

          // 検証: 影響度サマリーが元のviolationsから計算されていること
          expect(result.value.impactSummary.critical).toBe(1);
          expect(result.value.impactSummary.serious).toBe(1);
          expect(result.value.impactSummary.moderate).toBe(1);

          // 検証: フォールバックではdetectedIssuesは空
          expect(result.value.detectedIssues).toEqual([]);

          // 検証: generatedAtが設定されていること
          expect(result.value.generatedAt).toBeDefined();
        }

        // 検証: パースエラーログが出力されていること
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Gemini: JSONパースエラー',
          expect.objectContaining({
            message: expect.any(String),
          })
        );

        // 検証: フォールバック発動ログが出力されていること
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Gemini: フォールバックAISummaryを生成しました',
          expect.anything()
        );

        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
      });

      it('レスポンスにテキストがない場合のフォールバックフロー', async () => {
        // テキストがないレスポンス
        const mockGeminiResponse = {
          candidates: [
            {
              content: {
                parts: [],
              },
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockGeminiResponse,
        });

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await GeminiService.generateAISummary(mockViolations, mockScores);

        // 検証: フォールバックとして成功
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.isFallback).toBe(true);
        }

        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
      });

      it('必須フィールド欠落時のフォールバックフロー', async () => {
        // overallAssessmentがないJSON
        const mockGeminiResponse = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '{"detectedIssues": [], "impactSummary": {"critical": 0, "serious": 0, "moderate": 0, "minor": 0}}',
                  },
                ],
              },
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockGeminiResponse,
        });

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await GeminiService.generateAISummary(mockViolations, mockScores);

        // 検証: フォールバックとして成功
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.isFallback).toBe(true);
          expect(result.value.overallAssessment).toBeDefined();
        }

        consoleWarnSpy.mockRestore();
      });
    });

    describe('8.3: リトライ成功フローテスト', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('タイムアウト → リトライ → 成功の一連フローを検証する', async () => {
        const mockSuccessResponse = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      overallAssessment: '検出された違反は3件で、対応が必要です。',
                      detectedIssues: [
                        {
                          ruleId: 'color-contrast',
                          whatIsHappening: 'コントラスト不足',
                          whatIsNeeded: '4.5:1以上',
                          howToFix: 'color: #333;',
                        },
                      ],
                      prioritizedImprovements: ['コントラスト改善'],
                      specificRecommendations: ['カラーパレット見直し'],
                      impactSummary: { critical: 1, serious: 1, moderate: 1, minor: 0 },
                    }),
                  },
                ],
              },
            },
          ],
        };

        let callCount = 0;
        mockFetch.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // 1回目: タイムアウト
            return Promise.reject(new DOMException('Aborted', 'AbortError'));
          }
          // 2回目: 成功
          return Promise.resolve({
            ok: true,
            json: async () => mockSuccessResponse,
          });
        });

        const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const resultPromise = GeminiService.generateAISummary(mockViolations, mockScores);

        // リトライ待機時間を進める
        await vi.runAllTimersAsync();

        const result = await resultPromise;

        // 検証: 成功すること
        expect(result.success).toBe(true);

        if (result.success) {
          // 検証: 正常なAISummaryが返却されること（フォールバックではない）
          expect(result.value.isFallback).toBeUndefined();
          expect(result.value.overallAssessment).toContain('検出された違反は3件');
          expect(result.value.detectedIssues).toHaveLength(1);
        }

        // 検証: APIが2回呼ばれたこと（初回+リトライ）
        expect(mockFetch).toHaveBeenCalledTimes(2);

        // 検証: リトライログが出力されていること
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          'Gemini: リトライを実行します',
          expect.objectContaining({
            attempt: 1,
            delay: 1000,
            previousError: 'timeout',
          })
        );

        // 検証: 成功ログが出力されていること
        expect(consoleLogSpy).toHaveBeenCalledWith('Gemini: AI総評生成完了');

        consoleInfoSpy.mockRestore();
        consoleLogSpy.mockRestore();
      });

      it('5xxエラー → リトライ → 成功の一連フローを検証する', async () => {
        const mockSuccessResponse = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      overallAssessment: '検出された違反は0件です。',
                      detectedIssues: [],
                      prioritizedImprovements: [],
                      specificRecommendations: [],
                      impactSummary: { critical: 0, serious: 0, moderate: 0, minor: 0 },
                    }),
                  },
                ],
              },
            },
          ],
        };

        let callCount = 0;
        mockFetch.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // 1回目: 503エラー
            return Promise.resolve({
              ok: false,
              status: 503,
              statusText: 'Service Unavailable',
            });
          }
          // 2回目: 成功
          return Promise.resolve({
            ok: true,
            json: async () => mockSuccessResponse,
          });
        });

        const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

        const resultPromise = GeminiService.generateAISummary([], mockScores);

        await vi.runAllTimersAsync();

        const result = await resultPromise;

        // 検証: 成功すること
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.overallAssessment).toContain('検出された違反は0件');
        }

        // 検証: リトライが実行されたこと
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          'Gemini: リトライを実行します',
          expect.objectContaining({
            previousError: 'api_error',
          })
        );

        consoleInfoSpy.mockRestore();
      });

      it('ネットワークエラー → リトライ → 成功の一連フローを検証する', async () => {
        const mockSuccessResponse = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      overallAssessment: '検出された違反は1件です。',
                      detectedIssues: [],
                      prioritizedImprovements: [],
                      specificRecommendations: [],
                      impactSummary: { critical: 0, serious: 0, moderate: 0, minor: 1 },
                    }),
                  },
                ],
              },
            },
          ],
        };

        let callCount = 0;
        mockFetch.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // 1回目: ネットワークエラー
            return Promise.reject(new Error('Network error'));
          }
          // 2回目: 成功
          return Promise.resolve({
            ok: true,
            json: async () => mockSuccessResponse,
          });
        });

        const resultPromise = GeminiService.generateAISummary(mockViolations, mockScores);

        await vi.runAllTimersAsync();

        const result = await resultPromise;

        // 検証: 成功すること
        expect(result.success).toBe(true);

        // 検証: リトライが実行されたこと
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      it('リトライしても失敗する場合はエラーを返却する', async () => {
        // 2回ともタイムアウト
        mockFetch.mockImplementation(() => {
          return Promise.reject(new DOMException('Aborted', 'AbortError'));
        });

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const resultPromise = GeminiService.generateAISummary(mockViolations, mockScores);

        await vi.runAllTimersAsync();

        const result = await resultPromise;

        // 検証: 失敗すること
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe('timeout');
        }

        // 検証: MAX_RETRIES=3 なので、初回 + 3回リトライ = 4回試行
        expect(mockFetch).toHaveBeenCalledTimes(4);

        // 検証: エラーログが出力されていること
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Gemini: リトライ上限に達しました:',
          expect.any(String)
        );

        consoleErrorSpy.mockRestore();
      });
    });
  });
});
