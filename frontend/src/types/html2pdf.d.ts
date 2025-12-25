declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: {
      type?: 'jpeg' | 'png' | 'webp';
      quality?: number;
    };
    enableLinks?: boolean;
    html2canvas?: {
      scale?: number;
      useCORS?: boolean;
      logging?: boolean;
      backgroundColor?: string;
      width?: number;
      height?: number;
      windowWidth?: number;
      windowHeight?: number;
    };
    jsPDF?: {
      unit?: 'pt' | 'mm' | 'cm' | 'in' | 'px';
      format?: 'a4' | 'letter' | 'legal' | [number, number];
      orientation?: 'portrait' | 'landscape';
    };
    pagebreak?: {
      mode?: 'avoid-all' | 'css' | 'legacy' | string[];
      before?: string | string[];
      after?: string | string[];
      avoid?: string | string[];
    };
  }

  interface Html2PdfWorker {
    set(options: Html2PdfOptions): Html2PdfWorker;
    from(element: HTMLElement | string): Html2PdfWorker;
    toContainer(): Html2PdfWorker;
    toCanvas(): Html2PdfWorker;
    toImg(): Html2PdfWorker;
    toPdf(): Html2PdfWorker;
    save(filename?: string): Promise<void>;
    output(type: 'blob'): Promise<Blob>;
    output(type: 'datauristring'): Promise<string>;
    output(type: 'arraybuffer'): Promise<ArrayBuffer>;
    output(type: 'bloburl'): Promise<string>;
    then<T>(callback: (pdf: unknown) => T): Promise<T>;
    catch(callback: (error: Error) => void): Html2PdfWorker;
  }

  function html2pdf(): Html2PdfWorker;
  function html2pdf(
    element: HTMLElement | string,
    options?: Html2PdfOptions
  ): Html2PdfWorker;

  export = html2pdf;
}
