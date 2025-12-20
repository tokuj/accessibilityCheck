import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiService } from './gemini';
import { SecretManagerService } from './secret-manager';
import type { RuleResult, LighthouseScores } from '../analyzers/types';

// SecretManagerServiceをモック
vi.mock('./secret-manager', () => ({
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

    it('APIリクエストが失敗した場合はエラーを返す', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await GeminiService.generateAISummary(mockViolations, mockScores);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('api_error');
        expect(result.error.statusCode).toBe(500);
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

    it('レスポンスのJSONが不正な場合はエラーを返す', async () => {
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

      const result = await GeminiService.generateAISummary(mockViolations, mockScores);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('api_error');
      }
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
});
