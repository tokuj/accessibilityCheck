import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateCsvContent,
  generateAllResultsCsvContent,
  escapeForCsv,
  generateFileName,
  exportViolationsToCsv,
  exportAllResultsToCsv,
  generateAISummaryCsvContent,
  generateAISummaryFileName,
  exportAISummaryToCsv,
  type ViolationWithPage,
  type ResultWithPage,
} from './csvExport';
import type { DetectedIssue } from '../types/accessibility';

describe('csvExport', () => {
  describe('escapeForCsv', () => {
    it('通常のテキストはそのまま返す', () => {
      expect(escapeForCsv('Hello World')).toBe('Hello World');
    });

    it('カンマを含むテキストはダブルクォートで囲む', () => {
      expect(escapeForCsv('Hello, World')).toBe('"Hello, World"');
    });

    it('改行を含むテキストはダブルクォートで囲む', () => {
      expect(escapeForCsv('Hello\nWorld')).toBe('"Hello\nWorld"');
    });

    it('ダブルクォートを含むテキストはエスケープしてダブルクォートで囲む', () => {
      expect(escapeForCsv('Hello "World"')).toBe('"Hello ""World"""');
    });

    it('複合的な特殊文字を適切に処理する', () => {
      expect(escapeForCsv('Hello, "World"\nTest')).toBe('"Hello, ""World""\nTest"');
    });

    it('空文字列はそのまま返す', () => {
      expect(escapeForCsv('')).toBe('');
    });
  });

  describe('generateFileName', () => {
    it('URLからドメインを抽出してファイル名を生成する', () => {
      const fileName = generateFileName('https://example.com/page', new Date('2025-12-20'));
      expect(fileName).toBe('accessibility-report_example-com_2025-12-20.csv');
    });

    it('サブドメインを含むURLを適切に処理する', () => {
      const fileName = generateFileName('https://www.example.co.jp/page', new Date('2025-12-20'));
      expect(fileName).toBe('accessibility-report_www-example-co-jp_2025-12-20.csv');
    });

    it('ポート番号を含むURLを適切に処理する', () => {
      const fileName = generateFileName('http://localhost:3000/page', new Date('2025-12-20'));
      expect(fileName).toBe('accessibility-report_localhost-3000_2025-12-20.csv');
    });
  });

  describe('generateCsvContent', () => {
    const sampleViolations: ViolationWithPage[] = [
      {
        toolSource: 'axe-core',
        pageName: 'トップページ',
        pageUrl: 'https://example.com/',
        id: 'color-contrast',
        description: 'Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds',
        impact: 'serious',
        nodeCount: 3,
        wcagCriteria: ['WCAG2AA.1.4.3'],
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/color-contrast',
      },
      {
        toolSource: 'pa11y',
        pageName: 'お問い合わせ',
        pageUrl: 'https://example.com/contact',
        id: 'link-name',
        description: 'Links must have discernible text',
        impact: 'critical',
        nodeCount: 1,
        wcagCriteria: ['WCAG2AA.4.1.2', 'WCAG2AA.2.4.4'],
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/link-name',
      },
    ];

    it('UTF-8 BOMで始まるCSVを生成する', () => {
      const content = generateCsvContent(sampleViolations);
      expect(content.startsWith('\uFEFF')).toBe(true);
    });

    it('ヘッダー行を含む', () => {
      const content = generateCsvContent(sampleViolations);
      const lines = content.split('\n');
      expect(lines[0]).toBe('\uFEFFツール,ページ名,ページURL,ルールID,説明,影響度,ノード数,WCAG項番,ヘルプURL');
    });

    it('違反データを正しい形式で出力する', () => {
      const content = generateCsvContent(sampleViolations);
      const lines = content.split('\n');
      expect(lines.length).toBe(3); // ヘッダー + 2件のデータ
    });

    it('WCAG項番を複数含む場合はセミコロンで結合する', () => {
      const content = generateCsvContent(sampleViolations);
      expect(content).toContain('WCAG2AA.4.1.2; WCAG2AA.2.4.4');
    });

    it('空の配列の場合はヘッダーのみ出力する', () => {
      const content = generateCsvContent([]);
      const lines = content.split('\n');
      expect(lines.length).toBe(1);
    });
  });

  describe('exportViolationsToCsv', () => {
    let createObjectURLMock: ReturnType<typeof vi.fn>;
    let revokeObjectURLMock: ReturnType<typeof vi.fn>;
    let createElementMock: ReturnType<typeof vi.fn>;
    let appendChildMock: ReturnType<typeof vi.fn>;
    let removeChildMock: ReturnType<typeof vi.fn>;
    let clickMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.useFakeTimers();
      createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/mock-blob-url');
      revokeObjectURLMock = vi.fn();
      clickMock = vi.fn();
      appendChildMock = vi.fn();
      removeChildMock = vi.fn();

      const mockAnchor = {
        href: '',
        download: '',
        click: clickMock,
        style: {},
      };
      createElementMock = vi.fn().mockReturnValue(mockAnchor);

      // URLのスタティックメソッドのみモック、コンストラクタは維持
      const OriginalURL = globalThis.URL;
      const MockedURL = class extends OriginalURL {
        static override createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;
        static override revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;
      };
      vi.stubGlobal('URL', MockedURL);

      vi.spyOn(document, 'createElement').mockImplementation(createElementMock as typeof document.createElement);
      vi.spyOn(document.body, 'appendChild').mockImplementation(appendChildMock as typeof document.body.appendChild);
      vi.spyOn(document.body, 'removeChild').mockImplementation(removeChildMock as typeof document.body.removeChild);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('Blobを作成してダウンロードを実行する', () => {
      const violations: ViolationWithPage[] = [
        {
          toolSource: 'axe-core',
          pageName: 'トップページ',
          pageUrl: 'https://example.com/',
          id: 'color-contrast',
          description: 'Test description',
          impact: 'serious',
          nodeCount: 1,
          wcagCriteria: ['WCAG2AA.1.4.3'],
          helpUrl: 'https://example.com/help',
        },
      ];

      exportViolationsToCsv(violations, 'https://example.com/');

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();

      // 遅延解放のためタイマーを進める
      vi.advanceTimersByTime(1000);
      expect(revokeObjectURLMock).toHaveBeenCalled();
    });

    it('適切なファイル名でダウンロードする', () => {
      const violations: ViolationWithPage[] = [
        {
          toolSource: 'axe-core',
          pageName: 'トップページ',
          pageUrl: 'https://example.com/',
          id: 'color-contrast',
          description: 'Test description',
          impact: 'serious',
          nodeCount: 1,
          wcagCriteria: ['WCAG2AA.1.4.3'],
          helpUrl: 'https://example.com/help',
        },
      ];

      exportViolationsToCsv(violations, 'https://example.com/');

      const mockAnchor = createElementMock.mock.results[0].value;
      expect(mockAnchor.download).toMatch(/^accessibility-report_example-com_\d{4}-\d{2}-\d{2}\.csv$/);
    });
  });

  describe('generateAllResultsCsvContent', () => {
    const sampleResults: ResultWithPage[] = [
      {
        resultType: '違反',
        toolSource: 'axe-core',
        pageName: 'トップページ',
        pageUrl: 'https://example.com/',
        id: 'color-contrast',
        description: 'コントラスト不足',
        impact: 'serious',
        nodeCount: 3,
        wcagCriteria: ['WCAG2AA.1.4.3'],
        helpUrl: 'https://example.com/help',
      },
      {
        resultType: 'パス',
        toolSource: 'axe-core',
        pageName: 'トップページ',
        pageUrl: 'https://example.com/',
        id: 'image-alt',
        description: '画像にalt属性あり',
        impact: undefined,
        nodeCount: 5,
        wcagCriteria: ['WCAG2AA.1.1.1'],
        helpUrl: 'https://example.com/help2',
      },
      {
        resultType: '要確認',
        toolSource: 'pa11y',
        pageName: 'お問い合わせ',
        pageUrl: 'https://example.com/contact',
        id: 'form-label',
        description: 'フォームラベル確認必要',
        impact: 'moderate',
        nodeCount: 1,
        wcagCriteria: ['WCAG2AA.1.3.1'],
        helpUrl: 'https://example.com/help3',
      },
    ];

    it('UTF-8 BOMで始まるCSVを生成する', () => {
      const content = generateAllResultsCsvContent(sampleResults);
      expect(content.startsWith('\uFEFF')).toBe(true);
    });

    it('ヘッダー行に結果種別を含む', () => {
      const content = generateAllResultsCsvContent(sampleResults);
      const lines = content.split('\n');
      expect(lines[0]).toBe('\uFEFF結果種別,ツール,ページ名,ページURL,ルールID,説明,影響度,ノード数,WCAG項番,ヘルプURL');
    });

    it('結果種別が正しく出力される', () => {
      const content = generateAllResultsCsvContent(sampleResults);
      expect(content).toContain('違反');
      expect(content).toContain('パス');
      expect(content).toContain('要確認');
    });

    it('3件のデータを正しく出力する', () => {
      const content = generateAllResultsCsvContent(sampleResults);
      const lines = content.split('\n');
      expect(lines.length).toBe(4); // ヘッダー + 3件のデータ
    });

    it('空の配列の場合はヘッダーのみ出力する', () => {
      const content = generateAllResultsCsvContent([]);
      const lines = content.split('\n');
      expect(lines.length).toBe(1);
    });
  });

  describe('exportAllResultsToCsv', () => {
    let createObjectURLMock: ReturnType<typeof vi.fn>;
    let revokeObjectURLMock: ReturnType<typeof vi.fn>;
    let createElementMock: ReturnType<typeof vi.fn>;
    let appendChildMock: ReturnType<typeof vi.fn>;
    let removeChildMock: ReturnType<typeof vi.fn>;
    let clickMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.useFakeTimers();
      createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/mock-blob-url');
      revokeObjectURLMock = vi.fn();
      clickMock = vi.fn();
      appendChildMock = vi.fn();
      removeChildMock = vi.fn();

      const mockAnchor = {
        href: '',
        download: '',
        click: clickMock,
        style: {},
      };
      createElementMock = vi.fn().mockReturnValue(mockAnchor);

      // URLのスタティックメソッドのみモック、コンストラクタは維持
      const OriginalURL = globalThis.URL;
      const MockedURL = class extends OriginalURL {
        static override createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;
        static override revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;
      };
      vi.stubGlobal('URL', MockedURL);

      vi.spyOn(document, 'createElement').mockImplementation(createElementMock as typeof document.createElement);
      vi.spyOn(document.body, 'appendChild').mockImplementation(appendChildMock as typeof document.body.appendChild);
      vi.spyOn(document.body, 'removeChild').mockImplementation(removeChildMock as typeof document.body.removeChild);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('全結果をCSVとしてダウンロードできること', () => {
      const results: ResultWithPage[] = [
        {
          resultType: '違反',
          toolSource: 'axe-core',
          pageName: 'トップページ',
          pageUrl: 'https://example.com/',
          id: 'color-contrast',
          description: 'Test description',
          impact: 'serious',
          nodeCount: 1,
          wcagCriteria: ['WCAG2AA.1.4.3'],
          helpUrl: 'https://example.com/help',
        },
      ];

      exportAllResultsToCsv(results, 'https://example.com/');

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();

      // 遅延解放のためタイマーを進める
      vi.advanceTimersByTime(1000);
      expect(revokeObjectURLMock).toHaveBeenCalled();
    });
  });

  describe('generateAISummaryCsvContent', () => {
    const sampleIssues: DetectedIssue[] = [
      {
        ruleId: 'color-contrast',
        whatIsHappening: 'コントラスト比が不足しています',
        whatIsNeeded: 'テキストと背景のコントラスト比を4.5:1以上に',
        howToFix: 'CSSでcolor値を調整するか背景色を変更',
      },
      {
        ruleId: 'image-alt',
        whatIsHappening: '画像にalt属性がありません',
        whatIsNeeded: '意味のある代替テキストを設定',
        howToFix: '<img>タグにalt属性を追加する',
      },
    ];

    it('UTF-8 BOMで始まるCSVを生成する', () => {
      const content = generateAISummaryCsvContent(sampleIssues);
      expect(content.startsWith('\uFEFF')).toBe(true);
    });

    it('ヘッダー行を含む', () => {
      const content = generateAISummaryCsvContent(sampleIssues);
      const lines = content.split('\n');
      expect(lines[0]).toBe('\uFEFF問題番号,何が起きているか,修正に必要なもの,どう修正するか');
    });

    it('複数の問題を正しい形式で出力する', () => {
      const content = generateAISummaryCsvContent(sampleIssues);
      const lines = content.split('\n');
      expect(lines.length).toBe(3); // ヘッダー + 2件のデータ
    });

    it('問題番号は1から始まる連番になる', () => {
      const content = generateAISummaryCsvContent(sampleIssues);
      const lines = content.split('\n');
      expect(lines[1].startsWith('1,')).toBe(true);
      expect(lines[2].startsWith('2,')).toBe(true);
    });

    it('空の配列の場合はヘッダーのみ出力する', () => {
      const content = generateAISummaryCsvContent([]);
      const lines = content.split('\n');
      expect(lines.length).toBe(1);
      expect(lines[0]).toBe('\uFEFF問題番号,何が起きているか,修正に必要なもの,どう修正するか');
    });

    it('特殊文字（カンマ、改行、ダブルクォート）を適切にエスケープする', () => {
      const issuesWithSpecialChars: DetectedIssue[] = [
        {
          ruleId: 'test-rule',
          whatIsHappening: 'カンマ,を含む説明',
          whatIsNeeded: '改行\nを含む説明',
          howToFix: 'ダブルクォート"を含む説明',
        },
      ];
      const content = generateAISummaryCsvContent(issuesWithSpecialChars);
      expect(content).toContain('"カンマ,を含む説明"');
      expect(content).toContain('"改行\nを含む説明"');
      expect(content).toContain('"ダブルクォート""を含む説明"');
    });
  });

  describe('generateAISummaryFileName', () => {
    it('URLからドメインを抽出してファイル名を生成する', () => {
      const fileName = generateAISummaryFileName('https://example.com/page', new Date('2025-12-20'));
      expect(fileName).toBe('ai-summary_example-com_2025-12-20.csv');
    });

    it('サブドメインを含むURLを適切に処理する', () => {
      const fileName = generateAISummaryFileName('https://www.example.co.jp/page', new Date('2025-12-20'));
      expect(fileName).toBe('ai-summary_www-example-co-jp_2025-12-20.csv');
    });

    it('ポート番号を含むURLを適切に処理する', () => {
      const fileName = generateAISummaryFileName('http://localhost:3000/page', new Date('2025-12-20'));
      expect(fileName).toBe('ai-summary_localhost-3000_2025-12-20.csv');
    });

    it('無効なURLの場合はフォールバック名を使用する', () => {
      const fileName = generateAISummaryFileName('invalid-url', new Date('2025-12-20'));
      expect(fileName).toBe('ai-summary_unknown_2025-12-20.csv');
    });
  });

  describe('exportAISummaryToCsv', () => {
    let createObjectURLMock: ReturnType<typeof vi.fn>;
    let revokeObjectURLMock: ReturnType<typeof vi.fn>;
    let createElementMock: ReturnType<typeof vi.fn>;
    let appendChildMock: ReturnType<typeof vi.fn>;
    let removeChildMock: ReturnType<typeof vi.fn>;
    let clickMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.useFakeTimers();
      createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/mock-blob-url');
      revokeObjectURLMock = vi.fn();
      clickMock = vi.fn();
      appendChildMock = vi.fn();
      removeChildMock = vi.fn();

      const mockAnchor = {
        href: '',
        download: '',
        click: clickMock,
        style: {},
      };
      createElementMock = vi.fn().mockReturnValue(mockAnchor);

      const OriginalURL = globalThis.URL;
      const MockedURL = class extends OriginalURL {
        static override createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;
        static override revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;
      };
      vi.stubGlobal('URL', MockedURL);

      vi.spyOn(document, 'createElement').mockImplementation(createElementMock as typeof document.createElement);
      vi.spyOn(document.body, 'appendChild').mockImplementation(appendChildMock as typeof document.body.appendChild);
      vi.spyOn(document.body, 'removeChild').mockImplementation(removeChildMock as typeof document.body.removeChild);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('AI総評をCSVとしてダウンロードできること', () => {
      const issues: DetectedIssue[] = [
        {
          ruleId: 'color-contrast',
          whatIsHappening: 'コントラスト比が不足',
          whatIsNeeded: 'コントラスト比4.5:1以上',
          howToFix: 'CSSで色を調整',
        },
      ];

      exportAISummaryToCsv(issues, 'https://example.com/');

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();

      // 遅延解放のためタイマーを進める
      vi.advanceTimersByTime(1000);
      expect(revokeObjectURLMock).toHaveBeenCalled();
    });

    it('適切なファイル名でダウンロードする', () => {
      const issues: DetectedIssue[] = [
        {
          ruleId: 'color-contrast',
          whatIsHappening: 'コントラスト比が不足',
          whatIsNeeded: 'コントラスト比4.5:1以上',
          howToFix: 'CSSで色を調整',
        },
      ];

      exportAISummaryToCsv(issues, 'https://example.com/');

      const mockAnchor = createElementMock.mock.results[0].value;
      expect(mockAnchor.download).toMatch(/^ai-summary_example-com_\d{4}-\d{2}-\d{2}\.csv$/);
    });
  });

  describe('モバイルブラウザ互換性 - triggerDownload', () => {
    let createObjectURLMock: ReturnType<typeof vi.fn>;
    let revokeObjectURLMock: ReturnType<typeof vi.fn>;
    let createElementMock: ReturnType<typeof vi.fn>;
    let appendChildMock: ReturnType<typeof vi.fn>;
    let removeChildMock: ReturnType<typeof vi.fn>;
    let clickMock: ReturnType<typeof vi.fn>;
    let setTimeoutSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      vi.useFakeTimers();
      createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/mock-blob-url');
      revokeObjectURLMock = vi.fn();
      clickMock = vi.fn();
      appendChildMock = vi.fn();
      removeChildMock = vi.fn();

      const mockAnchor = {
        href: '',
        download: '',
        click: clickMock,
        style: {},
      };
      createElementMock = vi.fn().mockReturnValue(mockAnchor);

      const OriginalURL = globalThis.URL;
      const MockedURL = class extends OriginalURL {
        static override createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;
        static override revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;
      };
      vi.stubGlobal('URL', MockedURL);

      vi.spyOn(document, 'createElement').mockImplementation(createElementMock as typeof document.createElement);
      vi.spyOn(document.body, 'appendChild').mockImplementation(appendChildMock as typeof document.body.appendChild);
      vi.spyOn(document.body, 'removeChild').mockImplementation(removeChildMock as typeof document.body.removeChild);

      setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('Safari/iOS対応のためにBlob URL解放を遅延させること', async () => {
      const issues: DetectedIssue[] = [
        {
          ruleId: 'color-contrast',
          whatIsHappening: 'コントラスト比が不足',
          whatIsNeeded: 'コントラスト比4.5:1以上',
          howToFix: 'CSSで色を調整',
        },
      ];

      exportAISummaryToCsv(issues, 'https://example.com/');

      // clickは即座に呼ばれる
      expect(clickMock).toHaveBeenCalled();

      // URL解放は遅延される（setTimeoutが呼ばれる）
      expect(setTimeoutSpy).toHaveBeenCalled();

      // 遅延前はrevokeObjectURLがまだ呼ばれていない
      expect(revokeObjectURLMock).not.toHaveBeenCalled();

      // タイマーを進める
      vi.advanceTimersByTime(1000);

      // 遅延後にrevokeObjectURLが呼ばれる
      expect(revokeObjectURLMock).toHaveBeenCalled();
    });
  });
});
