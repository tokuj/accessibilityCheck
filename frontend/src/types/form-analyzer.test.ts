/**
 * フォーム解析機能の型定義テスト（Task 3.1）
 *
 * 設計書で定義された型が正しく存在し、必要なプロパティを持つことを検証
 */
import { describe, it, expect } from 'vitest';
import type {
  FormFieldCandidate,
  FormAnalysisResult,
  SelectedFormSelectors,
  FormAnalysisError,
  FormAnalyzerPanelState,
} from './form-analyzer';

describe('フォーム解析型定義', () => {
  describe('FormFieldCandidate', () => {
    it('必須プロパティを持つオブジェクトを作成できる', () => {
      const candidate: FormFieldCandidate = {
        selector: '#username',
        label: 'ユーザー名',
        placeholder: 'Enter username',
        name: 'username',
        id: 'username',
        type: 'text',
        confidence: 0.95,
      };

      expect(candidate.selector).toBe('#username');
      expect(candidate.confidence).toBe(0.95);
    });

    it('label/placeholder/name/idがnullでも有効', () => {
      const candidate: FormFieldCandidate = {
        selector: 'input[type="password"]',
        label: null,
        placeholder: null,
        name: null,
        id: null,
        type: 'password',
        confidence: 1.0,
      };

      expect(candidate.label).toBeNull();
      expect(candidate.type).toBe('password');
    });
  });

  describe('FormAnalysisResult', () => {
    it('フィールド候補配列と信頼度を持つ', () => {
      const result: FormAnalysisResult = {
        usernameFields: [
          {
            selector: '#email',
            label: 'メール',
            placeholder: null,
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

      expect(result.usernameFields).toHaveLength(1);
      expect(result.passwordFields).toHaveLength(1);
      expect(result.submitButtons).toHaveLength(1);
      expect(result.confidence).toBe('high');
    });

    it('信頼度はhigh/medium/lowのいずれか', () => {
      const highConfidence: FormAnalysisResult = {
        usernameFields: [],
        passwordFields: [],
        submitButtons: [],
        confidence: 'high',
      };

      const mediumConfidence: FormAnalysisResult = {
        ...highConfidence,
        confidence: 'medium',
      };

      const lowConfidence: FormAnalysisResult = {
        ...highConfidence,
        confidence: 'low',
      };

      expect(['high', 'medium', 'low']).toContain(highConfidence.confidence);
      expect(['high', 'medium', 'low']).toContain(mediumConfidence.confidence);
      expect(['high', 'medium', 'low']).toContain(lowConfidence.confidence);
    });
  });

  describe('SelectedFormSelectors', () => {
    it('3つのセレクタを持つ', () => {
      const selectors: SelectedFormSelectors = {
        usernameSelector: '#email',
        passwordSelector: '#password',
        submitSelector: 'button[type="submit"]',
      };

      expect(selectors.usernameSelector).toBe('#email');
      expect(selectors.passwordSelector).toBe('#password');
      expect(selectors.submitSelector).toBe('button[type="submit"]');
    });
  });

  describe('FormAnalysisError', () => {
    it('invalid_urlエラー型を持てる', () => {
      const error: FormAnalysisError = {
        type: 'invalid_url',
        message: '無効なURL形式です',
      };

      expect(error.type).toBe('invalid_url');
      expect(error.message).toBeDefined();
    });

    it('network_errorエラー型を持てる', () => {
      const error: FormAnalysisError = {
        type: 'network_error',
        message: 'ネットワークエラーが発生しました',
      };

      expect(error.type).toBe('network_error');
    });

    it('timeoutエラー型を持てる', () => {
      const error: FormAnalysisError = {
        type: 'timeout',
        message: 'タイムアウトしました',
      };

      expect(error.type).toBe('timeout');
    });

    it('no_form_foundエラー型を持てる', () => {
      const error: FormAnalysisError = {
        type: 'no_form_found',
        message: 'フォームが見つかりませんでした',
      };

      expect(error.type).toBe('no_form_found');
    });

    it('analysis_failedエラー型を持てる', () => {
      const error: FormAnalysisError = {
        type: 'analysis_failed',
        message: '解析に失敗しました',
      };

      expect(error.type).toBe('analysis_failed');
    });
  });

  describe('FormAnalyzerPanelState', () => {
    it('初期状態を表現できる', () => {
      const initialState: FormAnalyzerPanelState = {
        loginUrl: '',
        isAnalyzing: false,
        analysisResult: null,
        error: null,
        selectedSelectors: null,
      };

      expect(initialState.loginUrl).toBe('');
      expect(initialState.isAnalyzing).toBe(false);
      expect(initialState.analysisResult).toBeNull();
      expect(initialState.error).toBeNull();
      expect(initialState.selectedSelectors).toBeNull();
    });

    it('解析中の状態を表現できる', () => {
      const analyzingState: FormAnalyzerPanelState = {
        loginUrl: 'https://example.com/login',
        isAnalyzing: true,
        analysisResult: null,
        error: null,
        selectedSelectors: null,
      };

      expect(analyzingState.isAnalyzing).toBe(true);
      expect(analyzingState.loginUrl).toBe('https://example.com/login');
    });

    it('解析成功の状態を表現できる', () => {
      const successState: FormAnalyzerPanelState = {
        loginUrl: 'https://example.com/login',
        isAnalyzing: false,
        analysisResult: {
          usernameFields: [],
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
          submitButtons: [],
          confidence: 'medium',
        },
        error: null,
        selectedSelectors: null,
      };

      expect(successState.analysisResult).not.toBeNull();
      expect(successState.analysisResult?.confidence).toBe('medium');
    });

    it('エラー状態を表現できる', () => {
      const errorState: FormAnalyzerPanelState = {
        loginUrl: 'invalid-url',
        isAnalyzing: false,
        analysisResult: null,
        error: {
          type: 'invalid_url',
          message: '無効なURL形式です',
        },
        selectedSelectors: null,
      };

      expect(errorState.error).not.toBeNull();
      expect(errorState.error?.type).toBe('invalid_url');
    });

    it('セレクタ選択済みの状態を表現できる', () => {
      const selectedState: FormAnalyzerPanelState = {
        loginUrl: 'https://example.com/login',
        isAnalyzing: false,
        analysisResult: {
          usernameFields: [
            {
              selector: '#email',
              label: 'メール',
              placeholder: null,
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
        },
        error: null,
        selectedSelectors: {
          usernameSelector: '#email',
          passwordSelector: '#password',
          submitSelector: 'button[type="submit"]',
        },
      };

      expect(selectedState.selectedSelectors).not.toBeNull();
      expect(selectedState.selectedSelectors?.usernameSelector).toBe('#email');
    });
  });
});
