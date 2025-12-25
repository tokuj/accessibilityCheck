import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generatePdfFileName, exportReportToPdf } from './pdfExport';

describe('pdfExport', () => {
  describe('generatePdfFileName', () => {
    it('URLからドメインを抽出してファイル名を生成する', () => {
      const fileName = generatePdfFileName('https://example.com/page', new Date('2025-12-20'));
      expect(fileName).toBe('a11y-report_example-com_2025-12-20.pdf');
    });

    it('サブドメインを含むURLを適切に処理する', () => {
      const fileName = generatePdfFileName('https://www.example.co.jp/page', new Date('2025-12-20'));
      expect(fileName).toBe('a11y-report_www-example-co-jp_2025-12-20.pdf');
    });

    it('ポート番号を含むURLを適切に処理する', () => {
      const fileName = generatePdfFileName('http://localhost:3000/page', new Date('2025-12-20'));
      expect(fileName).toBe('a11y-report_localhost-3000_2025-12-20.pdf');
    });

    it('無効なURLの場合はフォールバック名を使用する', () => {
      const fileName = generatePdfFileName('invalid-url', new Date('2025-12-20'));
      expect(fileName).toBe('a11y-report_unknown_2025-12-20.pdf');
    });

    it('日付引数を省略した場合は現在日時を使用する', () => {
      const fileName = generatePdfFileName('https://example.com/');
      expect(fileName).toMatch(/^a11y-report_example-com_\d{4}-\d{2}-\d{2}\.pdf$/);
    });
  });

  describe('exportReportToPdf', () => {
    let mockHtml2pdf: ReturnType<typeof vi.fn>;
    let mockWorker: {
      set: ReturnType<typeof vi.fn>;
      from: ReturnType<typeof vi.fn>;
      save: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockWorker = {
        set: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        save: vi.fn().mockResolvedValue(undefined),
      };
      mockHtml2pdf = vi.fn().mockReturnValue(mockWorker);

      vi.doMock('html2pdf.js', () => ({
        default: mockHtml2pdf,
      }));
    });

    afterEach(() => {
      vi.clearAllMocks();
      vi.resetModules();
    });

    it('無効な要素参照の場合はエラー結果を返す', async () => {
      const result = await exportReportToPdf(null as unknown as HTMLElement, {
        filename: 'test.pdf',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('PDF生成対象の要素が見つかりません');
    });

    it('undefinedの要素参照の場合はエラー結果を返す', async () => {
      const result = await exportReportToPdf(undefined as unknown as HTMLElement, {
        filename: 'test.pdf',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('PDF生成対象の要素が見つかりません');
    });
  });
});
