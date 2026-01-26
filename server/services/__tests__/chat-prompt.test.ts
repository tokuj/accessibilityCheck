import { describe, it, expect } from 'vitest';
import { buildPrompt, buildInitialMessagePrompt, type ChatContext, type BuiltPrompt } from '../chat-prompt';

describe('PromptBuilder', () => {
  describe('buildPrompt (認知設計)', () => {
    const question = 'この違反はどう修正すればいいですか？';

    it('should include 5 elements (前提、状況、目的、動機、制約)', () => {
      const context: ChatContext = {
        type: 'violation',
        ruleId: 'color-contrast',
        wcagCriteria: ['1.4.3'],
        data: { impact: 'serious', description: 'コントラスト比が不足しています' },
        label: 'コントラスト比',
      };

      const result = buildPrompt(context, question);

      expect(result.systemPrompt).toContain('【前提】');
      expect(result.systemPrompt).toContain('【状況】');
      expect(result.systemPrompt).toContain('【目的】');
      expect(result.systemPrompt).toContain('【動機】');
      expect(result.systemPrompt).toContain('【制約】');
    });

    it('should NOT include "あなたは専門家です" pattern', () => {
      const context: ChatContext = {
        type: 'violation',
        ruleId: 'color-contrast',
        wcagCriteria: ['1.4.3'],
        data: {},
        label: 'テスト',
      };

      const result = buildPrompt(context, question);

      expect(result.systemPrompt).not.toContain('あなたは');
      expect(result.systemPrompt).not.toContain('専門家');
    });

    it('違反（violation）用のプロンプトにルールIDとWCAG基準を含める', () => {
      const context: ChatContext = {
        type: 'violation',
        ruleId: 'color-contrast',
        wcagCriteria: ['1.4.3'],
        data: { impact: 'serious', description: 'コントラスト比が不足しています' },
        label: 'コントラスト比',
      };

      const result = buildPrompt(context, question);

      expect(result.systemPrompt).toContain('color-contrast');
      expect(result.systemPrompt).toContain('1.4.3');
      expect(result.userPrompt).toContain(question);
    });

    it('スコア（score）用のプロンプトに算出根拠と改善アドバイス指示を含める', () => {
      const context: ChatContext = {
        type: 'score',
        data: { totalScore: 75, passCount: 10, violationCount: 5, isOverallScore: true },
        label: '総合スコア',
      };

      const result = buildPrompt(context, '75点の意味を教えてください');

      expect(result.systemPrompt).toContain('スコア');
      expect(result.systemPrompt).toContain('算出根拠');
      expect(result.systemPrompt).toContain('改善アドバイス');
      expect(result.systemPrompt).toContain('75');
    });

    it('カテゴリスコア用のプロンプトにカテゴリ名を含める', () => {
      const context: ChatContext = {
        type: 'score',
        data: { categoryName: 'コントラスト', score: 85 },
        label: 'コントラストスコア',
      };

      const result = buildPrompt(context, 'このスコアの意味は？');

      expect(result.systemPrompt).toContain('85');
      expect(result.systemPrompt).toContain('コントラスト');
    });

    it('lighthouse用のプロンプトに適切な指示を含める', () => {
      const context: ChatContext = {
        type: 'lighthouse',
        data: { category: 'Performance', score: 85 },
        label: 'Performance',
      };

      const result = buildPrompt(context, 'パフォーマンススコアの意味は？');

      expect(result.systemPrompt).toContain('Lighthouse');
      expect(result.systemPrompt).toContain('改善アドバイス');
    });

    it('WCAG基準（wcag）用のプロンプトに達成方法の説明指示を含める', () => {
      const context: ChatContext = {
        type: 'wcag',
        wcagCriteria: ['1.4.3'],
        data: { criterion: '1.4.3', name: 'コントラスト（最低限）' },
        label: 'WCAG 1.4.3',
      };

      const result = buildPrompt(context, 'この基準について詳しく教えて');

      expect(result.systemPrompt).toContain('WCAG');
      expect(result.systemPrompt).toContain('1.4.3');
      expect(result.systemPrompt).toContain('達成方法');
    });

    it('改善提案（improvement）用のプロンプトを生成する', () => {
      const context: ChatContext = {
        type: 'improvement',
        data: { priority: 1, suggestion: '画像に代替テキストを追加する' },
        label: '優先改善ポイント',
      };

      const result = buildPrompt(context, 'この改善の具体的な手順は？');

      expect(result.systemPrompt).toContain('改善');
      expect(result.userPrompt).toContain('手順');
    });

    it('推奨事項（recommendation）用のプロンプトを生成する', () => {
      const context: ChatContext = {
        type: 'recommendation',
        data: { recommendation: '定期的なアクセシビリティテストを実施する' },
        label: '推奨事項',
      };

      const result = buildPrompt(context, 'これを実践するには？');

      expect(result.systemPrompt).toContain('推奨');
    });

    it('検出問題（issue）用のプロンプトを生成する', () => {
      const context: ChatContext = {
        type: 'issue',
        ruleId: 'image-alt',
        data: {
          whatIsHappening: '画像にalt属性がありません',
          whatIsNeeded: '代替テキストの設定',
          howToFix: 'alt属性を追加する',
        },
        label: '検出問題',
      };

      const result = buildPrompt(context, 'もっと詳しく教えて');

      expect(result.systemPrompt).toContain('問題');
    });

    it('パス（pass）用のプロンプトを生成する', () => {
      const context: ChatContext = {
        type: 'pass',
        ruleId: 'image-alt',
        data: { description: '画像に適切な代替テキストが設定されています' },
        label: '画像の代替テキスト',
      };

      const result = buildPrompt(context, 'なぜパスしているのですか？');

      expect(result.systemPrompt).toContain('パス');
    });

    it('要確認（incomplete）用のプロンプトを生成する', () => {
      const context: ChatContext = {
        type: 'incomplete',
        ruleId: 'color-contrast',
        data: { description: '手動確認が必要なコントラスト' },
        label: '要確認項目',
      };

      const result = buildPrompt(context, '何を確認すればいいですか？');

      expect(result.systemPrompt).toContain('手動確認');
    });

    describe('共通指示の確認', () => {
      const allTypes: ChatContext['type'][] = [
        'score', 'lighthouse', 'violation', 'pass', 'incomplete',
        'improvement', 'recommendation', 'issue', 'wcag'
      ];

      it.each(allTypes)('%s タイプで簡潔な日本語回答の指示が含まれる', (type) => {
        const context: ChatContext = {
          type,
          data: {},
          label: 'テスト',
        };

        const result = buildPrompt(context, 'テスト質問');

        expect(result.systemPrompt).toContain('日本語');
        expect(result.systemPrompt).toContain('簡潔');
      });

      it.each(allTypes)('%s タイプで推測禁止の指示が含まれる', (type) => {
        const context: ChatContext = {
          type,
          data: {},
          label: 'テスト',
        };

        const result = buildPrompt(context, 'テスト質問');

        expect(result.systemPrompt).toContain('推測');
      });

      it.each(allTypes)('%s タイプでWeb検索を使用する指示が含まれる', (type) => {
        const context: ChatContext = {
          type,
          data: {},
          label: 'テスト',
        };

        const result = buildPrompt(context, 'テスト質問');

        expect(result.systemPrompt).toContain('Web検索');
      });

      it.each(allTypes)('%s タイプで内部処理言及禁止の指示が含まれる', (type) => {
        const context: ChatContext = {
          type,
          data: {},
          label: 'テスト',
        };

        const result = buildPrompt(context, 'テスト質問');

        expect(result.systemPrompt).toContain('内部処理');
        expect(result.systemPrompt).toContain('言及しない');
      });
    });

    it('戻り値の型がBuiltPromptであること', () => {
      const context: ChatContext = {
        type: 'score',
        data: {},
        label: 'テスト',
      };

      const result: BuiltPrompt = buildPrompt(context, 'テスト');

      expect(result).toHaveProperty('systemPrompt');
      expect(result).toHaveProperty('userPrompt');
      expect(typeof result.systemPrompt).toBe('string');
      expect(typeof result.userPrompt).toBe('string');
    });
  });

  describe('buildInitialMessagePrompt', () => {
    it('should build initial message prompt for user impact', () => {
      const context: ChatContext = {
        type: 'violation',
        ruleId: 'color-contrast',
        wcagCriteria: ['1.4.3'],
        data: { description: 'コントラスト比が不足' },
        label: 'コントラスト比',
      };

      const result = buildInitialMessagePrompt(context);

      expect(result.systemPrompt).toBeDefined();
      expect(result.userPrompt).toBeDefined();
    });

    it('should include user impact instruction in prompt', () => {
      const context: ChatContext = {
        type: 'violation',
        ruleId: 'image-alt',
        wcagCriteria: ['1.1.1'],
        data: {},
        label: '代替テキスト',
      };

      const result = buildInitialMessagePrompt(context);

      expect(result.systemPrompt).toContain('ユーザー');
      expect(result.systemPrompt).toContain('困る');
    });

    it('should include concise output instruction', () => {
      const context: ChatContext = {
        type: 'wcag',
        wcagCriteria: ['1.4.3'],
        data: {},
        label: 'WCAG 1.4.3',
      };

      const result = buildInitialMessagePrompt(context);

      expect(result.systemPrompt).toContain('100文字');
    });

    it('should NOT include "あなたは専門家です" pattern', () => {
      const context: ChatContext = {
        type: 'score',
        data: {},
        label: 'スコア',
      };

      const result = buildInitialMessagePrompt(context);

      expect(result.systemPrompt).not.toContain('あなたは');
      expect(result.systemPrompt).not.toContain('専門家');
    });
  });
});
