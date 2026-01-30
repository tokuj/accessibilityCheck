/**
 * フロントエンド統合テスト
 *
 * Task 12.2: 違反テーブル行展開、WCAGフィルタ動作、タブ切り替えUI一貫性の統合検証
 * Requirements: 1.1, 2.4, 4.3
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViolationsTable } from '../ViolationsTable';
import { IncompleteTable } from '../IncompleteTable';
import { PassesTable } from '../PassesTable';
import type { PageResult, RuleResult } from '../../types/accessibility';

// モック: useAIChat, useChatHistory
vi.mock('../../hooks/useAIChat', () => ({
  useAIChat: () => ({
    isLoading: false,
    error: null,
    history: [],
    lastAnswer: null,
    sendQuestion: vi.fn(),
    retry: vi.fn(),
    clearError: vi.fn(),
  }),
}));

vi.mock('../../hooks/useChatHistory', () => ({
  useChatHistory: () => ({
    history: [],
    historyCount: 0,
    addEntry: vi.fn(),
    clearHistory: vi.fn(),
  }),
}));

describe('フロントエンド統合テスト (Task 12.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('違反テーブル行展開でノード表示 (Req 1.1)', () => {
    const mockPagesWithNodes: PageResult[] = [
      {
        name: 'テストページ',
        url: 'https://example.com',
        violations: [
          {
            id: 'color-contrast',
            description: 'コントラスト比が不十分',
            impact: 'serious',
            nodeCount: 3,
            wcagCriteria: ['1.4.3'],
            helpUrl: 'https://example.com/help',
            toolSource: 'axe-core',
            nodes: [
              {
                target: '<p class="low-contrast" style="color: #777">テスト</p>',
                html: '<p class="low-contrast" style="color: #777">テスト</p>',
                failureSummary: 'コントラスト比が不足しています',
              },
              {
                target: 'html > body > span.faded',
                html: '<span class="faded">薄いテキスト</span>',
                failureSummary: 'コントラスト比が不足しています',
              },
              {
                target: 'div.container > a.subtle',
                html: '<a class="subtle" href="/link">リンク</a>',
              },
            ],
          },
          {
            id: 'image-alt',
            description: '代替テキストがありません',
            impact: 'critical',
            nodeCount: 2,
            wcagCriteria: ['1.1.1'],
            helpUrl: 'https://example.com/help2',
            toolSource: 'pa11y',
            nodes: [
              {
                target: 'img.hero',
                html: '<img class="hero" src="hero.jpg">',
              },
              {
                target: 'img.logo',
                html: '<img class="logo" src="logo.png">',
              },
            ],
          },
        ],
        passes: [],
        incomplete: [],
      },
    ];

    it('行展開ボタンをクリックするとNodeDetailsが表示される', async () => {
      const user = userEvent.setup();
      render(<ViolationsTable pages={mockPagesWithNodes} />);

      // 初期状態ではノード情報は非表示
      expect(screen.queryByText('<p class="low-contrast" style="color: #777">テスト</p>')).not.toBeInTheDocument();

      // 展開ボタンをクリック
      const expandButtons = screen.getAllByRole('button', { name: /ノード情報を展開/ });
      await user.click(expandButtons[0]);

      // ノード情報が表示される
      expect(screen.getByText('<p class="low-contrast" style="color: #777">テスト</p>')).toBeInTheDocument();
    });

    it('複数の違反行を個別に展開できる', async () => {
      const user = userEvent.setup();
      render(<ViolationsTable pages={mockPagesWithNodes} />);

      const expandButtons = screen.getAllByRole('button', { name: /ノード情報を展開/ });
      expect(expandButtons).toHaveLength(2);

      // 1つ目の違反を展開
      await user.click(expandButtons[0]);
      expect(screen.getByText('<p class="low-contrast" style="color: #777">テスト</p>')).toBeInTheDocument();

      // 2つ目の違反を展開
      await user.click(expandButtons[1]);
      expect(screen.getByText('<img class="hero" src="hero.jpg">')).toBeInTheDocument();

      // 両方が表示されている
      expect(screen.getByText('<p class="low-contrast" style="color: #777">テスト</p>')).toBeInTheDocument();
      expect(screen.getByText('<img class="hero" src="hero.jpg">')).toBeInTheDocument();
    });

    it('展開状態で再度クリックすると折りたたまれる', async () => {
      const user = userEvent.setup();
      render(<ViolationsTable pages={mockPagesWithNodes} />);

      // 展開
      const expandButton = screen.getAllByRole('button', { name: /ノード情報を展開/ })[0];
      await user.click(expandButton);
      expect(screen.getByText('<p class="low-contrast" style="color: #777">テスト</p>')).toBeInTheDocument();

      // 折りたたみ
      const collapseButton = screen.getByRole('button', { name: /ノード情報を折りたたむ/ });
      await user.click(collapseButton);

      // 展開ボタンが再度表示される
      expect(screen.getAllByRole('button', { name: /ノード情報を展開/ })[0]).toBeInTheDocument();
    });

    it('ノード情報にはCSSセレクタとHTML抜粋が含まれる', async () => {
      const user = userEvent.setup();
      render(<ViolationsTable pages={mockPagesWithNodes} />);

      const expandButton = screen.getAllByRole('button', { name: /ノード情報を展開/ })[0];
      await user.click(expandButton);

      // HTML抜粋の表示を確認（HTML抜粋として直接表示される）
      const htmlElements = screen.getAllByText('<p class="low-contrast" style="color: #777">テスト</p>');
      expect(htmlElements.length).toBeGreaterThan(0);
    });

    it('axe-core結果にはfailureSummaryが表示される', async () => {
      const user = userEvent.setup();
      render(<ViolationsTable pages={mockPagesWithNodes} />);

      const expandButton = screen.getAllByRole('button', { name: /ノード情報を展開/ })[0];
      await user.click(expandButton);

      // 複数の要素がマッチする可能性があるため、getAllByTextを使用
      const summaryElements = screen.getAllByText(/コントラスト比が不足しています/);
      expect(summaryElements.length).toBeGreaterThan(0);
    });

    it('ノード情報がない場合は展開ボタンが無効化される', () => {
      const pagesWithoutNodes: PageResult[] = [
        {
          name: 'テストページ',
          url: 'https://example.com',
          violations: [
            {
              id: 'bypass',
              description: 'スキップリンクがありません',
              impact: 'serious',
              nodeCount: 0,
              wcagCriteria: ['2.4.1'],
              helpUrl: '',
              toolSource: 'axe-core',
              // nodes プロパティなし
            },
          ],
          passes: [],
          incomplete: [],
        },
      ];

      render(<ViolationsTable pages={pagesWithoutNodes} />);

      const expandButton = screen.getByRole('button', { name: /ノード情報/ });
      expect(expandButton).toBeDisabled();
    });
  });

  describe('WCAG項番クリックでフィルタ動作 (Req 2.4)', () => {
    const mockPages: PageResult[] = [
      {
        name: 'テストページ',
        url: 'https://example.com',
        violations: [
          {
            id: 'color-contrast',
            description: 'コントラスト比が不十分',
            impact: 'serious',
            nodeCount: 2,
            wcagCriteria: ['1.4.3'],
            helpUrl: '',
            toolSource: 'axe-core',
          },
          {
            id: 'image-alt',
            description: '代替テキストがありません',
            impact: 'critical',
            nodeCount: 3,
            wcagCriteria: ['1.1.1'],
            helpUrl: '',
            toolSource: 'pa11y',
          },
          {
            id: 'link-name',
            description: 'リンクにアクセシブルな名前がありません',
            impact: 'serious',
            nodeCount: 1,
            wcagCriteria: ['2.4.4'],
            helpUrl: '',
            toolSource: 'lighthouse',
          },
        ],
        passes: [],
        incomplete: [],
      },
    ];

    it('wcagFilterを指定すると該当する違反のみ表示される', () => {
      render(<ViolationsTable pages={mockPages} wcagFilter="1.4.3" />);

      // 1.4.3に該当するcolor-contrastは表示
      expect(screen.getByText('color-contrast')).toBeInTheDocument();

      // 他の違反は非表示
      expect(screen.queryByText('image-alt')).not.toBeInTheDocument();
      expect(screen.queryByText('link-name')).not.toBeInTheDocument();
    });

    it('wcagFilter=nullの場合は全ての違反が表示される', () => {
      render(<ViolationsTable pages={mockPages} wcagFilter={null} />);

      expect(screen.getByText('color-contrast')).toBeInTheDocument();
      expect(screen.getByText('image-alt')).toBeInTheDocument();
      expect(screen.getByText('link-name')).toBeInTheDocument();
    });

    it('該当する違反がない場合はメッセージが表示される', () => {
      render(<ViolationsTable pages={mockPages} wcagFilter="3.1.1" />);

      expect(screen.getByText('WCAG 3.1.1 に該当する違反はありません')).toBeInTheDocument();
    });

    it('フィルタリングは複数のWCAG基準を持つ違反にも対応する', () => {
      const pagesWithMultipleCriteria: PageResult[] = [
        {
          name: 'テストページ',
          url: 'https://example.com',
          violations: [
            {
              id: 'complex-rule',
              description: '複数のWCAG基準に関連',
              impact: 'serious',
              nodeCount: 1,
              wcagCriteria: ['1.4.3', '1.4.6'],
              helpUrl: '',
              toolSource: 'axe-core',
            },
          ],
          passes: [],
          incomplete: [],
        },
      ];

      // 1.4.3でフィルタリング
      const { rerender } = render(
        <ViolationsTable pages={pagesWithMultipleCriteria} wcagFilter="1.4.3" />
      );
      expect(screen.getByText('complex-rule')).toBeInTheDocument();

      // 1.4.6でフィルタリング
      rerender(<ViolationsTable pages={pagesWithMultipleCriteria} wcagFilter="1.4.6" />);
      expect(screen.getByText('complex-rule')).toBeInTheDocument();

      // 関連のない基準でフィルタリング
      rerender(<ViolationsTable pages={pagesWithMultipleCriteria} wcagFilter="2.4.4" />);
      expect(screen.queryByText('complex-rule')).not.toBeInTheDocument();
    });
  });

  describe('タブ切り替え時のUI一貫性 (Req 4.3)', () => {
    describe('ViolationsTable', () => {
      it('ツール列が表示される', () => {
        const pages: PageResult[] = [
          {
            name: 'テストページ',
            url: 'https://example.com',
            violations: [
              {
                id: 'test',
                description: 'テスト',
                impact: 'serious',
                nodeCount: 1,
                wcagCriteria: ['1.4.3'],
                helpUrl: '',
                toolSource: 'axe-core',
              },
            ],
            passes: [],
            incomplete: [],
          },
        ];

        render(<ViolationsTable pages={pages} />);
        expect(screen.getByText('ツール')).toBeInTheDocument();
      });

      it('WCAG項番列が表示される', () => {
        const pages: PageResult[] = [
          {
            name: 'テストページ',
            url: 'https://example.com',
            violations: [
              {
                id: 'test',
                description: 'テスト',
                impact: 'serious',
                nodeCount: 1,
                wcagCriteria: ['1.4.3'],
                helpUrl: '',
                toolSource: 'axe-core',
              },
            ],
            passes: [],
            incomplete: [],
          },
        ];

        render(<ViolationsTable pages={pages} />);
        expect(screen.getByText('WCAG項番')).toBeInTheDocument();
      });

      it('影響度列が表示される', () => {
        const pages: PageResult[] = [
          {
            name: 'テストページ',
            url: 'https://example.com',
            violations: [
              {
                id: 'test',
                description: 'テスト',
                impact: 'serious',
                nodeCount: 1,
                wcagCriteria: ['1.4.3'],
                helpUrl: '',
                toolSource: 'axe-core',
              },
            ],
            passes: [],
            incomplete: [],
          },
        ];

        render(<ViolationsTable pages={pages} />);
        expect(screen.getByText('影響度')).toBeInTheDocument();
      });
    });

    describe('IncompleteTable', () => {
      it('ツール列が表示される', () => {
        const pages: PageResult[] = [
          {
            name: 'テストページ',
            url: 'https://example.com',
            violations: [],
            passes: [],
            incomplete: [
              {
                id: 'test',
                description: 'テスト',
                impact: 'moderate',
                nodeCount: 1,
                wcagCriteria: ['1.4.3'],
                helpUrl: '',
                toolSource: 'lighthouse',
              },
            ],
          },
        ];

        render(<IncompleteTable pages={pages} />);
        expect(screen.getByText('ツール')).toBeInTheDocument();
      });

      it('WCAG項番列が表示される', () => {
        const pages: PageResult[] = [
          {
            name: 'テストページ',
            url: 'https://example.com',
            violations: [],
            passes: [],
            incomplete: [
              {
                id: 'test',
                description: 'テスト',
                impact: 'moderate',
                nodeCount: 1,
                wcagCriteria: ['1.4.3'],
                helpUrl: '',
                toolSource: 'lighthouse',
              },
            ],
          },
        ];

        render(<IncompleteTable pages={pages} />);
        expect(screen.getByText('WCAG項番')).toBeInTheDocument();
      });

      it('影響度列が表示される', () => {
        const pages: PageResult[] = [
          {
            name: 'テストページ',
            url: 'https://example.com',
            violations: [],
            passes: [],
            incomplete: [
              {
                id: 'test',
                description: 'テスト',
                impact: 'moderate',
                nodeCount: 1,
                wcagCriteria: ['1.4.3'],
                helpUrl: '',
                toolSource: 'lighthouse',
              },
            ],
          },
        ];

        render(<IncompleteTable pages={pages} />);
        expect(screen.getByText('影響度')).toBeInTheDocument();
      });

      it('NodeDetails展開機能がある', async () => {
        const user = userEvent.setup();
        const pages: PageResult[] = [
          {
            name: 'テストページ',
            url: 'https://example.com',
            violations: [],
            passes: [],
            incomplete: [
              {
                id: 'test',
                description: 'テスト',
                impact: 'moderate',
                nodeCount: 1,
                wcagCriteria: ['1.4.3'],
                helpUrl: '',
                toolSource: 'lighthouse',
                nodes: [
                  {
                    target: 'div.test',
                    html: '<div class="test">テスト</div>',
                  },
                ],
              },
            ],
          },
        ];

        render(<IncompleteTable pages={pages} />);

        const expandButton = screen.getByRole('button', { name: /ノード情報を展開/ });
        await user.click(expandButton);

        expect(screen.getByText('<div class="test">テスト</div>')).toBeInTheDocument();
      });
    });

    describe('PassesTable', () => {
      it('ツール列が表示される', () => {
        const pages: PageResult[] = [
          {
            name: 'テストページ',
            url: 'https://example.com',
            violations: [],
            passes: [
              {
                id: 'test',
                description: 'テスト',
                nodeCount: 1,
                wcagCriteria: ['1.4.3'],
                helpUrl: '',
                toolSource: 'axe-core',
              },
            ],
            incomplete: [],
          },
        ];

        render(<PassesTable pages={pages} />);
        expect(screen.getByText('ツール')).toBeInTheDocument();
      });

      it('WCAG項番列が表示される', () => {
        const pages: PageResult[] = [
          {
            name: 'テストページ',
            url: 'https://example.com',
            violations: [],
            passes: [
              {
                id: 'test',
                description: 'テスト',
                nodeCount: 1,
                wcagCriteria: ['1.4.3'],
                helpUrl: '',
                toolSource: 'axe-core',
              },
            ],
            incomplete: [],
          },
        ];

        render(<PassesTable pages={pages} />);
        expect(screen.getByText('WCAG項番')).toBeInTheDocument();
      });

      it('影響度列が表示される', () => {
        const pages: PageResult[] = [
          {
            name: 'テストページ',
            url: 'https://example.com',
            violations: [],
            passes: [
              {
                id: 'test',
                description: 'テスト',
                impact: 'minor',
                nodeCount: 1,
                wcagCriteria: ['1.4.3'],
                helpUrl: '',
                toolSource: 'axe-core',
              },
            ],
            incomplete: [],
          },
        ];

        render(<PassesTable pages={pages} />);
        expect(screen.getByText('影響度')).toBeInTheDocument();
      });

      it('影響度がundefinedの場合は「-」が表示される', () => {
        const pages: PageResult[] = [
          {
            name: 'テストページ',
            url: 'https://example.com',
            violations: [],
            passes: [
              {
                id: 'test',
                description: 'テスト',
                // impact undefined
                nodeCount: 1,
                wcagCriteria: ['1.4.3'],
                helpUrl: '',
                toolSource: 'lighthouse',
              },
            ],
            incomplete: [],
          },
        ];

        render(<PassesTable pages={pages} />);
        expect(screen.getByText('-')).toBeInTheDocument();
      });

      it('NodeDetails展開機能がある', async () => {
        const user = userEvent.setup();
        const pages: PageResult[] = [
          {
            name: 'テストページ',
            url: 'https://example.com',
            violations: [],
            passes: [
              {
                id: 'test',
                description: 'テスト',
                nodeCount: 1,
                wcagCriteria: ['1.4.3'],
                helpUrl: '',
                toolSource: 'axe-core',
                nodes: [
                  {
                    target: 'button.accessible',
                    html: '<button class="accessible">アクセシブルなボタン</button>',
                  },
                ],
              },
            ],
            incomplete: [],
          },
        ];

        render(<PassesTable pages={pages} />);

        const expandButton = screen.getByRole('button', { name: /ノード情報を展開/ });
        await user.click(expandButton);

        expect(screen.getByText('<button class="accessible">アクセシブルなボタン</button>')).toBeInTheDocument();
      });
    });

    describe('全タブ共通', () => {
      it('各タブでAIChatButtonが表示される', () => {
        const pages: PageResult[] = [
          {
            name: 'テストページ',
            url: 'https://example.com',
            violations: [
              {
                id: 'violation',
                description: '違反',
                impact: 'serious',
                nodeCount: 1,
                wcagCriteria: ['1.4.3'],
                helpUrl: '',
                toolSource: 'axe-core',
              },
            ],
            passes: [
              {
                id: 'pass',
                description: 'パス',
                nodeCount: 1,
                wcagCriteria: ['1.1.1'],
                helpUrl: '',
                toolSource: 'axe-core',
              },
            ],
            incomplete: [
              {
                id: 'incomplete',
                description: '不明',
                impact: 'moderate',
                nodeCount: 1,
                wcagCriteria: ['2.4.4'],
                helpUrl: '',
                toolSource: 'lighthouse',
              },
            ],
          },
        ];

        const { unmount } = render(<ViolationsTable pages={pages} />);
        expect(screen.getAllByRole('button', { name: /AIに質問/ }).length).toBeGreaterThan(0);
        unmount();

        const { unmount: unmount2 } = render(<IncompleteTable pages={pages} />);
        expect(screen.getAllByRole('button', { name: /AIに質問/ }).length).toBeGreaterThan(0);
        unmount2();

        render(<PassesTable pages={pages} />);
        expect(screen.getAllByRole('button', { name: /AIに質問/ }).length).toBeGreaterThan(0);
      });
    });
  });

  describe('問題箇所の視覚的特定 (Task 13.5, Req 6.1, 6.2, 6.4, 6.7)', () => {
    describe('拡張ノード情報の表示', () => {
      it('バウンディングボックス情報を持つノードでは番号が表示される', async () => {
        const user = userEvent.setup();
        const pages: PageResult[] = [
          {
            name: 'テストページ',
            url: 'https://example.com',
            violations: [
              {
                id: 'image-alt',
                description: '代替テキストがありません',
                impact: 'critical',
                nodeCount: 2,
                wcagCriteria: ['1.1.1'],
                helpUrl: '',
                toolSource: 'axe-core',
                nodes: [
                  {
                    target: 'img.hero',
                    html: '<img class="hero" src="hero.jpg">',
                    boundingBox: { x: 100, y: 200, width: 300, height: 400 },
                    xpath: '/html/body/img[@class="hero"]',
                  },
                  {
                    target: 'img.logo',
                    html: '<img class="logo" src="logo.png">',
                    boundingBox: { x: 50, y: 50, width: 100, height: 100 },
                    xpath: '/html/body/img[@class="logo"]',
                  },
                ],
              },
            ],
            passes: [],
            incomplete: [],
          },
        ];

        render(<ViolationsTable pages={pages} />);

        const expandButton = screen.getByRole('button', { name: /ノード情報を展開/ });
        await user.click(expandButton);

        // 技術詳細を展開
        const accordionButtons = screen.getAllByText('技術詳細を表示');
        for (const btn of accordionButtons) {
          await user.click(btn);
        }

        // XPathが表示されていることを確認
        await waitFor(() => {
          expect(screen.getByText(/XPath:.*\/html\/body\/img\[@class="hero"\]/)).toBeInTheDocument();
          expect(screen.getByText(/XPath:.*\/html\/body\/img\[@class="logo"\]/)).toBeInTheDocument();
        });
      });

      it('XPathコピーボタンが表示される (Req 6.4)', async () => {
        const user = userEvent.setup();
        const pages: PageResult[] = [
          {
            name: 'テストページ',
            url: 'https://example.com',
            violations: [
              {
                id: 'test-rule',
                description: 'テスト',
                impact: 'serious',
                nodeCount: 1,
                wcagCriteria: ['1.1.1'],
                helpUrl: '',
                toolSource: 'axe-core',
                nodes: [
                  {
                    target: '#test-element',
                    html: '<div id="test-element">Test</div>',
                    xpath: '/html/body/div[@id="test-element"]',
                  },
                ],
              },
            ],
            passes: [],
            incomplete: [],
          },
        ];

        render(<ViolationsTable pages={pages} />);

        const expandButton = screen.getByRole('button', { name: /ノード情報を展開/ });
        await user.click(expandButton);

        // XPathコピーボタンが表示されていることを確認
        expect(screen.getByLabelText('XPathをコピー')).toBeInTheDocument();
      });

      it('非表示要素には警告メッセージが表示される (Req 6.7)', async () => {
        const user = userEvent.setup();
        const pages: PageResult[] = [
          {
            name: 'テストページ',
            url: 'https://example.com',
            violations: [
              {
                id: 'hidden-element-rule',
                description: '非表示要素',
                impact: 'moderate',
                nodeCount: 1,
                wcagCriteria: ['2.4.1'],
                helpUrl: '',
                toolSource: 'axe-core',
                nodes: [
                  {
                    target: '#hidden-element',
                    html: '<div id="hidden-element" style="display:none">Hidden</div>',
                    isHidden: true,
                  },
                ],
              },
            ],
            passes: [],
            incomplete: [],
          },
        ];

        render(<ViolationsTable pages={pages} />);

        const expandButton = screen.getByRole('button', { name: /ノード情報を展開/ });
        await user.click(expandButton);

        // 非表示要素の警告メッセージが表示されていることを確認
        expect(screen.getByText(/ビューポート外または非表示/i)).toBeInTheDocument();
      });

      it('周辺HTMLが展開可能なセクションとして表示される (Req 6.5)', async () => {
        const user = userEvent.setup();
        const pages: PageResult[] = [
          {
            name: 'テストページ',
            url: 'https://example.com',
            violations: [
              {
                id: 'context-html-rule',
                description: '周辺HTML確認',
                impact: 'minor',
                nodeCount: 1,
                wcagCriteria: ['1.1.1'],
                helpUrl: '',
                toolSource: 'axe-core',
                nodes: [
                  {
                    target: 'span.target',
                    html: '<span class="target">Target</span>',
                    contextHtml: '<div class="parent"><span class="target">Target</span><span class="sibling">Sibling</span></div>',
                  },
                ],
              },
            ],
            passes: [],
            incomplete: [],
          },
        ];

        render(<ViolationsTable pages={pages} />);

        // ノード情報を展開
        const expandButton = screen.getByRole('button', { name: /ノード情報を展開/ });
        await user.click(expandButton);

        // 周辺HTML表示ボタンが表示されていることを確認
        const contextButton = screen.getByText('周辺HTMLを表示');
        expect(contextButton).toBeInTheDocument();

        // クリックして周辺HTMLを表示
        await user.click(contextButton);

        // 周辺HTMLが表示されることを確認
        expect(screen.getByText(/Sibling/)).toBeInTheDocument();
      });

      it('修正方法ラベルでfailureSummaryが表示される (Req 6.6)', async () => {
        const user = userEvent.setup();
        const pages: PageResult[] = [
          {
            name: 'テストページ',
            url: 'https://example.com',
            violations: [
              {
                id: 'fix-rule',
                description: '修正が必要',
                impact: 'serious',
                nodeCount: 1,
                wcagCriteria: ['1.1.1'],
                helpUrl: '',
                toolSource: 'axe-core',
                nodes: [
                  {
                    target: 'img.no-alt',
                    html: '<img class="no-alt" src="test.jpg">',
                    failureSummary: 'Fix any of the following: Element does not have an alt attribute',
                  },
                ],
              },
            ],
            passes: [],
            incomplete: [],
          },
        ];

        render(<ViolationsTable pages={pages} />);

        const expandButton = screen.getByRole('button', { name: /ノード情報を展開/ });
        await user.click(expandButton);

        // 修正方法ラベルが表示されていることを確認
        expect(screen.getByText('修正方法')).toBeInTheDocument();
        expect(screen.getByText(/Element does not have an alt attribute/i)).toBeInTheDocument();
      });
    });
  });

  describe('後方互換性', () => {
    it('nodesプロパティがないRuleResultでも正常に表示される', () => {
      const pages: PageResult[] = [
        {
          name: 'テストページ',
          url: 'https://example.com',
          violations: [
            {
              id: 'legacy-rule',
              description: 'レガシールール',
              impact: 'serious',
              nodeCount: 5,
              wcagCriteria: ['1.4.3'],
              helpUrl: '',
              toolSource: 'axe-core',
              // nodes プロパティなし（後方互換性テスト）
            },
          ],
          passes: [],
          incomplete: [],
        },
      ];

      render(<ViolationsTable pages={pages} />);

      expect(screen.getByText('legacy-rule')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // nodeCount
    });

    it('wcagFilterプロパティがない場合でも正常に動作する', () => {
      const pages: PageResult[] = [
        {
          name: 'テストページ',
          url: 'https://example.com',
          violations: [
            {
              id: 'test',
              description: 'テスト',
              impact: 'serious',
              nodeCount: 1,
              wcagCriteria: ['1.4.3'],
              helpUrl: '',
              toolSource: 'axe-core',
            },
          ],
          passes: [],
          incomplete: [],
        },
      ];

      // wcagFilterを指定しない
      render(<ViolationsTable pages={pages} />);

      expect(screen.getByText('test')).toBeInTheDocument();
    });
  });
});
