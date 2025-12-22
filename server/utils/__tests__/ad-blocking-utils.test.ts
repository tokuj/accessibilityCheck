/**
 * AdBlockingUtils テスト
 *
 * Playwrightページへの広告ブロック設定機能をテスト
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Page, Route, Request } from 'playwright';
import { setupAdBlocking, type AdBlockingResult } from '../ad-blocking-utils';

// Playwrightのモック型
interface MockRoute {
  abort: ReturnType<typeof vi.fn>;
  continue: ReturnType<typeof vi.fn>;
}

interface MockRequest {
  url: ReturnType<typeof vi.fn>;
}

describe('AdBlockingUtils', () => {
  let mockPage: {
    route: ReturnType<typeof vi.fn>;
  };
  let capturedRouteHandler: ((route: Route, request: Request) => Promise<void>) | null;
  let capturedRoutePattern: string | RegExp | null;

  beforeEach(() => {
    capturedRouteHandler = null;
    capturedRoutePattern = null;

    mockPage = {
      route: vi.fn().mockImplementation((pattern, handler) => {
        capturedRoutePattern = pattern;
        capturedRouteHandler = handler;
        return Promise.resolve();
      }),
    };
  });

  describe('setupAdBlocking', () => {
    it('page.route()ハンドラを設定する', async () => {
      const result = await setupAdBlocking(mockPage as unknown as Page);

      expect(mockPage.route).toHaveBeenCalled();
      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.blockedCount).toBe(0); // 初期状態
    });

    it('デフォルトの広告URLパターンをログに出力する', async () => {
      const result = await setupAdBlocking(mockPage as unknown as Page);

      // デフォルトパターンが含まれていることを確認
      expect(result.patterns).toContain('*doubleclick.net/*');
      expect(result.patterns).toContain('*googlesyndication.com/*');
    });

    it('広告URLへのリクエストをabortする', async () => {
      await setupAdBlocking(mockPage as unknown as Page);

      // ハンドラが設定されていることを確認
      expect(capturedRouteHandler).not.toBeNull();

      // 広告URLをシミュレート
      const mockRoute: MockRoute = {
        abort: vi.fn().mockResolvedValue(undefined),
        continue: vi.fn().mockResolvedValue(undefined),
      };
      const mockRequest: MockRequest = {
        url: vi.fn().mockReturnValue('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'),
      };

      await capturedRouteHandler!(mockRoute as unknown as Route, mockRequest as unknown as Request);

      expect(mockRoute.abort).toHaveBeenCalled();
      expect(mockRoute.continue).not.toHaveBeenCalled();
    });

    it('通常URLへのリクエストを継続する', async () => {
      await setupAdBlocking(mockPage as unknown as Page);

      const mockRoute: MockRoute = {
        abort: vi.fn().mockResolvedValue(undefined),
        continue: vi.fn().mockResolvedValue(undefined),
      };
      const mockRequest: MockRequest = {
        url: vi.fn().mockReturnValue('https://example.com/main.js'),
      };

      await capturedRouteHandler!(mockRoute as unknown as Route, mockRequest as unknown as Request);

      expect(mockRoute.continue).toHaveBeenCalled();
      expect(mockRoute.abort).not.toHaveBeenCalled();
    });

    it('カスタムパターンを追加できる', async () => {
      const customPatterns = ['*custom-ads.com/*', '*my-tracking.net/*'];
      const result = await setupAdBlocking(mockPage as unknown as Page, {
        customPatterns,
      });

      expect(result.patterns).toContain('*custom-ads.com/*');
      expect(result.patterns).toContain('*my-tracking.net/*');
    });

    it('メディアファイルブロックオプションが有効な場合、メディアURLをabortする', async () => {
      await setupAdBlocking(mockPage as unknown as Page, {
        blockMedia: true,
      });

      const mockRoute: MockRoute = {
        abort: vi.fn().mockResolvedValue(undefined),
        continue: vi.fn().mockResolvedValue(undefined),
      };
      const mockRequest: MockRequest = {
        url: vi.fn().mockReturnValue('https://example.com/video.mp4'),
      };

      await capturedRouteHandler!(mockRoute as unknown as Route, mockRequest as unknown as Request);

      expect(mockRoute.abort).toHaveBeenCalled();
    });

    it('メディアファイルブロックがデフォルトで無効', async () => {
      await setupAdBlocking(mockPage as unknown as Page);

      const mockRoute: MockRoute = {
        abort: vi.fn().mockResolvedValue(undefined),
        continue: vi.fn().mockResolvedValue(undefined),
      };
      const mockRequest: MockRequest = {
        url: vi.fn().mockReturnValue('https://example.com/video.mp4'),
      };

      await capturedRouteHandler!(mockRoute as unknown as Route, mockRequest as unknown as Request);

      // メディアブロックが無効なので、continueされる
      expect(mockRoute.continue).toHaveBeenCalled();
    });

    it('ブロックしたリクエスト数をカウントする', async () => {
      const result = await setupAdBlocking(mockPage as unknown as Page);

      // ブロック対象リクエストをシミュレート
      const mockRoute: MockRoute = {
        abort: vi.fn().mockResolvedValue(undefined),
        continue: vi.fn().mockResolvedValue(undefined),
      };

      // 3つの広告リクエストをシミュレート
      const adUrls = [
        'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
        'https://ad.doubleclick.net/ddm/trackclk',
        'https://googleads.g.doubleclick.net/pagead/viewthroughconversion',
      ];

      for (const adUrl of adUrls) {
        const mockRequest: MockRequest = {
          url: vi.fn().mockReturnValue(adUrl),
        };
        await capturedRouteHandler!(mockRoute as unknown as Route, mockRequest as unknown as Request);
      }

      // ブロックカウントはresultオブジェクト経由で取得（クロージャで更新）
      // 実装ではgetBlockedCount()メソッドを提供するか、resultを更新する設計が必要
      expect(mockRoute.abort).toHaveBeenCalledTimes(3);
    });

    it('doubleclick.netのURLをブロックする', async () => {
      await setupAdBlocking(mockPage as unknown as Page);

      const mockRoute: MockRoute = {
        abort: vi.fn().mockResolvedValue(undefined),
        continue: vi.fn().mockResolvedValue(undefined),
      };
      const mockRequest: MockRequest = {
        url: vi.fn().mockReturnValue('https://ad.doubleclick.net/tracking/123'),
      };

      await capturedRouteHandler!(mockRoute as unknown as Route, mockRequest as unknown as Request);

      expect(mockRoute.abort).toHaveBeenCalled();
    });

    it('amazon-adsystem.comのURLをブロックする', async () => {
      await setupAdBlocking(mockPage as unknown as Page);

      const mockRoute: MockRoute = {
        abort: vi.fn().mockResolvedValue(undefined),
        continue: vi.fn().mockResolvedValue(undefined),
      };
      const mockRequest: MockRequest = {
        url: vi.fn().mockReturnValue('https://aax-us-east.amazon-adsystem.com/e/dtb/bid'),
      };

      await capturedRouteHandler!(mockRoute as unknown as Route, mockRequest as unknown as Request);

      expect(mockRoute.abort).toHaveBeenCalled();
    });

    it('webm動画ファイルをブロックオプション有効時にブロックする', async () => {
      await setupAdBlocking(mockPage as unknown as Page, {
        blockMedia: true,
      });

      const mockRoute: MockRoute = {
        abort: vi.fn().mockResolvedValue(undefined),
        continue: vi.fn().mockResolvedValue(undefined),
      };
      const mockRequest: MockRequest = {
        url: vi.fn().mockReturnValue('https://cdn.example.com/large-video.webm?quality=high'),
      };

      await capturedRouteHandler!(mockRoute as unknown as Route, mockRequest as unknown as Request);

      expect(mockRoute.abort).toHaveBeenCalled();
    });
  });

  describe('AdBlockingResult', () => {
    it('ブロック対象パターンが正しく返される', async () => {
      const result = await setupAdBlocking(mockPage as unknown as Page);

      expect(result.patterns).toBeDefined();
      expect(Array.isArray(result.patterns)).toBe(true);
      expect(result.patterns.length).toBeGreaterThan(0);
    });

    it('blockedCountの初期値が0である', async () => {
      const result = await setupAdBlocking(mockPage as unknown as Page);

      expect(result.blockedCount).toBe(0);
    });
  });
});
