/**
 * 半自動チェックサービスのテスト
 *
 * Requirements: wcag-coverage-expansion 5.1, 5.2, 5.3, 5.4, 5.6, 9.1, 9.2
 * - 5.1: 分析完了後、半自動確認が可能な項目をリストアップする
 * - 5.2: 各半自動チェック項目についてスクリーンショット、HTML抜粋、質問を表示
 * - 5.3: ユーザーが選択肢を選択した場合、回答を記録しレポートに反映
 * - 5.4: alt属性、リンクテキスト、見出し、フォーカス可視性の確認項目を生成
 * - 5.6: 進捗状況（完了数/全体数）を表示
 * - 9.1: incomplete結果から半自動確認が可能な項目を抽出
 * - 9.2: 回答記録と進捗管理
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SemiAutoCheckService,
  type SemiAutoItem,
  type SemiAutoAnswer,
  type SemiAutoCheckOptions,
  SEMI_AUTO_RULE_MAPPING,
  DEFAULT_SEMI_AUTO_CHECK_OPTIONS,
} from '../semi-auto-check';
import type { RuleResult, ImpactLevel } from '../types';

// テスト用ヘルパー関数
function createMockRuleResult(overrides: Partial<RuleResult> = {}): RuleResult {
  return {
    id: 'test-rule',
    description: 'テストルール説明',
    impact: 'moderate' as ImpactLevel,
    nodeCount: 1,
    helpUrl: 'https://example.com/help',
    wcagCriteria: ['1.1.1'],
    toolSource: 'axe-core',
    nodes: [
      {
        target: 'img',
        html: '<img src="test.jpg" alt="テスト">',
      },
    ],
    ...overrides,
  };
}

describe('SemiAutoCheckService', () => {
  let service: SemiAutoCheckService;

  beforeEach(() => {
    service = new SemiAutoCheckService();
  });

  describe('型定義とインターフェース', () => {
    it('SEMI_AUTO_RULE_MAPPINGが定義されていること', () => {
      expect(SEMI_AUTO_RULE_MAPPING).toBeDefined();
      expect(typeof SEMI_AUTO_RULE_MAPPING).toBe('object');
    });

    it('DEFAULT_SEMI_AUTO_CHECK_OPTIONSが正しく定義されていること', () => {
      expect(DEFAULT_SEMI_AUTO_CHECK_OPTIONS).toBeDefined();
      expect(DEFAULT_SEMI_AUTO_CHECK_OPTIONS.enableAltCheck).toBe(true);
      expect(DEFAULT_SEMI_AUTO_CHECK_OPTIONS.enableLinkTextCheck).toBe(true);
      expect(DEFAULT_SEMI_AUTO_CHECK_OPTIONS.enableHeadingCheck).toBe(true);
      expect(DEFAULT_SEMI_AUTO_CHECK_OPTIONS.enableFocusVisibilityCheck).toBe(true);
    });

    it('SemiAutoAnswer型が正しい値を持つこと', () => {
      const validAnswers: SemiAutoAnswer[] = ['appropriate', 'inappropriate', 'cannot-determine'];
      expect(validAnswers).toHaveLength(3);
    });
  });

  describe('半自動チェック項目の抽出 (9.1)', () => {
    describe('extractItems', () => {
      it('incomplete結果から半自動確認項目を抽出すること', () => {
        const incompleteRules: RuleResult[] = [
          createMockRuleResult({
            id: 'image-alt',
            description: '画像に代替テキストがあることを確認してください',
            wcagCriteria: ['1.1.1'],
            nodes: [
              {
                target: 'img.hero',
                html: '<img class="hero" src="hero.jpg" alt="美しい風景">',
              },
            ],
          }),
        ];

        const items = service.extractItems([], incompleteRules);

        expect(items.length).toBeGreaterThan(0);
        expect(items[0].ruleId).toBe('image-alt');
        expect(items[0].wcagCriteria).toContain('1.1.1');
      });

      it('violations結果からも半自動確認項目を抽出できること', () => {
        const violations: RuleResult[] = [
          createMockRuleResult({
            id: 'link-name',
            description: 'リンクにアクセシブルな名前がありません',
            wcagCriteria: ['2.4.4'],
            nodes: [
              {
                target: 'a.more-link',
                html: '<a class="more-link" href="/details">もっと見る</a>',
              },
            ],
          }),
        ];

        const items = service.extractItems(violations, []);

        expect(items.length).toBeGreaterThan(0);
      });

      it('各SemiAutoItemに必須フィールドが設定されていること', () => {
        const incompleteRules: RuleResult[] = [
          createMockRuleResult({
            id: 'image-alt',
            nodes: [
              {
                target: 'img.test',
                html: '<img class="test" src="test.jpg" alt="テスト画像">',
                elementDescription: 'テスト画像',
              },
            ],
          }),
        ];

        const items = service.extractItems([], incompleteRules);

        expect(items.length).toBeGreaterThan(0);
        const item = items[0];

        expect(item.id).toBeDefined();
        expect(typeof item.id).toBe('string');
        expect(item.ruleId).toBe('image-alt');
        expect(item.wcagCriteria).toBeDefined();
        expect(Array.isArray(item.wcagCriteria)).toBe(true);
        expect(item.question).toBeDefined();
        expect(typeof item.question).toBe('string');
        expect(item.html).toBeDefined();
        expect(item.elementDescription).toBeDefined();
      });

      it('ノード情報がないルールは抽出しないこと', () => {
        const incompleteRules: RuleResult[] = [
          createMockRuleResult({
            id: 'image-alt',
            nodes: undefined,
          }),
        ];

        const items = service.extractItems([], incompleteRules);

        expect(items.length).toBe(0);
      });

      it('空のノード配列を持つルールは抽出しないこと', () => {
        const incompleteRules: RuleResult[] = [
          createMockRuleResult({
            id: 'image-alt',
            nodes: [],
          }),
        ];

        const items = service.extractItems([], incompleteRules);

        expect(items.length).toBe(0);
      });
    });
  });

  describe('alt属性の確認項目 (5.4.1)', () => {
    it('image-altルールから確認項目を生成すること', () => {
      const incompleteRules: RuleResult[] = [
        createMockRuleResult({
          id: 'image-alt',
          description: '画像に代替テキストが必要です',
          wcagCriteria: ['1.1.1'],
          nodes: [
            {
              target: 'img.product',
              html: '<img class="product" src="product.jpg" alt="青いシャツ">',
            },
          ],
        }),
      ];

      const items = service.extractItems([], incompleteRules);

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].question).toContain('alt');
    });

    it('質問文に画像とaltテキストの情報が含まれること', () => {
      const incompleteRules: RuleResult[] = [
        createMockRuleResult({
          id: 'image-alt',
          nodes: [
            {
              target: 'img.product',
              html: '<img class="product" src="product.jpg" alt="青いシャツ">',
            },
          ],
        }),
      ];

      const items = service.extractItems([], incompleteRules);

      expect(items[0].question.length).toBeGreaterThan(0);
    });
  });

  describe('リンクテキストの確認項目 (5.4.2)', () => {
    it('link-nameルールから確認項目を生成すること', () => {
      const incompleteRules: RuleResult[] = [
        createMockRuleResult({
          id: 'link-name',
          description: 'リンクにアクセシブルな名前が必要です',
          wcagCriteria: ['2.4.4'],
          nodes: [
            {
              target: 'a.cta',
              html: '<a class="cta" href="/signup">今すぐ登録</a>',
            },
          ],
        }),
      ];

      const items = service.extractItems([], incompleteRules);

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].ruleId).toBe('link-name');
    });
  });

  describe('見出しテキストの確認項目 (5.4.3)', () => {
    it('heading関連ルールから確認項目を生成すること', () => {
      const incompleteRules: RuleResult[] = [
        createMockRuleResult({
          id: 'empty-heading',
          description: '見出しが空です',
          wcagCriteria: ['1.3.1'],
          nodes: [
            {
              target: 'h2.section-title',
              html: '<h2 class="section-title">製品情報</h2>',
            },
          ],
        }),
      ];

      const items = service.extractItems([], incompleteRules);

      expect(items.length).toBeGreaterThan(0);
    });
  });

  describe('フォーカス可視性の確認項目 (5.4.4)', () => {
    it('focus関連ルールから確認項目を生成すること', () => {
      const incompleteRules: RuleResult[] = [
        createMockRuleResult({
          id: 'focus-visible',
          description: 'フォーカスインジケーターが見えることを確認してください',
          wcagCriteria: ['2.4.7'],
          nodes: [
            {
              target: 'button.submit',
              html: '<button class="submit">送信</button>',
            },
          ],
        }),
      ];

      const items = service.extractItems([], incompleteRules);

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].wcagCriteria).toContain('2.4.7');
    });
  });

  describe('質問文の生成', () => {
    it('alt属性チェック用の質問文が生成されること', () => {
      const incompleteRules: RuleResult[] = [
        createMockRuleResult({
          id: 'image-alt',
          nodes: [
            {
              target: 'img',
              html: '<img src="test.jpg" alt="製品画像">',
            },
          ],
        }),
      ];

      const items = service.extractItems([], incompleteRules);
      expect(items[0].question).toBeDefined();
      expect(items[0].question.length).toBeGreaterThan(10);
    });

    it('リンクテキストチェック用の質問文が生成されること', () => {
      const incompleteRules: RuleResult[] = [
        createMockRuleResult({
          id: 'link-name',
          nodes: [
            {
              target: 'a',
              html: '<a href="/page">詳細を見る</a>',
            },
          ],
        }),
      ];

      const items = service.extractItems([], incompleteRules);
      expect(items[0].question).toBeDefined();
    });
  });

  describe('回答記録 (9.2, 5.3)', () => {
    describe('recordAnswer', () => {
      it('回答を記録できること', () => {
        const incompleteRules: RuleResult[] = [
          createMockRuleResult({
            id: 'image-alt',
            nodes: [
              {
                target: 'img',
                html: '<img src="test.jpg" alt="テスト">',
              },
            ],
          }),
        ];

        service.extractItems([], incompleteRules);
        const items = service.getItems();
        expect(items.length).toBeGreaterThan(0);

        const itemId = items[0].id;
        service.recordAnswer(itemId, 'appropriate');

        const updatedItems = service.getItems();
        expect(updatedItems[0].answer).toBe('appropriate');
      });

      it('inappropriate回答を記録できること', () => {
        const incompleteRules: RuleResult[] = [
          createMockRuleResult({
            id: 'image-alt',
            nodes: [
              {
                target: 'img',
                html: '<img src="test.jpg" alt="テスト">',
              },
            ],
          }),
        ];

        service.extractItems([], incompleteRules);
        const items = service.getItems();
        const itemId = items[0].id;

        service.recordAnswer(itemId, 'inappropriate');

        const updatedItems = service.getItems();
        expect(updatedItems[0].answer).toBe('inappropriate');
      });

      it('cannot-determine回答を記録できること', () => {
        const incompleteRules: RuleResult[] = [
          createMockRuleResult({
            id: 'image-alt',
            nodes: [
              {
                target: 'img',
                html: '<img src="test.jpg" alt="テスト">',
              },
            ],
          }),
        ];

        service.extractItems([], incompleteRules);
        const items = service.getItems();
        const itemId = items[0].id;

        service.recordAnswer(itemId, 'cannot-determine');

        const updatedItems = service.getItems();
        expect(updatedItems[0].answer).toBe('cannot-determine');
      });

      it('存在しないIDへの回答記録でエラーが発生しないこと', () => {
        expect(() => {
          service.recordAnswer('non-existent-id', 'appropriate');
        }).not.toThrow();
      });

      it('回答を上書きできること', () => {
        const incompleteRules: RuleResult[] = [
          createMockRuleResult({
            id: 'image-alt',
            nodes: [
              {
                target: 'img',
                html: '<img src="test.jpg" alt="テスト">',
              },
            ],
          }),
        ];

        service.extractItems([], incompleteRules);
        const items = service.getItems();
        const itemId = items[0].id;

        service.recordAnswer(itemId, 'appropriate');
        service.recordAnswer(itemId, 'inappropriate');

        const updatedItems = service.getItems();
        expect(updatedItems[0].answer).toBe('inappropriate');
      });
    });
  });

  describe('進捗管理 (9.2, 5.6)', () => {
    describe('getProgress', () => {
      it('初期状態で進捗が0/0であること', () => {
        const progress = service.getProgress();

        expect(progress.completed).toBe(0);
        expect(progress.total).toBe(0);
      });

      it('項目抽出後に正しい総数が表示されること', () => {
        const incompleteRules: RuleResult[] = [
          createMockRuleResult({
            id: 'image-alt',
            nodes: [
              { target: 'img.a', html: '<img class="a" src="a.jpg" alt="A">' },
              { target: 'img.b', html: '<img class="b" src="b.jpg" alt="B">' },
            ],
          }),
        ];

        service.extractItems([], incompleteRules);
        const progress = service.getProgress();

        expect(progress.total).toBe(2);
        expect(progress.completed).toBe(0);
      });

      it('回答後に完了数が増加すること', () => {
        const incompleteRules: RuleResult[] = [
          createMockRuleResult({
            id: 'image-alt',
            nodes: [
              { target: 'img.a', html: '<img class="a" src="a.jpg" alt="A">' },
              { target: 'img.b', html: '<img class="b" src="b.jpg" alt="B">' },
            ],
          }),
        ];

        service.extractItems([], incompleteRules);
        const items = service.getItems();

        service.recordAnswer(items[0].id, 'appropriate');
        const progress = service.getProgress();

        expect(progress.completed).toBe(1);
        expect(progress.total).toBe(2);
      });

      it('全項目回答後に完了数が総数と一致すること', () => {
        const incompleteRules: RuleResult[] = [
          createMockRuleResult({
            id: 'image-alt',
            nodes: [
              { target: 'img.a', html: '<img class="a" src="a.jpg" alt="A">' },
              { target: 'img.b', html: '<img class="b" src="b.jpg" alt="B">' },
            ],
          }),
        ];

        service.extractItems([], incompleteRules);
        const items = service.getItems();

        service.recordAnswer(items[0].id, 'appropriate');
        service.recordAnswer(items[1].id, 'inappropriate');
        const progress = service.getProgress();

        expect(progress.completed).toBe(2);
        expect(progress.total).toBe(2);
      });
    });
  });

  describe('オプション設定', () => {
    it('特定のチェック種別を無効にできること', () => {
      const options: SemiAutoCheckOptions = {
        ...DEFAULT_SEMI_AUTO_CHECK_OPTIONS,
        enableAltCheck: false,
      };

      const serviceWithOptions = new SemiAutoCheckService(options);
      const incompleteRules: RuleResult[] = [
        createMockRuleResult({
          id: 'image-alt',
          nodes: [
            { target: 'img', html: '<img src="test.jpg" alt="テスト">' },
          ],
        }),
      ];

      const items = serviceWithOptions.extractItems([], incompleteRules);

      expect(items.length).toBe(0);
    });
  });

  describe('結果のエクスポート', () => {
    it('getResultsで回答済み項目を取得できること', () => {
      const incompleteRules: RuleResult[] = [
        createMockRuleResult({
          id: 'image-alt',
          nodes: [
            { target: 'img.a', html: '<img class="a" src="a.jpg" alt="A">' },
            { target: 'img.b', html: '<img class="b" src="b.jpg" alt="B">' },
          ],
        }),
      ];

      service.extractItems([], incompleteRules);
      const items = service.getItems();

      service.recordAnswer(items[0].id, 'appropriate');

      const results = service.getResults();

      expect(results.length).toBe(1);
      expect(results[0].answer).toBe('appropriate');
      expect(results[0].answeredAt).toBeDefined();
    });

    it('getResultsで回答日時が記録されていること', () => {
      const incompleteRules: RuleResult[] = [
        createMockRuleResult({
          id: 'image-alt',
          nodes: [
            { target: 'img', html: '<img src="test.jpg" alt="テスト">' },
          ],
        }),
      ];

      service.extractItems([], incompleteRules);
      const items = service.getItems();

      const beforeAnswer = new Date().toISOString();
      service.recordAnswer(items[0].id, 'appropriate');
      const afterAnswer = new Date().toISOString();

      const results = service.getResults();
      const answeredAt = results[0].answeredAt;

      expect(answeredAt >= beforeAnswer).toBe(true);
      expect(answeredAt <= afterAnswer).toBe(true);
    });
  });

  describe('クリア機能', () => {
    it('clearで全項目をクリアできること', () => {
      const incompleteRules: RuleResult[] = [
        createMockRuleResult({
          id: 'image-alt',
          nodes: [
            { target: 'img', html: '<img src="test.jpg" alt="テスト">' },
          ],
        }),
      ];

      service.extractItems([], incompleteRules);
      expect(service.getItems().length).toBeGreaterThan(0);

      service.clear();

      expect(service.getItems().length).toBe(0);
      expect(service.getProgress().total).toBe(0);
    });
  });
});
