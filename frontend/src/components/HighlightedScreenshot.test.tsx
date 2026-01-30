/**
 * HighlightedScreenshotコンポーネントのテスト
 * @requirement 6.2, 6.3 - 問題箇所の視覚的特定
 * @task 13.3 - HighlightedScreenshotコンポーネントを作成する
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HighlightedScreenshot } from './HighlightedScreenshot';
import type { NodeInfo } from '../types/accessibility';

describe('HighlightedScreenshot', () => {
  const mockNodes: NodeInfo[] = [
    {
      target: '#button-1',
      html: '<button id="button-1">Click me</button>',
      boundingBox: { x: 100, y: 100, width: 150, height: 50 },
    },
    {
      target: '#image-1',
      html: '<img id="image-1" src="test.jpg">',
      boundingBox: { x: 200, y: 300, width: 200, height: 150 },
    },
    {
      target: '#link-1',
      html: '<a id="link-1" href="#">Link</a>',
      // boundingBoxがないノード
    },
  ];

  const mockScreenshot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('スクリーンショット画像を表示する', () => {
    render(
      <HighlightedScreenshot
        screenshot={mockScreenshot}
        nodes={mockNodes}
      />
    );

    const image = screen.getByRole('img');
    expect(image).toBeInTheDocument();
  });

  it('バウンディングボックスを持つノードのハイライトを表示する', () => {
    render(
      <HighlightedScreenshot
        screenshot={mockScreenshot}
        nodes={mockNodes}
      />
    );

    // バウンディングボックスを持つノードの数（2つ）だけハイライトが表示される
    const highlights = screen.getAllByTestId(/^highlight-/);
    expect(highlights).toHaveLength(2);
  });

  it('各ハイライトに番号ラベルが表示される（Req 6.3）', () => {
    render(
      <HighlightedScreenshot
        screenshot={mockScreenshot}
        nodes={mockNodes}
      />
    );

    // 番号ラベルが表示される
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('ノードクリックでコールバックが呼び出される', () => {
    const onNodeClick = vi.fn();

    render(
      <HighlightedScreenshot
        screenshot={mockScreenshot}
        nodes={mockNodes}
        onNodeClick={onNodeClick}
      />
    );

    const highlight = screen.getByTestId('highlight-0');
    fireEvent.click(highlight);

    expect(onNodeClick).toHaveBeenCalledWith(0);
  });

  it('選択中のノードが強調色で表示される', () => {
    render(
      <HighlightedScreenshot
        screenshot={mockScreenshot}
        nodes={mockNodes}
        selectedNodeIndex={0}
      />
    );

    const selectedHighlight = screen.getByTestId('highlight-0');
    expect(selectedHighlight).toHaveAttribute('data-selected', 'true');
  });

  it('非選択のノードは通常色で表示される', () => {
    render(
      <HighlightedScreenshot
        screenshot={mockScreenshot}
        nodes={mockNodes}
        selectedNodeIndex={0}
      />
    );

    const unselectedHighlight = screen.getByTestId('highlight-1');
    expect(unselectedHighlight).toHaveAttribute('data-selected', 'false');
  });

  it('空のノード配列でもエラーなく表示される', () => {
    render(
      <HighlightedScreenshot
        screenshot={mockScreenshot}
        nodes={[]}
      />
    );

    const image = screen.getByRole('img');
    expect(image).toBeInTheDocument();
  });

  it('全ノードにboundingBoxがない場合でもエラーなく表示される', () => {
    const nodesWithoutBbox: NodeInfo[] = [
      { target: '#test', html: '<div>Test</div>' },
    ];

    render(
      <HighlightedScreenshot
        screenshot={mockScreenshot}
        nodes={nodesWithoutBbox}
      />
    );

    const image = screen.getByRole('img');
    expect(image).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^highlight-/)).toHaveLength(0);
  });

  it('拡大・縮小ボタンが表示される', () => {
    render(
      <HighlightedScreenshot
        screenshot={mockScreenshot}
        nodes={mockNodes}
      />
    );

    expect(screen.getByLabelText('拡大')).toBeInTheDocument();
    expect(screen.getByLabelText('縮小')).toBeInTheDocument();
  });

  it('拡大ボタンクリックで画像が拡大される', () => {
    render(
      <HighlightedScreenshot
        screenshot={mockScreenshot}
        nodes={mockNodes}
      />
    );

    const zoomInButton = screen.getByLabelText('拡大');
    fireEvent.click(zoomInButton);

    // 拡大後のスケールが1.25（1 + 0.25）に変更されていることを確認
    const container = screen.getByTestId('screenshot-container');
    expect(container).toHaveStyle({ transform: 'scale(1.25)' });
  });
});
