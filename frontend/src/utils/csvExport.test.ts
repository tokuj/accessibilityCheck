import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateCsvContent,
  escapeForCsv,
  generateFileName,
  exportViolationsToCsv,
  type ViolationWithPage,
} from './csvExport';

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
      const OriginalURL = URL;
      vi.stubGlobal('URL', class extends OriginalURL {
        static createObjectURL = createObjectURLMock;
        static revokeObjectURL = revokeObjectURLMock;
      });

      vi.spyOn(document, 'createElement').mockImplementation(createElementMock);
      vi.spyOn(document.body, 'appendChild').mockImplementation(appendChildMock);
      vi.spyOn(document.body, 'removeChild').mockImplementation(removeChildMock);
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
});
