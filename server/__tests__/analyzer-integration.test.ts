/**
 * analyzer.ts 統合テスト
 *
 * Requirements: 7.1, 7.4, 9.4
 * - タイムアウトエラーメッセージの検証
 * - 広告ブロック設定が適用されることの検証
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Playwrightモック
const mockPage = {
  setDefaultTimeout: vi.fn(),
  route: vi.fn().mockResolvedValue(undefined),
  goto: vi.fn(),
  waitForLoadState: vi.fn().mockResolvedValue(undefined),
  screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
  url: vi.fn().mockReturnValue('https://example.com'),
  title: vi.fn().mockResolvedValue('Test Page Title'),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

// axe-coreモック
vi.mock('../analyzers/axe', () => ({
  analyzeWithAxe: vi.fn().mockResolvedValue({
    violations: [],
    passes: [],
    incomplete: [],
    duration: 1000,
  }),
  AXE_VERSION: '4.11.0',
}));

// Pa11yモック
vi.mock('../analyzers/pa11y', () => ({
  analyzeWithPa11y: vi.fn().mockResolvedValue({
    violations: [],
    passes: [],
    incomplete: [],
    duration: 500,
  }),
  PA11Y_VERSION: '9.0.1',
}));

// Lighthouseモック
vi.mock('../analyzers/lighthouse', () => ({
  analyzeWithLighthouse: vi.fn().mockResolvedValue({
    violations: [],
    passes: [],
    incomplete: [],
    scores: {
      performance: 90,
      accessibility: 85,
      bestPractices: 80,
      seo: 75,
    },
    duration: 2000,
  }),
  LIGHTHOUSE_VERSION: '13.0.1',
}));

// AuthManagerモック
vi.mock('../auth/manager', () => {
  return {
    AuthManager: class MockAuthManager {
      requiresAuth() { return false; }
      authenticate() { return Promise.resolve({ success: true }); }
      getStorageState() { return null; }
      getHttpCredentials() { return null; }
      getHeaders() { return {}; }
      setStorageState() {}
    },
  };
});

// GeminiServiceモック
vi.mock('../services/gemini', () => ({
  GeminiService: {
    generateAISummary: vi.fn().mockResolvedValue({
      success: false,
      error: { message: 'Skipped in test' },
    }),
  },
  generateFallbackSummary: vi.fn().mockReturnValue({
    overallAssessment: 'テスト用フォールバック総評',
    detectedIssues: [],
    prioritizedImprovements: [],
    specificRecommendations: [],
    impactSummary: { critical: 0, serious: 0, moderate: 0, minor: 0 },
    generatedAt: new Date().toISOString(),
    isFallback: true,
  }),
}));

describe('analyzer.ts 統合テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトでは正常に動作
    mockPage.goto.mockResolvedValue(undefined);
    mockPage.url.mockReturnValue('https://example.com');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('広告ブロック設定の適用（Requirement 5.1, 9.4）', () => {
    it('ページ作成後にsetupAdBlockingが呼び出される', async () => {
      const { analyzeUrl } = await import('../analyzer');

      await analyzeUrl('https://example.com');

      // page.route() が呼び出されていることを確認（setupAdBlockingが実行された証拠）
      expect(mockPage.route).toHaveBeenCalled();
    });

    it('デフォルトタイムアウトが設定される（Req 1.4）', async () => {
      const { analyzeUrl } = await import('../analyzer');

      await analyzeUrl('https://example.com');

      // page.setDefaultTimeout() が呼び出されていることを確認
      expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(120000);
    });

    it('ページ読み込みタイムアウトが90秒に設定される（Req 4.4）', async () => {
      const { analyzeUrl } = await import('../analyzer');

      await analyzeUrl('https://example.com');

      // page.goto() が呼び出されていることを確認
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          timeout: 90000,
        })
      );
    });
  });

  describe('タイムアウトエラーメッセージ（Requirement 7.1, 7.4）', () => {
    it('ページ読み込みタイムアウト時に詳細なエラーメッセージを返す', async () => {
      // TimeoutErrorをシミュレート
      const timeoutError = new Error('Timeout 90000ms exceeded');
      timeoutError.name = 'TimeoutError';
      mockPage.goto.mockRejectedValue(timeoutError);

      const { analyzeUrl } = await import('../analyzer');

      await expect(analyzeUrl('https://slow-site.example.com')).rejects.toThrow(/ページの読み込み.*タイムアウト.*90秒/);
    });

    it('タイムアウトエラーに対象URLが含まれる', async () => {
      const timeoutError = new Error('Timeout 90000ms exceeded');
      timeoutError.name = 'TimeoutError';
      mockPage.goto.mockRejectedValue(timeoutError);

      const { analyzeUrl } = await import('../analyzer');

      await expect(analyzeUrl('https://ads-heavy-site.example.com')).rejects.toThrow(/ads-heavy-site\.example\.com/);
    });
  });

  describe('分析完了（Requirement 9.4）', () => {
    it('正常に分析が完了し、レポートを返す', async () => {
      const { analyzeUrl } = await import('../analyzer');

      const report = await analyzeUrl('https://example.com');

      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('pages');
      expect(report).toHaveProperty('toolsUsed');
      expect(report.toolsUsed).toHaveLength(3);
    });

    it('3つのツールすべてが使用される', async () => {
      const { analyzeUrl } = await import('../analyzer');

      const report = await analyzeUrl('https://example.com');

      const toolNames = report.toolsUsed.map((t) => t.name);
      expect(toolNames).toContain('axe-core');
      expect(toolNames).toContain('pa11y');
      expect(toolNames).toContain('lighthouse');
    });

    it('スクリーンショットがbase64形式で含まれる', async () => {
      const { analyzeUrl } = await import('../analyzer');

      const report = await analyzeUrl('https://example.com');

      expect(report.screenshot).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('エラーハンドリング（Requirement 7.1）', () => {
    it('Execution context was destroyedエラーを適切に処理する', async () => {
      mockPage.goto.mockRejectedValue(new Error('Execution context was destroyed'));

      const { analyzeUrl } = await import('../analyzer');

      await expect(analyzeUrl('https://example.com')).rejects.toThrow(/リダイレクト/);
    });

    it('Target closedエラーを適切に処理する', async () => {
      mockPage.goto.mockRejectedValue(new Error('Target closed'));

      const { analyzeUrl } = await import('../analyzer');

      await expect(analyzeUrl('https://example.com')).rejects.toThrow(/接続が切断/);
    });
  });
});
