# Research & Design Decisions

## Summary

- **Feature**: `download-enhancements`
- **Discovery Scope**: Extension（既存システムへの機能追加）
- **Key Findings**:
  - 既存の`csvExport.ts`にCSV生成・ダウンロードパターンが確立されており、AI総評CSV出力は同パターンで実装可能
  - PDF生成にはhtml2pdf.jsが最適（html2canvas + jsPDFのラッパーで実装が簡潔）
  - 背景除外は`html2canvas`のオプションまたはCSS印刷スタイルで対応可能

## Research Log

### PDF生成ライブラリの選定

- **Context**: レポート全体をPDFでダウンロードする機能の実装方法を調査
- **Sources Consulted**:
  - [npm trends: html2canvas vs html2pdf.js vs jspdf](https://npmtrends.com/html2canvas-vs-html2pdf.js-vs-js-html2pdf-vs-jspdf)
  - [JS Pdf Generation libraries comparison (2025)](https://dmitriiboikov.com/posts/2025/01/pdf-generation-comarison/)
  - [html2pdf.js公式ドキュメント](https://ekoopmans.github.io/html2pdf.js/)
  - [Creating PDFs from HTML + CSS in JavaScript - Joyfill](https://joyfill.io/blog/creating-pdfs-from-html-css-in-javascript-what-actually-works)
- **Findings**:
  - html2pdf.js: html2canvas + jsPDFのラッパー、シンプルなAPI、週350K+ダウンロード
  - jsPDF単体: 週約400万ダウンロード、ベクターテキスト対応だがCSSサポートに制限
  - html2canvas: 週約520万ダウンロード、DOMを画像化する主要ライブラリ
  - **制限事項**: html2canvas方式はテキストが画像化されるため検索・選択不可
- **Implications**:
  - html2pdf.jsを採用（API簡潔、依存管理不要）
  - 高DPI対応に`scale: 2`オプションを使用
  - ファイルサイズは増加するが、本用途（監査レポート保存）では許容範囲

### 背景色除外の実装方法

- **Context**: 要件2.3「背景色を除外し、印刷に適したスタイルで出力」の実現方法
- **Sources Consulted**:
  - [html2canvas Options](https://html2canvas.hertzen.com/configuration)
  - [Generating PDFs from HTML in React - Medium](https://medium.com/@saidularefin8/generating-pdfs-from-html-in-a-react-application-with-html2canvas-and-jspdf-d46c5785eff2)
- **Findings**:
  - html2canvasの`backgroundColor: null`オプションで透明背景に設定可能
  - CSS `@media print`でPDF生成時のみ背景を非表示にする方法も有効
  - PDF生成前にDOM要素に一時的なクラスを付与してスタイル変更する方法
- **Implications**:
  - `backgroundColor: '#ffffff'`で白背景を指定（印刷向け）
  - グリッド背景コンポーネント（`GridBackground.tsx`）はPDF生成時に除外

### 既存CSVエクスポートパターンの分析

- **Context**: AI総評CSVダウンロード機能の設計に向けた既存コード調査
- **Sources Consulted**: `frontend/src/utils/csvExport.ts`（コードベース内）
- **Findings**:
  - `escapeForCsv()`: カンマ・改行・ダブルクォートのエスケープ処理実装済み
  - `generateFileName()`: ドメイン・日付ベースのファイル名生成パターン
  - `exportAllResultsToCsv()`: Blob生成→aタグ経由のダウンロードパターン
  - UTF-8 BOM対応済み（`\uFEFF`）
- **Implications**:
  - 同ファイルにAI総評専用関数を追加するのが最も一貫性がある
  - 新規ファイル不要、既存パターンを踏襲

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| html2pdf.js | html2canvas + jsPDFの統合ラッパー | APIシンプル、依存管理不要、ドキュメント充実 | テキスト検索不可、ファイルサイズ大 | **採用** |
| jsPDF + html2canvas個別 | 2ライブラリを直接使用 | 細かい制御可能 | 設定複雑、バージョン互換性管理必要 | 不採用 |
| react-to-pdf | Reactコンポーネント専用 | React統合が簡単 | ドキュメント少、カスタマイズ制限 | 不採用 |

## Design Decisions

### Decision: PDF生成ライブラリ選定

- **Context**: クライアントサイドでHTMLをPDFに変換する必要がある
- **Alternatives Considered**:
  1. html2pdf.js - html2canvas + jsPDFのラッパー
  2. jsPDF + html2canvas - 個別ライブラリの組み合わせ
  3. react-to-pdf - React専用ライブラリ
- **Selected Approach**: html2pdf.js
- **Rationale**:
  - APIが簡潔（`html2pdf().from(element).save()`）
  - 依存関係を内部で管理
  - 週350K+ダウンロードで安定
- **Trade-offs**:
  - ✅ 実装工数削減
  - ✅ バージョン互換性問題を回避
  - ❌ 個別ライブラリより細かい制御が難しい場合あり
- **Follow-up**: 大きなレポート（4ページ以上）でのメモリ使用量を実装時に検証

### Decision: 背景除外の実装方式

- **Context**: 印刷向けに背景色を除外する必要がある
- **Alternatives Considered**:
  1. html2canvasの`backgroundColor`オプション
  2. CSS `@media print`
  3. PDF生成時の一時的なDOM操作
- **Selected Approach**: html2canvasの`backgroundColor: '#ffffff'`オプション + 専用CSSクラス
- **Rationale**:
  - 最も影響範囲が小さい
  - 既存UIに変更不要
  - GridBackground等の装飾要素はref外に配置
- **Trade-offs**:
  - ✅ シンプルな実装
  - ❌ DOM構造に若干の制約

### Decision: AI総評CSVのファイル配置

- **Context**: 新しいCSV出力関数をどこに配置するか
- **Alternatives Considered**:
  1. 既存の`csvExport.ts`に追加
  2. 新規`aiSummaryCsvExport.ts`を作成
- **Selected Approach**: 既存の`csvExport.ts`に追加
- **Rationale**:
  - 単一責務（CSV出力）の範囲内
  - 既存のヘルパー関数（`escapeForCsv`, `generateFileName`）を再利用可能
  - ファイル数を増やさない
- **Trade-offs**:
  - ✅ コードの一貫性維持
  - ❌ ファイルサイズが若干増加（許容範囲）

## Risks & Mitigations

- **大きなレポートでのメモリ不足** — PDF生成前に不要な要素を非表示にし、生成後に復元。進捗インジケーターで待機を促す
- **モバイルブラウザでのPDFダウンロード** — Blob URL方式が標準的に動作。Safari対応として`URL.revokeObjectURL`のタイミングを調整
- **Base64画像（スクリーンショット）のPDF埋め込み** — html2canvasがBase64をそのまま処理可能であることを確認済み

## References

- [html2pdf.js公式](https://ekoopmans.github.io/html2pdf.js/) — 基本的な使用方法とオプション
- [npm trends比較](https://npmtrends.com/html2canvas-vs-html2pdf.js-vs-js-html2pdf-vs-jspdf) — ダウンロード数比較
- [Generating PDFs from HTML in React - Medium](https://medium.com/@saidularefin8/generating-pdfs-from-html-in-a-react-application-with-html2canvas-and-jspdf-d46c5785eff2) — ベストプラクティス
