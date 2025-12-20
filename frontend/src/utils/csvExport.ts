import type { ToolSource, Impact } from '../types/accessibility';

/**
 * 結果種別
 */
export type ResultType = '違反' | 'パス' | '要確認';

/**
 * ViolationWithPage - 違反データにページ情報を付加した型（後方互換性のため維持）
 */
export interface ViolationWithPage {
  toolSource: ToolSource;
  pageName: string;
  pageUrl: string;
  id: string;
  description: string;
  impact?: Impact;
  nodeCount: number;
  wcagCriteria: string[];
  helpUrl: string;
}

/**
 * ResultWithPage - 全結果（違反・パス・要確認）にページ情報を付加した型
 */
export interface ResultWithPage {
  resultType: ResultType;
  toolSource: ToolSource;
  pageName: string;
  pageUrl: string;
  id: string;
  description: string;
  impact?: Impact;
  nodeCount: number;
  wcagCriteria: string[];
  helpUrl: string;
}

/**
 * CSVフィールドのエスケープ処理
 * カンマ、改行、ダブルクォートを含む場合は適切にエスケープ
 */
export function escapeForCsv(field: string): string {
  if (field === '') return '';

  const needsQuoting = field.includes(',') || field.includes('\n') || field.includes('"');

  if (needsQuoting) {
    const escaped = field.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return field;
}

/**
 * ファイル名を生成
 * 形式: accessibility-report_{domain}_{YYYY-MM-DD}.csv
 */
export function generateFileName(targetUrl: string, date: Date = new Date()): string {
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

  return `accessibility-report_${domain}_${dateStr}.csv`;
}

/**
 * 違反データからCSVコンテンツを生成
 * UTF-8 BOM付きで返す
 */
export function generateCsvContent(violations: ViolationWithPage[]): string {
  const BOM = '\uFEFF';
  const headers = ['ツール', 'ページ名', 'ページURL', 'ルールID', '説明', '影響度', 'ノード数', 'WCAG項番', 'ヘルプURL'];
  const headerRow = headers.join(',');

  if (violations.length === 0) {
    return BOM + headerRow;
  }

  const dataRows = violations.map((v) => {
    const fields = [
      escapeForCsv(v.toolSource || ''),
      escapeForCsv(v.pageName || ''),
      escapeForCsv(v.pageUrl || ''),
      escapeForCsv(v.id || ''),
      escapeForCsv(v.description || ''),
      escapeForCsv(v.impact || ''),
      String(v.nodeCount),
      escapeForCsv(v.wcagCriteria.join('; ')),
      escapeForCsv(v.helpUrl || ''),
    ];
    return fields.join(',');
  });

  return BOM + headerRow + '\n' + dataRows.join('\n');
}

/**
 * 違反データをCSVファイルとしてダウンロード（後方互換性のため維持）
 */
export function exportViolationsToCsv(violations: ViolationWithPage[], targetUrl: string): void {
  const content = generateCsvContent(violations);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = generateFileName(targetUrl);
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * 全結果（違反・パス・要確認）からCSVコンテンツを生成
 * UTF-8 BOM付きで返す
 */
export function generateAllResultsCsvContent(results: ResultWithPage[]): string {
  const BOM = '\uFEFF';
  const headers = ['結果種別', 'ツール', 'ページ名', 'ページURL', 'ルールID', '説明', '影響度', 'ノード数', 'WCAG項番', 'ヘルプURL'];
  const headerRow = headers.join(',');

  if (results.length === 0) {
    return BOM + headerRow;
  }

  const dataRows = results.map((r) => {
    const fields = [
      escapeForCsv(r.resultType),
      escapeForCsv(r.toolSource || ''),
      escapeForCsv(r.pageName || ''),
      escapeForCsv(r.pageUrl || ''),
      escapeForCsv(r.id || ''),
      escapeForCsv(r.description || ''),
      escapeForCsv(r.impact || ''),
      String(r.nodeCount),
      escapeForCsv(r.wcagCriteria.join('; ')),
      escapeForCsv(r.helpUrl || ''),
    ];
    return fields.join(',');
  });

  return BOM + headerRow + '\n' + dataRows.join('\n');
}

/**
 * 全結果をCSVファイルとしてダウンロード
 */
export function exportAllResultsToCsv(results: ResultWithPage[], targetUrl: string): void {
  const content = generateAllResultsCsvContent(results);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = generateFileName(targetUrl);
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
