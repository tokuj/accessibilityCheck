/**
 * フォーム解析型定義のテスト
 * Task 1.1: フォーム解析の型定義を追加する
 * TDDアプローチ: まずテストを作成し、型定義が正しく動作することを確認
 */

import type {
  FormFieldCandidate,
  FormAnalysisResult,
  SelectedFormSelectors,
  FormAnalysisError,
  AnalyzeOptions,
  AnalyzeError,
} from '../types';

describe('FormAnalyzer Types', () => {
  describe('FormFieldCandidate', () => {
    it('フォームフィールド候補の全プロパティを持てること', () => {
      const candidate: FormFieldCandidate = {
        selector: '#username',
        label: 'ユーザー名',
        placeholder: 'メールアドレスを入力',
        name: 'username',
        id: 'username',
        type: 'email',
        confidence: 0.95,
      };

      expect(candidate.selector).toBe('#username');
      expect(candidate.label).toBe('ユーザー名');
      expect(candidate.placeholder).toBe('メールアドレスを入力');
      expect(candidate.name).toBe('username');
      expect(candidate.id).toBe('username');
      expect(candidate.type).toBe('email');
      expect(candidate.confidence).toBe(0.95);
    });

    it('オプショナルプロパティがnullでも動作すること', () => {
      const candidate: FormFieldCandidate = {
        selector: 'input[type="password"]',
        label: null,
        placeholder: null,
        name: null,
        id: null,
        type: 'password',
        confidence: 0.8,
      };

      expect(candidate.label).toBeNull();
      expect(candidate.placeholder).toBeNull();
    });
  });

  describe('FormAnalysisResult', () => {
    it('解析結果の全フィールドを含められること', () => {
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

    it('空の配列でも動作すること', () => {
      const result: FormAnalysisResult = {
        usernameFields: [],
        passwordFields: [],
        submitButtons: [],
        confidence: 'low',
      };

      expect(result.usernameFields).toHaveLength(0);
      expect(result.confidence).toBe('low');
    });

    it('各信頼度レベルを設定できること', () => {
      const highConfidence: FormAnalysisResult = {
        usernameFields: [],
        passwordFields: [],
        submitButtons: [],
        confidence: 'high',
      };
      const mediumConfidence: FormAnalysisResult = {
        usernameFields: [],
        passwordFields: [],
        submitButtons: [],
        confidence: 'medium',
      };
      const lowConfidence: FormAnalysisResult = {
        usernameFields: [],
        passwordFields: [],
        submitButtons: [],
        confidence: 'low',
      };

      expect(highConfidence.confidence).toBe('high');
      expect(mediumConfidence.confidence).toBe('medium');
      expect(lowConfidence.confidence).toBe('low');
    });
  });

  describe('SelectedFormSelectors', () => {
    it('選択されたセレクタを保持できること', () => {
      const selected: SelectedFormSelectors = {
        usernameSelector: '#email',
        passwordSelector: '#password',
        submitSelector: 'button[type="submit"]',
      };

      expect(selected.usernameSelector).toBe('#email');
      expect(selected.passwordSelector).toBe('#password');
      expect(selected.submitSelector).toBe('button[type="submit"]');
    });
  });

  describe('FormAnalysisError', () => {
    it('invalid_urlエラーを表現できること', () => {
      const error: FormAnalysisError = {
        type: 'invalid_url',
        message: 'URLの形式が正しくありません',
      };

      expect(error.type).toBe('invalid_url');
      expect(error.message).toBe('URLの形式が正しくありません');
    });

    it('network_errorエラーを表現できること', () => {
      const error: FormAnalysisError = {
        type: 'network_error',
        message: 'ネットワークに接続できません',
      };

      expect(error.type).toBe('network_error');
    });

    it('timeoutエラーを表現できること', () => {
      const error: FormAnalysisError = {
        type: 'timeout',
        message: 'タイムアウトしました',
      };

      expect(error.type).toBe('timeout');
    });

    it('no_form_foundエラーを表現できること', () => {
      const error: FormAnalysisError = {
        type: 'no_form_found',
        message: 'フォーム要素が見つかりませんでした',
      };

      expect(error.type).toBe('no_form_found');
    });

    it('analysis_failedエラーを表現できること', () => {
      const error: FormAnalysisError = {
        type: 'analysis_failed',
        message: '解析に失敗しました',
      };

      expect(error.type).toBe('analysis_failed');
    });
  });

  describe('AnalyzeOptions', () => {
    it('タイムアウトオプションを設定できること', () => {
      const options: AnalyzeOptions = {
        timeout: 30000,
      };

      expect(options.timeout).toBe(30000);
    });

    it('空のオプションでも動作すること', () => {
      const options: AnalyzeOptions = {};

      expect(options.timeout).toBeUndefined();
    });
  });

  describe('AnalyzeError', () => {
    it('navigation_failedエラーを表現できること', () => {
      const error: AnalyzeError = {
        type: 'navigation_failed',
        message: 'ページへのナビゲーションに失敗しました',
      };

      expect(error.type).toBe('navigation_failed');
    });

    it('timeoutエラーを表現できること', () => {
      const error: AnalyzeError = {
        type: 'timeout',
        message: 'タイムアウトしました',
      };

      expect(error.type).toBe('timeout');
    });

    it('no_form_foundエラーを表現できること', () => {
      const error: AnalyzeError = {
        type: 'no_form_found',
        message: 'フォーム要素が見つかりませんでした',
      };

      expect(error.type).toBe('no_form_found');
    });
  });
});
