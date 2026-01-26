/**
 * インラインAI対話用APIルーター
 * POST /api/chat - コンテキストと質問からAI回答を生成
 * POST /api/chat/initial - 初期メッセージ（ユーザーインパクト）を生成
 */

import { Router, type Request, type Response } from 'express';
import { GeminiService, type ReferenceLink } from '../services/gemini';
import { buildPrompt, buildInitialMessagePrompt, type ChatContext } from '../services/chat-prompt';

// 質問の最大文字数
const MAX_QUESTION_LENGTH = 500;

/**
 * リクエストボディの型定義
 */
interface ChatRequest {
  context: ChatContext;
  question: string;
}

/**
 * 初期メッセージリクエストボディの型定義
 */
interface InitialMessageRequest {
  context: ChatContext;
}

/**
 * レスポンスボディの型定義（Grounding対応）
 */
interface ChatResponse {
  answer: string;
  referenceUrls: string[];  // 後方互換性のため維持
  referenceLinks: ReferenceLink[];  // 新しい形式（ドメイン情報を含む）
}

/**
 * エラーレスポンスの型定義
 */
interface ErrorResponse {
  error: string;
}

/**
 * ChatRouterを作成
 */
export function createChatRouter(): Router {
  const router = Router();

  /**
   * POST /api/chat
   * インラインAI対話：コンテキストと質問からAI回答を生成
   */
  router.post('/', async (req: Request, res: Response<ChatResponse | ErrorResponse>) => {
    const { context, question } = req.body as Partial<ChatRequest>;

    // バリデーション: contextの確認
    if (!context) {
      return res.status(400).json({
        error: 'contextは必須です',
      });
    }

    // バリデーション: questionの確認
    if (!question || question.trim() === '') {
      return res.status(400).json({
        error: 'questionは必須です',
      });
    }

    // バリデーション: 質問の文字数制限
    if (question.length > MAX_QUESTION_LENGTH) {
      return res.status(400).json({
        error: `questionは${MAX_QUESTION_LENGTH}文字以内で入力してください`,
      });
    }

    // プロンプトを生成
    const builtPrompt = buildPrompt(context, question);

    // Gemini APIを呼び出し（Grounding対応）
    const result = await GeminiService.generateChatResponse(
      builtPrompt.systemPrompt,
      builtPrompt.userPrompt
    );

    if (!result.success) {
      const error = result.error;

      switch (error.type) {
        case 'timeout':
          return res.status(408).json({
            error: 'AIサービスへのリクエストがタイムアウトしました。しばらく経ってから再度お試しください。',
          });

        case 'rate_limit':
          res.setHeader('Retry-After', String(error.retryAfter));
          return res.status(429).json({
            error: 'レート制限に達しました。しばらく経ってから再度お試しください。',
          });

        default:
          console.error('Chat API error:', error.message);
          return res.status(500).json({
            error: 'AIサービスでエラーが発生しました。しばらく経ってから再度お試しください。',
          });
      }
    }

    // 成功レスポンス（Grounding対応：referenceLinksを返却）
    return res.json({
      answer: result.value.answer,
      referenceUrls: result.value.referenceUrls,
      referenceLinks: result.value.referenceLinks,
    });
  });

  /**
   * POST /api/chat/initial
   * 初期メッセージ：ユーザーインパクト説明を生成
   * @requirement 10.1-10.4 - 初期メッセージ（ユーザーインパクト提示）
   */
  router.post('/initial', async (req: Request, res: Response<ChatResponse | ErrorResponse>) => {
    const { context } = req.body as Partial<InitialMessageRequest>;

    // バリデーション: contextの確認
    if (!context) {
      return res.status(400).json({
        error: 'contextは必須です',
      });
    }

    // 初期メッセージ用プロンプトを生成
    const builtPrompt = buildInitialMessagePrompt(context);

    // Gemini APIを呼び出し（Grounding対応）
    const result = await GeminiService.generateChatResponse(
      builtPrompt.systemPrompt,
      builtPrompt.userPrompt
    );

    if (!result.success) {
      const error = result.error;

      switch (error.type) {
        case 'timeout':
          return res.status(408).json({
            error: 'AIサービスへのリクエストがタイムアウトしました。',
          });

        case 'rate_limit':
          res.setHeader('Retry-After', String(error.retryAfter));
          return res.status(429).json({
            error: 'レート制限に達しました。',
          });

        default:
          console.error('Initial message API error:', error.message);
          return res.status(500).json({
            error: 'AIサービスでエラーが発生しました。',
          });
      }
    }

    // 成功レスポンス
    return res.json({
      answer: result.value.answer,
      referenceUrls: result.value.referenceUrls,
      referenceLinks: result.value.referenceLinks,
    });
  });

  return router;
}
