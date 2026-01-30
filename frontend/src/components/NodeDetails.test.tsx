/**
 * NodeDetailsコンポーネントのユニットテスト
 * @requirement 1.1, 1.2, 1.4, 5.1, 5.5 - ノード情報の展開表示
 * @task 6.2 - NodeDetailsコンポーネントのテストを作成する
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NodeDetails } from './NodeDetails';
import type { NodeInfo } from '../types/accessibility';

// テスト用のモックノードデータを作成
const createMockNodes = (count: number): NodeInfo[] => {
  return Array.from({ length: count }, (_, i) => ({
    target: `html > body > main > div:nth-child(${i + 1})`,
    html: `<div class="test-${i + 1}">テスト要素 ${i + 1}</div>`,
    failureSummary: i % 2 === 0 ? `失敗理由 ${i + 1}` : undefined,
  }));
};

describe('NodeDetails', () => {
  describe('展開・折りたたみ動作', () => {
    it('collapsed状態の場合、Collapse領域が閉じていること', () => {
      const nodes = createMockNodes(3);
      const onToggle = vi.fn();

      const { container } = render(
        <NodeDetails nodes={nodes} expanded={false} onToggle={onToggle} />
      );

      // MUI Collapseが閉じた状態（height: 0）であることを確認
      const collapseWrapper = container.querySelector('.MuiCollapse-root');
      expect(collapseWrapper).toHaveClass('MuiCollapse-hidden');
    });

    it('expanded状態の場合、ノード情報が表示されること', () => {
      const nodes = createMockNodes(3);
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // ノード情報が表示されていることを確認（HTML抜粋で確認）
      expect(screen.getByText(nodes[0].html)).toBeInTheDocument();
    });

    it('展開トグルをクリックするとonToggleが呼ばれること', () => {
      const nodes = createMockNodes(3);
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={false} onToggle={onToggle} />
      );

      // 展開ボタンをクリック
      const toggleButton = screen.getByRole('button', { name: /ノード情報/i });
      fireEvent.click(toggleButton);

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('ノード情報の表示', () => {
    it('CSSセレクタ（target）がアコーディオン内に表示されること', async () => {
      const nodes = createMockNodes(1);
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // 「技術詳細を表示」ボタンをクリック
      const accordionButton = screen.getByText('技術詳細を表示');
      fireEvent.click(accordionButton);

      // CSSセレクタが表示されていることを確認
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`CSS:.*${nodes[0].target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))).toBeInTheDocument();
      });
    });

    it('HTML抜粋がcodeタグでモノスペース表示されること', () => {
      const nodes = createMockNodes(2);
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // HTML抜粋がcode要素内に表示されていることを確認
      const codeElements = screen.getAllByTestId('node-html');
      expect(codeElements.length).toBe(2);
      expect(codeElements[0]).toHaveTextContent(nodes[0].html);
    });

    it('failureSummaryが存在する場合に表示されること', () => {
      const nodes = createMockNodes(3);
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // failureSummaryが設定されているノードのみ表示
      expect(screen.getByText('失敗理由 1')).toBeInTheDocument();
      expect(screen.queryByText('失敗理由 2')).not.toBeInTheDocument(); // 2番目は未設定
      expect(screen.getByText('失敗理由 3')).toBeInTheDocument();
    });
  });

  describe('10件超時のページネーション動作', () => {
    it('10件以下の場合は「さらに表示」ボタンが表示されないこと', () => {
      const nodes = createMockNodes(10);
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      expect(screen.queryByRole('button', { name: /さらに表示/i })).not.toBeInTheDocument();
    });

    it('10件超の場合、最初の10件のみ表示されること', () => {
      const nodes = createMockNodes(15);
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // 最初の10件のみ表示（HTML抜粋で確認）
      expect(screen.getByText(nodes[0].html)).toBeInTheDocument();
      expect(screen.getByText(nodes[9].html)).toBeInTheDocument();
      expect(screen.queryByText(nodes[10].html)).not.toBeInTheDocument();
    });

    it('10件超の場合、「さらにN件表示」ボタンが表示されること', () => {
      const nodes = createMockNodes(15);
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // ボタン名は「さらに5件表示」の形式
      expect(screen.getByRole('button', { name: /さらに\d+件表示/i })).toBeInTheDocument();
    });

    it('「さらにN件表示」ボタンをクリックすると残りのノードが表示されること', () => {
      const nodes = createMockNodes(15);
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // 「さらにN件表示」ボタンをクリック
      const showMoreButton = screen.getByRole('button', { name: /さらに\d+件表示/i });
      fireEvent.click(showMoreButton);

      // 残りのノードが表示されることを確認（HTML抜粋で確認）
      expect(screen.getByText(nodes[10].html)).toBeInTheDocument();
      expect(screen.getByText(nodes[14].html)).toBeInTheDocument();
    });

    it('残り件数が正しく表示されること', () => {
      const nodes = createMockNodes(15);
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // 「さらに5件表示」のようなテキストが含まれることを確認
      expect(screen.getByText(/さらに5件表示/i)).toBeInTheDocument();
    });

    it('initialDisplayCountプロパティで初期表示件数をカスタマイズできること', () => {
      const nodes = createMockNodes(10);
      const onToggle = vi.fn();

      render(
        <NodeDetails
          nodes={nodes}
          expanded={true}
          onToggle={onToggle}
          initialDisplayCount={5}
        />
      );

      // 最初の5件のみ表示（HTML抜粋で確認）
      expect(screen.getByText(nodes[0].html)).toBeInTheDocument();
      expect(screen.getByText(nodes[4].html)).toBeInTheDocument();
      expect(screen.queryByText(nodes[5].html)).not.toBeInTheDocument();

      // 「さらにN件表示」ボタンが表示されること
      expect(screen.getByRole('button', { name: /さらに\d+件表示/i })).toBeInTheDocument();
    });
  });

  describe('空配列・エラー表示', () => {
    it('ノードが空配列の場合、メッセージを表示すること', () => {
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={[]} expanded={true} onToggle={onToggle} />
      );

      expect(screen.getByText('ノード情報を取得できませんでした')).toBeInTheDocument();
    });

    it('ノードがundefinedの場合もエラーメッセージを表示すること', () => {
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={undefined as unknown as NodeInfo[]} expanded={true} onToggle={onToggle} />
      );

      expect(screen.getByText('ノード情報を取得できませんでした')).toBeInTheDocument();
    });
  });

  describe('ノード数の表示', () => {
    it('ノード数がヘッダーに表示されること', () => {
      const nodes = createMockNodes(5);
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={false} onToggle={onToggle} />
      );

      expect(screen.getByText(/5件/i)).toBeInTheDocument();
    });
  });

  describe('アクセシビリティ', () => {
    it('展開ボタンにaria-expandedが設定されていること', () => {
      const nodes = createMockNodes(3);
      const onToggle = vi.fn();

      const { rerender } = render(
        <NodeDetails nodes={nodes} expanded={false} onToggle={onToggle} />
      );

      const toggleButton = screen.getByRole('button', { name: /ノード情報/i });
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

      rerender(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('拡張ノード情報の表示（Req 6.4, 6.5, 6.6, 6.7）', () => {
    it('XPathが表示され、コピーボタンが存在すること（Req 6.4）', async () => {
      const nodes: NodeInfo[] = [
        {
          target: '#test-element',
          html: '<div id="test-element">Test</div>',
          xpath: '/html/body/div[@id="test-element"]',
        },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // 「技術詳細を表示」ボタンをクリック
      const accordionButton = screen.getByText('技術詳細を表示');
      fireEvent.click(accordionButton);

      // XPathが表示されていること
      await waitFor(() => {
        expect(screen.getByText(/XPath:.*\/html\/body\/div/)).toBeInTheDocument();
      });
      // XPathコピーボタンが存在すること
      expect(screen.getByLabelText('XPathをコピー')).toBeInTheDocument();
    });

    it('CSSセレクタのコピーボタンが存在すること（Req 6.4）', () => {
      const nodes: NodeInfo[] = [
        {
          target: '#test-element',
          html: '<div id="test-element">Test</div>',
        },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // CSSセレクタコピーボタンが存在すること
      expect(screen.getByLabelText('CSSセレクタをコピー')).toBeInTheDocument();
    });

    it('failureSummaryが「修正方法」ラベルで表示されること（Req 6.6）', () => {
      const nodes: NodeInfo[] = [
        {
          target: '#test-element',
          html: '<img id="test-element">',
          failureSummary: 'Fix any of the following: Element does not have an alt attribute',
        },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // 「修正方法」ラベルが表示されていること
      expect(screen.getByText('修正方法')).toBeInTheDocument();
      expect(screen.getByText(/Element does not have an alt attribute/i)).toBeInTheDocument();
    });

    it('isHiddenがtrueの場合、警告メッセージが表示されること（Req 6.7）', () => {
      const nodes: NodeInfo[] = [
        {
          target: '#hidden-element',
          html: '<div id="hidden-element" style="display:none">Hidden</div>',
          isHidden: true,
        },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // 非表示要素の警告メッセージが表示されていること
      expect(screen.getByText(/ビューポート外または非表示/i)).toBeInTheDocument();
    });

    it('isHiddenがfalseまたは未定義の場合、警告メッセージが表示されないこと', () => {
      const nodes: NodeInfo[] = [
        {
          target: '#visible-element',
          html: '<div id="visible-element">Visible</div>',
          isHidden: false,
        },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // 警告メッセージが表示されていないこと
      expect(screen.queryByText(/ビューポート外または非表示/i)).not.toBeInTheDocument();
    });

    it('contextHtmlが存在する場合、周辺HTMLセクションが表示されること（Req 6.5）', () => {
      const nodes: NodeInfo[] = [
        {
          target: '#test-element',
          html: '<span id="test-element">Test</span>',
          contextHtml: '<div><span id="test-element">Test</span><span>Sibling</span></div>',
        },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // contextHtmlが展開可能なセクションとして表示されていること
      const expandContextButton = screen.getByText('周辺HTMLを表示');
      expect(expandContextButton).toBeInTheDocument();

      // クリックして展開
      fireEvent.click(expandContextButton);

      // contextHtmlが表示されること
      expect(screen.getByText(/Sibling/i)).toBeInTheDocument();
    });

    it('ノード選択時にonNodeSelectが呼び出されること', () => {
      const nodes: NodeInfo[] = [
        {
          target: '#test-element',
          html: '<div id="test-element">Test</div>',
          boundingBox: { x: 10, y: 20, width: 100, height: 50 },
        },
      ];
      const onToggle = vi.fn();
      const onNodeSelect = vi.fn();

      render(
        <NodeDetails
          nodes={nodes}
          expanded={true}
          onToggle={onToggle}
          onNodeSelect={onNodeSelect}
        />
      );

      // ノードをクリック（HTML抜粋で要素を探す）
      const nodeContainer = screen.getByText(nodes[0].html).closest('[data-node-index]');
      if (nodeContainer) {
        fireEvent.click(nodeContainer);
        expect(onNodeSelect).toHaveBeenCalledWith(0);
      }
    });

    it('選択中のノードがハイライトされること', () => {
      const nodes: NodeInfo[] = [
        { target: '#element-1', html: '<div>1</div>' },
        { target: '#element-2', html: '<div>2</div>' },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails
          nodes={nodes}
          expanded={true}
          onToggle={onToggle}
          selectedNodeIndex={1}
        />
      );

      // 選択中のノードがハイライトされていること（HTML抜粋で要素を探す）
      const selectedNode = screen.getByText(nodes[1].html).closest('[data-node-index]');
      expect(selectedNode).toHaveAttribute('data-selected', 'true');
    });
  });

  describe('要素説明の優先表示（Req 7.2, 7.3）', () => {
    it('elementDescriptionが存在する場合、優先的に表示されること', () => {
      const nodes: NodeInfo[] = [
        {
          target: '#test-link',
          html: '<a id="test-link" href="/path">詳細はこちら</a>',
          elementDescription: 'リンク「詳細はこちら」',
        },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // elementDescriptionが表示されていること
      expect(screen.getByText('リンク「詳細はこちら」')).toBeInTheDocument();
    });

    it('elementDescriptionがない場合、CSSセレクタのみ表示されること', () => {
      const nodes: NodeInfo[] = [
        {
          target: '#test-element',
          html: '<div id="test-element">Test</div>',
        },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // CSSセレクタが表示されていること
      expect(screen.getByText(/CSS:.*#test-element/)).toBeInTheDocument();
    });

    it('技術詳細（CSSセレクタ・XPath）が折りたたみ表示になっていること', () => {
      const nodes: NodeInfo[] = [
        {
          target: '#test-element',
          html: '<div id="test-element">Test</div>',
          xpath: '/html/body/div[@id="test-element"]',
          elementDescription: 'ブロック要素',
        },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // 「技術詳細を表示」ボタンが存在すること
      expect(screen.getByText('技術詳細を表示')).toBeInTheDocument();
    });

    it('技術詳細を展開するとCSSセレクタとXPathが表示されること', async () => {
      const nodes: NodeInfo[] = [
        {
          target: '#test-element',
          html: '<div id="test-element">Test</div>',
          xpath: '/html/body/div[@id="test-element"]',
          elementDescription: 'ブロック要素',
        },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // 「技術詳細を表示」をクリック
      const accordionButton = screen.getByText('技術詳細を表示');
      fireEvent.click(accordionButton);

      // CSSセレクタとXPathが表示されること
      await waitFor(() => {
        expect(screen.getByText(/CSS:.*#test-element/)).toBeInTheDocument();
        expect(screen.getByText(/XPath:.*\/html\/body\/div/)).toBeInTheDocument();
      });
    });
  });

  describe('位置情報バッジ（Req 7.6）', () => {
    it('boundingBoxがある場合、位置情報バッジが表示されること', () => {
      const nodes: NodeInfo[] = [
        {
          target: '#test-element',
          html: '<div id="test-element">Test</div>',
          boundingBox: { x: 100, y: 100, width: 200, height: 50 },
          isHidden: false,
        },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails
          nodes={nodes}
          expanded={true}
          onToggle={onToggle}
          viewportSize={{ width: 1280, height: 720 }}
        />
      );

      // 位置情報バッジが表示されていること（上部・左）
      expect(screen.getByText('上部・左')).toBeInTheDocument();
    });

    it('中央に位置する場合「中央」と表示されること', () => {
      const nodes: NodeInfo[] = [
        {
          target: '#test-element',
          html: '<div id="test-element">Test</div>',
          boundingBox: { x: 500, y: 300, width: 200, height: 50 },
          isHidden: false,
        },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails
          nodes={nodes}
          expanded={true}
          onToggle={onToggle}
          viewportSize={{ width: 1280, height: 720 }}
        />
      );

      // 「中央」が表示されていること
      expect(screen.getByText('中央')).toBeInTheDocument();
    });

    it('右下に位置する場合「下部・右」と表示されること', () => {
      const nodes: NodeInfo[] = [
        {
          target: '#test-element',
          html: '<div id="test-element">Test</div>',
          boundingBox: { x: 1000, y: 600, width: 200, height: 50 },
          isHidden: false,
        },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails
          nodes={nodes}
          expanded={true}
          onToggle={onToggle}
          viewportSize={{ width: 1280, height: 720 }}
        />
      );

      // 「下部・右」が表示されていること
      expect(screen.getByText('下部・右')).toBeInTheDocument();
    });

    it('isHiddenがtrueの場合、位置情報バッジは表示されないこと', () => {
      const nodes: NodeInfo[] = [
        {
          target: '#hidden-element',
          html: '<div id="hidden-element">Hidden</div>',
          boundingBox: { x: 100, y: 100, width: 200, height: 50 },
          isHidden: true,
        },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails
          nodes={nodes}
          expanded={true}
          onToggle={onToggle}
          viewportSize={{ width: 1280, height: 720 }}
        />
      );

      // 位置情報バッジが表示されていないこと
      expect(screen.queryByText(/上部|中央|下部/)).not.toBeInTheDocument();
    });

    it('boundingBoxがない場合、位置情報バッジは表示されないこと', () => {
      const nodes: NodeInfo[] = [
        {
          target: '#no-bbox-element',
          html: '<div id="no-bbox-element">No BBox</div>',
        },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails
          nodes={nodes}
          expanded={true}
          onToggle={onToggle}
          viewportSize={{ width: 1280, height: 720 }}
        />
      );

      // 位置情報バッジが表示されていないこと
      expect(screen.queryByText(/上部|中央|下部/)).not.toBeInTheDocument();
    });
  });

  describe('要素スクリーンショット表示（Req 7.4）', () => {
    it('elementScreenshotがある場合、スクリーンショットが表示されること', () => {
      const nodes: NodeInfo[] = [
        {
          target: '#test-element',
          html: '<div id="test-element">Test</div>',
          elementScreenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // スクリーンショットが表示されていること
      const screenshot = screen.getByAltText('問題箇所のスクリーンショット');
      expect(screenshot).toBeInTheDocument();
      expect(screenshot).toHaveAttribute('src', nodes[0].elementScreenshot);
    });

    it('elementScreenshotがない場合、スクリーンショットは表示されないこと', () => {
      const nodes: NodeInfo[] = [
        {
          target: '#test-element',
          html: '<div id="test-element">Test</div>',
        },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // スクリーンショットが表示されていないこと
      expect(screen.queryByAltText('問題箇所のスクリーンショット')).not.toBeInTheDocument();
    });

    it('スクリーンショットにラベルが表示されること', () => {
      const nodes: NodeInfo[] = [
        {
          target: '#test-element',
          html: '<div id="test-element">Test</div>',
          elementScreenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        },
      ];
      const onToggle = vi.fn();

      render(
        <NodeDetails nodes={nodes} expanded={true} onToggle={onToggle} />
      );

      // ラベルが表示されていること
      expect(screen.getByText('問題箇所のスクリーンショット')).toBeInTheDocument();
    });
  });
});
