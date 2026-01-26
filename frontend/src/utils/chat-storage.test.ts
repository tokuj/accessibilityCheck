import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateContextKey,
  getHistory,
  saveHistory,
  clearAllChatHistory,
  getCurrentTargetUrl,
  setCurrentTargetUrl,
  hasTargetUrlChanged,
  STORAGE_KEY_PREFIX,
  MAX_HISTORY_ENTRIES,
  type ChatContext,
  type ChatHistoryEntry,
} from './chat-storage';

describe('chat-storage', () => {
  beforeEach(() => {
    // sessionStorageをクリア
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('generateContextKey', () => {
    it('typeのみの場合、typeとlabelからキーを生成する', () => {
      const context: ChatContext = {
        type: 'score',
        data: { value: 85 },
        label: '総合スコア',
      };
      const key = generateContextKey(context);
      expect(key).toBe('score_総合スコア');
    });

    it('ruleIdがある場合、type_ruleId_label形式のキーを生成する', () => {
      const context: ChatContext = {
        type: 'violation',
        ruleId: 'color-contrast',
        data: { impact: 'serious' },
        label: 'コントラスト比',
      };
      const key = generateContextKey(context);
      expect(key).toBe('violation_color-contrast_コントラスト比');
    });

    it('wcagCriteriaがある場合、キーに含める', () => {
      const context: ChatContext = {
        type: 'violation',
        ruleId: 'image-alt',
        wcagCriteria: ['1.1.1'],
        data: { impact: 'critical' },
        label: '画像の代替テキスト',
      };
      const key = generateContextKey(context);
      expect(key).toBe('violation_image-alt_1.1.1_画像の代替テキスト');
    });

    it('複数のwcagCriteriaはハイフンで結合する', () => {
      const context: ChatContext = {
        type: 'violation',
        ruleId: 'link-name',
        wcagCriteria: ['2.4.4', '4.1.2'],
        data: { impact: 'serious' },
        label: 'リンクテキスト',
      };
      const key = generateContextKey(context);
      expect(key).toBe('violation_link-name_2.4.4-4.1.2_リンクテキスト');
    });

    it('wcag typeの場合、WCAG基準がキーに含まれる', () => {
      const context: ChatContext = {
        type: 'wcag',
        wcagCriteria: ['1.4.3'],
        data: { criterion: '1.4.3' },
        label: 'WCAG 1.4.3',
      };
      const key = generateContextKey(context);
      expect(key).toBe('wcag_1.4.3_WCAG 1.4.3');
    });

    it('labelがキーに含まれる（同じruleIdでも異なるラベルを区別）', () => {
      const context1: ChatContext = {
        type: 'score',
        data: { value: 85 },
        label: 'Performance',
      };
      const context2: ChatContext = {
        type: 'score',
        data: { value: 72 },
        label: 'Accessibility',
      };

      const key1 = generateContextKey(context1);
      const key2 = generateContextKey(context2);

      expect(key1).toBe('score_Performance');
      expect(key2).toBe('score_Accessibility');
      expect(key1).not.toBe(key2);
    });

    it('ruleIdとlabelの両方がキーに含まれる', () => {
      const context: ChatContext = {
        type: 'violation',
        ruleId: 'color-contrast',
        data: { impact: 'serious' },
        label: 'コントラスト比違反',
      };
      const key = generateContextKey(context);
      expect(key).toBe('violation_color-contrast_コントラスト比違反');
    });
  });

  describe('getHistory', () => {
    it('履歴がない場合、空の配列を返す', () => {
      const history = getHistory('nonexistent_key');
      expect(history).toEqual([]);
    });

    it('sessionStorageから履歴を正しくパースして返す', () => {
      const entries: ChatHistoryEntry[] = [
        {
          id: 'entry-1',
          question: 'この違反はどう修正すればいいですか？',
          answer: 'コントラスト比を4.5:1以上に調整してください。',
          referenceUrl: 'https://a11y-guidelines.ameba.design/1/contrast-minimum/',
          timestamp: '2026-01-25T10:00:00Z',
        },
      ];
      const storageKey = `${STORAGE_KEY_PREFIX}test_key`;
      sessionStorage.setItem(storageKey, JSON.stringify(entries));

      const history = getHistory('test_key');
      expect(history).toEqual(entries);
    });

    it('不正なJSONの場合、空の配列を返す', () => {
      const storageKey = `${STORAGE_KEY_PREFIX}invalid_key`;
      sessionStorage.setItem(storageKey, 'invalid json');

      const history = getHistory('invalid_key');
      expect(history).toEqual([]);
    });
  });

  describe('clearAllChatHistory', () => {
    it('すべてのa11y_chat_history_*キーをクリアする', () => {
      // 複数の履歴を保存
      saveHistory('key1', [{ id: '1', question: 'q1', answer: 'a1', timestamp: '2026-01-01' }]);
      saveHistory('key2', [{ id: '2', question: 'q2', answer: 'a2', timestamp: '2026-01-01' }]);
      // 関連なしのキーも保存
      sessionStorage.setItem('other_key', 'value');

      // すべての履歴をクリア
      clearAllChatHistory();

      // a11y_chat_history_*キーはクリアされる
      expect(sessionStorage.getItem(`${STORAGE_KEY_PREFIX}key1`)).toBeNull();
      expect(sessionStorage.getItem(`${STORAGE_KEY_PREFIX}key2`)).toBeNull();
      // 他のキーは影響を受けない
      expect(sessionStorage.getItem('other_key')).toBe('value');
    });
  });

  describe('setCurrentTargetUrl / getCurrentTargetUrl', () => {
    it('現在の分析対象URLを保存・取得できる', () => {
      setCurrentTargetUrl('https://example.com');
      expect(getCurrentTargetUrl()).toBe('https://example.com');
    });

    it('URLが変更されたらtrueを返す', () => {
      setCurrentTargetUrl('https://example.com');
      expect(hasTargetUrlChanged('https://other.com')).toBe(true);
      expect(hasTargetUrlChanged('https://example.com')).toBe(false);
    });
  });

  describe('saveHistory', () => {
    it('履歴をsessionStorageに保存する', () => {
      const entries: ChatHistoryEntry[] = [
        {
          id: 'entry-1',
          question: 'この違反はどう修正すればいいですか？',
          answer: 'コントラスト比を4.5:1以上に調整してください。',
          timestamp: '2026-01-25T10:00:00Z',
        },
      ];

      saveHistory('test_key', entries);

      const storageKey = `${STORAGE_KEY_PREFIX}test_key`;
      const stored = sessionStorage.getItem(storageKey);
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual(entries);
    });

    it('20件を超える場合、古いエントリを削除して20件に制限する', () => {
      const entries: ChatHistoryEntry[] = [];
      for (let i = 0; i < 25; i++) {
        entries.push({
          id: `entry-${i}`,
          question: `質問 ${i}`,
          answer: `回答 ${i}`,
          timestamp: new Date(2026, 0, 25, 10, i, 0).toISOString(),
        });
      }

      saveHistory('test_key', entries);

      const history = getHistory('test_key');
      expect(history.length).toBe(MAX_HISTORY_ENTRIES);
      // 新しいエントリ（後ろの20件）が残っている
      expect(history[0].id).toBe('entry-5');
      expect(history[19].id).toBe('entry-24');
    });

    it('キー名はa11y_chat_history_{contextKey}形式になる', () => {
      const entries: ChatHistoryEntry[] = [
        {
          id: 'entry-1',
          question: '質問',
          answer: '回答',
          timestamp: '2026-01-25T10:00:00Z',
        },
      ];

      saveHistory('violation_color-contrast', entries);

      const expectedKey = 'a11y_chat_history_violation_color-contrast';
      expect(sessionStorage.getItem(expectedKey)).not.toBeNull();
    });
  });
});
