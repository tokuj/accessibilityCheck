import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createChatRouter } from '../chat';
import { GeminiService } from '../../services/gemini';
import type { ChatContext } from '../../services/chat-prompt';

// GeminiServiceをモック
vi.mock('../../services/gemini', () => ({
  GeminiService: {
    generateChatResponse: vi.fn(),
  },
}));

describe('ChatRouter', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/chat', createChatRouter());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/chat', () => {
    const validContext: ChatContext = {
      type: 'violation',
      ruleId: 'color-contrast',
      wcagCriteria: ['1.4.3'],
      data: { impact: 'serious' },
      label: 'コントラスト比',
    };

    const validQuestion = 'この違反はどう修正すればいいですか？';

    it('正常なリクエストで200とレスポンスを返す（Grounding対応）', async () => {
      vi.mocked(GeminiService.generateChatResponse).mockResolvedValue({
        success: true,
        value: {
          answer: 'コントラスト比を4.5:1以上に調整してください。',
          referenceUrls: ['https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html'],
        },
      });

      const response = await request(app)
        .post('/api/chat')
        .send({ context: validContext, question: validQuestion });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        answer: 'コントラスト比を4.5:1以上に調整してください。',
        referenceUrls: ['https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html'],
      });
    });

    it('contextがない場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({ question: validQuestion });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('context');
    });

    it('questionがない場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({ context: validContext });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('question');
    });

    it('questionが空文字の場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({ context: validContext, question: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('question');
    });

    it('questionが500文字を超える場合は400エラー', async () => {
      const longQuestion = 'あ'.repeat(501);
      const response = await request(app)
        .post('/api/chat')
        .send({ context: validContext, question: longQuestion });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('500文字');
    });

    it('GeminiServiceがタイムアウトした場合は408エラー', async () => {
      vi.mocked(GeminiService.generateChatResponse).mockResolvedValue({
        success: false,
        error: {
          type: 'timeout',
          message: 'タイムアウトしました',
        },
      });

      const response = await request(app)
        .post('/api/chat')
        .send({ context: validContext, question: validQuestion });

      expect(response.status).toBe(408);
      expect(response.body.error).toContain('タイムアウト');
    });

    it('GeminiServiceがレート制限された場合は429エラー', async () => {
      vi.mocked(GeminiService.generateChatResponse).mockResolvedValue({
        success: false,
        error: {
          type: 'rate_limit',
          message: 'レート制限に達しました',
          retryAfter: 60,
        },
      });

      const response = await request(app)
        .post('/api/chat')
        .send({ context: validContext, question: validQuestion });

      expect(response.status).toBe(429);
      expect(response.body.error).toContain('レート制限');
      expect(response.headers['retry-after']).toBe('60');
    });

    it('GeminiServiceがAPIエラーを返した場合は500エラー', async () => {
      vi.mocked(GeminiService.generateChatResponse).mockResolvedValue({
        success: false,
        error: {
          type: 'api_error',
          message: 'APIエラーが発生しました',
          statusCode: 500,
        },
      });

      const response = await request(app)
        .post('/api/chat')
        .send({ context: validContext, question: validQuestion });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('AIサービスでエラー');
    });

    it('referenceUrlsがレスポンスに含まれる（Grounding対応）', async () => {
      vi.mocked(GeminiService.generateChatResponse).mockResolvedValue({
        success: true,
        value: {
          answer: 'テスト回答',
          referenceUrls: [
            'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html',
            'https://developer.mozilla.org/en-US/docs/Web/Accessibility',
          ],
        },
      });

      const response = await request(app)
        .post('/api/chat')
        .send({
          context: {
            type: 'wcag',
            wcagCriteria: ['1.1.1'],
            data: {},
            label: 'WCAG 1.1.1',
          },
          question: 'この基準について教えて',
        });

      expect(response.status).toBe(200);
      expect(response.body.referenceUrls).toHaveLength(2);
      expect(response.body.referenceUrls[0]).toContain('non-text-content');
    });

    it('contextのtypeが無効な場合でもデフォルト処理される', async () => {
      vi.mocked(GeminiService.generateChatResponse).mockResolvedValue({
        success: true,
        value: {
          answer: 'テスト回答',
          referenceUrls: [],
        },
      });

      const response = await request(app)
        .post('/api/chat')
        .send({
          context: {
            type: 'unknown_type' as ChatContext['type'],
            data: {},
            label: 'テスト',
          },
          question: '質問',
        });

      // 無効なタイプでも処理される（デフォルトテンプレートが使用される）
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/chat/initial', () => {
    const validContext: ChatContext = {
      type: 'violation',
      ruleId: 'color-contrast',
      wcagCriteria: ['1.4.3'],
      data: {},
      label: 'コントラスト比',
    };

    it('正常なリクエストで200と初期メッセージを返す', async () => {
      vi.mocked(GeminiService.generateChatResponse).mockResolvedValue({
        success: true,
        value: {
          answer: '視覚障害のあるユーザーがテキストを読み取れなくなります。',
          referenceUrls: ['https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html'],
        },
      });

      const response = await request(app)
        .post('/api/chat/initial')
        .send({ context: validContext });

      expect(response.status).toBe(200);
      expect(response.body.answer).toContain('視覚障害');
      expect(response.body.referenceUrls).toBeDefined();
    });

    it('contextがない場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/chat/initial')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('context');
    });

    it('GeminiServiceがタイムアウトした場合は408エラー', async () => {
      vi.mocked(GeminiService.generateChatResponse).mockResolvedValue({
        success: false,
        error: {
          type: 'timeout',
          message: 'タイムアウトしました',
        },
      });

      const response = await request(app)
        .post('/api/chat/initial')
        .send({ context: validContext });

      expect(response.status).toBe(408);
    });
  });
});
