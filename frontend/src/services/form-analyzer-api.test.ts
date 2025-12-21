/**
 * フォーム解析API呼び出し関数のテスト（Task 3.2）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeForm, FormAnalyzerApiError } from './form-analyzer-api';
import type { FormAnalysisResult } from '../types/form-analyzer';

describe('form-analyzer-api.ts', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('analyzeForm', () => {
    describe('正常系', () => {
      it('有効なURLで解析結果が返される', async () => {
        const mockResult: FormAnalysisResult = {
          usernameFields: [
            {
              selector: '#email',
              label: 'メールアドレス',
              placeholder: 'Enter email',
              name: 'email',
              id: 'email',
              type: 'email',
              confidence: 0.9,
            },
          ],
          passwordFields: [
            {
              selector: '#password',
              label: 'パスワード',
              placeholder: null,
              name: 'password',
              id: 'password',
              type: 'password',
              confidence: 1.0,
            },
          ],
          submitButtons: [
            {
              selector: 'button[type="submit"]',
              label: 'ログイン',
              placeholder: null,
              name: null,
              id: null,
              type: 'submit',
              confidence: 0.85,
            },
          ],
          confidence: 'high',
        };

        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({ success: true, result: mockResult }),
            { status: 200 }
          )
        );

        const result = await analyzeForm('https://example.com/login');

        expect(result).toEqual(mockResult);
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/auth/analyze-form'),
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: 'https://example.com/login' }),
          })
        );
      });

      it('タイムアウト設定が適用される', async () => {
        const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: true,
              result: {
                usernameFields: [],
                passwordFields: [],
                submitButtons: [],
                confidence: 'low',
              },
            }),
            { status: 200 }
          )
        );

        await analyzeForm('https://example.com/login');

        // 60秒のタイムアウト（解析処理は時間がかかる）
        expect(timeoutSpy).toHaveBeenCalledWith(60000);
      });
    });

    describe('エラーハンドリング', () => {
      it('400エラー（無効なURL）でFormAnalyzerApiErrorがスローされる', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: false,
              error: { type: 'invalid_url', message: '無効なURL形式です' },
            }),
            { status: 400 }
          )
        );

        try {
          await analyzeForm('invalid-url');
          expect.fail('エラーがスローされるべき');
        } catch (error) {
          expect(error).toBeInstanceOf(FormAnalyzerApiError);
          expect((error as FormAnalyzerApiError).errorType).toBe('invalid_url');
          expect((error as FormAnalyzerApiError).message).toBe(
            '無効なURL形式です'
          );
        }
      });

      it('408エラー（タイムアウト）でFormAnalyzerApiErrorがスローされる', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: false,
              error: { type: 'timeout', message: 'タイムアウトしました' },
            }),
            { status: 408 }
          )
        );

        try {
          await analyzeForm('https://slow-site.com/login');
          expect.fail('エラーがスローされるべき');
        } catch (error) {
          expect(error).toBeInstanceOf(FormAnalyzerApiError);
          expect((error as FormAnalyzerApiError).errorType).toBe('timeout');
        }
      });

      it('500エラー（サーバーエラー）でFormAnalyzerApiErrorがスローされる', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: false,
              error: { type: 'analysis_failed', message: '解析に失敗しました' },
            }),
            { status: 500 }
          )
        );

        try {
          await analyzeForm('https://example.com/login');
          expect.fail('エラーがスローされるべき');
        } catch (error) {
          expect(error).toBeInstanceOf(FormAnalyzerApiError);
          expect((error as FormAnalyzerApiError).errorType).toBe(
            'analysis_failed'
          );
        }
      });

      it('ネットワークエラーでFormAnalyzerApiErrorがスローされる', async () => {
        vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

        try {
          await analyzeForm('https://example.com/login');
          expect.fail('エラーがスローされるべき');
        } catch (error) {
          expect(error).toBeInstanceOf(FormAnalyzerApiError);
          expect((error as FormAnalyzerApiError).errorType).toBe('network_error');
          expect((error as FormAnalyzerApiError).message).toContain(
            'サーバーに接続できません'
          );
        }
      });

      it('リクエストタイムアウトでFormAnalyzerApiErrorがスローされる', async () => {
        vi.mocked(fetch).mockRejectedValueOnce(
          new DOMException('Timeout', 'TimeoutError')
        );

        try {
          await analyzeForm('https://example.com/login');
          expect.fail('エラーがスローされるべき');
        } catch (error) {
          expect(error).toBeInstanceOf(FormAnalyzerApiError);
          expect((error as FormAnalyzerApiError).errorType).toBe('timeout');
          expect((error as FormAnalyzerApiError).message).toContain(
            'タイムアウト'
          );
        }
      });

      it('フォームが見つからない場合にFormAnalyzerApiErrorがスローされる', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: false,
              error: {
                type: 'no_form_found',
                message: 'ログインフォームが見つかりませんでした',
              },
            }),
            { status: 200 }
          )
        );

        try {
          await analyzeForm('https://example.com/about');
          expect.fail('エラーがスローされるべき');
        } catch (error) {
          expect(error).toBeInstanceOf(FormAnalyzerApiError);
          expect((error as FormAnalyzerApiError).errorType).toBe('no_form_found');
        }
      });
    });
  });
});
