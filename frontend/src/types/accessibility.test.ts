/**
 * @file 複数URL分析機能に関する型定義のテスト
 *
 * タスク1.1: PageProgressEventの型定義テスト
 * タスク1.2: AnalysisState型の定義テスト
 */

import { describe, it, expect } from 'vitest';
import type {
  PageProgressEvent,
  SSEEvent,
  AnalysisState,
} from './accessibility';

describe('PageProgressEvent型定義', () => {
  it('全てのフィールドが正しく定義されていること', () => {
    const event: PageProgressEvent = {
      type: 'page_progress',
      pageIndex: 0,
      totalPages: 4,
      pageUrl: 'https://example.com',
      pageTitle: 'Example Page',
      status: 'started',
    };

    expect(event.type).toBe('page_progress');
    expect(event.pageIndex).toBe(0);
    expect(event.totalPages).toBe(4);
    expect(event.pageUrl).toBe('https://example.com');
    expect(event.pageTitle).toBe('Example Page');
    expect(event.status).toBe('started');
  });

  it('statusが全ての有効な値を受け入れること', () => {
    const statuses = ['started', 'analyzing', 'completed', 'failed'] as const;

    statuses.forEach((status) => {
      const event: PageProgressEvent = {
        type: 'page_progress',
        pageIndex: 1,
        totalPages: 2,
        pageUrl: 'https://test.com',
        pageTitle: 'Test',
        status,
      };
      expect(event.status).toBe(status);
    });
  });

  it('SSEEventユニオン型にPageProgressEventが含まれること', () => {
    const event: SSEEvent = {
      type: 'page_progress',
      pageIndex: 0,
      totalPages: 4,
      pageUrl: 'https://example.com',
      pageTitle: 'Example Page',
      status: 'analyzing',
    };

    expect(event.type).toBe('page_progress');
  });
});

describe('AnalysisState型定義', () => {
  it('全てのフィールドが正しく定義されていること', () => {
    const state: AnalysisState = {
      targetUrls: ['https://example.com', 'https://example.com/about'],
      currentPageIndex: 0,
      completedPageIndexes: [],
      currentPageTitle: 'Example Page',
    };

    expect(state.targetUrls).toHaveLength(2);
    expect(state.currentPageIndex).toBe(0);
    expect(state.completedPageIndexes).toEqual([]);
    expect(state.currentPageTitle).toBe('Example Page');
  });

  it('複数のページが完了した状態を表現できること', () => {
    const state: AnalysisState = {
      targetUrls: [
        'https://example.com',
        'https://example.com/about',
        'https://example.com/contact',
        'https://example.com/products',
      ],
      currentPageIndex: 2,
      completedPageIndexes: [0, 1],
      currentPageTitle: 'Contact Us',
    };

    expect(state.targetUrls).toHaveLength(4);
    expect(state.currentPageIndex).toBe(2);
    expect(state.completedPageIndexes).toEqual([0, 1]);
  });

  it('全てのページが完了した状態を表現できること', () => {
    const state: AnalysisState = {
      targetUrls: [
        'https://example.com',
        'https://example.com/about',
      ],
      currentPageIndex: 2, // 範囲外（全完了）
      completedPageIndexes: [0, 1],
      currentPageTitle: '',
    };

    expect(state.completedPageIndexes).toHaveLength(2);
    expect(state.completedPageIndexes).toEqual([0, 1]);
  });
});
