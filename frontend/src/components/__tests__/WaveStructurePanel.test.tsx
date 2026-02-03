/**
 * WaveStructurePanelコンポーネントのテスト
 *
 * Requirements: wcag-coverage-expansion 4.3
 * Task 13.2: WAVE構造情報表示を実装
 *
 * - WAVEの見出し階層情報を視覚的に表示
 * - ランドマーク情報を表示
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { WaveStructurePanel } from '../WaveStructurePanel';

/**
 * WAVE構造情報の型定義
 */
export interface HeadingInfo {
  /** 見出しレベル（1-6） */
  level: number;
  /** 見出しテキスト */
  text: string;
  /** XPath（オプション） */
  xpath?: string;
}

export interface LandmarkInfo {
  /** ランドマーク種類 */
  type: 'banner' | 'navigation' | 'main' | 'contentinfo' | 'complementary' | 'search' | 'form' | 'region';
  /** ランドマークのラベル（aria-label / aria-labelledby） */
  label?: string;
  /** XPath（オプション） */
  xpath?: string;
}

export interface WaveStructureInfo {
  /** 見出し階層情報 */
  headings: HeadingInfo[];
  /** ランドマーク情報 */
  landmarks: LandmarkInfo[];
}

// テスト用モックデータ
const createMockStructureInfo = (): WaveStructureInfo => ({
  headings: [
    { level: 1, text: 'ページタイトル' },
    { level: 2, text: 'セクション1' },
    { level: 3, text: 'サブセクション1-1' },
    { level: 3, text: 'サブセクション1-2' },
    { level: 2, text: 'セクション2' },
    { level: 4, text: '詳細セクション' },
  ],
  landmarks: [
    { type: 'banner', label: 'サイトヘッダー' },
    { type: 'navigation', label: 'メインナビゲーション' },
    { type: 'main' },
    { type: 'complementary', label: 'サイドバー' },
    { type: 'contentinfo', label: 'フッター' },
  ],
});

describe('WaveStructurePanel', () => {
  describe('基本レンダリング', () => {
    it('タイトルが表示される', () => {
      render(<WaveStructurePanel structureInfo={createMockStructureInfo()} />);

      expect(screen.getByText('ページ構造情報（WAVE）')).toBeInTheDocument();
    });

    it('見出しセクションが表示される', () => {
      render(<WaveStructurePanel structureInfo={createMockStructureInfo()} />);

      expect(screen.getByText('見出し階層')).toBeInTheDocument();
    });

    it('ランドマークセクションが表示される', () => {
      render(<WaveStructurePanel structureInfo={createMockStructureInfo()} />);

      expect(screen.getByText('ランドマーク')).toBeInTheDocument();
    });

    it('空のデータでは「構造情報がありません」と表示される', () => {
      render(
        <WaveStructurePanel
          structureInfo={{ headings: [], landmarks: [] }}
        />
      );

      expect(screen.getByText('構造情報がありません')).toBeInTheDocument();
    });
  });

  describe('見出し階層表示', () => {
    it('すべての見出しが表示される', () => {
      render(<WaveStructurePanel structureInfo={createMockStructureInfo()} />);

      expect(screen.getByText('ページタイトル')).toBeInTheDocument();
      expect(screen.getByText('セクション1')).toBeInTheDocument();
      expect(screen.getByText('サブセクション1-1')).toBeInTheDocument();
      expect(screen.getByText('セクション2')).toBeInTheDocument();
    });

    it('見出しレベルが表示される', () => {
      render(<WaveStructurePanel structureInfo={createMockStructureInfo()} />);

      expect(screen.getByTestId('heading-level-h1')).toBeInTheDocument();
      expect(screen.getByTestId('heading-level-h2')).toBeInTheDocument();
      expect(screen.getByTestId('heading-level-h3')).toBeInTheDocument();
    });

    it('見出しレベルに応じたインデントが適用される', () => {
      render(<WaveStructurePanel structureInfo={createMockStructureInfo()} />);

      // H1は基準位置
      const h1Item = screen.getByTestId('heading-item-0');
      expect(h1Item).toHaveStyle({ marginLeft: '0px' });

      // H2は1レベルインデント
      const h2Item = screen.getByTestId('heading-item-1');
      expect(h2Item).toHaveStyle({ marginLeft: '16px' });

      // H3は2レベルインデント
      const h3Item = screen.getByTestId('heading-item-2');
      expect(h3Item).toHaveStyle({ marginLeft: '32px' });
    });

    it('見出しスキップが警告として表示される', () => {
      const structureInfo: WaveStructureInfo = {
        headings: [
          { level: 1, text: 'タイトル' },
          { level: 3, text: 'H2をスキップ' }, // H2をスキップ
        ],
        landmarks: [],
      };

      render(<WaveStructurePanel structureInfo={structureInfo} />);

      expect(screen.getByTestId('heading-skip-warning')).toBeInTheDocument();
    });

    it('見出しがない場合は「見出しがありません」と表示される', () => {
      render(
        <WaveStructurePanel
          structureInfo={{ headings: [], landmarks: [{ type: 'main' }] }}
        />
      );

      expect(screen.getByText('見出しがありません')).toBeInTheDocument();
    });
  });

  describe('ランドマーク表示', () => {
    it('すべてのランドマークが表示される', () => {
      render(<WaveStructurePanel structureInfo={createMockStructureInfo()} />);

      expect(screen.getByText('banner')).toBeInTheDocument();
      expect(screen.getByText('navigation')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('complementary')).toBeInTheDocument();
      expect(screen.getByText('contentinfo')).toBeInTheDocument();
    });

    it('ランドマークのラベルが表示される', () => {
      render(<WaveStructurePanel structureInfo={createMockStructureInfo()} />);

      expect(screen.getByText('サイトヘッダー')).toBeInTheDocument();
      expect(screen.getByText('メインナビゲーション')).toBeInTheDocument();
      expect(screen.getByText('サイドバー')).toBeInTheDocument();
    });

    it('ラベルがないランドマークはタイプのみ表示される', () => {
      render(<WaveStructurePanel structureInfo={createMockStructureInfo()} />);

      const mainLandmark = screen.getByTestId('landmark-main');
      expect(within(mainLandmark).getByText('main')).toBeInTheDocument();
      // ラベルは表示されない
      expect(within(mainLandmark).queryByTestId('landmark-label')).not.toBeInTheDocument();
    });

    it('ランドマークがない場合は「ランドマークがありません」と表示される', () => {
      render(
        <WaveStructurePanel
          structureInfo={{ headings: [{ level: 1, text: 'タイトル' }], landmarks: [] }}
        />
      );

      expect(screen.getByText('ランドマークがありません')).toBeInTheDocument();
    });

    it('ランドマークタイプに応じたアイコンが表示される', () => {
      render(<WaveStructurePanel structureInfo={createMockStructureInfo()} />);

      // 各ランドマークにアイコンが存在することを確認
      const bannerLandmark = screen.getByTestId('landmark-banner');
      expect(within(bannerLandmark).getByTestId('landmark-icon')).toBeInTheDocument();
    });
  });

  describe('構造サマリー', () => {
    it('見出し数のサマリーが表示される', () => {
      render(<WaveStructurePanel structureInfo={createMockStructureInfo()} />);

      // 6つの見出しがある
      expect(screen.getByTestId('heading-count')).toHaveTextContent('6');
    });

    it('ランドマーク数のサマリーが表示される', () => {
      render(<WaveStructurePanel structureInfo={createMockStructureInfo()} />);

      // 5つのランドマークがある
      expect(screen.getByTestId('landmark-count')).toHaveTextContent('5');
    });

    it('見出しレベル別の内訳が表示される', () => {
      render(<WaveStructurePanel structureInfo={createMockStructureInfo()} />);

      // H1: 1, H2: 2, H3: 2, H4: 1
      expect(screen.getByTestId('heading-breakdown')).toBeInTheDocument();
    });
  });

  describe('アクセシビリティ', () => {
    it('見出し階層リストにaria-labelが設定されている', () => {
      render(<WaveStructurePanel structureInfo={createMockStructureInfo()} />);

      expect(screen.getByRole('list', { name: '見出し階層' })).toBeInTheDocument();
    });

    it('ランドマークリストにaria-labelが設定されている', () => {
      render(<WaveStructurePanel structureInfo={createMockStructureInfo()} />);

      expect(screen.getByRole('list', { name: 'ランドマーク一覧' })).toBeInTheDocument();
    });
  });

  describe('compactモード', () => {
    it('compactモードではサマリーのみ表示される', () => {
      render(
        <WaveStructurePanel
          structureInfo={createMockStructureInfo()}
          compact
        />
      );

      // サマリーは表示
      expect(screen.getByTestId('heading-count')).toBeInTheDocument();
      expect(screen.getByTestId('landmark-count')).toBeInTheDocument();

      // 詳細リストは非表示
      expect(screen.queryByText('ページタイトル')).not.toBeInTheDocument();
      expect(screen.queryByText('メインナビゲーション')).not.toBeInTheDocument();
    });
  });
});
