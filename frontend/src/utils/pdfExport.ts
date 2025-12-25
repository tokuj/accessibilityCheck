import html2pdf from 'html2pdf.js';

export interface PdfExportOptions {
  filename: string;
  margin?: number;
  imageQuality?: number;
  scale?: number;
}

export interface PdfExportResult {
  success: boolean;
  error?: string;
}

/**
 * PDF用のファイル名を生成
 * 形式: a11y-report_{domain}_{YYYY-MM-DD}.pdf
 */
export function generatePdfFileName(targetUrl: string, date: Date = new Date()): string {
  let domain: string;
  try {
    const url = new URL(targetUrl);
    domain = url.host.replace(/[.:]/g, '-');
  } catch {
    domain = 'unknown';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  return `a11y-report_${domain}_${dateStr}.pdf`;
}

/**
 * DOM要素をPDFとしてダウンロード
 * @param element - PDF化対象のHTML要素
 * @param options - PDF出力オプション
 * @returns Promise<PdfExportResult>
 */
export async function exportReportToPdf(
  element: HTMLElement,
  options: PdfExportOptions
): Promise<PdfExportResult> {
  if (!element) {
    return {
      success: false,
      error: 'PDF生成対象の要素が見つかりません',
    };
  }

  try {
    const opt = {
      margin: options.margin ?? 10,
      filename: options.filename,
      image: { type: 'jpeg' as const, quality: options.imageQuality ?? 0.95 },
      html2canvas: {
        scale: options.scale ?? 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      },
      jsPDF: {
        unit: 'mm' as const,
        format: 'a4' as const,
        orientation: 'landscape' as const,
      },
    };

    await html2pdf().set(opt).from(element).save();

    return { success: true };
  } catch (error) {
    console.error('PDF生成エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'PDF生成中にエラーが発生しました',
    };
  }
}
